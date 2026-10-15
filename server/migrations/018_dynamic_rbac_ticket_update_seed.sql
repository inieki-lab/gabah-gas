-- Dynamic RBAC Stage 11B: ticket status-update permission grants.
-- Existing security middleware continues to enforce object-level ticket authority
-- and the handler continues to enforce valid state transitions and audit logging.
-- Only roles with an existing status-update path receive a grant; custom roles
-- receive no implicit permissions. Migration runner owns transaction.

INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM gabah_roles r
JOIN gabah_permissions p ON p.permission_key = 'tickets.update'
WHERE r.role_key IN (
  'superadmin', 'it', 'ga', 'supply_chain', 'pibc', 'karyawan'
)
  AND r.is_active = TRUE
  AND p.is_active = TRUE
ON CONFLICT (role_id, permission_key) DO NOTHING;
