import { clearFailedLogins, isLoginLocked, recordFailedLogin } from '../server/auth';

process.env.NODE_ENV = 'production';

const accountA = '127.0.0.1|USR-LOCKOUT-A';
const accountB = '127.0.0.1|USR-LOCKOUT-B';
const sameAccountDifferentIp = '127.0.0.2|USR-LOCKOUT-A';

for (let attempt = 0; attempt < 5; attempt += 1) {
  recordFailedLogin(accountA);
}

const aLocked = isLoginLocked(accountA).isLocked;
const bUnaffected = !isLoginLocked(accountB).isLocked;
const otherIpUnaffected = !isLoginLocked(sameAccountDifferentIp).isLocked;

clearFailedLogins(accountA);
const resetOnlyA = !isLoginLocked(accountA).isLocked && !isLoginLocked(accountB).isLocked;

const checks = [
  ['Five failures lock only the targeted IP/account pair', aLocked],
  ['Another employee behind the same NAT IP remains unlocked', bUnaffected],
  ['The same account from a different IP has an independent bucket', otherIpUnaffected],
  ['Successful-auth reset semantics clear only the matching bucket', resetOnlyA],
];

let failed = 0;
for (const [name, pass] of checks) {
  console.log((pass ? 'PASS' : 'FAIL') + ' | ' + name);
  if (!pass) failed += 1;
}
console.log('TOTAL: ' + checks.length + ' | PASS: ' + (checks.length - failed) + ' | FAIL: ' + failed);
process.exit(failed === 0 ? 0 : 1);
