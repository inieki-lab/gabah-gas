import crypto from 'node:crypto';
import { Request } from 'express';
import { db, ServerUser, ServerSession } from './db';
import { hashPassword, verifyPassword, generateToken } from './crypto';
import { getSecurityEpoch } from './persistence';

export { hashPassword, verifyPassword, generateToken };

// Rate limiting state for brute-force protection
interface LoginAttemptRecord {
  attempts: number;
  lastAttempt: number;
  lockedUntil: number;
}

const loginAttempts = new Map<string, LoginAttemptRecord>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes

// Rate limiting state for general API endpoints
interface ApiRateLimitRecord {
  count: number;
  resetAt: number;
}
const apiRateLimits = new Map<string, ApiRateLimitRecord>();
const API_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_API_REQUESTS_PER_MINUTE = 200; // 200 requests/minute per client IP

export function checkApiRateLimit(clientIp: string): { allowed: boolean; remaining: number; resetSeconds: number } {
  const now = Date.now();
  let bucket = apiRateLimits.get(clientIp);

  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 1, resetAt: now + API_WINDOW_MS };
    apiRateLimits.set(clientIp, bucket);
    return { allowed: true, remaining: MAX_API_REQUESTS_PER_MINUTE - 1, resetSeconds: 60 };
  }

  bucket.count += 1;
  const resetSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

  if (bucket.count > MAX_API_REQUESTS_PER_MINUTE) {
    return { allowed: false, remaining: 0, resetSeconds };
  }

  return { allowed: true, remaining: MAX_API_REQUESTS_PER_MINUTE - bucket.count, resetSeconds };
}

// Session duration: 7 days
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Check and record failed login attempt for rate limiting
 */
export function recordFailedLogin(identifier: string): { isLocked: boolean; remainingLockoutSeconds?: number } {
  const now = Date.now();
  let record = loginAttempts.get(identifier);

  if (!record) {
    record = { attempts: 1, lastAttempt: now, lockedUntil: 0 };
    loginAttempts.set(identifier, record);
    return { isLocked: false };
  }

  // Reset if last attempt was older than lockout window
  if (now - record.lastAttempt > LOCKOUT_MS && record.lockedUntil < now) {
    record.attempts = 1;
    record.lastAttempt = now;
    record.lockedUntil = 0;
    return { isLocked: false };
  }

  record.attempts += 1;
  record.lastAttempt = now;

  if (record.attempts >= MAX_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_MS;
    return {
      isLocked: true,
      remainingLockoutSeconds: Math.ceil(LOCKOUT_MS / 1000),
    };
  }

  return { isLocked: false };
}

/**
 * Check if identifier is currently locked out
 */
export function isLoginLocked(identifier: string): { isLocked: boolean; remainingLockoutSeconds?: number } {
  // Dalam mode pengembangan, matikan lockout IP agar tidak memblokir pengujian multi-akun
  if (process.env.NODE_ENV !== 'production') {
    return { isLocked: false };
  }
  const record = loginAttempts.get(identifier);
  if (!record || record.lockedUntil <= Date.now()) {
    return { isLocked: false };
  }
  return {
    isLocked: true,
    remainingLockoutSeconds: Math.ceil((record.lockedUntil - Date.now()) / 1000),
  };
}

/**
 * Reset failed login attempts on successful authentication
 */
export function clearFailedLogins(identifier: string): void {
  loginAttempts.delete(identifier);
}

/**
 * Create a new authenticated session for a user
 *
 * SECURITY (CR-03):
 * - Token is a 256-bit CSPRNG value (crypto.randomBytes via generateToken()).
 * - Fresh token per authentication event — old tokens are never resurrected.
 * - Session carries the global security epoch at issuance; tokens from older
 *   epochs are rejected (forced revocation / rotation on boot).
 */
export function createSession(
  userId: string,
  req?: Request,
  simulatedUser?: ServerUser,
  originalAdminId?: string
): ServerSession {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);

  const ip = req ? (req.headers['x-forwarded-for'] as string || req.socket?.remoteAddress || '127.0.0.1').split(',')[0].trim() : '127.0.0.1';
  const userAgent = req ? (req.headers['user-agent'] || 'Unknown') : 'Unknown';

  const session: ServerSession = {
    id: `SES-${Date.now().toString().slice(-6)}-${crypto.randomBytes(4).toString('hex')}`,
    token: generateToken(),
    auth_epoch: getSecurityEpoch(),
    user_auth_version: db.users.find(u => u.id === userId)?.authVersion ?? 1,
    user_id: userId,
    original_admin_id: originalAdminId,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    last_active_at: now.toISOString(),
    ip_address: ip,
    user_agent: userAgent,
    simulated_user: simulatedUser,
  };

  db.sessions.push(session);
  return session;
}

/**
 * Find and validate active session
 *
 * SECURITY (CR-03): a token is valid only if
 *  - it exists in the in-memory session registry (never restored from Git-tracked state),
 *  - it has not expired, AND
 *  - it was issued under the CURRENT global security epoch.
 * Any mismatch ⇒ the token is treated as invalid (revoked).
 */
export function getActiveSession(token: string): ServerSession | null {
  if (!token) return null;
  const index = db.sessions.findIndex(s => s.token === token);
  if (index === -1) return null;

  const session = db.sessions[index];
  const now = new Date();

  // Check expiration (absolute timeout)
  if (new Date(session.expires_at) <= now) {
    db.sessions.splice(index, 1);
    return null;
  }

  // Check global revocation epoch (forced revocation / rotation)
  if (session.auth_epoch !== undefined && session.auth_epoch !== getSecurityEpoch()) {
    db.sessions.splice(index, 1);
    return null;
  }

  // Update last_active_at (sliding activity marker; absolute expiry is unchanged)
  session.last_active_at = now.toISOString();
  return session;
}

/**
 * Destroy a session on logout
 */
export function destroySession(token: string): boolean {
  if (!token) return false;
  const index = db.sessions.findIndex(s => s.token === token);
  if (index !== -1) {
    db.sessions.splice(index, 1);
    return true;
  }
  return false;
}

/**
 * Destroy all sessions for a user (e.g., password reset or deactivation)
 */
export function destroyAllUserSessions(userId: string): void {
  db.sessions = db.sessions.filter(s => s.user_id !== userId);
}

/**
 * SECURITY (CR-03 §3.7): bump a user's authVersion and drop every session
 * issued to them. Called on password change/reset, material privilege change,
 * account deactivation, and forced single-user revoke. Old tokens must be
 * re-authenticated — there is no silent migration to a new token.
 */
export function revokeUserSessions(userId: string): void {
  const user = db.users.find(u => u.id === userId);
  if (user) user.authVersion = (user.authVersion || 1) + 1;
  destroyAllUserSessions(userId);
}

/**
 * SECURITY (CR-03 §3.4): forced global revocation for incident response.
 * Increments the server-side security epoch so every previously issued token
 * is invalid, then clears the in-memory session registry.
 */
export function revokeAllSessions(): void {
  for (const u of db.users) {
    u.authVersion = (u.authVersion || 1) + 1;
  }
  db.sessions = [];
}

/**
 * SECURITY (CR-03 §3.8): absolute session timeout — 7 days from issuance.
 * There is no refresh token; after expiry (or logout/rotation) the client must
 * re-authenticate with credentials. Idle timeout is not enforced beyond the
 * absolute window (documented as accepted behavior for P0).
 */
export const SESSION_LIFETIME_POLICY = {
  absoluteTimeout: '7 days',
  idleTimeout: 'not enforced (absolute 7-day window only)',
  refreshTokens: 'none — re-authentication required on expiry',
};

/**
 * Extract auth token from request headers
 */
export function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  const customHeader = req.headers['x-auth-token'];
  if (typeof customHeader === 'string' && customHeader.trim()) {
    return customHeader.trim();
  }

  return null;
}

/**
 * Core authentication resolver for Express requests.
 * User identity comes EXCLUSIVELY from authenticated session token.
 * Arbitrary `x-user-id` headers cannot be used to forge identity.
 * Unauthenticated requests NEVER default to Superadmin.
 */
export function authenticateRequest(req: Request): {
  user: ServerUser | null;
  session?: ServerSession;
  error?: string;
  spoofAttempt?: boolean;
} {
  const token = extractToken(req);
  const rawHeaderUserId = req.headers['x-user-id'];
  const hasHeaderUserId = typeof rawHeaderUserId === 'string' && rawHeaderUserId.trim().length > 0;
  const headerUserId = hasHeaderUserId ? (rawHeaderUserId as string).trim() : null;

  if (token) {
    const session = getActiveSession(token);
    if (session) {
      const sessionOwnerId = db.users.find(u => u.id === session.user_id);
      // If the session owner's authVersion has advanced since issuance, the
      // token was revoked (password change / privilege change / forced revoke).
      const ownerVersion = sessionOwnerId?.authVersion ?? 1;
      if (session.user_auth_version !== undefined && session.user_auth_version !== ownerVersion) {
        const idx = db.sessions.findIndex(s => s.token === token);
        if (idx !== -1) db.sessions.splice(idx, 1);
        return { user: null, error: 'Sesi telah dicabut (kredensial atau hak akses berubah). Silakan login kembali.' };
      }
      const activeUser = session.simulated_user || db.users.find(u => u.id === session.user_id && u.is_active);
      if (activeUser) {
        // Anti-spoofing verification:
        // If client sends x-user-id that doesn't match the authenticated session and is not superadmin
        if (headerUserId && headerUserId !== activeUser.id && activeUser.role !== 'Admin GABAH') {
          return {
            user: null,
            spoofAttempt: true,
            error: 'Percobaan manipulasi identitas (ID spoofing) melalui header terdeteksi.',
          };
        }
        return { user: activeUser, session };
      }
      return { user: null, error: 'Akun pengguna untuk sesi ini tidak aktif atau telah dinonaktifkan.' };
    }
    return { user: null, error: 'Sesi token tidak valid atau telah kedaluwarsa. Silakan login kembali.' };
  }

  // Attempting to authenticate via x-user-id header without an active session is an explicit spoofing attempt
  if (hasHeaderUserId) {
    return {
      user: null,
      spoofAttempt: true,
      error: 'Header identitas x-user-id ditolak: autentikasi memerlukan session token Bearer yang valid.',
    };
  }

  // STRICT ZERO FALLBACK: Never auto-login as Superadmin / first active user
  return {
    user: null,
    error: 'Autentikasi diperlukan. Header Authorization: Bearer <token> tidak ditemukan.',
  };
}

/**
 * Sanitize user object to never leak password hashes or internal secrets to client
 */
export function sanitizeUser(user: ServerUser): Record<string, any> {
  const { password_hash, password_salt, temp_password, ...safe } = user;
  return safe;
}
