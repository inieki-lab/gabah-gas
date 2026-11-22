import assert from 'node:assert/strict';

process.env.NODE_ENV = 'production';
const {
  API_RATE_LIMIT_KEY_LIMIT,
  LOGIN_ATTEMPT_KEY_LIMIT,
  checkApiRateLimit,
  recordFailedLogin,
} = await import('../server/auth.ts');

// No persistence initialization is performed: this exercises the bounded
// in-memory fallback used only by isolated file-store development.
for (let i = 0; i < LOGIN_ATTEMPT_KEY_LIMIT; i++) {
  assert.equal((await recordFailedLogin(`login-key-${i}`)).isLocked, false);
}
const overflowLogin = await recordFailedLogin('login-key-overflow');
assert.equal(overflowLogin.isLocked, true);
assert.equal(overflowLogin.remainingLockoutSeconds, 300);
assert.equal((await recordFailedLogin('login-key-0')).isLocked, false);

for (let i = 0; i < API_RATE_LIMIT_KEY_LIMIT; i++) {
  assert.equal((await checkApiRateLimit(`192.0.2.${i}`)).allowed, true);
}
const overflowApi = await checkApiRateLimit('198.51.100.250');
assert.equal(overflowApi.allowed, false);
assert.equal(overflowApi.remaining, 0);
assert.equal(overflowApi.resetSeconds, 60);
const existingApi = await checkApiRateLimit('192.0.2.0');
assert.equal(existingApi.allowed, true);
assert.equal(existingApi.remaining, 198);

console.log('PASS | login fallback key cardinality is bounded and fails closed');
console.log('PASS | API fallback client-IP cardinality is bounded and fails closed');
console.log('PASS | existing fallback buckets continue to enforce their limits');
