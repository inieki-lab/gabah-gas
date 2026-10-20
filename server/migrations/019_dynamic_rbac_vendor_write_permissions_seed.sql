-- Dynamic RBAC Stage 13C: vendor create/update permissions.
-- Preserve the existing vendor-management roles; custom roles receive no implicit grants.
-- IT/GA category restrictions remain enforced by the route's legacy domain checks.
-- Additive and idempotent; the migration runner owns the transaction.

INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM gabah_roles r
JOIN gabah_permissions p
  ON p.permission_key IN ('vendors.create', 'vendors.update')
WHERE r.role_key IN ('superadmin', 'it', 'ga', 'supply_chain', 'pibc')
  AND r.is_active = TRUE
  AND p.is_active = TRUE
ON CONFLICT (role_id, permission_key) DO NOTHING;
