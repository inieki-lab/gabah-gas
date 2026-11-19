import fs from 'node:fs';

const migration = fs.readFileSync('server/migrations/046_it_loan_catalog_category_backfill.sql', 'utf8');
const taxonomy = fs.readFileSync('server/taxonomy.ts', 'utf8');
const checks = [
  ['IT portable peripherals and GA projector/CCTV are seeded into normalized asset_categories', ['HHDM', 'HPTR', 'HADP', 'HDCK', 'HKEY', 'HWEB', 'HAUD', 'HUSB', 'HEXT', 'GPRJ', 'GCCTV'].every(code => migration.includes(`('${code}',`)) && /INSERT INTO asset_categories/.test(migration)],
  ['Loan catalog categories are present in the canonical application taxonomy', ['HHDM', 'HPTR', 'HADP', 'HDCK', 'HKEY', 'HWEB', 'HAUD', 'HUSB', 'HEXT', 'GPRJ', 'GCCTV'].every(code => taxonomy.includes(`code: '${code}'`))],
  ['Existing normalized category rows are never overwritten', /ON CONFLICT \(code\) DO NOTHING/.test(migration)],
  ['Existing gabah_state category customizations are preserved and only missing codes are appended', migration.includes('jsonb_array_elements(snap.categories)') && migration.includes('WHERE NOT EXISTS') && migration.includes('|| missing.additions')],
  ['CCTV remains GA-owned and non-loanable while projector is GA-owned and loanable', /\('GPRJ',[\s\S]*?'GA', TRUE\)/.test(migration) && /\('GCCTV',[\s\S]*?'GA', FALSE\)/.test(migration)],
  ['Infrastructure exclusions are not introduced into the loanable catalog', !['HSV', 'HFW', 'HSTG', 'HNET', 'HUPS', 'HRCK', 'SLIC'].some(code => migration.includes(`('${code}',`))],
  ['Snapshot backfill is additive and idempotent', /jsonb_array_length\(missing\.additions\) > 0/.test(migration) && /WHERE id = 1/.test(migration)],
];

for (const [name, pass] of checks) console.log(`${pass ? 'PASS' : 'FAIL'} | ${name}`);
const failed = checks.filter(([, pass]) => !pass);
console.log(`TOTAL: ${checks.length} | PASS: ${checks.length - failed.length} | FAIL: ${failed.length}`);
if (failed.length) process.exit(1);
