-- The employee/location mapping is explicit business policy: old profile
-- labels Supply Chain and PIBC are normalized to the ordinary Karyawan
-- baseline; office location is stored separately. No job level or custom role
-- is inferred, and old location-shaped unit references are cleared.
CREATE TEMP TABLE _gabah_legacy_location_users ON COMMIT DROP AS
SELECT id::text AS user_id, name, role AS old_role, unit_id AS old_unit_id,
       office_location_id AS old_office_location_id
FROM users
WHERE role IN ('Supply Chain', 'PIBC')
   OR unit_id IN ('UNIT-SC', 'UNIT-PIBC', 'UNIT-PANGSUB');

UPDATE gabah_user_roles
SET is_primary = FALSE
WHERE user_id IN (SELECT user_id FROM _gabah_legacy_location_users);

DELETE FROM gabah_user_roles ur
USING gabah_roles r
WHERE ur.role_id = r.id
  AND r.role_key IN ('supply_chain', 'pibc');

UPDATE users u
SET role = CASE WHEN u.role IN ('Supply Chain', 'PIBC') THEN 'Karyawan' ELSE u.role END,
    office_location_id = COALESCE(
      u.office_location_id,
      CASE
        WHEN u.unit_id = 'UNIT-PANGSUB' THEN 'OFF-PANGSUB'
        WHEN u.unit_id = 'UNIT-PIBC' OR u.role = 'PIBC' THEN 'OFF-PIBC'
        WHEN u.unit_id = 'UNIT-SC' OR u.role = 'Supply Chain' THEN 'OFF-RPC'
        ELSE NULL
      END
    ),
    unit_id = CASE
      WHEN u.unit_id IN ('UNIT-SC', 'UNIT-PIBC', 'UNIT-PANGSUB') THEN NULL
      ELSE u.unit_id
    END,
    updated_at = NOW()
FROM _gabah_legacy_location_users legacy
WHERE u.id::text = legacy.user_id;

INSERT INTO gabah_user_roles (user_id, role_id, is_primary)
SELECT legacy.user_id, employee_role.id, TRUE
FROM _gabah_legacy_location_users legacy
JOIN gabah_roles employee_role
  ON employee_role.role_key = 'karyawan'
 AND employee_role.is_active = TRUE
WHERE legacy.old_role IN ('Supply Chain', 'PIBC')
ON CONFLICT (user_id, role_id) DO UPDATE SET is_primary = TRUE;

UPDATE gabah_roles
SET is_active = FALSE, updated_at = NOW()
WHERE role_key IN ('supply_chain', 'pibc');

INSERT INTO audit_logs
  (id, action, entity, entity_id, user_id, user_name, user_role, details, timestamp)
SELECT LEFT('MIG-102-' || legacy.user_id, 64),
       'USER_LOCATION_ROLE_NORMALIZED',
       'Users',
       legacy.user_id,
       NULL,
       COALESCE(legacy.name, 'Unknown user'),
       'System Migration',
       'Legacy location profile normalized: role ' || COALESCE(legacy.old_role, '(unchanged)') ||
       ', unit ' || COALESCE(legacy.old_unit_id, '(none)') ||
       ', office location ' || COALESCE(u.office_location_id, '(needs admin review)') ||
       '. Job level and unrelated role capabilities were not inferred or overwritten.',
       NOW()
FROM _gabah_legacy_location_users legacy
JOIN users u ON u.id::text = legacy.user_id
ON CONFLICT (id) DO NOTHING;
