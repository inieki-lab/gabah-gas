import crypto from 'node:crypto';

/**
 * Hash password using PBKDF2 with SHA-512 and 100,000 iterations (OWASP recommended)
 */
export function hashPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

/**
 * Verify password with constant-time equality check to prevent timing attacks
 */
export function verifyPassword(password: string, hash: string, salt: string): boolean {
  if (!password || !hash || !salt) return false;
  try {
    const calculated = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(calculated, 'hex'), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Generate 256-bit cryptographically secure token
 */
export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
