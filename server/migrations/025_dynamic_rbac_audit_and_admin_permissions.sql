-- Stage 18: administrative and audit read permissions for sensitive endpoints.
-- Only Super Admin can run contract reminder operations or change numbering;
-- Auditor gets read-only reconciliation and audit access.

INSERT INTO gabah_permissions (permission_key, module, action, description) VALUES
  ('reconciliation.read', 'reconciliation', 'read', 'Melihat hasil rekonsiliasi aset'),
  ('audit.read', 'audit', 'read', 'Melihat audit trail lintas domain')
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM gabah_roles r
JOIN (VALUES
  ('reconciliation.read'),
  ('audit.read')
) AS p(permission_key) ON TRUE
WHERE r.role_key IN ('superadmin', 'auditor')
  AND r.is_active = TRUE
ON CONFLICT (role_id, permission_key) DO NOTHING;

INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM gabah_roles r
JOIN (VALUES
  ('contracts.reminders.manage'),
  ('numbering.read'),
  ('numbering.manage')
) AS p(permission_key) ON TRUE
WHERE r.role_key = 'superadmin'
  AND r.is_active = TRUE
ON CONFLICT (role_id, permission_key) DO NOTHING;
