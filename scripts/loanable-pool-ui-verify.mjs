import fs from 'node:fs';

const source = fs.readFileSync('src/components/modals/CreateLoanModal.tsx', 'utf8');
const loansView = fs.readFileSync('src/components/views/LoansView.tsx', 'utf8');
const services = fs.readFileSync('server/services.ts', 'utf8');
const taxonomy = fs.readFileSync('server/taxonomy.ts', 'utf8');
const database = fs.readFileSync('server/db.ts', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');
const checks = [
  ['Both data sources pass through one eligibility filter', /const source = loanableAssets[\s\S]*?\? loanableAssets[\s\S]*?: \(Array\.isArray\(assets\) \? assets : \[\]\);[\s\S]*?return source\.filter\(a => a\.is_loanable === true && a\.status === 'available'\);/.test(source)],
  ['Available inventory alone is not treated as loanable', !/a\.is_loanable \|\| a\.status === 'available'/.test(source)],
  ['IT loan catalog includes laptop, PC, monitor and portable presentation peripherals', ['HLT', 'HPC', 'HMON', 'HHDM', 'HPTR', 'HADP', 'HDCK', 'HKEY', 'HWEB', 'HAUD', 'HUSB', 'HEXT'].every(code => taxonomy.includes(`code: '${code}'`))],
  ['GA projector is a loanable GA asset while CCTV is GA-owned but not loanable by default', /code: 'GPRJ'[\s\S]{0,250}owner_division: 'GA'[\s\S]{0,250}is_loanable_by_default: true/.test(taxonomy) && /code: 'GCCTV'[\s\S]{0,250}owner_division: 'GA'[\s\S]{0,250}is_loanable_by_default: false/.test(taxonomy)],
  ['Server, firewall, network core, storage, UPS and rack remain non-loanable by default', ['HSV', 'HFW', 'HSTG', 'HNET', 'HUPS', 'HRCK'].every(code => taxonomy.split('\n').some(line => line.includes(`code: '${code}'`) && line.includes('is_loanable_by_default: false')))],
  ['Backend resolves infrastructure policy from authoritative category metadata and protected labels', /export function isNonLoanableInfrastructureAsset/.test(services) && /mainType === 'IT-S'/.test(services) && /protectedCodes\.has\(code\)/.test(services) && /protectedDescription/.test(services)],
  ['Asset creation forces infrastructure and license categories non-loanable even when API submits true', /const effectiveLoanable = !isNonLoanableInfrastructureAsset\(policyAsset\)/.test(services) && /is_loanable: effectiveLoanable/.test(services)],
  ['Loan request rejects infrastructure based on authoritative category metadata', /if \(isNonLoanableInfrastructureAsset\(asset as any\)\)/.test(services)],
  ['Asset update API rejects attempts to enable loanability for infrastructure assets', /req\.body\.is_loanable === true && isNonLoanableInfrastructureAsset\(asset as any\)/.test(server)],
  ['Bulk asset update rejects infrastructure loanability overrides', /isLoanable === true && isNonLoanableInfrastructureAsset\(existing as any\)/.test(server)],
  ['Loan form explains IT peripherals and owner-based approval', /kabel HDMI, pointer, adaptor/.test(source) && /Persetujuan mengikuti pemilik aset/.test(source)],
  ['Preselected asset must belong to eligible pool', /preselectedAssetId && availablePool\.some\(a => a\.id === preselectedAssetId\)/.test(source)],
  ['CreateLoanModal resolves Auditor deny-write and effective loans.create permission', /const isAuditor = GabahService\.isAuditor\(currentUser\)/.test(source) && /const canCreateLoan = !isAuditor/.test(source) && /currentUser\.permission_keys!\.includes\('loans\.create'\)/.test(source)],
  ['Loans view uses effective Auditor and loans.create permissions', /const isAuditor = GabahService\.isAuditor\(currentUser\)/.test(loansView) && /hasEffectivePermission\('loans\.create'/.test(loansView) && /\{canCreateLoan && \(/.test(loansView)],
  ['Loans view trusts backend owner/unit-scoped results instead of primary-role self-only filtering', /const baseLoans = safeLoans/.test(loansView) && !/const isEmployee = \['Karyawan', 'Sekretaris Direksi', 'Humas'\]/.test(loansView) && !/safeLoans\.filter\(l =>/.test(loansView)],
  ['Submit handler rejects stale or ineligible selected IDs', /selectedAssetIds\.every\(id => availablePool\.some\(asset => asset\.id === id\)\)/.test(source)],
  ['Submit control and handler both enforce loans.create and selected-asset eligibility', /disabled=\{!canCreateLoan \|\| hasAnyConflict \|\| selectedAssetIds\.length === 0 \|\| selectedAssetIds\.some\(id => !availablePool\.some\(asset => asset\.id === id\)\)\}/.test(source) && /if \(!canCreateLoan \|\| hasAnyConflict \|\| !selectionIsValid\) return;/.test(source)],
  ['Historical seeded MacBook loan is returned and its pool asset remains available', /loan_number: 'LOAN-2026-0001'[\s\S]{0,1200}status: 'returned'[\s\S]{0,500}actual_returned_at: '2026-01-26T16:30:00.000Z'/.test(database) && !/loan_number: 'LOAN-2026-0001'[\s\S]{0,1200}status: 'borrowed'/.test(database) && /asset_number: 'IT-HLT-2026-0002'[\s\S]{0,500}status: 'available'[\s\S]{0,300}is_loanable: true/.test(database)],
  ['Borrower phone defaults to the employee profile instead of a fabricated sample number', /useState<string>\(currentUser\?\.phone \|\| ''\)/.test(source) && !source.includes('0812-3456-7890')],
  ['Loan request accepts and validates a supplied borrower phone number', /borrower_phone\?: string/.test(services) && /typeof payload\.borrower_phone !== 'string' \|\| payload\.borrower_phone\.trim\(\)\.length > 40/.test(services)],
  ['Loan record stores the validated supplied phone with profile fallback', /const borrowerPhone = typeof payload\.borrower_phone === 'string'[\s\S]*?\(borrower\.phone \|\| '-'\)/.test(services) && /borrower_phone: borrowerPhone/.test(services)],
];

for (const [name, pass] of checks) console.log(`${pass ? 'PASS' : 'FAIL'} | ${name}`);
const failed = checks.filter(([, pass]) => !pass);
console.log(`TOTAL: ${checks.length} | PASS: ${checks.length - failed.length} | FAIL: ${failed.length}`);
if (failed.length) process.exit(1);
