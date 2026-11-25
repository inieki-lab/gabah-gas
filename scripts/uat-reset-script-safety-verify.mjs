import fs from 'node:fs';
import assert from 'node:assert/strict';

const reset = fs.readFileSync(new URL('./reset-temporary-users.mjs', import.meta.url), 'utf8');

assert.match(reset, /Retired legacy utility/);
assert.match(reset, /process\.exitCode = 1/);
assert.match(reset, /Refusing to run/);
assert.match(reset, /Dynamic RBAC UAT provisioning workflow/);

// The retired utility must not open a database connection or retain destructive
// SQL against the canonical state/users tables.
assert.doesNotMatch(reset, /from ['"]pg['"]/);
assert.doesNotMatch(reset, /new Pool\s*\(/);
assert.doesNotMatch(reset, /UPDATE\s+gabah_state/i);
assert.doesNotMatch(reset, /UPDATE\s+users\s+SET\s+is_active\s*=\s*FALSE/i);
assert.doesNotMatch(reset, /DELETE\s+FROM\s+(users|gabah_state)/i);

console.log('PASS | retired legacy user reset fails closed before database access');
console.log('PASS | no destructive user/state SQL remains in the retired script');
