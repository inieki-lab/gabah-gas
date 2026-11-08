-- Stage 24: model Humas and Sekretaris Direksi as employees with additional
-- job-function roles. Their role_label, unit, job level, and office location
-- remain intact; Karyawan becomes the primary employee baseline while Humas /
-- Sekretaris Direksi stay as additional permission packages.

-- First demote the function-role assignment while the old profile role is
-- still available for an unambiguous mapping.
UPDATE gabah_user_roles ur
SET is_primary = FALSE
FROM users u, gabah_roles r
WHERE ur.user_id = u.id::text
  AND ur.role_id = r.id
  AND u.role IN ('Humas', 'Sekretaris Direksi')
  AND r.role_key = CASE u.role
    WHEN 'Humas' THEN 'humas'
    WHEN 'Sekretaris Direksi' THEN 'sekretaris_direksi'
  END;

UPDATE users
SET role = 'Karyawan'
WHERE role IN ('Humas', 'Sekretaris Direksi');

INSERT INTO gabah_user_roles (user_id, role_id, is_primary)
SELECT u.id::text, r.id, FALSE
FROM users u
JOIN gabah_roles r ON r.role_key = CASE
  WHEN u.role_label = 'Staf Humas & Protokoler' THEN 'humas'
  WHEN u.role_label = 'Staf Sekretariat Direksi' THEN 'sekretaris_direksi'
END
WHERE u.role = 'Karyawan'
  AND u.role_label IN ('Staf Humas & Protokoler', 'Staf Sekretariat Direksi')
  AND r.is_active = TRUE
ON CONFLICT (user_id, role_id) DO UPDATE SET is_primary = FALSE;

-- Ensure the employee baseline is the single primary role.
INSERT INTO gabah_user_roles (user_id, role_id, is_primary)
SELECT u.id::text, r.id, TRUE
FROM users u
JOIN gabah_roles r ON r.role_key = 'karyawan' AND r.is_active = TRUE
WHERE u.role = 'Karyawan'
  AND u.role_label IN ('Staf Humas & Protokoler', 'Staf Sekretariat Direksi')
ON CONFLICT (user_id, role_id) DO UPDATE SET is_primary = TRUE;
