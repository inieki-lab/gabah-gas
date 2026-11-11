-- Stage 16: seed navigation/read permissions for the employee baseline and
-- the current IT/GA/Auditor workspaces. Menu visibility is derived from these
-- permissions; the backend endpoints still enforce their own authorization.
-- RPC and PIBC are legacy account labels for office locations, not
-- asset-owner roles. Remove their legacy asset mutation grants; Super Admin
-- can explicitly grant new role templates after organizational mapping.
-- Additive/idempotent and safe to re-run.

INSERT INTO gabah_permissions (permission_key, module, action, description) VALUES
  ('assets.audit.read', 'assets', 'audit_read', 'Melihat katalog aset lintas owner untuk kebutuhan audit read-only'),
  ('vendors.read', 'vendors', 'read', 'Melihat vendor sesuai scope'),
  ('licenses.read', 'licenses', 'read', 'Melihat lisensi sesuai scope'),
  ('contracts.read', 'contracts', 'read', 'Melihat kontrak sesuai scope'),
  ('reports.read', 'reports', 'read', 'Melihat laporan sesuai scope')
ON CONFLICT (permission_key) DO NOTHING;

-- Shared employee workspace. Each endpoint applies its own object/data scope.
INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM gabah_roles r
JOIN (VALUES
  ('loans.read'),
  ('tickets.read'),
  ('meeting_rooms.read'),
  ('room_reservations.read'),
  ('knowledge.read')
) AS p(permission_key) ON TRUE
WHERE r.role_key IN (
  'superadmin', 'it', 'ga', 'rpc', 'pibc',
  'karyawan', 'auditor', 'sekretaris_direksi', 'humas'
)
  AND r.is_active = TRUE
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- Asset catalog: Auditor receives an explicit read-only catalogue permission.
INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, 'assets.audit.read'
FROM gabah_roles r
WHERE r.role_key = 'auditor' AND r.is_active = TRUE
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- Domain workspaces based on current responsibility, not branch location.
INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM gabah_roles r
JOIN (VALUES
  ('licenses.read'),
  ('contracts.read'),
  ('vendors.read'),
  ('reports.read')
) AS p(permission_key) ON TRUE
WHERE r.role_key IN ('superadmin', 'it', 'ga', 'auditor')
  AND r.is_active = TRUE
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- Legacy RPC/PIBC labels no longer authorize asset management.
-- Historical owner_division values are not migrated here; those assets require
-- per-record ownership review and a separate approved migration.
DELETE FROM gabah_role_permissions rp
USING gabah_roles r
WHERE rp.role_id = r.id
  AND r.role_key IN ('rpc', 'pibc')
  AND rp.permission_key IN (
    'assets.create', 'assets.update', 'assets.bulk_import',
    'assets.assign', 'assets.move', 'assets.lifecycle'
  );
