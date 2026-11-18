import fs from 'node:fs';

const admin = fs.readFileSync(new URL('../src/components/modals/AdministrationModal.tsx', import.meta.url), 'utf8');
const checks = [
  ['Recent reminder failures are type-checked as an array before rendering', /Array\.isArray\(reminderOverview\.recent_failures\)\s*&&\s*reminderOverview\.recent_failures\.length\s*>\s*0/.test(admin)],
  ['Recent failure rendering is capped at five records', /reminderOverview\.recent_failures\.slice\(0,\s*5\)\.map/.test(admin)],
  ['Unsafe truthy fallback is not used for recent failures', !/\(reminderOverview\.recent_failures\s*\|\|\s*\[\]\)\.length/.test(admin)],
];
let failed = 0;
for (const [name, pass] of checks) {
  console.log((pass ? 'PASS' : 'FAIL') + ' | ' + name);
  if (!pass) failed += 1;
}
console.log('TOTAL: ' + checks.length + ' | PASS: ' + (checks.length - failed) + ' | FAIL: ' + failed);
process.exit(failed === 0 ? 0 : 1);
