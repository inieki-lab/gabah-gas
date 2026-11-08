-- Stage 21: gate employee directory reads.
-- The full sanitized directory is needed by Super Admin and operational
-- custodians for asset assignment/helpdesk routing. Other roles receive no
-- implicit access; Super Admin may grant users.read to additional templates.

INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, 'users.read'
FROM gabah_roles r
WHERE r.role_key IN ('superadmin', 'it', 'ga')
  AND r.is_active = TRUE
ON CONFLICT (role_id, permission_key) DO NOTHING;
