-- Dynamic RBAC Stage 8: preserve dashboard access for existing canonical roles.
-- This grants only dashboard.read; it does not grant access to other modules.
-- The migration runner owns the transaction. Safe to apply repeatedly.

INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, 'dashboard.read'
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
