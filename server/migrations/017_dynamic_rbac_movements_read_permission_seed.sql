-- Dynamic RBAC Stage 11: movement history read permission.
-- Legacy behavior (verified in server.ts before this stage): GET /api/movements
-- is unrestricted for every authenticated user, so the grant mirrors reality by
-- covering all nine canonical legacy roles. Custom roles receive no permission
-- implicitly; a Superadmin can grant movements.read via the roles admin API.
-- The migration runner owns the transaction; this file is idempotent.

INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, 'movements.read'
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
