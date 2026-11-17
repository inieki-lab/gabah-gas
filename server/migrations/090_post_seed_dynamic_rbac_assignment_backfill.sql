-- Post-seed Dynamic RBAC backfill.
-- The normal schema phase runs before canonical users are materialized on a
-- fresh database. This migration is deliberately deferred until after the
-- first normalized user sync so the legacy assignment backfill sees accounts.
-- Additive/idempotent: existing custom role assignments are never deleted.

-- Preserve legacy function capabilities as secondary assignments and map the
-- canonical profile labels to their initial capability records exactly once.
INSERT INTO gabah_user_roles (user_id, role_id, is_primary)
SELECT u.id::text, r.id, FALSE
FROM users u
JOIN gabah_roles r ON r.role_key = CASE u.role
  WHEN 'Admin GABAH' THEN 'superadmin'
  WHEN 'IT' THEN 'it'
  WHEN 'GA' THEN 'ga'
  WHEN 'Supply Chain' THEN 'supply_chain'
  WHEN 'PIBC' THEN 'pibc'
  WHEN 'Karyawan' THEN 'karyawan'
  WHEN 'Auditor' THEN 'auditor'
  WHEN 'Humas' THEN 'humas'
  WHEN 'Sekretaris Direksi' THEN 'sekretaris_direksi'
  ELSE NULL
END
WHERE r.is_active = TRUE
ON CONFLICT (user_id, role_id) DO NOTHING;

-- The two function roles must remain secondary even if an older assignment
-- had previously been marked primary.
UPDATE gabah_user_roles ur
SET is_primary = FALSE
FROM gabah_roles r
WHERE r.id = ur.role_id
  AND r.role_key IN ('humas', 'sekretaris_direksi');

-- Humas and Sekretariat Direksi are employee profiles with independent
-- additional function capabilities: Karyawan is their primary baseline,
-- while Humas/Sekretariat remain secondary assignments.
INSERT INTO gabah_user_roles (user_id, role_id, is_primary)
SELECT u.id::text, employee_role.id, TRUE
FROM users u
JOIN gabah_roles employee_role ON employee_role.role_key = 'karyawan' AND employee_role.is_active = TRUE
WHERE u.role IN ('Humas', 'Sekretaris Direksi')
ON CONFLICT (user_id, role_id) DO UPDATE SET is_primary = TRUE;

UPDATE users
SET role = 'Karyawan'
WHERE role IN ('Humas', 'Sekretaris Direksi');

-- Re-apply capability grants after canonical roles have been materialized.
-- The regular migration phase can run before role seeding on a fresh database;
-- the original capability migration therefore may insert permissions while
-- its role-grant SELECTs match zero rows. This post-seed phase closes that gap.
INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM gabah_roles r
JOIN (VALUES
  ('it', 'room_reservations.it_facilities.read'),
  ('humas', 'room_reservations.documentation.read'),
  ('sekretaris_direksi', 'room_reservations.override_priority')
) AS p(role_key, permission_key) ON p.role_key = r.role_key
JOIN gabah_permissions permission ON permission.permission_key = p.permission_key AND permission.is_active = TRUE
WHERE r.is_active = TRUE
ON CONFLICT (role_id, permission_key) DO NOTHING;
