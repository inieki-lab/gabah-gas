import assert from 'node:assert/strict';

process.env.NODE_ENV = 'production';
const {
  API_RATE_LIMIT_KEY_LIMIT,
  LOGIN_ATTEMPT_KEY_LIMIT,
  checkApiRateLimit,
  recordFailedLogin,
} = await import('../server/auth.ts');

// The login lockout map must never grow beyond its configured key ceiling.
for (let i = 0; i < LOGIN_ATTEMPT_KEY_LIMIT; i++) {
  assert.equal(recordFailedLogin(`login-key-${i}`).isLocked, false);
}
const overflowLogin = recordFailedLogin('login-key-overflow');
assert.equal(overflowLogin.isLocked, true, 'new login identifiers fail closed at capacity');
assert.equal(overflowLogin.remainingLockoutSeconds, 300);
assert.equal(recordFailedLogin('login-key-0').isLocked, false, 'existing login bucket remains usable');

// The general API limiter must bound client-IP cardinality and reject new keys
// rather than allocating another bucket after the ceiling is reached.
for (let i = 0; i < API_RATE_LIMIT_KEY_LIMIT; i++) {
  assert.equal(checkApiRateLimit(`192.0.2.${i}`).allowed, true);
}
const overflowApi = checkApiRateLimit('198.51.100.250');
assert.equal(overflowApi.allowed, false, 'new API client keys fail closed at capacity');
assert.equal(overflowApi.remaining, 0);
assert.equal(overflowApi.resetSeconds, 60);
const existingApi = checkApiRateLimit('192.0.2.0');
assert.equal(existingApi.allowed, true, 'existing API bucket remains usable');
assert.equal(existingApi.remaining, 198);

console.log('PASS | login lockout identifier cardinality is bounded and fails closed');
console.log('PASS | API client-IP bucket cardinality is bounded and fails closed');
console.log('PASS | existing buckets continue to enforce their individual limits');
