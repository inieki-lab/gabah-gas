-- SC/RPC and PIBC are office locations, not application roles.
-- Preserve all employee records, job levels, custom role capabilities, and
-- profile division text for administrator review; remove only the obsolete
-- location-shaped role grants and retain Karyawan as the employee baseline.
WITH affected_users AS (
  SELECT id::text AS user_id
  FROM users
  WHERE role IN ('Supply Chain', 'PIBC')
)
UPDATE gabah_user_roles ur
SET is_primary = FALSE
FROM affected_users affected
WHERE ur.user_id = affected.user_id;

DELETE FROM gabah_user_roles ur
USING gabah_roles r
WHERE ur.role_id = r.id
  AND r.role_key IN ('supply_chain', 'pibc');

INSERT INTO gabah_user_roles (user_id, role_id, is_primary)
SELECT u.id::text, employee_role.id, TRUE
FROM users u
JOIN gabah_roles employee_role
  ON employee_role.role_key = 'karyawan'
 AND employee_role.is_active = TRUE
WHERE u.role IN ('Supply Chain', 'PIBC')
ON CONFLICT (user_id, role_id) DO UPDATE SET is_primary = TRUE;

UPDATE gabah_roles
SET is_active = FALSE, updated_at = NOW()
WHERE role_key IN ('supply_chain', 'pibc');

UPDATE users
SET role = 'Karyawan', updated_at = NOW()
WHERE role IN ('Supply Chain', 'PIBC');
