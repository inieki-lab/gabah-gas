import fs from 'node:fs';

const source = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const start = source.indexOf("app.post('/api/auth/login'");
const end = source.indexOf("app.post('/api/auth/logout'", start);
if (start < 0 || end < 0) throw new Error('Login route not found');
const route = source.slice(start, end);
const checks = [
  ['Login rejects non-string email/password before normalization', /typeof email !== 'string' \|\| typeof password !== 'string'/.test(route)],
  ['Lockout key combines transport IP and normalized email', /const loginIdentifier = `\$\{ip\}\|\$\{inputEmail\}`/.test(route)],
  ['Lock check uses the per-account identifier', /isLoginLocked\(loginIdentifier\)/.test(route)],
  ['Unknown-account failures increment the per-account identifier', /recordFailedLogin\(loginIdentifier\)/.test(route)],
  ['Wrong-password failures increment the per-account identifier', (route.match(/recordFailedLogin\(loginIdentifier\)/g) || []).length === 2],
  ['Successful login clears only the matching per-account identifier', /clearFailedLogins\(loginIdentifier\)/.test(route)],
  ['Login route no longer shares a lockout bucket by IP alone', !/isLoginLocked\(ip\)|recordFailedLogin\(ip\)|clearFailedLogins\(ip\)/.test(route)],
];
let failed = 0;
for (const [name, pass] of checks) {
  console.log((pass ? 'PASS' : 'FAIL') + ' | ' + name);
  if (!pass) failed += 1;
}
console.log('TOTAL: ' + checks.length + ' | PASS: ' + (checks.length - failed) + ' | FAIL: ' + failed);
process.exit(failed === 0 ? 0 : 1);
