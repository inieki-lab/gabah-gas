-- Stage 49: make read-only a configurable policy capability, not a fixed role identity.
-- The legacy Auditor template receives the marker so existing assignments retain
-- their behavior. Any custom Dynamic RBAC role may receive the same marker.
-- Additive and idempotent; no user, role, scope, or business records are rewritten.

INSERT INTO gabah_permissions (permission_key, module, action, description)
VALUES (
  'security.read_only',
  'security',
  'read_only',
  'Deny all data mutations for users assigned this policy, while preserving only explicitly granted read permissions and scopes'
)
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, 'security.read_only'
FROM gabah_roles r
WHERE r.role_key = 'auditor'
  AND r.is_active = TRUE
ON CONFLICT (role_id, permission_key) DO NOTHING;
