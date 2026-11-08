import fs from 'node:fs';

const source = fs.readFileSync(new URL('../server/runtime-hardening.ts', import.meta.url), 'utf8');
const start = source.indexOf('function scopedAttention(');
const end = source.indexOf('\n}\n', start);
if (start < 0 || end < 0) throw new Error('scopedAttention() not found');
const block = source.slice(start, end + 2);
const checks = [
  ['Borrower can always see own loan attention card', /loan\.borrower_id === actor\.id\) return true/.test(block)],
  ['PostgreSQL loan attention uses explicit loans owner scope', /isPostgresPersistenceActive\(\)[\s\S]*hasRbacScope\(String\(actor\.id\), 'division', owner, 'loans'\)/.test(block)],
  ['Primary IT/GA role fallback is limited to file-store compatibility', /File-store compatibility only[\s\S]*actor\.role === 'IT' \|\| actor\.role === 'GA'/.test(block)],
];
let failed = 0;
for (const [name, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${name}`);
  if (!pass) failed += 1;
}
console.log(`TOTAL: ${checks.length} | PASS: ${checks.length - failed} | FAIL: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
