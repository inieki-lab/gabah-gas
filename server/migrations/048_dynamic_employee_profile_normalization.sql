-- Normalize employee identity separately from Dynamic RBAC job-function grants.
-- This migration is additive to the role catalogue and preserves existing custom grants.
-- The migration runner owns the transaction; do not add BEGIN/COMMIT.

-- Preserve operational capabilities as secondary role assignments before changing users.role.
INSERT INTO gabah_user_roles (user_id, role_id, is_primary)
SELECT u.id::text, r.id, FALSE
FROM users u
JOIN gabah_roles r ON r.role_key = CASE u.role
  WHEN 'IT' THEN 'it'
  WHEN 'GA' THEN 'ga'
  WHEN 'Auditor' THEN 'auditor'
  WHEN 'Humas' THEN 'humas'
  WHEN 'Sekretaris Direksi' THEN 'sekretaris_direksi'
  ELSE NULL
END
WHERE u.role IN ('IT', 'GA', 'Auditor', 'Humas', 'Sekretaris Direksi')
  AND r.is_active = TRUE
ON CONFLICT (user_id, role_id) DO UPDATE SET is_primary = FALSE;

-- Supply Chain/SC and PIBC are location aliases, not application capabilities.
-- Preserve the account's organization/location fields and do not create those role grants.
UPDATE users
SET office_location_id = CASE
  WHEN role IN ('Supply Chain', 'SC') THEN COALESCE(NULLIF(office_location_id, ''), 'OFF-RPC')
  WHEN role = 'PIBC' THEN COALESCE(NULLIF(office_location_id, ''), 'OFF-PIBC')
  ELSE office_location_id
END
WHERE role IN ('Supply Chain', 'SC', 'PIBC');

-- The only primary profile identities are the system administrator and employee baseline.
UPDATE users
SET role = CASE WHEN role IN ('Superadmin', 'Admin GABAH') THEN 'Admin GABAH' ELSE 'Karyawan' END
WHERE role IS DISTINCT FROM CASE
  WHEN role IN ('Superadmin', 'Admin GABAH') THEN 'Admin GABAH'
  ELSE 'Karyawan'
END;

-- Rebuild the primary marker without deleting any unrelated/custom role assignment.
UPDATE gabah_user_roles ur
SET is_primary = FALSE
FROM users u
WHERE ur.user_id = u.id::text;

INSERT INTO gabah_user_roles (user_id, role_id, is_primary)
SELECT u.id::text, r.id, TRUE
FROM users u
JOIN gabah_roles r ON r.role_key = CASE
  WHEN u.role = 'Admin GABAH' THEN 'superadmin'
  ELSE 'karyawan'
END
WHERE r.is_active = TRUE
ON CONFLICT (user_id, role_id) DO UPDATE SET is_primary = TRUE;

-- Job-function roles remain available as additional Dynamic RBAC templates.
UPDATE gabah_user_roles ur
SET is_primary = FALSE
FROM gabah_roles r
WHERE ur.role_id = r.id
  AND r.role_key IN ('it', 'ga', 'auditor', 'humas', 'sekretaris_direksi');

-- Retire the invalid location-as-role templates while retaining their catalogue
-- rows and permission history for auditability.
UPDATE gabah_roles
SET is_active = FALSE, updated_at = NOW()
WHERE role_key IN ('supply_chain', 'pibc');
DELETE FROM gabah_user_roles ur
USING gabah_roles r
WHERE ur.role_id = r.id
  AND r.role_key IN ('supply_chain', 'pibc');
