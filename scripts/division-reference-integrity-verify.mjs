import fs from 'node:fs';

const source = fs.readFileSync('server.ts', 'utf8');
const routeStart = source.indexOf("app.delete('/api/master/divisions/:code'");
const routeEnd = source.indexOf("\n  });", routeStart);
const route = routeStart >= 0 && routeEnd > routeStart ? source.slice(routeStart, routeEnd) : '';

const checks = [
  ['division delete route exists', routeStart >= 0],
  ['ticket category references are counted case-insensitively', /const ticketsCount = \(db\.tickets \|\| \[\]\)\.filter\(item => String\(item\.category \|\| ''\)\.trim\(\)\.toUpperCase\(\) === code\)\.length/.test(route)],
  ['ticket references participate in deletion guard', /const references = [^;]*\+ ticketsCount;/.test(route)],
  ['blocked deletion reports ticket reference count', /tiket \(\$\{ticketsCount\}\)/.test(route)],
  ['existing asset, user, vendor, contract, maintenance and loan guards remain', /assetsCount[\s\S]*categoriesCount[\s\S]*usersCount[\s\S]*unitsCount[\s\S]*vendorsCount[\s\S]*contractsCount[\s\S]*maintenanceCount[\s\S]*loanCount[\s\S]*ticketsCount/.test(route)],
];

for (const [name, pass] of checks) console.log(`${pass ? 'PASS' : 'FAIL'} | ${name}`);
const failed = checks.filter(([, pass]) => !pass).length;
console.log(`TOTAL: ${checks.length} | PASS: ${checks.length - failed} | FAIL: ${failed}`);
process.exit(failed ? 1 : 0);
