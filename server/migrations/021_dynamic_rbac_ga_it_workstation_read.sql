-- Stage 14: explicit, configurable GA read-only access to IT laptops and PCs.
-- The existing role-permission administration API lets Super Admin revoke or
-- re-grant this key at runtime. This grant is the conservative compatibility
-- default for the GA role; it never grants any write/assign/lifecycle action.
-- HLT = Laptop/Notebook; HPC = PC/Desktop (canonical taxonomy only).
-- Additive and idempotent; migration runner owns the transaction.

INSERT INTO gabah_permissions (permission_key, module, action, description)
VALUES (
  'assets.read.it_workstations',
  'assets',
  'read_it_workstations',
  'Melihat aset IT kategori Laptop (HLT) dan PC/Desktop (HPC) secara read-only'
)
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, 'assets.read.it_workstations'
FROM gabah_roles r
WHERE r.role_key = 'ga'
  AND r.is_active = TRUE
ON CONFLICT (role_id, permission_key) DO NOTHING;
