import fs from 'node:fs';

const source = fs.readFileSync('src/components/modals/CreateLoanModal.tsx', 'utf8');
const services = fs.readFileSync('server/services.ts', 'utf8');
const taxonomy = fs.readFileSync('server/taxonomy.ts', 'utf8');
const database = fs.readFileSync('server/db.ts', 'utf8');
const checks = [
  ['Both data sources pass through one eligibility filter', /const source = loanableAssets[\s\S]*?\? loanableAssets[\s\S]*?: \(Array\.isArray\(assets\) \? assets : \[\]\);[\s\S]*?return source\.filter\(a => a\.is_loanable === true && a\.status === 'available'\);/.test(source)],
  ['Available inventory alone is not treated as loanable', !/a\.is_loanable \|\| a\.status === 'available'/.test(source)],
  ['IT loan catalog includes laptop, PC, monitor and portable presentation peripherals', ['HLT', 'HPC', 'HMON', 'HHDM', 'HPTR', 'HADP', 'HDCK', 'HKEY', 'HWEB', 'HAUD', 'HUSB', 'HEXT'].every(code => taxonomy.includes(`code: '${code}'`))],
  ['GA projector is a loanable GA asset while CCTV is GA-owned but not loanable by default', /code: 'GPRJ'[\s\S]{0,250}owner_division: 'GA'[\s\S]{0,250}is_loanable_by_default: true/.test(taxonomy) && /code: 'GCCTV'[\s\S]{0,250}owner_division: 'GA'[\s\S]{0,250}is_loanable_by_default: false/.test(taxonomy)],
  ['Server, firewall, network core, storage, UPS and rack remain non-loanable by default', ['HSV', 'HFW', 'HSTG', 'HNET', 'HUPS', 'HRCK'].every(code => new RegExp(`code: '${code}'[\\s\\S]{0,300}is_loanable_by_default: false`).test(taxonomy))],
  ['Backend rejects infrastructure and license assets even if marked loanable', /nonLoanableInfrastructureCodes = new Set\(\['HSV', 'HFW', 'HSTG', 'HNET', 'HUPS', 'HRCK', 'SLIC'\]\)/.test(services) && /category_type \|\| ''\)\.toLowerCase\(\) === 'license'/.test(services)],
  ['Loan form explains IT peripherals and owner-based approval', /kabel HDMI, pointer, adaptor/.test(source) && /Persetujuan mengikuti pemilik aset/.test(source)],
  ['Preselected asset must belong to eligible pool', /preselectedAssetId && availablePool\.some\(a => a\.id === preselectedAssetId\)/.test(source)],
  ['Submit handler rejects stale or ineligible selected IDs', /selectedAssetIds\.every\(id => availablePool\.some\(asset => asset\.id === id\)\)/.test(source)],
  ['Submit control is disabled for ineligible selected IDs', /disabled=\{isAuditor \|\| hasAnyConflict \|\| selectedAssetIds\.length === 0 \|\| selectedAssetIds\.some\(id => !availablePool\.some\(asset => asset\.id === id\)\)\}/.test(source)],
  ['Historical seeded MacBook loan is returned and does not reserve the available pool asset', /loan_number: 'LOAN-2026-0001'[\\s\\S]{0,900}status: 'returned'[\\s\\S]{0,500}actual_returned_at: '2026-01-26T16:30:00.000Z'/.test(database) && !/loan_number: 'LOAN-2026-0001'[\\s\\S]{0,900}status: 'borrowed'/.test(database)],
  ['Borrower phone defaults to the employee profile instead of a fabricated sample number', /useState<string>\(currentUser\?\.phone \|\| ''\)/.test(source) && !source.includes('0812-3456-7890')],
  ['Loan request accepts and validates a supplied borrower phone number', /borrower_phone\?: string/.test(services) && /typeof payload\.borrower_phone !== 'string' \|\| payload\.borrower_phone\.trim\(\)\.length > 40/.test(services)],
  ['Loan record stores the validated supplied phone with profile fallback', /const borrowerPhone = typeof payload\.borrower_phone === 'string'[\s\S]*?\(borrower\.phone \|\| '-'\)/.test(services) && /borrower_phone: borrowerPhone/.test(services)],
];

for (const [name, pass] of checks) console.log(`${pass ? 'PASS' : 'FAIL'} | ${name}`);
const failed = checks.filter(([, pass]) => !pass);
console.log(`TOTAL: ${checks.length} | PASS: ${checks.length - failed.length} | FAIL: ${failed.length}`);
if (failed.length) process.exit(1);
