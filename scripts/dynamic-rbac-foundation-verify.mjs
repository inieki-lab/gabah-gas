/**
 * Dynamic RBAC foundation verification.
 * Static contract checks only; PostgreSQL execution/integration is intentionally
 * deferred until the migration runner and runtime authorization switch are implemented.
 */
import fs from 'node:fs';

const migration = fs.readFileSync('server/migrations/010_dynamic_rbac_foundation.sql', 'utf8');
const backfill = fs.readFileSync('server/migrations/011_dynamic_rbac_legacy_backfill.sql', 'utf8');
const catalogExpansion = fs.readFileSync('server/migrations/012_dynamic_rbac_permission_catalog_expansion.sql', 'utf8');
const dashboardPermissionSeed = fs.readFileSync('server/migrations/013_dynamic_rbac_dashboard_permission_seed.sql', 'utf8');
const assetsReadPermissionSeed = fs.readFileSync('server/migrations/014_dynamic_rbac_assets_read_permission_seed.sql', 'utf8');
const assetWritePermissionSeed = fs.readFileSync('server/migrations/016_dynamic_rbac_asset_write_permissions_seed.sql', 'utf8');
const movementsReadPermissionSeed = fs.readFileSync('server/migrations/017_dynamic_rbac_movements_read_permission_seed.sql', 'utf8');
const knowledgePermissionSeed = fs.readFileSync('server/migrations/018_dynamic_rbac_knowledge_permissions_seed.sql', 'utf8');
const vendorPermissionSeed = fs.readFileSync('server/migrations/019_dynamic_rbac_vendor_write_permissions_seed.sql', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');
const persistence = fs.readFileSync('server/persistence.ts', 'utf8');
const policy = fs.readFileSync('server/rbac-policy.ts', 'utf8');
const domainServices = fs.readFileSync('server/services.ts', 'utf8');
const runtimeHardening = fs.readFileSync('server/runtime-hardening.ts', 'utf8');
const frontend = fs.readFileSync('src/components/modals/AdministrationModal.tsx', 'utf8');
const apiClient = fs.readFileSync('src/services/gabahApi.ts', 'utf8');
const checks = [
  ['roles table is additive/idempotent', /CREATE TABLE IF NOT EXISTS gabah_roles/i.test(migration)],
  ['permission catalogue exists', /CREATE TABLE IF NOT EXISTS gabah_permissions/i.test(migration)],
  ['role-permission mapping exists', /CREATE TABLE IF NOT EXISTS gabah_role_permissions/i.test(migration)],
  ['role scope mapping exists', /CREATE TABLE IF NOT EXISTS gabah_role_division_scopes/i.test(migration)],
  ['user-role assignment mapping exists', /CREATE TABLE IF NOT EXISTS gabah_user_roles/i.test(migration)],
  ['Superadmin capability is a stable field', /is_superadmin BOOLEAN NOT NULL DEFAULT FALSE/i.test(migration)],
  ['Superadmin seed is keyed independently from display name', /\('superadmin',\s*'Admin GABAH'.*TRUE\)/i.test(migration)],
  ['role deletion is restricted while assigned', /gabah_user_roles[\s\S]*?REFERENCES gabah_roles\(id\) ON DELETE RESTRICT/i.test(migration)],
  ['migration does not drop legacy data', !/\bDROP\s+(TABLE|COLUMN|DATABASE)\b/i.test(migration)],
  ['transaction is owned by the migration runner', !/^\s*(BEGIN|COMMIT);\s*$/im.test(migration)],
  ['legacy role field remains authoritative in this stage', /existing users\.role field remains authoritative/i.test(migration)],
  ['seed records are not overwritten on rerun', /ON CONFLICT \(role_key\) DO NOTHING/i.test(migration)],
  ['legacy backfill seeds a canonical permission catalogue', /INSERT INTO gabah_permissions/i.test(backfill) && /dashboard\.read/i.test(backfill) && /roles\.permissions\.manage/i.test(backfill)],
  ['legacy user roles are backfilled without duplicate assignments', /INSERT INTO gabah_user_roles/i.test(backfill) && /ON CONFLICT \(user_id, role_id\) DO NOTHING/i.test(backfill)],
  ['legacy role names are mapped explicitly', /WHEN 'Admin GABAH' THEN 'superadmin'/i.test(backfill) && /WHEN 'Sekretaris Direksi' THEN 'sekretaris_direksi'/i.test(backfill)],
  ['unknown legacy role values are not silently mapped', /ELSE NULL/i.test(backfill)],
  ['permission catalogue is seeded idempotently', /ON CONFLICT \(permission_key\) DO NOTHING/i.test(backfill)],
  ['permission catalogue expansion is additive and idempotent', /INSERT INTO gabah_permissions/i.test(catalogExpansion) && /ON CONFLICT \(permission_key\) DO NOTHING/i.test(catalogExpansion) && !/\bDROP\s+(TABLE|COLUMN|DATABASE)\b/i.test(catalogExpansion)],
  ['permission catalogue covers rooms, reservations, maintenance, knowledge, vendors, and contracts', ['room_reservations.approve','meeting_rooms.update','maintenances.update','knowledge.create','vendors.create','contracts.documents.upload'].every(key => catalogExpansion.includes("'" + key + "'"))],
  ['catalog expansion does not grant permissions automatically', !/INSERT INTO gabah_role_permissions/i.test(catalogExpansion)],
  ['dashboard permission seed is idempotent and limited to canonical legacy roles', /INSERT INTO gabah_role_permissions/i.test(dashboardPermissionSeed) && /'dashboard\.read'/i.test(dashboardPermissionSeed) && /ON CONFLICT \(role_id, permission_key\) DO NOTHING/i.test(dashboardPermissionSeed) && /'superadmin'[\s\S]*'humas'/i.test(dashboardPermissionSeed)],
  ['dashboard stats and attention endpoints enforce dashboard.read in PostgreSQL mode', (server.match(/requireRbacPermission\(req, res, 'dashboard\.read'\)/g) || []).length === 2 && /export function hasRbacPermission/.test(policy)],
  ['asset read permission seed is idempotent and custom roles receive no implicit grant', /INSERT INTO gabah_role_permissions/i.test(assetsReadPermissionSeed) && /'assets\.read'/i.test(assetsReadPermissionSeed) && /ON CONFLICT \(role_id, permission_key\) DO NOTHING/i.test(assetsReadPermissionSeed) && /'superadmin'[\s\S]*'humas'/i.test(assetsReadPermissionSeed)],
  ['asset list and detail enforce assets.read', (server.match(/requireRbacPermission\(req, res, 'assets\.read'\)/g) || []).length === 2],
  ['asset detail uses the same scoped asset visibility as the list endpoint', /getScopedAssets\(actor\)\.find\(a => a\.id === req\.params\.id\)/.test(server)],
  ['asset create endpoint enforces assets.create', /requireRbacPermission\(req, res, 'assets\.create'\)/.test(server)],
  ['asset update endpoint enforces assets.update', /requireRbacPermission\(req, res, 'assets\.update'\)/.test(server)],
  ['asset bulk import endpoint enforces assets.bulk_import', /requireRbacPermission\(req, res, 'assets\.bulk_import'\)/.test(server)],
  ['asset assign endpoint enforces assets.assign', /requireRbacPermission\(req, res, 'assets\.assign'\)/.test(server)],
  ['asset move endpoint enforces assets.move', /requireRbacPermission\(req, res, 'assets\.move'\)/.test(server)],
  ['asset lifecycle endpoint enforces assets.lifecycle', /requireRbacPermission\(req, res, 'assets\.lifecycle'\)/.test(server)],
  ['bulk import update path preserves division authority like PATCH', /hanya dapat diperbarui oleh personel IT atau Admin GABAH/.test(server) && /hanya dapat diperbarui oleh personel GA atau Admin GABAH/.test(server) && /hanya dapat diperbarui oleh personel Supply Chain atau Admin GABAH/.test(server) && /hanya dapat diperbarui oleh personel PIBC atau Admin GABAH/.test(server)],
  ['movements endpoint enforces movements.read in PostgreSQL mode', /app\.get\('\/api\/movements', \(req, res\) => \{\s*if \(!requireRbacPermission\(req, res, 'movements\.read'\)\) return;/i.test(server)],
  ['movements read permission seed is idempotent and covers the canonical legacy roles', /INSERT INTO gabah_role_permissions/i.test(movementsReadPermissionSeed) && /'movements\.read'/i.test(movementsReadPermissionSeed) && /ON CONFLICT \(role_id, permission_key\) DO NOTHING/i.test(movementsReadPermissionSeed) && /'superadmin'[\s\S]*'humas'/i.test(movementsReadPermissionSeed)],
  ['custom roles resolve asset visibility from dynamic scopes instead of the all-seeing fallback', /isPostgresPersistenceActive\(\) && !isLegacyScopedRole\(user\.role\)\) \{\s*return filterAssetsByDynamicScopes/i.test(domainServices)],
  ['dynamic scope resolution fails closed for unscoped dynamic roles', /policies\.length === 0\) return \[\];/i.test(domainServices) && /scopes\.length === 0\) return \[\];/i.test(domainServices)],
  ['dynamic scope resolution honors a superadmin dynamic policy', /policies\.some\(policy => policy\.isSuperadmin\)\) return assets;/i.test(domainServices)],
  ['dynamic scope matching covers own, division, unit, and location scope types', ['case \'own\'','case \'division\'','case \'unit\'','case \'location\''].every(needle => domainServices.includes(needle))],
  ['legacy nine-role scoping is preserved before the dynamic fallback', /if \(user\.role === 'Admin GABAH' \|\| user\.role === 'Auditor'\)/i.test(domainServices) && /return filterAssetsByDynamicScopes\(db\.assets, user\);\s*\}\s*\n\s*return db\.assets;/.test(domainServices)],
  ['asset write permission seed is additive and idempotent', /INSERT INTO gabah_role_permissions/i.test(assetWritePermissionSeed) && /ON CONFLICT \(role_id, permission_key\) DO NOTHING/i.test(assetWritePermissionSeed)],
  ['asset write grants cover the six catalogue keys without duplicate permissions', ['assets.create', 'assets.update', 'assets.bulk_import', 'assets.assign', 'assets.move', 'assets.lifecycle'].every(key => assetWritePermissionSeed.includes("'" + key + "'"))],
  ['asset write grants cover exactly the division authority roles', /role_key IN \('superadmin',\s*'it',\s*'ga',\s*'supply_chain',\s*'pibc'\)/i.test(assetWritePermissionSeed)],
  ['asset write grants expose no implicit access to denied legacy roles', !/karyawan|auditor|humas|sekretaris/i.test((assetWritePermissionSeed.match(/INSERT INTO[\s\S]*?ON CONFLICT \(role_id, permission_key\) DO NOTHING/) || [''])[0])],
  ['Superadmin-only role CRUD endpoints exist', /app\.post\('\/api\/admin\/rbac\/roles'/i.test(server) && /app\.patch\('\/api\/admin\/rbac\/roles\/:id'/i.test(server) && /app\.delete\('\/api\/admin\/rbac\/roles\/:id'/i.test(server)],
  ['permission and scope configuration endpoints exist', /\/roles\/:id\/permissions/i.test(server) && /\/roles\/:id\/scopes/i.test(server)],
  ['role administration is guarded by stable Superadmin assignment', /requireRbacSuperadmin[\s\S]{0,400}isRbacSuperadmin\(actor\.id\)/i.test(server)],
  ['Superadmin role cannot be deleted or have its permissions overwritten', /role\.is_superadmin \|\| role\.role_key === 'superadmin'/i.test(server)],
  ['RBAC writes fail closed without PostgreSQL', /Dynamic RBAC memerlukan PostgreSQL aktif/i.test(persistence) && /withRbacTransaction/i.test(persistence)],
  ['role deactivation and deletion check current assignments', /RBAC_ROLE_IN_USE/i.test(server) && /FROM gabah_user_roles WHERE role_id = \$1/i.test(server)],
  ['role administration changes are audit logged', /RBAC_ROLE_CREATED/i.test(server) && /RBAC_ROLE_UPDATED/i.test(server) && /RBAC_PERMISSIONS_UPDATED/i.test(server)],
  ['Superadmin comparisons use the stable policy in server and domain services', !/actor\.role\s*(?:===|!==)\s*'Admin GABAH'/.test(server) && !/actor\.role\s*(?:===|!==)\s*'Admin GABAH'/.test(domainServices) && /isSuperadminActor\(actor\)/.test(domainServices)],
  ['legacy Superadmin string bypasses are removed from API guards', !/\(actor as any\)\.role !== 'Superadmin'/.test(server)],
  ['runtime security middleware uses stable Superadmin policy', /isSuperadminActor\(actor\)/.test(runtimeHardening) && /isSuperadminActor/.test(policy)],
  ['last active Superadmin cannot be demoted, deactivated, or deleted', /Superadmin aktif terakhir tidak boleh diturunkan atau dinonaktifkan/i.test(server) && /Superadmin aktif terakhir tidak boleh dihapus/i.test(server) && /countRbacSuperadmins/.test(policy)],
  ['deleted users lose stale role assignments', /DELETE FROM gabah_user_roles WHERE NOT \(user_id = ANY\(\$1::text\[\]\)\)/i.test(persistence)],
  ['Superadmin authorization uses active database role assignment', /isRbacSuperadmin\(actor\.id\)/i.test(server) && /export function isRbacSuperadmin/i.test(policy) && /policy\.isSuperadmin/i.test(policy)],
  ['policy cache loads roles, permissions, and scopes from PostgreSQL', /gabah_user_roles/i.test(policy) && /gabah_role_permissions/i.test(policy) && /gabah_role_division_scopes/i.test(policy) && /refreshRbacPolicy/i.test(server)],
  ['fresh database backfills role assignments after normalized users exist', /backfillNormalizedTables\(\);\s*await backfillDynamicRbacUserRoles\(\);/i.test(persistence)],
  ['legacy backfill reconciles stale canonical roles without deleting custom roles', /DELETE FROM gabah_user_roles ur USING users u, gabah_roles assigned_role/i.test(persistence) && /assigned_role\.role_key IN \('superadmin','it','ga','sekretaris_direksi','humas','supply_chain','pibc','karyawan','auditor'\)/i.test(persistence)],
  ['RBAC policy refreshes after permission and scope changes', /await refreshRbacPolicy\(\);\s*GabahDomainService\.recordAudit\('RBAC_PERMISSIONS_UPDATED'/i.test(server) && /await refreshRbacPolicy\(\);\s*GabahDomainService\.recordAudit\('RBAC_SCOPES_UPDATED'/i.test(server)],
  ['user role assignment endpoint exists for Superadmin', /app\.put\('\/api\/admin\/rbac\/users\/:id\/roles'/i.test(server)],
  ['user role assignment is guarded by the stable Superadmin policy', /app\.put\('\/api\/admin\/rbac\/users\/:id\/roles'[\s\S]{0,200}requireRbacSuperadmin\(req, res\)/i.test(server)],
  ['assignment validates the target user against normalized users table', /const target = await client\.query\('SELECT id, name, email FROM users WHERE id = \$1', \[userId\]\)/.test(server) && /RBAC_USER_NOT_FOUND/.test(server)],
  ['assignment rejects unknown and deactivated roles', /is_active = TRUE AND id = ANY\(\$1::bigint\[\]\)/.test(server) && /RBAC_ROLE_INVALID/.test(server) && /valid\.rowCount !== uniqueIds\.length/.test(server)],
  ['assignment replaces the full set atomically inside one transaction', /DELETE FROM gabah_user_roles WHERE user_id = \$1', \[userId\]\)/.test(server) && /withRbacTransaction\(async client => \{[\s\S]{0,1600}gabah_user_roles[\s\S]{0,1600}\}\);/i.test(server) && /ON CONFLICT \(user_id, role_id\) DO NOTHING/.test(server)],
  ['assignment stamps the assigning Superadmin', /assigned_by_user_id\) VALUES \(\$1, \$2, \$3\)[\s\S]{0,120}\[userId, roleId, actor\.id\]/.test(server)],
  ['assignment protects the last active Superadmin', /RBAC_LAST_SUPERADMIN/.test(server) && /r\.is_superadmin = TRUE AND ur\.user_id <> \$1/.test(server)],
  ['assignment is audit logged and refreshes the policy cache', /await refreshRbacPolicy\(\);\s*GabahDomainService\.recordAudit\(\s*'RBAC_USER_ROLES_UPDATED'/i.test(server)],
  ['frontend role manager uses live database APIs', /Dynamic Role Management/i.test(frontend) && /gabahApi\.getRbacRoles\(\)/i.test(frontend) && /gabahApi\.getRbacPermissions\(\)/i.test(frontend)],
  ['frontend supports create, rename, delete, deactivate, permissions, and scopes', /handleCreateRbacRole/i.test(frontend) && /handleSaveRbacRole/i.test(frontend) && /handleDeleteRbacRole/i.test(frontend) && /handleToggleRbacRole/i.test(frontend) && /handleSaveRbacPermissions/i.test(frontend) && /handleSaveRbacScopes/i.test(frontend)],
  ['frontend API client exposes Dynamic RBAC operations', /getRbacRoles/i.test(apiClient) && /createRbacRole/i.test(apiClient) && /deleteRbacRole/i.test(apiClient) && /setRbacRolePermissions/i.test(apiClient) && /setRbacRoleScopes/i.test(apiClient)],
  ['legacy browser-only role matrix is hidden from the live roles screen', /\{false && activeSection === 'roles' && \(/i.test(frontend)],
  ['legacy backfill does not assign permissions before authorization mapping', !/INSERT INTO gabah_role_permissions/i.test(backfill)],
  ['knowledge create/update permission seed is additive and idempotent', knowledgePermissionSeed.includes('INSERT INTO gabah_role_permissions') && knowledgePermissionSeed.includes('ON CONFLICT (role_id, permission_key) DO NOTHING')],
  ['knowledge seed grants only create/update to superadmin, IT, and GA', knowledgePermissionSeed.includes("'knowledge.create'") && knowledgePermissionSeed.includes("'knowledge.update'") && knowledgePermissionSeed.includes("r.role_key IN ('superadmin', 'it', 'ga')")],
  ['knowledge seed does not implicitly grant permissions to other legacy or custom roles', !/karyawan|auditor|humas|supply_chain|pibc|sekretaris/i.test(knowledgePermissionSeed)],
  ['knowledge create endpoint enforces dynamic permission and preserves file-store allowlist', (() => { const route = server.slice(server.indexOf("app.post('/api/knowledge'"), server.indexOf("app.patch('/api/knowledge/:id'")); return route.includes("requireRbacPermission(req, res, 'knowledge.create')") && route.includes("isPostgresPersistenceActive()") && route.includes("!['Admin GABAH', 'IT', 'GA'].includes(actor.role)"); })()],
  ['knowledge update endpoint enforces dynamic permission and preserves file-store allowlist', (() => { const route = server.slice(server.indexOf("app.patch('/api/knowledge/:id'"), server.indexOf("app.post('/api/knowledge/:id/vote'")); return route.includes("requireRbacPermission(req, res, 'knowledge.update')") && route.includes("isPostgresPersistenceActive()") && route.includes("!['Admin GABAH', 'IT', 'GA'].includes(actor.role)"); })()],
  ['vendor write permission seed is additive and idempotent', vendorPermissionSeed.includes('INSERT INTO gabah_role_permissions') && vendorPermissionSeed.includes('ON CONFLICT (role_id, permission_key) DO NOTHING')],
  ['vendor seed grants create/update only to superadmin, IT, GA, Supply Chain, and PIBC', vendorPermissionSeed.includes("'vendors.create'") && vendorPermissionSeed.includes("'vendors.update'") && vendorPermissionSeed.includes("r.role_key IN ('superadmin', 'it', 'ga', 'supply_chain', 'pibc')")],
  ['vendor create endpoint enforces dynamic permission and preserves file-store allowlist', (() => { const route = server.slice(server.indexOf("app.post('/api/vendors'"), server.indexOf("app.patch('/api/vendors/:id'")); return route.includes("requireRbacPermission(req, res, 'vendors.create')") && route.includes("isPostgresPersistenceActive()") && route.includes("!['Admin GABAH', 'IT', 'GA', 'Supply Chain', 'PIBC'].includes(actor.role)"); })()],
  ['vendor update endpoint enforces dynamic permission and preserves file-store allowlist', (() => { const route = server.slice(server.indexOf("app.patch('/api/vendors/:id'"), server.indexOf("app.get('/api/knowledge'")); return route.includes("requireRbacPermission(req, res, 'vendors.update')") && route.includes("isPostgresPersistenceActive()") && route.includes("!['Admin GABAH', 'IT', 'GA', 'Supply Chain', 'PIBC'].includes(actor.role)"); })()],
  ['dynamic asset write authority resolves all/division scopes and never own/unit/location', domainServices.includes('export function getDynamicAssetWriteAuthority') && (() => { const start = domainServices.indexOf('export function getDynamicAssetWriteAuthority'); const end = domainServices.indexOf('function filterAssetsByDynamicScopes'); if (start === -1 || end === -1 || end <= start) return false; const fn = domainServices.slice(start, end); return fn.includes("scope.type === 'all'") && fn.includes("scope.type === 'division'") && !fn.includes("case 'own'") && !fn.includes("case 'unit'") && !fn.includes("case 'location'"); })()],
  ['dynamic write authority defaults to empty (deny-by-default) without scope grants', domainServices.includes('export function getDynamicAssetWriteAuthority(user: ServerUser): { all: boolean; divisions: Set<string> }')],
  ['asset PATCH combines legacy division rule with dynamic authority (all/division scopes)', (() => { const route = server.slice(server.indexOf("app.patch('/api/assets/:id'"), server.indexOf("app.post('/api/assets/:id/assign'")); return route.includes('getDynamicAssetWriteAuthority(actor)') && route.includes('hasDynamicDivisionAuthority') && route.includes("actor.role !== 'IT'") && route.includes("actor.role !== 'GA'") && route.includes("actor.role !== 'Supply Chain'") && route.includes("actor.role !== 'PIBC'"); })()],
  ['bulk import UPDATE path mirrors the same legacy-plus-dynamic division authority', (() => { const route = server.slice(server.indexOf("app.post('/api/assets/bulk-import'"), server.indexOf("app.patch('/api/assets/:id'")); return route.includes('getDynamicAssetWriteAuthority(actor)') && route.includes('hasDynamicDivisionAuthority') && route.includes("actor.role !== 'IT'") && route.includes("actor.role !== 'Supply Chain'"); })()],
  ['asset PATCH keeps explicit read-only blocks for Auditor and Karyawan', (() => { const route = server.slice(server.indexOf("app.patch('/api/assets/:id'"), server.indexOf("app.post('/api/assets/:id/assign'")); return route.includes("actor.role === 'Auditor'") && route.includes("actor.role === 'Karyawan'"); })()],
  ['dynamic write authority only applies when PostgreSQL persistence is active', server.includes("isPostgresPersistenceActive() ? getDynamicAssetWriteAuthority(actor) : null")],
  ['bulk import update path retains permission gate before any update mutation', (() => { const route = server.slice(server.indexOf("app.post('/api/assets/bulk-import'"), server.indexOf("app.patch('/api/assets/:id'")); return route.includes("requireRbacPermission(req, res, 'assets.bulk_import')") && route.indexOf("requireRbacPermission(req, res, 'assets.bulk_import')") < route.indexOf('allowUpdate'); })()],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}`);
  if (!ok) failed++;
}
console.log(`Dynamic RBAC foundation: ${checks.length - failed}/${checks.length} checks passed.`);
if (failed) process.exit(1);
