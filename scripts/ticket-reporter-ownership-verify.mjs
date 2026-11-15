import fs from 'node:fs';

const source = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const start = source.indexOf("const isReporter = (ticket: any) =>");
const end = source.indexOf("\n\n    if (isSuperadminActor(actor)", start);
const block = source.slice(start, end);

const checks = [
  ['Reporter ID remains the primary ownership key', /ticket\.reporter_id === actor\.id/.test(block)],
  ['Name fallback is restricted to legacy records without reporter ID', /!ticket\.reporter_id && Boolean\(ticket\.reporter_name\)/.test(block)],
  ['Name equality cannot override a different reporter ID', /\|\| \(!ticket\.reporter_id/.test(block)],
  ['Ticket list still filters through the reporter predicate', /isReporter\(ticket\)/.test(source.slice(end, end + 1200))],
];

let failed = 0;
for (const [name, pass] of checks) {
  console.log((pass ? 'PASS' : 'FAIL') + ' | ' + name);
  if (!pass) failed += 1;
}
console.log('TOTAL: ' + checks.length + ' | PASS: ' + (checks.length - failed) + ' | FAIL: ' + failed);
process.exit(failed === 0 ? 0 : 1);
