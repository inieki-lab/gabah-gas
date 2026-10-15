/**
 * Dynamic RBAC foundation verification.
 * Static contract checks only; PostgreSQL execution/integration is intentionally
 * deferred until the migration runner and runtime authorization switch are implemented.
 */
import fs from 'node:fs';

const migration = fs.readFileSync('server/migrations/010_dynamic_rbac_foundation.sql', 'utf8');
const backfill = fs.readFileSync('server/migrations/011_dynamic_rbac_legacy_backfill.sql', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');
const persistence = fs.readFileSync('server/persistence.ts', 'utf8');
const frontend = fs.readFileSync('src/components/modals/AdministrationModal.tsx', 'utf8');
const apiClient = fs.readFileSync('src/services/gabahApi.ts', 'utf8');
const checks = [
  ['roles table is additive/idempotent', /CREATE TABLE IF NOT EXISTS gabah_roles/i.test(migration)],
  ['permission catalogue exists', /CREATE TABLE IF NOT EXISTS gabah_permissions/i.test(migration)],
  ['role-permission mapping exists', /CREATE TABLE IF NOT EXISTS gabah_role_permissions/i.test(migration)],
  ['role scope mapping exists', /CREATE TABLE IF NOT EXISTS gabah_role_division_scopes/i.test(migration)],
  ['user-role assignment mapping exists', /CREATE TABLE IF NOT EXISTS gabah_user_roles/i.test(migration)],
  ['Superadmin capability is a stable field', /is_superadmin BOOLEAN NOT NULL DEFAULT FALSE/i.test(migration)],
  ['Superadmin seed is keyed independently from display name', /\('superadmin',\s*'Admin GABAH'.*TRUE\)/i.test(migration)),
  ['role deletion is restricted while assigned', /gabah_user_roles[\s\S]*?REFERENCES gabah_roles\(id\) ON DELETE RESTRICT/i.test(migration)),
  ['migration does not drop legacy data', !/\bDROP\s+(TABLE|COLUMN|DATABASE)\b/i.test(migration)),
  ['transaction is owned by the migration runner', !/^\s*(BEGIN|COMMIT);\s*$/im.test(migration)],
  ['legacy role field remains authoritative in this stage', /existing users\.role field remains authoritative/i.test(migration)),
  ['seed records are not overwritten on rerun', /ON CONFLICT \(role_key\) DO NOTHING/i.test(migration)),
  ['legacy backfill seeds a canonical permission catalogue', /INSERT INTO gabah_permissions/i.test(backfill) && /dashboard\.read/i.test(backfill) && /roles\.permissions\.manage/i.test(backfill)),
  ['legacy user roles are backfilled without duplicate assignments', /INSERT INTO gabah_user_roles/i.test(backfill) && /ON CONFLICT \(user_id, role_id\) DO NOTHING/i.test(backfill)),
  ['legacy role names are mapped explicitly', /WHEN 'Admin GABAH' THEN 'superadmin'/i.test(backfill) && /WHEN 'Sekretaris Direksi' THEN 'sekretaris_direksi'/i.test(backfill)),
  ['unknown legacy role values are not silently mapped', /ELSE NULL/i.test(backfill)),
  ['permission catalogue is seeded idempotently', /ON CONFLICT \(permission_key\) DO NOTHING/i.test(backfill)),
  ['Superadmin-only role CRUD endpoints exist', /app\.post\('\/api\/admin\/rbac\/roles'/i.test(server) && /app\.patch\('\/api\/admin\/rbac\/roles\/:id'/i.test(server) && /app\.delete\('\/api\/admin\/rbac\/roles\/:id'/i.test(server)),
  ['permission and scope configuration endpoints exist', /\/roles\/:id\/permissions/i.test(server) && /\/roles\/:id\/scopes/i.test(server)),
  ['role administration is guarded by verified Admin GABAH identity', /requireRbacSuperadmin[\s\S]{0,300}actor\.role !== 'Admin GABAH'/i.test(server)),
  ['Superadmin role cannot be deleted or have its permissions overwritten', /role\.is_superadmin \|\| role\.role_key === 'superadmin'/i.test(server)),
  ['RBAC writes fail closed without PostgreSQL', /Dynamic RBAC memerlukan PostgreSQL aktif/i.test(persistence) && /withRbacTransaction/i.test(persistence)),
  ['role deactivation and deletion check current assignments', /RBAC_ROLE_IN_USE/i.test(server) && /FROM gabah_user_roles WHERE role_id = \$1/i.test(server)),
  ['role administration changes are audit logged', /RBAC_ROLE_CREATED/i.test(server) && /RBAC_ROLE_UPDATED/i.test(server) && /RBAC_PERMISSIONS_UPDATED/i.test(server)),
  ['frontend role manager uses live database APIs', /Dynamic Role Management/i.test(frontend) && /gabahApi\.getRbacRoles\(\)/i.test(frontend) && /gabahApi\.getRbacPermissions\(\)/i.test(frontend)),
  ['frontend supports create, rename, delete, deactivate, permissions, and scopes', /handleCreateRbacRole/i.test(frontend) && /handleSaveRbacRole/i.test(frontend) && /handleDeleteRbacRole/i.test(frontend) && /handleToggleRbacRole/i.test(frontend) && /handleSaveRbacPermissions/i.test(frontend) && /handleSaveRbacScopes/i.test(frontend)),
  ['frontend API client exposes Dynamic RBAC operations', /getRbacRoles/i.test(apiClient) && /createRbacRole/i.test(apiClient) && /deleteRbacRole/i.test(apiClient) && /setRbacRolePermissions/i.test(apiClient) && /setRbacRoleScopes/i.test(apiClient)),
  ['legacy browser-only role matrix is hidden from the live roles screen', /\{false && activeSection === 'roles' && \(/i.test(frontend)),
  ['legacy backfill does not assign permissions before authorization mapping', !/INSERT INTO gabah_role_permissions/i.test(backfill)),
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}`);
  if (!ok) failed++;
}
console.log(`Dynamic RBAC foundation: ${checks.length - failed}/${checks.length} checks passed.`);
if (failed) process.exit(1);
