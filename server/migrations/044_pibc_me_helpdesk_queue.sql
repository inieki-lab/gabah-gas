-- GABAH migration 044: dedicated PIBC Mechanical/Electrical/Perawatan helpdesk queue.
-- Additive and idempotent. The unit is a routing destination, not an application role
-- or asset owner. No user is assigned automatically; Super Admin assigns the role/unit.
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS assigned_unit_id VARCHAR(64)
  REFERENCES org_units(id);

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS recipient_unit_id VARCHAR(64)
  REFERENCES org_units(id);

CREATE INDEX IF NOT EXISTS idx_tickets_assigned_unit_status
  ON tickets (assigned_unit_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unit_read
  ON notifications (recipient_unit_id, is_read, created_at DESC);

INSERT INTO org_units (id, name, division_code, is_active)
VALUES ('UNIT-PIBC-ME', 'Tim Perawatan (ME)', 'PIBC', TRUE)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, division_code = EXCLUDED.division_code, is_active = TRUE;

INSERT INTO gabah_permissions (permission_key, module, action, description)
VALUES ('tickets.create.me', 'tickets', 'create_me', 'Mengajukan tiket Mechanical, Electrical, dan Perawatan (ME)')
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO gabah_roles (role_key, name, description, is_superadmin, is_active)
VALUES
  ('admin_tiket_me', 'Admin Tiket ME', 'Mengelola antrean tiket Tim Perawatan (ME) di PIBC.', FALSE, TRUE),
  ('pemohon_tiket_me', 'Pemohon Tiket ME', 'Kapabilitas tambahan untuk mengajukan tiket ME; tidak memberikan hak menangani tiket.', FALSE, TRUE)
ON CONFLICT (role_key) DO NOTHING;

INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM gabah_roles r
JOIN (VALUES
  ('admin_tiket_me', 'tickets.read'),
  ('admin_tiket_me', 'tickets.update'),
  ('admin_tiket_me', 'notifications.read'),
  ('admin_tiket_me', 'notifications.read_all'),
  ('pemohon_tiket_me', 'tickets.create.me')
) AS p(role_key, permission_key) ON TRUE
WHERE r.role_key = p.role_key AND r.is_active = TRUE
ON CONFLICT (role_id, permission_key) DO NOTHING;

INSERT INTO gabah_role_division_scopes (role_id, module, scope_type, scope_value)
SELECT r.id, 'tickets', 'unit', 'UNIT-PIBC-ME'
FROM gabah_roles r
WHERE r.role_key = 'admin_tiket_me' AND r.is_active = TRUE
ON CONFLICT DO NOTHING;
