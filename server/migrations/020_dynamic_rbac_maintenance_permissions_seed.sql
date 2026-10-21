-- Dynamic RBAC Stage 13F: Maintenance schedule permissions.
-- Mirror of the effective legacy behavior on GET/POST/PATCH /api/maintenances
-- (files-store rules), so enabling PostgreSQL authorization does not close or
-- widen any canonical legacy role:
--   maintenances.read    → all nine canonical legacy roles (read today is
--                          effectively open to every legacy role; the read
--                          filter differences per role are preserved in the
--                          route, not in the permission).
--   maintenances.create  → superadmin, it, ga (legacy allowlist; SC and PIBC
--                          are deliberately excluded — legacy behavior).
--   maintenances.update  → superadmin, it, ga (same legacy allowlist).
-- Custom role assignments receive no implicit grant; a Superadmin may grant
-- these permissions explicitly via the RBAC role-permission API. Additive and
-- idempotent; the migration runner owns the transaction.

INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, 'maintenances.read'
FROM gabah_roles r
WHERE r.role_key IN (
  'superadmin',
  'it',
  'ga',
  'supply_chain',
  'pibc',
  'karyawan',
  'auditor',
  'sekretaris_direksi',
  'humas'
)
  AND r.is_active = TRUE
ON CONFLICT (role_id, permission_key) DO NOTHING;

INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM gabah_roles r
JOIN gabah_permissions p
  ON p.permission_key IN ('maintenances.create', 'maintenances.update')
WHERE r.role_key IN ('superadmin', 'it', 'ga')
  AND r.is_active = TRUE
  AND p.is_active = TRUE
ON CONFLICT (role_id, permission_key) DO NOTHING;
