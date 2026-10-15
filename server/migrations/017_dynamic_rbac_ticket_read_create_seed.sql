-- Dynamic RBAC Stage 11A: ticket read/create permission grants.
-- Runtime gates are additive to the existing ticket reporter/category filtering
-- and domain validation. No ticket update/status mutation is changed in this stage.
-- Grant only canonical legacy roles to preserve current authenticated-user behavior;
-- custom roles receive no implicit permissions. Migration runner owns transaction.

INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM gabah_roles r
JOIN gabah_permissions p ON p.permission_key = 'tickets.read'
WHERE r.role_key IN (
  'superadmin', 'it', 'ga', 'sekretaris_direksi', 'humas',
  'supply_chain', 'pibc', 'karyawan', 'auditor'
)
  AND r.is_active = TRUE
  AND p.is_active = TRUE
ON CONFLICT (role_id, permission_key) DO NOTHING;

INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM gabah_roles r
JOIN gabah_permissions p ON p.permission_key = 'tickets.create'
WHERE r.role_key IN (
  'superadmin', 'it', 'ga', 'sekretaris_direksi', 'humas',
  'supply_chain', 'pibc', 'karyawan'
)
  AND r.is_active = TRUE
  AND p.is_active = TRUE
ON CONFLICT (role_id, permission_key) DO NOTHING;
