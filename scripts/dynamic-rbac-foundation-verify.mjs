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
const ticketReadCreatePermissionSeed = fs.readFileSync('server/migrations/017_dynamic_rbac_ticket_read_create_seed.sql', 'utf8');
const ticketUpdatePermissionSeed = fs.readFileSync('server/migrations/018_dynamic_rbac_ticket_update_seed.sql', 'utf8');
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
  ['frontend role manager uses live database APIs', /Dynamic Role Management/i.test(frontend) && /gabahApi\.getRbacRoles\(\)/i.test(frontend) && /gabahApi\.getRbacPermissions\(\)/i.test(frontend)],
  ['frontend supports create, rename, delete, deactivate, permissions, and scopes', /handleCreateRbacRole/i.test(frontend) && /handleSaveRbacRole/i.test(frontend) && /handleDeleteRbacRole/i.test(frontend) && /handleToggleRbacRole/i.test(frontend) && /handleSaveRbacPermissions/i.test(frontend) && /handleSaveRbacScopes/i.test(frontend)],
  ['frontend API client exposes Dynamic RBAC operations', /getRbacRoles/i.test(apiClient) && /createRbacRole/i.test(apiClient) && /deleteRbacRole/i.test(apiClient) && /setRbacRolePermissions/i.test(apiClient) && /setRbacRoleScopes/i.test(apiClient)],
  ['legacy browser-only role matrix is hidden from the live roles screen', /\{false && activeSection === 'roles' && \(/i.test(frontend)],
  ['legacy backfill does not assign permissions before authorization mapping', !/INSERT INTO gabah_role_permissions/i.test(backfill)],
  ['ticket list endpoint has dynamic read permission gate', /app\.get\('\/api\/tickets'[\s\S]{0,180}requireRbacPermission\(req, res, 'tickets\.read'\)/i.test(server)],
  ['ticket creation endpoint has dynamic create permission gate', /app\.post\('\/api\/tickets'[\s\S]{0,180}requireRbacPermission\(req, res, 'tickets\.create'\)/i.test(server)],
  ['ticket permission seed grants read only to canonical legacy roles', /tickets\.read[\s\S]{0,450}superadmin[\s\S]{0,180}auditor/i.test(ticketReadCreatePermissionSeed) && /ON CONFLICT \(role_id, permission_key\) DO NOTHING/i.test(ticketReadCreatePermissionSeed)],
  ['ticket creation permission excludes Auditor and custom roles', /tickets\.create[\s\S]{0,450}karyawan/i.test(ticketReadCreatePermissionSeed) && !/tickets\.create[\s\S]{0,500}auditor/i.test(ticketReadCreatePermissionSeed) && !/INSERT INTO gabah_role_permissions[\s\S]{0,100}custom/i.test(ticketReadCreatePermissionSeed)],
  ['ticket status endpoint has dynamic update permission gate', /app\.patch\('\/api\/tickets\/:id\/status'[\s\S]{0,180}requireRbacPermission\(req, res, 'tickets\.update'\)/i.test(server)],
  ['ticket update seed grants only roles with legacy ticket management authority', /tickets\.update[\s\S]{0,400}superadmin[\s\S]{0,200}karyawan/i.test(ticketUpdatePermissionSeed) && /ON CONFLICT \(role_id, permission_key\) DO NOTHING/i.test(ticketUpdatePermissionSeed)],
  ['ticket update seed excludes Auditor, Humas, Sekretaris Direksi and custom roles', !/tickets\.update[\s\S]{0,500}auditor/i.test(ticketUpdatePermissionSeed) && !/tickets\.update[\s\S]{0,500}humas/i.test(ticketUpdatePermissionSeed) && !/tickets\.update[\s\S]{0,500}sekretaris_direksi/i.test(ticketUpdatePermissionSeed)],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}`);
  if (!ok) failed++;
}
console.log(`Dynamic RBAC foundation: ${checks.length - failed}/${checks.length} checks passed.`);
if (failed) process.exit(1);
