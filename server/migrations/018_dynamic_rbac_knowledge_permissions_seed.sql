-- Dynamic RBAC Stage 13B: Knowledge Base create/update permissions.
-- Mirrors the existing PostgreSQL-era legacy allowlist for knowledge writes:
-- Admin GABAH (superadmin), IT, and GA. Other legacy roles and custom roles
-- receive no implicit grant. Custom roles may be granted these permissions by
-- a Superadmin through the Dynamic RBAC role-permission administration API.
-- Additive and idempotent; the migration runner owns the transaction.

INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM gabah_roles r
JOIN gabah_permissions p
  ON p.permission_key IN ('knowledge.create', 'knowledge.update')
WHERE r.role_key IN ('superadmin', 'it', 'ga')
  AND r.is_active = TRUE
  AND p.is_active = TRUE
ON CONFLICT (role_id, permission_key) DO NOTHING;
