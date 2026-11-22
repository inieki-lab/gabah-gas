import { clearFailedLogins, isLoginLocked, recordFailedLogin } from '../server/auth';

async function main() {
  process.env.NODE_ENV = 'production';

  const accountA = '127.0.0.1|USR-LOCKOUT-A';
  const accountB = '127.0.0.1|USR-LOCKOUT-B';
  const sameAccountDifferentIp = '127.0.0.2|USR-LOCKOUT-A';

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await recordFailedLogin(accountA);
  }

  const aLocked = (await isLoginLocked(accountA)).isLocked;
  const bUnaffected = !(await isLoginLocked(accountB)).isLocked;
  const otherIpUnaffected = !(await isLoginLocked(sameAccountDifferentIp)).isLocked;

  await clearFailedLogins(accountA);
  const resetOnlyA = !(await isLoginLocked(accountA)).isLocked && !(await isLoginLocked(accountB)).isLocked;

  const originalNodeEnv = process.env.NODE_ENV;
  const originalDisableFlag = process.env.GABAH_DISABLE_LOGIN_LOCKOUT;
  process.env.NODE_ENV = 'development';
  delete process.env.GABAH_DISABLE_LOGIN_LOCKOUT;
  const devDefaultAccount = '127.0.0.1|USR-DEV-LOCKOUT-DEFAULT';
  for (let attempt = 0; attempt < 5; attempt += 1) await recordFailedLogin(devDefaultAccount);
  const devDefaultLockoutWorks = (await isLoginLocked(devDefaultAccount)).isLocked;
  await clearFailedLogins(devDefaultAccount);

  process.env.GABAH_DISABLE_LOGIN_LOCKOUT = 'true';
  const devAccount = '127.0.0.1|USR-DEV-LOCKOUT-OPT-OUT';
  const devAttempts = await Promise.all(Array.from({ length: 5 }, () => recordFailedLogin(devAccount)));
  const devOptOutWorks = devAttempts.every(result => !result.isLocked)
    && !(await isLoginLocked(devAccount)).isLocked;
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  if (originalDisableFlag === undefined) delete process.env.GABAH_DISABLE_LOGIN_LOCKOUT;
  else process.env.GABAH_DISABLE_LOGIN_LOCKOUT = originalDisableFlag;

  const checks = [
    ['Five failures lock only the targeted IP/account pair', aLocked],
    ['Another employee behind the same NAT IP remains unlocked', bUnaffected],
    ['The same account from a different IP has an independent bucket', otherIpUnaffected],
    ['Successful-auth reset semantics clear only the matching bucket', resetOnlyA],
    ['Development keeps brute-force lockout enabled by default', devDefaultLockoutWorks],
    ['Explicit non-production opt-out disables both lock check and fifth-attempt 429', devOptOutWorks],
  ];

  let failed = 0;
  for (const [name, pass] of checks) {
    console.log((pass ? 'PASS' : 'FAIL') + ' | ' + name);
    if (!pass) failed += 1;
  }
  console.log('TOTAL: ' + checks.length + ' | PASS: ' + (checks.length - failed) + ' | FAIL: ' + failed);
  if (failed) process.exitCode = 1;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
