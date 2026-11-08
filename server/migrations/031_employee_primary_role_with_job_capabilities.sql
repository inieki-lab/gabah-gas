-- Stage 24: Humas and Sekretariat Direksi are employees with additional
-- job-function capabilities. Keep the existing function-role assignment as
-- a secondary role; do not infer it from role_label, which is editable text
-- and is not a reliable authorization key.

-- Preserve/repair the function-role assignment BEFORE normalizing users.role.
INSERT INTO gabah_user_roles (user_id, role_id, is_primary)
SELECT u.id::text, r.id, FALSE
FROM users u
JOIN gabah_roles r ON r.role_key = CASE u.role
  WHEN 'Humas' THEN 'humas'
  WHEN 'Sekretaris Direksi' THEN 'sekretaris_direksi'
END
WHERE u.role IN ('Humas', 'Sekretaris Direksi')
  AND r.is_active = TRUE
ON CONFLICT (user_id, role_id) DO UPDATE SET is_primary = FALSE;

-- The primary application role is the shared employee baseline. The original
-- job level, unit, office location, role_label, and secondary capability role
-- remain intact.
UPDATE users
SET role = 'Karyawan'
WHERE role IN ('Humas', 'Sekretaris Direksi');

-- Ensure the employee baseline is the single primary role for these users.
INSERT INTO gabah_user_roles (user_id, role_id, is_primary)
SELECT u.id::text, r.id, TRUE
FROM users u
JOIN gabah_roles r ON r.role_key = 'karyawan' AND r.is_active = TRUE
WHERE u.role = 'Karyawan'
  AND EXISTS (
    SELECT 1
    FROM gabah_user_roles ur
    JOIN gabah_roles function_role ON function_role.id = ur.role_id
    WHERE ur.user_id = u.id::text
      AND function_role.role_key IN ('humas', 'sekretaris_direksi')
      AND ur.is_primary = FALSE
  )
ON CONFLICT (user_id, role_id) DO UPDATE SET is_primary = TRUE;
