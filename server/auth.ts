import crypto from 'node:crypto';
import { Request } from 'express';
import { db, ServerUser, ServerSession } from './db';
import { hashPassword, verifyPassword, generateToken } from './crypto';
import { getSecurityEpoch, getDbPool, isPostgresPersistenceActive, isPostgresFailureLatched } from './persistence';
import { extractClientIp } from './requestContext';

export { hashPassword, verifyPassword, generateToken };

// Rate limiting state for isolated file-store development only. Production and
// PostgreSQL-backed deployments use the shared database buckets below so
// multiple app replicas enforce one common limit.
interface LoginAttemptRecord {
  attempts: number;
  lastAttempt: number;
  lockedUntil: number;
}
const loginAttempts = new Map<string, LoginAttemptRecord>();
let loginAttemptCleanupCounter = 0;
export const LOGIN_ATTEMPT_KEY_LIMIT = 10_000;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;

interface ApiRateLimitRecord {
  count: number;
  resetAt: number;
}
const apiRateLimits = new Map<string, ApiRateLimitRecord>();
let apiRateLimitCleanupCounter = 0;
let apiRateLimitCapacitySweepAt = 0;
let loginAttemptCapacitySweepAt = 0;
const API_WINDOW_MS = 60 * 1000;
export const API_RATE_LIMIT_KEY_LIMIT = 20_000;
const MAX_API_REQUESTS_PER_MINUTE = 200;
let persistentBucketCleanupCounter = 0;

function isLoginLockoutDisabled(): boolean {
  return process.env.NODE_ENV !== 'production'
    && process.env.GABAH_DISABLE_LOGIN_LOCKOUT === 'true';
}

function isProductionAppMode(env: NodeJS.ProcessEnv = process.env): boolean {
  const configuredMode = String(env.GABAH_APP_MODE || '').trim().toLowerCase();
  // NODE_ENV=production is authoritative; an accidental UAT override must
  // never disable production secret validation.
  return env.NODE_ENV === 'production' || configuredMode === 'production';
}

/**
 * Production must use an independent HMAC key for shared rate-limit identifiers.
 * Database credentials and connection URLs are not acceptable substitutes.
 * Development/UAT retains the compatibility fallback for easy local setup.
 */
export function validateRateLimitSecretConfiguration(env: NodeJS.ProcessEnv = process.env): void {
  if (!isProductionAppMode(env)) return;

  const secret = String(env.GABAH_RATE_LIMIT_SECRET || '');
  if (Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('Production requires GABAH_RATE_LIMIT_SECRET with at least 32 bytes of independently generated secret material.');
  }
  if (secret !== secret.trim()) {
    throw new Error('GABAH_RATE_LIMIT_SECRET must not contain leading or trailing whitespace.');
  }
  if (secret === env.PGPASSWORD || secret === env.DATABASE_URL) {
    throw new Error('GABAH_RATE_LIMIT_SECRET must be independent from PostgreSQL credentials.');
  }
}

function hashRateLimitKey(kind: 'api' | 'login', identifier: string): string {
  const production = isProductionAppMode();
  const secret = production
    ? String(process.env.GABAH_RATE_LIMIT_SECRET || '')
    : process.env.GABAH_RATE_LIMIT_SECRET
      || process.env.PGPASSWORD
      || process.env.DATABASE_URL
      || 'gabah-local-development-rate-limit-key';
  if (!secret) {
    throw new Error('Production GABAH_RATE_LIMIT_SECRET is required before rate limiting can run.');
  }
  return crypto.createHmac('sha256', secret).update(kind).update(':').update(identifier).digest('hex');
}

async function prunePersistentRateLimitBuckets(): Promise<void> {
  if (++persistentBucketCleanupCounter < 128) return;
  persistentBucketCleanupCounter = 0;
  // Cleanup is best-effort; a cleanup failure must never disable the active
  // limiter decision for the request that triggered it.
  await getDbPool().query(
    "DELETE FROM gabah_rate_limit_buckets WHERE updated_at < NOW() - INTERVAL '24 hours'",
  ).catch(() => undefined);
}

function pruneExpiredLoginAttempts(now: number, force = false): void {
  if (!force && ++loginAttemptCleanupCounter < 128) return;
  loginAttemptCleanupCounter = 0;
  for (const [key, entry] of loginAttempts) {
    if (entry.lockedUntil <= now && now - entry.lastAttempt > LOCKOUT_MS) {
      loginAttempts.delete(key);
    }
  }
}

/**
 * Shared API rate limit: 200 requests/minute/IP across all app instances.
 * If PostgreSQL became unavailable after startup, fail closed rather than
 * silently resetting the protection in a per-process Map.
 */
export async function checkApiRateLimit(
  clientIp: string,
): Promise<{ allowed: boolean; remaining: number; resetSeconds: number }> {
  if (isPostgresFailureLatched()) {
    throw new Error('Shared API rate-limit storage is unavailable after a PostgreSQL failure.');
  }

  if (isPostgresPersistenceActive()) {
    const bucketKey = hashRateLimitKey('api', clientIp || 'unknown');
    const result = await getDbPool().query(
      `INSERT INTO gabah_rate_limit_buckets
         (bucket_type, bucket_key, window_started_at, request_count, last_attempt_at, updated_at)
       VALUES ('api', $1, NOW(), 1, NOW(), NOW())
       ON CONFLICT (bucket_type, bucket_key) DO UPDATE SET
         request_count = CASE
           WHEN gabah_rate_limit_buckets.window_started_at <= NOW() - INTERVAL '1 minute' THEN 1
           ELSE LEAST(gabah_rate_limit_buckets.request_count + 1, $2)
         END,
         window_started_at = CASE
           WHEN gabah_rate_limit_buckets.window_started_at <= NOW() - INTERVAL '1 minute' THEN NOW()
           ELSE gabah_rate_limit_buckets.window_started_at
         END,
         last_attempt_at = NOW(),
         updated_at = NOW()
       RETURNING request_count,
         GREATEST(1, CEIL(EXTRACT(EPOCH FROM (window_started_at + INTERVAL '1 minute' - NOW()))))::integer AS reset_seconds`,
      [bucketKey, MAX_API_REQUESTS_PER_MINUTE + 1],
    );
    await prunePersistentRateLimitBuckets();
    const row = result.rows[0] as { request_count: number; reset_seconds: number } | undefined;
    if (!row) throw new Error('Shared API rate-limit storage returned no bucket.');
    const count = Number(row.request_count);
    const resetSeconds = Math.max(1, Number(row.reset_seconds) || 1);
    if (count > MAX_API_REQUESTS_PER_MINUTE) {
      return { allowed: false, remaining: 0, resetSeconds };
    }
    return {
      allowed: true,
      remaining: Math.max(0, MAX_API_REQUESTS_PER_MINUTE - count),
      resetSeconds,
    };
  }

  // Isolated local file-store fallback. Never used after an authoritative
  // PostgreSQL runtime failure (guarded above).
  const now = Date.now();
  const key = String(clientIp || 'unknown').slice(0, 128);
  let bucket = apiRateLimits.get(key);
  const needsCapacitySweep = !bucket && apiRateLimits.size >= API_RATE_LIMIT_KEY_LIMIT
    && now - apiRateLimitCapacitySweepAt >= 1_000;
  if (needsCapacitySweep || ++apiRateLimitCleanupCounter >= 128) {
    apiRateLimitCleanupCounter = 0;
    if (needsCapacitySweep) apiRateLimitCapacitySweepAt = now;
    for (const [key, entry] of apiRateLimits) {
      if (entry.resetAt <= now) apiRateLimits.delete(key);
    }
    bucket = apiRateLimits.get(key);
  }
  if (!bucket || bucket.resetAt <= now) {
    if (!bucket && apiRateLimits.size >= API_RATE_LIMIT_KEY_LIMIT) {
      return { allowed: false, remaining: 0, resetSeconds: 60 };
    }
    bucket = { count: 1, resetAt: now + API_WINDOW_MS };
    apiRateLimits.set(key, bucket);
    return { allowed: true, remaining: MAX_API_REQUESTS_PER_MINUTE - 1, resetSeconds: 60 };
  }
  bucket.count += 1;
  const resetSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  if (bucket.count > MAX_API_REQUESTS_PER_MINUTE) {
    return { allowed: false, remaining: 0, resetSeconds };
  }
  return { allowed: true, remaining: MAX_API_REQUESTS_PER_MINUTE - bucket.count, resetSeconds };
}

/**
 * Atomically record a failed login. PostgreSQL's upsert row lock makes the
 * five-attempt lockout consistent across app replicas and concurrent requests.
 */
export async function recordFailedLogin(
  identifier: string,
): Promise<{ isLocked: boolean; remainingLockoutSeconds?: number }> {
  if (isLoginLockoutDisabled()) return { isLocked: false };
  if (isPostgresFailureLatched()) {
    throw new Error('Shared login lockout storage is unavailable after a PostgreSQL failure.');
  }

  if (isPostgresPersistenceActive()) {
    const bucketKey = hashRateLimitKey('login', identifier);
    const result = await getDbPool().query(
      `INSERT INTO gabah_rate_limit_buckets
         (bucket_type, bucket_key, window_started_at, request_count, last_attempt_at, locked_until, updated_at)
       VALUES ('login', $1, NOW(), 1, NOW(), NULL, NOW())
       ON CONFLICT (bucket_type, bucket_key) DO UPDATE SET
         request_count = CASE
           WHEN gabah_rate_limit_buckets.locked_until > NOW() THEN gabah_rate_limit_buckets.request_count
           WHEN gabah_rate_limit_buckets.last_attempt_at <= NOW() - INTERVAL '5 minutes' THEN 1
           ELSE LEAST(gabah_rate_limit_buckets.request_count + 1, $2)
         END,
         window_started_at = CASE
           WHEN gabah_rate_limit_buckets.locked_until > NOW() THEN gabah_rate_limit_buckets.window_started_at
           WHEN gabah_rate_limit_buckets.last_attempt_at <= NOW() - INTERVAL '5 minutes' THEN NOW()
           ELSE gabah_rate_limit_buckets.window_started_at
         END,
         locked_until = CASE
           WHEN gabah_rate_limit_buckets.locked_until > NOW() THEN gabah_rate_limit_buckets.locked_until
           WHEN gabah_rate_limit_buckets.last_attempt_at <= NOW() - INTERVAL '5 minutes' THEN NULL
           WHEN gabah_rate_limit_buckets.request_count + 1 >= $2 THEN NOW() + INTERVAL '5 minutes'
           ELSE NULL
         END,
         last_attempt_at = CASE
           WHEN gabah_rate_limit_buckets.locked_until > NOW() THEN gabah_rate_limit_buckets.last_attempt_at
           ELSE NOW()
         END,
         updated_at = NOW()
       RETURNING locked_until,
         (locked_until > NOW()) AS is_locked,
         CASE WHEN locked_until > NOW()
           THEN GREATEST(1, CEIL(EXTRACT(EPOCH FROM (locked_until - NOW()))))::integer
           ELSE NULL END AS remaining_lockout_seconds`,
      [bucketKey, MAX_ATTEMPTS],
    );
    await prunePersistentRateLimitBuckets();
    const row = result.rows[0] as { is_locked: boolean; remaining_lockout_seconds: number | null } | undefined;
    if (!row) throw new Error('Shared login lockout storage returned no bucket.');
    return row.is_locked
      ? { isLocked: true, remainingLockoutSeconds: Math.max(1, Number(row.remaining_lockout_seconds) || 1) }
      : { isLocked: false };
  }

  const now = Date.now();
  pruneExpiredLoginAttempts(now);
  let record = loginAttempts.get(identifier);
  if (!record) {
    if (loginAttempts.size >= LOGIN_ATTEMPT_KEY_LIMIT) {
      if (now - loginAttemptCapacitySweepAt >= 1_000) {
        loginAttemptCapacitySweepAt = now;
        pruneExpiredLoginAttempts(now, true);
      }
      if (loginAttempts.size >= LOGIN_ATTEMPT_KEY_LIMIT) {
        return { isLocked: true, remainingLockoutSeconds: Math.ceil(LOCKOUT_MS / 1000) };
      }
    }
    record = { attempts: 1, lastAttempt: now, lockedUntil: 0 };
    loginAttempts.set(identifier, record);
    return { isLocked: false };
  }
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
    return { isLocked: true, remainingLockoutSeconds: Math.ceil(LOCKOUT_MS / 1000) };
  }
  return { isLocked: false };
}

/** Check whether the shared login bucket is currently locked. */
export async function isLoginLocked(
  identifier: string,
): Promise<{ isLocked: boolean; remainingLockoutSeconds?: number }> {
  if (isLoginLockoutDisabled()) return { isLocked: false };
  if (isPostgresFailureLatched()) {
    throw new Error('Shared login lockout storage is unavailable after a PostgreSQL failure.');
  }

  if (isPostgresPersistenceActive()) {
    const bucketKey = hashRateLimitKey('login', identifier);
    const result = await getDbPool().query(
      `SELECT GREATEST(1, CEIL(EXTRACT(EPOCH FROM (locked_until - NOW()))))::integer AS remaining_lockout_seconds
       FROM gabah_rate_limit_buckets
       WHERE bucket_type = 'login' AND bucket_key = $1 AND locked_until > NOW()`,
      [bucketKey],
    );
    const row = result.rows[0] as { remaining_lockout_seconds: number } | undefined;
    return row
      ? { isLocked: true, remainingLockoutSeconds: Math.max(1, Number(row.remaining_lockout_seconds) || 1) }
      : { isLocked: false };
  }

  pruneExpiredLoginAttempts(Date.now());
  const record = loginAttempts.get(identifier);
  if (!record || record.lockedUntil <= Date.now()) return { isLocked: false };
  return {
    isLocked: true,
    remainingLockoutSeconds: Math.ceil((record.lockedUntil - Date.now()) / 1000),
  };
}

/** Reset failed attempts for only the matching identifier after successful auth. */
export async function clearFailedLogins(identifier: string): Promise<void> {
  if (isPostgresFailureLatched()) {
    throw new Error('Shared login lockout storage is unavailable after a PostgreSQL failure.');
  }
  if (isPostgresPersistenceActive()) {
    await getDbPool().query(
      "DELETE FROM gabah_rate_limit_buckets WHERE bucket_type = 'login' AND bucket_key = $1",
      [hashRateLimitKey('login', identifier)],
    );
    return;
  }
  loginAttempts.delete(identifier);
}

// Session duration: 7 days
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

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

  const ip = req ? (extractClientIp(req) || 'unknown') : 'unknown';
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

  const cookie = req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith('gabah_session='));
  if (cookie) return cookie.slice('gabah_session='.length);

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
export function sanitizeUser(user: ServerUser, options: { includeTelegramChatId?: boolean } = {}): Record<string, any> {
  const { password_hash, password_salt, temp_password, telegram_chat_id, ...safe } = user;
  return options.includeTelegramChatId && telegram_chat_id ? { ...safe, telegram_chat_id } : safe;
}
