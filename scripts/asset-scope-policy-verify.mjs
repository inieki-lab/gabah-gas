import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const services = read('server/services.ts');
const hardening = read('server/runtime-hardening.ts');
const policy = read('server/rbac-policy.ts');
const migration = read('server/migrations/021_dynamic_rbac_ga_it_workstation_read.sql');
const branchMigration = read('server/migrations/026_map_branch_accounts_to_employee_location.sql');
const server = read('server.ts');
const hardeningSource = read('server/runtime-hardening.ts');
const persistence = read('server/persistence.ts');
const dbSeed = read('server/db.ts');
const contracts = read('server/contracts.ts');
const orgMasterMigration = read('server/migrations/006_org_model_masters.sql');

const checks = [
  ['Current office master seeds exactly HO, PIBC, RPC/SC and Pangsub as active', /id: 'OFF-KP', name: 'HO', is_active: true/.test(dbSeed) && /id: 'OFF-PIBC', name: 'PIBC', is_active: true/.test(dbSeed) && /id: 'OFF-RPC', name: 'RPC\/SC', is_active: true/.test(dbSeed) && /id: 'OFF-PANGSUB', name: 'Pangsub', is_active: true/.test(dbSeed) && /id: 'OFF-PERAWATAN', name: 'Kantor Perawatan', is_active: false/.test(dbSeed)],
  ['Persistence fallback agrees with current office sites and keeps closed office inactive', /id: 'OFF-KP', name: 'HO', is_active: true/.test(persistence) && /id: 'OFF-PIBC', name: 'PIBC', is_active: true/.test(persistence) && /id: 'OFF-RPC', name: 'RPC\/SC', is_active: true/.test(persistence) && /id: 'OFF-PANGSUB', name: 'Pangsub', is_active: true/.test(persistence) && /id: 'OFF-PERAWATAN', name: 'Kantor Perawatan', is_active: false/.test(persistence)],
  ['Office migration deactivates retired Perawatan without deleting history', /UPDATE org_office_locations[\s\S]*WHEN 'OFF-PERAWATAN' THEN FALSE/.test(read('server/migrations/033_current_office_location_master.sql')) && !/DELETE FROM org_office_locations/.test(read('server/migrations/033_current_office_location_master.sql'))],

  ['Fresh schema seeds Umum and Audit divisions before their org-unit foreign keys', /INSERT INTO divisions \(code, name\)[\s\S]*'Umum'[\s\S]*'Audit'[\s\S]*CREATE TABLE IF NOT EXISTS org_units/.test(orgMasterMigration)],

  ['Owner domains are synchronized from the configurable division master before PostgreSQL FK-backed data', /for \(const division of db\.divisions \|\| \[\]\)/.test(persistence) && /INSERT INTO divisions \(code,name,is_active\)/.test(persistence)],
  ['Asset categories and new assets require owner codes from the configured master', /db\.divisions \|\| \[\]\)\.some\(d => String\(d\.code\)/.test(server) && /const configuredOwner = \(db\.divisions \|\| \[\]\)\.some/.test(services)],
  ['Contract visibility and edits follow any explicit owner scope, not IT/GA whitelist', /if \(!owner\) return false;/.test(contracts) && !/owner !== 'IT' && owner !== 'GA'/.test(contracts) && /hasRbacScope\(String\(user\.id\), 'division', owner, 'contracts'\)/.test(contracts)],

  ['ERP reconciliation reads only the actor visible asset scope', /const visibleAssets = isSuperadminActor\(actor\) \|\| actor\.role === 'Auditor'[\s\S]*GabahDomainService\.getScopedAssets\(actor\)[\s\S]*getReconciliationData\(visibleAssets\)/.test(server) && /static getReconciliationData\(assets: ServerAsset\[\] = db\.assets\)/.test(services)],
  ['ERP reconciliation linking requires asset update permission and matching owner scope', /app\.post\('\/api\/reconciliation\/link'[\s\S]*canMutateAssetOwner\(actor, asset\.owner_division, 'assets\.update'\)/.test(server)],
  ['Inactive owner masters stay inactive in PostgreSQL and cannot receive new assets', /VALUES \(\$1,\$2,\$3\)[\s\S]*is_active=EXCLUDED\.is_active/.test(persistence) && /division\.is_active !== false/.test(services)],
  ['Owner exclusion cannot be bypassed by unit/location scope', /const excluded = scopes\.some\(scope => scope\.type === 'division_except'[\s\S]*const explicitOwnerGrant = scopes\.some\(scope => scope\.type === 'division'[\s\S]*otherScopedGrant = !excluded/.test(services)],
  ['Owner exclusions are a first-class dynamic scope and preserve explicit owner grants', /division_except/.test(policy) && /division_except/.test(services) && /result\.all = true;[\s\S]*result\.excludedDivisions\.add\(value\)/.test(services) && /authority\.excludedDivisions\.has\(owner\)/.test(services) && /scope_type IN \('all', 'own', 'division', 'division_except', 'unit', 'location'\)/.test(read('server/migrations/032_rbac_owner_scope_exclusions.sql'))],
  ['Superadmin can configure all-owner-except scopes in the role editor and API', /option value="division_except">Semua owner kecuali/.test(read('src/components/modals/AdministrationModal.tsx')) && /'division_except'/.test(server)],
  ['Dynamic asset visibility is owner-code agnostic and scope-driven', /const owner = String\(asset\.owner_division \|\| ''\)\.trim\(\)\.toUpperCase\(\);\s*if \(!owner\) return false;/.test(services) && /case 'division':[\s\S]*textEquals\(asset\.owner_division, scope\.value\)/.test(services) && /assetMatchesAssetScope\(asset, scope, user\)/.test(services)],
  ['GA and additional capabilities retain explicitly scoped owner domains', /const dynamicAssets = filterAssetsByDynamicScopes\(db\.assets, user\)/.test(services) && /\.\.\.dynamicAssets, \.\.\.readOnlyItWorkstations/.test(services)],
  ['GA IT read scope memerlukan permission khusus', /hasRbacPermission\(String\(user\.id\), 'assets\.read\.it_workstations'\)/.test(services)],
  ['GA IT read scope dibatasi taxonomy HLT dan HPC', /\['HLT', 'HPC'\]\.includes\(String\(asset\.category_code/.test(services) && /readOnlyItWorkstations/.test(services)],
  ['Asset creation authorization is not hardcoded to job-title labels', /Effective permission and explicit owner-domain scope are enforced by/.test(server) && !/if \(actor\.role === 'Karyawan'\)[\s\S]{0,180}wewenang mendaftarkan aset baru/.test(server)],
  ['Tidak ada lagi scope aset berdasarkan lokasi SC/PIBC di resolver utama', !/user\.role === 'Supply Chain'[\s\S]{0,500}owner_division === 'SC'|user\.role === 'PIBC'[\s\S]{0,500}owner_division === 'PIBC'/.test(services)],
  ['Direct asset guard memakai permission GA yang sama', /hasRbacPermission\(String\(actor\.id\), 'assets\.read\.it_workstations'\)/.test(hardening)],
  ['Direct asset guard menggunakan dynamic scope untuk custom role', /assetVisibleUnderDynamicScopes\(actor, asset\)/.test(hardening)],
  ['GA read permission didaftarkan khusus untuk role GA', /'assets\.read\.it_workstations'[\s\S]*?WHERE r\.role_key = 'ga'/.test(migration)],
  ['Permission khusus tidak memberi permission mutasi', !/assets\.(create|update|delete|assign|move|lifecycle)/.test(migration)],
  ['RBAC policy mengevaluasi permission efektif per user', /export function hasRbacPermission/.test(policy)],
  ['Branch migration does not rewrite user role or work-unit assignments', !/\b(UPDATE|DELETE|INSERT|MERGE)\b/i.test(branchMigration.replace(/--[^\n]*/g, ''))],
  ['Branch migration preserves role templates and operational units', /RPC\/SC may also be an operational asset-owning function/i.test(branchMigration) && !/UPDATE gabah_roles|UPDATE org_units/i.test(branchMigration)],
  ['Branch role migration does not rewrite historical asset ownership', !/UPDATE assets|UPDATE gabah_assets|owner_division\s*=/.test(branchMigration)],
  ['Movement history is restricted to the same visible asset scope', /visibleAssetIds[\s\S]*db\.movements\.filter\(m => visibleAssetIds\.has\(m\.asset_id\)\)/.test(server)],
  ['Maintenance schedules follow visible asset scope and exclude branch-wide fallback', /visibleAssetIds[\s\S]*db\.maintenances\.filter\(item => visibleAssetIds\.has\(item\.asset_id\)\)/.test(server)],
  ['Unknown owner access fails closed without explicit dynamic scopes', /if \(!owner\) return false;/.test(services) && /if \(scopes == null\) return false;/.test(services) && /assetVisibleUnderDynamicScopes\(actor, asset\)/.test(hardeningSource)],
  ['Loan operations require permission and explicit matching owner scope', /static canOperateLoan\([\s\S]*if \(!owner\) return false;[\s\S]*hasRbacPermission[\s\S]*hasRbacScope/.test(services)],
  ['Full asset catalogue menu requires its own explicit permission', /assets\.catalog\.read/.test(read('src/navigation/roleNavigation.ts')) && /assets\.catalog\.read/.test(read('server/migrations/027_dynamic_rbac_asset_catalog_read.sql'))],
  ['New assets require a configured owner master plus explicit create permission and owner scope', /const configuredOwner = \(db\.divisions \|\| \[\]\)\.some/.test(services) && /canMutateAssetOwner\(actor, resolvedOwnerDivision, 'assets.create'\)/.test(services)],
  ['Asset mutation is not hardcoded to IT/GA owner names', !/Only IT and GA are active asset-owner domains/.test(services) && /authority.divisions.has\(owner\)/.test(services)],
  ['Loan owner authorization is independent of physical site', /Loan authority follows the asset's actual owner domain/.test(services) && /hasRbacScope\(String\(actor.id\), 'division', owner, 'loans'\)/.test(services)],
  ['Employee movement history excludes unassigned loanable-pool inventory', /employeeBaseline[\s\S]*asset\.assigned_to\?\.id === actor\.id[\s\S]*db\.movements\.filter/.test(server)],
  ['Private agenda fields are redacted from GA/IT operational queues', /title: 'Reservasi ruang rapat'[\s\S]*description: undefined[\s\S]*attendees_list: undefined[\s\S]*documentation_notes: undefined/.test(server)],
  ['Employee directory is gated by users.read', /app\.get\('\/api\/users', \(req, res\) => \{[\s\S]*requireRbacPermission\(req, res, 'users\.read'\)[\s\S]*!\['IT', 'GA'\]\.includes\(actor\.role\)/i.test(server)],
  ['Knowledge vote and view actions require their read/action permissions', /app\.post\('\/api\/knowledge\/:id\/vote', \(req, res\) => \{\s*if \(!requireRbacPermission\(req, res, 'knowledge\.vote'\)\) return;/i.test(server) && /app\.post\('\/api\/knowledge\/:id\/view', \(req, res\) => \{\s*if \(!requireRbacPermission\(req, res, 'knowledge\.read'\)\) return;/i.test(server)],
  ['Ticket list visibility follows reporter, assignee, and explicit module owner scope', /canReadTicketOwner = \(owner: string\)/.test(server) && /hasRbacScope\(String\(actor.id\), 'division', owner, 'tickets'\)/.test(server) && /ticket\.assigned_agent_id === actor\.id/.test(hardeningSource)],
  ['Dashboard ticket counts reuse dynamic ticket owner scope and personal visibility', /canReadOwnerScope = \(owner: string, module: 'loans' \| 'tickets'\)/.test(server) && /canReadOwnerScope\(ticket\.category, 'tickets'\)/.test(server) && /ticket\.reporter_id === actor\.id/.test(server)],
  ['Loan list and dashboard counts follow borrower and explicit owner scope', /hasRbacScope\(String\(actor.id\), 'division', loan\.owner_division, 'loans'\)/.test(server) && /canReadOwnerScope\(loan\.owner_division, 'loans'\)/.test(server) && /loans\.approve[\s\S]*hasRbacScope/.test(services)],
  ['User-targeted notifications cannot be read or marked by same-role colleagues', /if \(notification\.recipient_user_id\) return notification\.recipient_user_id === actor\.id;[\s\S]*if \(notification\.recipient_role\) return notification\.recipient_role === actor\.role;/.test(server) && /recipient_user_id \? n\.recipient_user_id === actor\.id[\s\S]*recipient_role \? n\.recipient_role === actor\.role/.test(server)],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}`);
  if (!ok) failed++;
}
console.log(`TOTAL: ${checks.length} | PASS: ${checks.length - failed} | FAIL: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
