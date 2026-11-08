-- Stage 34: room-reservation operational queues and priority override are
-- explicit capabilities, separate from primary employee role labels.
-- Additive/idempotent; Super Admin may assign these to custom roles later.

INSERT INTO gabah_permissions (permission_key, module, action, description) VALUES
  ('room_reservations.it_facilities.read', 'room_reservations', 'read', 'Melihat antrean reservasi dengan kebutuhan fasilitas IT (detail agenda disamarkan)'),
  ('room_reservations.documentation.read', 'room_reservations', 'read', 'Melihat antrean permintaan dokumentasi Humas'),
  ('room_reservations.override_priority', 'room_reservations', 'override', 'Mengajukan prioritas tinggi dan interupsi jadwal sesuai kebijakan Direksi')
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM gabah_roles r
JOIN (VALUES
  ('room_reservations.it_facilities.read')
) AS p(permission_key) ON TRUE
WHERE r.role_key = 'it' AND r.is_active = TRUE
ON CONFLICT (role_id, permission_key) DO NOTHING;

INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM gabah_roles r
JOIN (VALUES
  ('room_reservations.documentation.read')
) AS p(permission_key) ON TRUE
WHERE r.role_key = 'humas' AND r.is_active = TRUE
ON CONFLICT (role_id, permission_key) DO NOTHING;

INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM gabah_roles r
JOIN (VALUES
  ('room_reservations.override_priority')
) AS p(permission_key) ON TRUE
WHERE r.role_key = 'sekretaris_direksi' AND r.is_active = TRUE
ON CONFLICT (role_id, permission_key) DO NOTHING;
