-- Dynamic RBAC Stage 9: asset catalogue read permission.
-- Grants read access only to the existing canonical legacy roles; custom roles
-- receive no permission implicitly. Scope filtering remains in the domain service.
-- The migration runner owns the transaction; this file is idempotent.

INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, 'assets.read'
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
