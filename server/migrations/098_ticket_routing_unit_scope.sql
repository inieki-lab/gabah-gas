-- GABAH Migration 098: separate helpdesk queue routing from legacy division/location labels.
-- ME is an operational unit at the PIBC office location, NOT a PIBC division.
-- Historical SC/PIBC ticket categories and asset ownership are deliberately preserved.

ALTER TABLE org_units
  ADD COLUMN IF NOT EXISTS office_location_id VARCHAR(64)
  REFERENCES org_office_locations(id) ON DELETE SET NULL;

INSERT INTO org_units (id, name, division_code, office_location_id, is_active)
VALUES ('UNIT-PIBC-ME', 'Tim Perawatan (ME)', 'Umum', 'OFF-PIBC', TRUE)
ON CONFLICT (id) DO UPDATE
SET division_code = 'Umum',
    office_location_id = EXCLUDED.office_location_id,
    is_active = TRUE;

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS assigned_unit_id VARCHAR(64)
  REFERENCES org_units(id) ON DELETE SET NULL;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS recipient_unit_id VARCHAR(64)
  REFERENCES org_units(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_assigned_unit_id
  ON tickets(assigned_unit_id)
  WHERE assigned_unit_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unit_id
  ON notifications(recipient_unit_id)
  WHERE recipient_unit_id IS NOT NULL;

-- Requester capabilities for GA and ME are opt-in; IT remains the standard
-- authenticated employee helpdesk channel through tickets.create.
INSERT INTO gabah_permissions (permission_key, module, action, description)
VALUES
  ('tickets.create.ga', 'tickets', 'create_ga', 'Mengajukan tiket layanan General Affair (GA)'),
  ('tickets.create.me', 'tickets', 'create_me', 'Mengajukan tiket Mechanical & Electrical (ME)')
ON CONFLICT (permission_key) DO NOTHING;

-- Separate dispatcher/operator authority from generic GA asset administration.
DELETE FROM gabah_role_permissions rp
USING gabah_roles r
WHERE rp.role_id = r.id
  AND r.role_key = 'ga'
  AND rp.permission_key IN ('tickets.update', 'tickets.assign');

-- Keep generic GA staff on their own submitted tickets only. The dedicated
-- operator role below is the sole seeded GA queue scope; job title/profile
-- labels do not grant access to the whole GA ticket queue.
DELETE FROM gabah_role_division_scopes s
USING gabah_roles r
WHERE s.role_id = r.id
  AND r.role_key = 'ga'
  AND s.module = 'tickets'
  AND s.scope_type IN ('all', 'division');

-- Historical branch profiles do not retain queue-wide access just because
-- their old profile key matched SC/PIBC. Their own/assigned tickets remain
-- visible; Superadmin may add a reviewed explicit scope if a real workflow needs it.
DELETE FROM gabah_role_division_scopes s
USING gabah_roles r
WHERE s.role_id = r.id
  AND r.role_key IN ('supply_chain', 'pibc')
  AND s.module = 'tickets'
  AND s.scope_type IN ('all', 'division');


INSERT INTO gabah_roles (role_key, name, description, is_superadmin, is_active)
VALUES
  ('ga_helpdesk_operator', 'Petugas Helpdesk GA',
   'Menangani dan mendelegasikan tiket layanan GA. Ditetapkan secara eksplisit oleh Superadmin; tidak diberikan berdasarkan jabatan.',
   FALSE, TRUE),
  ('admin_tiket_me', 'Admin Tiket ME',
   'Mengelola antrean tiket unit Tim Perawatan (ME) di lokasi PIBC. Ditetapkan secara eksplisit oleh Superadmin.',
   FALSE, TRUE),
  ('pemohon_tiket_ga', 'Pemohon Tiket GA',
   'Kapabilitas tambahan untuk mengajukan tiket layanan GA tanpa hak menangani tiket.',
   FALSE, TRUE),
  ('pemohon_tiket_me', 'Pemohon Tiket ME',
   'Kapabilitas tambahan untuk mengajukan tiket ME tanpa hak menangani tiket.',
   FALSE, TRUE)
ON CONFLICT (role_key) DO NOTHING;

INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM gabah_roles r
JOIN (VALUES
  ('ga_helpdesk_operator', 'tickets.read'),
  ('ga_helpdesk_operator', 'tickets.update'),
  ('ga_helpdesk_operator', 'tickets.assign'),
  ('ga_helpdesk_operator', 'notifications.read'),
  ('ga_helpdesk_operator', 'notifications.read_all'),
  ('admin_tiket_me', 'tickets.read'),
  ('admin_tiket_me', 'tickets.update'),
  ('admin_tiket_me', 'tickets.assign'),
  ('admin_tiket_me', 'notifications.read'),
  ('admin_tiket_me', 'notifications.read_all'),
  ('pemohon_tiket_ga', 'tickets.read'),
  ('pemohon_tiket_ga', 'tickets.create.ga'),
  ('pemohon_tiket_me', 'tickets.read'),
  ('pemohon_tiket_me', 'tickets.create.me')
) AS grants(role_key, permission_key) ON TRUE
JOIN gabah_permissions p ON p.permission_key = grants.permission_key AND p.is_active = TRUE
WHERE r.role_key = grants.role_key AND r.is_active = TRUE
ON CONFLICT (role_id, permission_key) DO NOTHING;

INSERT INTO gabah_role_division_scopes (role_id, module, scope_type, scope_value)
SELECT r.id, 'tickets', 'division', 'GA'
FROM gabah_roles r
WHERE r.role_key = 'ga_helpdesk_operator' AND r.is_active = TRUE
ON CONFLICT DO NOTHING;

INSERT INTO gabah_role_division_scopes (role_id, module, scope_type, scope_value)
SELECT r.id, 'tickets', 'unit', 'UNIT-PIBC-ME'
FROM gabah_roles r
WHERE r.role_key = 'admin_tiket_me' AND r.is_active = TRUE
ON CONFLICT DO NOTHING;
