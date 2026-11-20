-- GABAH migration 046: explicit UI capability for the PIBC ME ticket queue.
-- A custom-named Dynamic RBAC role can receive this capability plus the
-- tickets unit scope; the UI does not infer ME queue membership from role names.
INSERT INTO gabah_permissions (permission_key, module, action, description)
VALUES (
  'tickets.queue.me',
  'tickets',
  'queue_me',
  'Menampilkan antrean tiket Mechanical, Electrical, dan Perawatan (ME)'
)
ON CONFLICT (permission_key) DO NOTHING;

-- Preserve the existing canonical Admin Tiket ME template. No custom role is
-- granted automatically; Superadmin must explicitly configure its permission
-- and UNIT-PIBC-ME scope.
INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, 'tickets.queue.me'
FROM gabah_roles r
WHERE r.role_key = 'admin_tiket_me' AND r.is_active = TRUE
ON CONFLICT (role_id, permission_key) DO NOTHING;
