/**
 * Dynamic RBAC foundation verification.
 * Static contract checks only; PostgreSQL execution/integration is intentionally
 * deferred until the migration runner and runtime authorization switch are implemented.
 */
import fs from 'node:fs';

const migration = fs.readFileSync('server/migrations/010_dynamic_rbac_foundation.sql', 'utf8');
const backfill = fs.readFileSync('server/migrations/011_dynamic_rbac_legacy_backfill.sql', 'utf8');
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
  ['legacy backfill does not assign permissions before authorization mapping', !/INSERT INTO gabah_role_permissions/i.test(backfill)),
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}`);
  if (!ok) failed++;
}
console.log(`Dynamic RBAC foundation: ${checks.length - failed}/${checks.length} checks passed.`);
if (failed) process.exit(1);
