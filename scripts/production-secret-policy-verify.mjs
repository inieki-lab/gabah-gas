import assert from 'node:assert/strict';
import { validateRateLimitSecretConfiguration } from '../server/auth.ts';

const production = {
  NODE_ENV: 'production',
  GABAH_APP_MODE: 'production',
  PGPASSWORD: 'database-password-that-is-not-the-hmac-key',
  DATABASE_URL: 'postgresql://gabah_app:database-password@database:5432/gabah_db',
};

assert.throws(
  () => validateRateLimitSecretConfiguration(production),
  /GABAH_RATE_LIMIT_SECRET.*32 bytes/,
  'production must reject a missing independent secret',
);
assert.throws(
  () => validateRateLimitSecretConfiguration({ ...production, GABAH_RATE_LIMIT_SECRET: 'too-short' }),
  /32 bytes/,
  'production must reject a weak/short secret',
);
assert.throws(
  () => validateRateLimitSecretConfiguration({ ...production, GABAH_RATE_LIMIT_SECRET: production.PGPASSWORD }),
  /independent from PostgreSQL credentials/,
  'production must not reuse the app database password',
);
assert.throws(
  () => validateRateLimitSecretConfiguration({ ...production, GABAH_RATE_LIMIT_SECRET: production.DATABASE_URL }),
  /independent from PostgreSQL credentials/,
  'production must not reuse the database URL',
);
assert.throws(
  () => validateRateLimitSecretConfiguration({ ...production, GABAH_RATE_LIMIT_SECRET: '  ' + 'x'.repeat(40) }),
  /whitespace/,
  'production must reject whitespace-padded secrets',
);

const independentSecret = 'a'.repeat(64);
assert.doesNotThrow(
  () => validateRateLimitSecretConfiguration({ ...production, GABAH_RATE_LIMIT_SECRET: independentSecret }),
  'production accepts a strong independent secret',
);
assert.throws(
  () => validateRateLimitSecretConfiguration({ ...production, GABAH_APP_MODE: 'uat' }),
  /32 bytes/,
  'NODE_ENV=production remains authoritative even if GABAH_APP_MODE is mis-set to UAT',
);
assert.doesNotThrow(
  () => validateRateLimitSecretConfiguration({ NODE_ENV: 'development', GABAH_APP_MODE: 'uat' }),
  'UAT retains the local development fallback outside production Node mode',
);
assert.doesNotThrow(
  () => validateRateLimitSecretConfiguration({ NODE_ENV: 'development' }),
  'non-production Node runtime defaults to development when app mode is unset',
);

console.log('PASS | production rejects missing, weak, padded, or database-reused rate-limit secrets');
console.log('PASS | production accepts an independent 32+ byte secret');
console.log('PASS | development/UAT compatibility remains available');
