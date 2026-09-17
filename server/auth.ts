import crypto from 'node:crypto';
import { Request } from 'express';
import { db, ServerUser, ServerSession } from './db';
import { hashPassword, verifyPassword, generateToken } from './crypto';

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
 */
export function createSession(userId: string, req?: Request): ServerSession {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);

  const ip = req ? (req.headers['x-forwarded-for'] as string || req.socket?.remoteAddress || '127.0.0.1').split(',')[0].trim() : '127.0.0.1';
  const userAgent = req ? (req.headers['user-agent'] || 'Unknown') : 'Unknown';

  const session: ServerSession = {
    id: `SES-${Date.now().toString().slice(-6)}-${crypto.randomBytes(4).toString('hex')}`,
    token: generateToken(),
    user_id: userId,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    last_active_at: now.toISOString(),
    ip_address: ip,
    user_agent: userAgent,
  };

  db.sessions.push(session);
  return session;
}

/**
 * Find and validate active session
 */
export function getActiveSession(token: string): ServerSession | null {
  if (!token) return null;
  const index = db.sessions.findIndex(s => s.token === token);
  if (index === -1) return null;

  const session = db.sessions[index];
  const now = new Date();

  // Check expiration
  if (new Date(session.expires_at) <= now) {
    db.sessions.splice(index, 1);
    return null;
  }

  // Update last_active_at
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
 * `x-user-id` is strictly audited and cannot be used to forge identity.
 */
export function authenticateRequest(req: Request): { user: ServerUser | null; error?: string; spoofAttempt?: boolean } {
  const token = extractToken(req);

  if (!token) {
    return { user: null, error: 'Token autentikasi tidak ditemukan.' };
  }

  const session = getActiveSession(token);
  if (!session) {
    return { user: null, error: 'Sesi autentikasi telah kedaluwarsa atau tidak valid.' };
  }

  const user = db.users.find(u => u.id === session.user_id);
  if (!user || !user.is_active) {
    return { user: null, error: 'Pengguna tidak ditemukan atau berstatus nonaktif.' };
  }

  // Check for x-user-id spoofing attempt:
  // If client also sends `x-user-id` header and it does NOT match authenticated user,
  // we flag it and reject privilege escalation unless the authenticated actor is Superadmin/Admin GABAH.
  const headerUserId = req.headers['x-user-id'];
  if (typeof headerUserId === 'string' && headerUserId.trim() && headerUserId.trim() !== user.id) {
    const isSuper = user.role === 'Admin GABAH' || (user as any).role === 'Superadmin';
    if (!isSuper) {
      return { user: null, error: 'Akses ditolak: Percobaan manipulasi identitas (ID spoofing) terdeteksi.', spoofAttempt: true };
    }
  }

  return { user };
}

/**
 * Sanitize user object to never leak password hashes or internal secrets to client
 */
export function sanitizeUser(user: ServerUser): Record<string, any> {
  const { password_hash, password_salt, temp_password, ...safe } = user;
  return safe;
}
