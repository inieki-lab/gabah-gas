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
  ['IT list scope hanya owner IT', /if \(user\.role === 'IT'\) \{\s*return dynamicAssets\.filter\(asset => String\(asset\.owner_division \|\| ''\)\.toUpperCase\(\) === 'IT'\);/.test(services)],
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
  ['Unknown roles fail closed for asset list and direct asset access', /if \(owner !== 'IT' && owner !== 'GA'\) return false;/.test(services) && /if \(scopes == null\) return false;/.test(services) && /assetVisibleUnderDynamicScopes\(actor, asset\)/.test(hardeningSource)],
  ['Loan approval/rejection/handover/return use permission and IT/GA owner scope only', /static canOperateLoan\([\s\S]*owner !== 'IT' && owner !== 'GA'[\s\S]*hasRbacPermission[\s\S]*hasRbacScope/.test(services)],
  ['Full asset catalogue menu requires its own explicit permission', /assets\.catalog\.read/.test(read('src/navigation/roleNavigation.ts')) && /assets\.catalog\.read/.test(read('server/migrations/027_dynamic_rbac_asset_catalog_read.sql'))],
  ['New assets cannot be created with legacy SC/PIBC owner values', /resolvedOwnerDivision !== 'IT' && resolvedOwnerDivision !== 'GA'/.test(services)],
  ['Legacy SC/PIBC asset records are Super Admin-only for mutation', /owner !== 'IT' && owner !== 'GA'/.test(services) && /owner legacy SC\/PIBC/.test(server)],
  ['Legacy SC/PIBC loans remain Super Admin review-only', /SC\/PIBC are locations[\s\S]*Super Admin review-only/.test(services)],
  ['Employee movement history excludes unassigned loanable-pool inventory', /employeeBaseline[\s\S]*asset\.assigned_to\?\.id === actor\.id[\s\S]*db\.movements\.filter/.test(server)],
  ['Private agenda fields are redacted from GA/IT operational queues', /title: 'Reservasi ruang rapat'[\s\S]*description: undefined[\s\S]*attendees_list: undefined[\s\S]*documentation_notes: undefined/.test(server)],
  ['Employee directory is gated by users.read', /app\.get\('\/api\/users', \(req, res\) => \{[\s\S]*requireRbacPermission\(req, res, 'users\.read'\)[\s\S]*!\['IT', 'GA'\]\.includes\(actor\.role\)/i.test(server)],
  ['Knowledge vote and view actions require their read/action permissions', /app\.post\('\/api\/knowledge\/:id\/vote', \(req, res\) => \{\s*if \(!requireRbacPermission\(req, res, 'knowledge\.vote'\)\) return;/i.test(server) && /app\.post\('\/api\/knowledge\/:id\/view', \(req, res\) => \{\s*if \(!requireRbacPermission\(req, res, 'knowledge\.read'\)\) return;/i.test(server)],
  ['Ticket list and status access follow reporter, assignee, and IT/GA scope', /hasRbacScope\(String\(actor\.id\), 'division', 'IT', 'tickets'\)/.test(server) && /hasRbacScope\(String\(actor\.id\), 'division', 'GA', 'tickets'\)/.test(server) && /ticket\.assigned_agent_id === actor\.id/.test(hardeningSource)],
  ['Dashboard ticket counts use the same IT/GA and personal ticket scope', /canReadITTickets[\s\S]*canReadGATickets[\s\S]*ticket\.reporter_id === actor\.id/.test(server)],
  ['Loan list and dashboard counts follow borrower and IT/GA owner scope', /canReadITLoans[\s\S]*canReadGALoans[\s\S]*loan\.borrower_id === actor\.id/.test(server) && /loans\.approve[\s\S]*hasRbacScope/.test(services)],
  ['User-targeted notifications cannot be read or marked by same-role colleagues', /if \(notification\.recipient_user_id\) return notification\.recipient_user_id === actor\.id;[\s\S]*if \(notification\.recipient_role\) return notification\.recipient_role === actor\.role;/.test(server) && /recipient_user_id \? n\.recipient_user_id === actor\.id[\s\S]*recipient_role \? n\.recipient_role === actor\.role/.test(server)],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}`);
  if (!ok) failed++;
}
console.log(`TOTAL: ${checks.length} | PASS: ${checks.length - failed} | FAIL: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
