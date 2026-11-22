import assert from 'node:assert/strict';
import crypto from 'node:crypto';

process.env.NODE_ENV = 'production';

const { initializePersistence, getDbPool, isPostgresPersistenceActive } = await import('../server/persistence.ts');
const { checkApiRateLimit, recordFailedLogin, isLoginLocked, clearFailedLogins } = await import('../server/auth.ts');

const apiIp = 'shared-rate-limit-ci-' + crypto.randomUUID();
const loginIdentifier = 'shared-login-lockout-ci-' + crypto.randomUUID();
const parallelLoginIdentifier = 'shared-login-parallel-ci-' + crypto.randomUUID();
const apiBucketKey = crypto.createHash('sha256').update('api').update(':').update(apiIp).digest('hex');

try {
  await initializePersistence();
  assert.equal(isPostgresPersistenceActive(), true, 'PostgreSQL must be authoritative for this regression');

  const apiResults = await Promise.all(
    Array.from({ length: 205 }, () => checkApiRateLimit(apiIp)),
  );
  assert.equal(apiResults.filter(result => result.allowed).length, 200,
    'shared API bucket must allow exactly 200 requests in a one-minute window');
  assert.equal(apiResults.filter(result => !result.allowed).length, 5,
    'requests above the shared API limit must be denied');

  const sequentialResults = [];
  for (let attempt = 0; attempt < 5; attempt += 1) {
    sequentialResults.push(await recordFailedLogin(loginIdentifier));
  }
  assert.equal(sequentialResults.at(-1)?.isLocked, true,
    'the fifth failed login must lock the shared account/IP key');
  assert.equal((await isLoginLocked(loginIdentifier)).isLocked, true,
    'lockout must be visible through a separate database read');
  assert.equal((await isLoginLocked(loginIdentifier + '-other')).isLocked, false,
    'another identifier must remain unaffected');

  const concurrentResults = await Promise.all(
    Array.from({ length: 8 }, () => recordFailedLogin(parallelLoginIdentifier)),
  );
  assert.ok(concurrentResults.some(result => result.isLocked)
    || (await isLoginLocked(parallelLoginIdentifier)).isLocked,
  'concurrent failures must atomically reach the shared lockout threshold');
  assert.equal((await isLoginLocked(parallelLoginIdentifier)).isLocked, true,
    'parallel requests must leave the shared bucket locked');

  await clearFailedLogins(loginIdentifier);
  assert.equal((await isLoginLocked(loginIdentifier)).isLocked, false,
    'successful authentication reset must clear only the matching shared bucket');
  assert.equal((await isLoginLocked(parallelLoginIdentifier)).isLocked, true,
    'clearing another identifier must not clear the concurrent bucket');

  await clearFailedLogins(parallelLoginIdentifier);
  await getDbPool().query(
    "DELETE FROM gabah_rate_limit_buckets WHERE bucket_type = 'api' AND bucket_key = $1",
    [apiBucketKey],
  );

  console.log('PASS | 205 concurrent API requests share one PostgreSQL 200/minute bucket');
  console.log('PASS | fifth failed login creates a shared five-minute lockout');
  console.log('PASS | concurrent failed logins are serialized atomically in PostgreSQL');
  console.log('PASS | successful login clears only its own bucket');
} finally {
  await getDbPool().end();
}
