import crypto from 'node:crypto';

const PASSWORD_HASH_ALGORITHM = 'pbkdf2-sha512';
const CURRENT_ITERATIONS = 220_000;
const LEGACY_ITERATIONS = 100_000;
const MAX_ACCEPTED_ITERATIONS = 1_000_000;

/**
 * Hash new passwords using PBKDF2-HMAC-SHA512 at the current OWASP work factor.
 * The iteration count is encoded in password_hash so future upgrades are
 * versioned and old hashes can be verified without a forced password reset.
 */
export function hashPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const digest = crypto.pbkdf2Sync(password, salt, CURRENT_ITERATIONS, 64, 'sha512').toString('hex');
  return { hash: `${PASSWORD_HASH_ALGORITHM}$${CURRENT_ITERATIONS}$${digest}`, salt };
}

/**
 * Verify current versioned hashes and legacy raw 100k-iteration hashes.
 * Work factors are bounded before invoking PBKDF2 to prevent a corrupted
 * database value from forcing an unbounded CPU loop during authentication.
 */
export function verifyPassword(password: string, hash: string, salt: string): boolean {
  if (!password || !hash || !salt) return false;
  try {
    const versioned = hash.match(/^pbkdf2-sha512\$(\d+)\$([a-f0-9]{128})$/i);
    const iterations = versioned ? Number(versioned[1]) : LEGACY_ITERATIONS;
    const expectedHex = versioned ? versioned[2] : hash;

    if (!Number.isSafeInteger(iterations)
      || iterations < LEGACY_ITERATIONS
      || iterations > MAX_ACCEPTED_ITERATIONS
      || !/^[a-f0-9]{128}$/i.test(expectedHex)) {
      return false;
    }

    const calculated = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512');
    const expected = Buffer.from(expectedHex, 'hex');
    return calculated.length === expected.length && crypto.timingSafeEqual(calculated, expected);
  } catch {
    return false;
  }
}

/** True for valid legacy/under-strength formats that should be upgraded on login. */
export function needsPasswordRehash(hash: string): boolean {
  const match = String(hash || '').match(/^pbkdf2-sha512\$(\d+)\$([a-f0-9]{128})$/i);
  if (!match) return true;
  const iterations = Number(match[1]);
  return !Number.isSafeInteger(iterations)
    || iterations < CURRENT_ITERATIONS
    || iterations > MAX_ACCEPTED_ITERATIONS;
}

/** Generate 256-bit cryptographically secure session tokens. */
export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
