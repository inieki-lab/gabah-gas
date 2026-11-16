-- Reconcile legacy profile-to-role assignments AND room operational grants
-- after canonical users/roles have been materialized.
--
-- This is a NEW post-seed migration, not an edit to 090: older databases may
-- already have recorded 090 before the canonical user rows existed. In that
-- case its one-time user-role backfill matched zero users and was never retried.
-- Re-run the additive/idempotent backfill here so those accounts receive their
-- expected secondary capabilities. Custom role assignments are preserved.

-- Restore canonical role assignments from legacy profile labels. This only
-- adds missing canonical assignments and never deletes custom assignments.
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

-- Humas and Sekretariat Direksi are additional function capabilities, not
-- primary employee profiles. Ensure they remain secondary.
UPDATE gabah_user_roles ur
SET is_primary = FALSE
FROM gabah_roles r
WHERE r.id = ur.role_id
  AND r.role_key IN ('humas', 'sekretaris_direksi');

-- Give these employee accounts the Karyawan baseline as their single primary
-- role while retaining their Humas/Sekdir secondary capability.
INSERT INTO gabah_user_roles (user_id, role_id, is_primary)
SELECT u.id::text, employee_role.id, TRUE
FROM users u
JOIN gabah_roles employee_role
  ON employee_role.role_key = 'karyawan'
 AND employee_role.is_active = TRUE
WHERE u.role IN ('Humas', 'Sekretaris Direksi')
ON CONFLICT (user_id, role_id) DO UPDATE SET is_primary = TRUE;

UPDATE users
SET role = 'Karyawan'
WHERE role IN ('Humas', 'Sekretaris Direksi');

-- Re-apply operational room-queue grants after canonical roles are available.
-- This covers both fresh installs and upgrades where migration 034 ran before
-- role seeding. Existing custom role grants are never overwritten or deleted.
INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM gabah_roles r
JOIN (VALUES
  ('it', 'room_reservations.it_facilities.read'),
  ('humas', 'room_reservations.documentation.read'),
  ('sekretaris_direksi', 'room_reservations.override_priority')
) AS p(role_key, permission_key) ON p.role_key = r.role_key
JOIN gabah_permissions permission
  ON permission.permission_key = p.permission_key
 AND permission.is_active = TRUE
WHERE r.is_active = TRUE
ON CONFLICT (role_id, permission_key) DO NOTHING;
