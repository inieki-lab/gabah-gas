import fs from 'node:fs';

const source = fs.readFileSync('src/components/modals/CreateLoanModal.tsx', 'utf8');
const services = fs.readFileSync('server/services.ts', 'utf8');
const checks = [
  ['Both data sources pass through one eligibility filter', /const source = loanableAssets[\s\S]*?\? loanableAssets[\s\S]*?: \(Array\.isArray\(assets\) \? assets : \[\]\);[\s\S]*?return source\.filter\(a => a\.is_loanable === true && a\.status === 'available'\);/.test(source)],
  ['Available inventory alone is not treated as loanable', !/a\.is_loanable \|\| a\.status === 'available'/.test(source)],
  ['Preselected asset must belong to eligible pool', /preselectedAssetId && availablePool\.some\(a => a\.id === preselectedAssetId\)/.test(source)],
  ['Submit handler rejects stale or ineligible selected IDs', /selectedAssetIds\.every\(id => availablePool\.some\(asset => asset\.id === id\)\)/.test(source)],
  ['Submit control is disabled for ineligible selected IDs', /disabled=\{isAuditor \|\| hasAnyConflict \|\| selectedAssetIds\.length === 0 \|\| selectedAssetIds\.some\(id => !availablePool\.some\(asset => asset\.id === id\)\)\}/.test(source)],
  ['Borrower phone defaults to the employee profile instead of a fabricated sample number', /useState<string>\(currentUser\?\.phone \|\| ''\)/.test(source) && !source.includes('0812-3456-7890')],
  ['Loan request accepts and validates a supplied borrower phone number', /borrower_phone\?: string/.test(services) && /typeof payload\.borrower_phone !== 'string' \|\| payload\.borrower_phone\.trim\(\)\.length > 40/.test(services)],
  ['Loan record stores the validated supplied phone with profile fallback', /const borrowerPhone = typeof payload\.borrower_phone === 'string'[\s\S]*?\(borrower\.phone \|\| '-'\)/.test(services) && /borrower_phone: borrowerPhone/.test(services)],
];

for (const [name, pass] of checks) console.log(`${pass ? 'PASS' : 'FAIL'} | ${name}`);
const failed = checks.filter(([, pass]) => !pass);
console.log(`TOTAL: ${checks.length} | PASS: ${checks.length - failed.length} | FAIL: ${failed.length}`);
if (failed.length) process.exit(1);
