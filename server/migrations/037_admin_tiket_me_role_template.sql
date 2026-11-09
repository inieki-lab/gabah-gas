-- GABAH migration 037: provide a least-privilege role template for ME ticket administration.
-- The role is deliberately NOT assigned to any account. Super Admin must assign
-- it only to the designated ME admin and set that employee's unit_id to UNIT-PIBC-ME.

INSERT INTO gabah_roles (role_key, name, description, is_superadmin, is_active)
VALUES (
  'admin_tiket_me',
  'Admin Tiket ME',
  'Administrasi antrean tiket Mechanical & Electrical unit Tim Perawatan (ME): membaca, memperbarui, dan mendelegasikan tiket ME kepada petugas unit yang berwenang.',
  FALSE,
  TRUE
)
ON CONFLICT (role_key) DO NOTHING;

INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM gabah_roles r
JOIN (VALUES ('tickets.read'), ('tickets.update'), ('notifications.read'), ('notifications.read_all')) AS p(permission_key) ON TRUE
WHERE r.role_key = 'admin_tiket_me'
  AND r.is_active = TRUE
ON CONFLICT (role_id, permission_key) DO NOTHING;

INSERT INTO gabah_role_division_scopes (role_id, module, scope_type, scope_value)
SELECT r.id, 'tickets', 'unit', 'UNIT-PIBC-ME'
FROM gabah_roles r
WHERE r.role_key = 'admin_tiket_me'
  AND r.is_active = TRUE
ON CONFLICT DO NOTHING;
