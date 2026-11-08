-- Stage 17: permission grants for core operational APIs.
-- These grants make menu visibility and endpoint authorization use the same
-- permission catalogue. Object-level scope and domain transitions remain enforced
-- in routes/domain services. Custom roles receive no implicit grants.
-- Additive/idempotent; migration runner owns the transaction.

INSERT INTO gabah_permissions (permission_key, module, action, description) VALUES
  ('meeting_types.read', 'meeting_types', 'read', 'Melihat jenis rapat'),
  ('meeting_facilities.read', 'meeting_facilities', 'read', 'Melihat fasilitas rapat')
ON CONFLICT (permission_key) DO NOTHING;

-- Employee actions and personal workspace.
INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM gabah_roles r
JOIN (VALUES
  ('loans.create'),
  ('loans.return'),
  ('tickets.create'),
  ('knowledge.vote'),
  ('notifications.read'),
  ('notifications.read_all'),
  ('room_reservations.cancel'),
  ('meeting_types.read'),
  ('meeting_facilities.read')
) AS p(permission_key) ON TRUE
WHERE r.role_key IN (
  'superadmin', 'it', 'ga', 'supply_chain', 'pibc',
  'karyawan', 'auditor', 'sekretaris_direksi', 'humas'
)
  AND r.is_active = TRUE
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- Custodian actions are limited to the central owner domains. Historical
-- SC/PIBC owner records remain visible to Super Admin for review only.
INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM gabah_roles r
JOIN (VALUES
  ('loans.approve'),
  ('loans.reject'),
  ('loans.handover'),
  ('loans.return'),
  ('tickets.update'),
  ('tickets.assign'),
  ('tickets.close'),
  ('vendors.create'),
  ('vendors.update'),
  ('contracts.create'),
  ('contracts.update')
) AS p(permission_key) ON TRUE
WHERE r.role_key IN ('superadmin', 'it', 'ga')
  AND r.is_active = TRUE
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- Contract attachments and lifecycle actions follow the same owner-domain
-- permission grants as create/update.
INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM gabah_roles r
JOIN (VALUES
  ('contracts.documents.upload'),
  ('contracts.milestones.manage'),
  ('contracts.renewal.decide')
) AS p(permission_key) ON TRUE
WHERE r.role_key IN ('superadmin', 'it', 'ga')
  AND r.is_active = TRUE
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- Meeting-room workflow: all employees can request/read; GA and Super Admin
-- operate approvals and room lifecycle. Domain service still checks organizer,
-- priority, current state, and the requested action.
INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM gabah_roles r
JOIN (VALUES
  ('room_reservations.create')
) AS p(permission_key) ON TRUE
WHERE r.role_key IN (
  'superadmin', 'it', 'ga', 'supply_chain', 'pibc',
  'karyawan', 'auditor', 'sekretaris_direksi', 'humas'
)
  AND r.is_active = TRUE
ON CONFLICT (role_id, permission_key) DO NOTHING;

INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM gabah_roles r
JOIN (VALUES
  ('room_reservations.approve'),
  ('room_reservations.reject'),
  ('room_reservations.checkin'),
  ('room_reservations.checkout'),
  ('meeting_rooms.update'),
  ('meeting_types.manage'),
  ('meeting_facilities.manage')
) AS p(permission_key) ON TRUE
WHERE r.role_key IN ('superadmin', 'ga')
  AND r.is_active = TRUE
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- Branch/location legacy roles are not vendor or asset owner administrators.
DELETE FROM gabah_role_permissions rp
USING gabah_roles r
WHERE rp.role_id = r.id
  AND r.role_key IN ('supply_chain', 'pibc')
  AND rp.permission_key IN ('vendors.create', 'vendors.update');
