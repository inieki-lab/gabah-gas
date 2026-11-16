-- GABAH migration 037: least-privilege roles for ME ticket administration and technicians.
-- Neither role is assigned automatically to normal employees.

INSERT INTO gabah_roles (role_key, name, description, is_superadmin, is_active)
VALUES
  ('admin_tiket_me', 'Admin Tiket ME', 'Membaca antrean ME, memperbarui tiket, dan mendelegasikan pekerjaan di unit Tim Perawatan (ME).', FALSE, TRUE),
  ('petugas_me', 'Petugas ME', 'Menangani tiket ME yang ditugaskan di unit Tim Perawatan (ME); tidak memiliki hak delegasi.', FALSE, TRUE)
ON CONFLICT (role_key) DO NOTHING;

INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM gabah_roles r
JOIN (VALUES
  ('tickets.read'), ('tickets.update'), ('notifications.read'), ('notifications.read_all')
) AS p(permission_key) ON TRUE
WHERE r.role_key = 'admin_tiket_me' AND r.is_active = TRUE
ON CONFLICT (role_id, permission_key) DO NOTHING;

INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM gabah_roles r
JOIN (VALUES
  ('tickets.read'), ('tickets.update'), ('notifications.read')
) AS p(permission_key) ON TRUE
WHERE r.role_key = 'petugas_me' AND r.is_active = TRUE
ON CONFLICT (role_id, permission_key) DO NOTHING;

INSERT INTO gabah_role_division_scopes (role_id, module, scope_type, scope_value)
SELECT r.id, 'tickets', 'unit', 'UNIT-PIBC-ME'
FROM gabah_roles r
WHERE r.role_key IN ('admin_tiket_me', 'petugas_me') AND r.is_active = TRUE
ON CONFLICT DO NOTHING;
