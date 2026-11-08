import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const services = read('server/services.ts');
const hardening = read('server/runtime-hardening.ts');
const policy = read('server/rbac-policy.ts');
const migration = read('server/migrations/021_dynamic_rbac_ga_it_workstation_read.sql');
const branchMigration = read('server/migrations/026_map_branch_accounts_to_employee_location.sql');
const server = read('server.ts');
const hardeningSource = read('server/runtime-hardening.ts');

const checks = [
  ['IT list scope hanya owner IT', /if \(user\.role === 'IT'\) \{\s*return db\.assets\.filter\(a => String\(a\.owner_division \|\| ''\)\.toUpperCase\(\) === 'IT'\);/.test(services)],
  ['GA list scope mengelola owner GA', /if \(user\.role === 'GA'\) \{\s*const canReadItWorkstations = hasRbacPermission/.test(services)],
  ['GA IT read scope memerlukan permission khusus', /hasRbacPermission\(String\(user\.id\), 'assets\.read\.it_workstations'\)/.test(services)],
  ['GA IT read scope dibatasi taxonomy HLT dan HPC', /\['HLT', 'HPC'\]\.includes\(String\(asset\.category_code/.test(services)],
  ['Tidak ada lagi scope aset berdasarkan lokasi SC/PIBC di resolver utama', !/user\.role === 'Supply Chain'[\s\S]{0,500}owner_division === 'SC'|user\.role === 'PIBC'[\s\S]{0,500}owner_division === 'PIBC'/.test(services)],
  ['Direct asset guard memakai permission GA yang sama', /hasRbacPermission\(String\(actor\.id\), 'assets\.read\.it_workstations'\)/.test(hardening)],
  ['Direct asset guard menggunakan dynamic scope untuk custom role', /assetVisibleUnderDynamicScopes\(actor, asset\)/.test(hardening)],
  ['GA read permission didaftarkan khusus untuk role GA', /'assets\.read\.it_workstations'[\s\S]*?WHERE r\.role_key = 'ga'/.test(migration)],
  ['Permission khusus tidak memberi permission mutasi', !/assets\.(create|update|delete|assign|move|lifecycle)/.test(migration)],
  ['RBAC policy mengevaluasi permission efektif per user', /export function hasRbacPermission/.test(policy)],
  ['Supply Chain/PIBC accounts migrate to Karyawan with office-location attributes', /WHEN 'Supply Chain' THEN 'OFF-RPC'[\s\S]*WHEN 'PIBC' THEN 'OFF-PIBC'[\s\S]*role = 'Karyawan'/.test(branchMigration)],
  ['Legacy branch roles and branch units are retired without deleting historical rows', /UPDATE gabah_roles[\s\S]*role_key IN \('supply_chain', 'pibc'\)[\s\S]*UPDATE org_units[\s\S]*UNIT-SC[\s\S]*UNIT-PIBC/.test(branchMigration)],
  ['Branch role migration does not rewrite historical asset ownership', !/UPDATE assets|UPDATE gabah_assets|owner_division\s*=/.test(branchMigration)],
  ['Movement history is restricted to the same visible asset scope', /visibleAssetIds[\s\S]*db\.movements\.filter\(m => visibleAssetIds\.has\(m\.asset_id\)\)/.test(server)],
  ['Maintenance schedules follow visible asset scope and exclude branch-wide fallback', /visibleAssetIds[\s\S]*db\.maintenances\.filter\(item => visibleAssetIds\.has\(item\.asset_id\)\)/.test(server)],
  ['Unknown roles fail closed for asset list and direct asset access', /Unknown or unconfigured roles must fail closed[\s\S]*return \[\];/.test(services) && /return assetVisibleUnderDynamicScopes\(actor, asset\);/.test(hardeningSource)],
  ['Loan approval/rejection/handover/return use permission and IT/GA owner scope only', /static canOperateLoan\([\s\S]*owner !== 'IT' && owner !== 'GA'[\s\S]*hasRbacPermission[\s\S]*hasRbacScope/.test(services)],
  ['Legacy SC/PIBC loans remain Super Admin review-only', /SC\/PIBC are locations[\s\S]*Super Admin review-only/.test(services)],
  ['Employee movement history excludes unassigned loanable-pool inventory', /employeeBaseline[\s\S]*asset\.assigned_to\?\.id === actor\.id[\s\S]*db\.movements\.filter/.test(server)],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}`);
  if (!ok) failed++;
}
console.log(`TOTAL: ${checks.length} | PASS: ${checks.length - failed} | FAIL: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
