-- Stage 23: distinguish a user's primary application role from additional
-- job-function roles. The primary role mirrors users.role; additional roles
-- are additive permission/scope packages assigned by Super Admin.

ALTER TABLE gabah_user_roles
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill the primary marker from the normalized user profile role.
UPDATE gabah_user_roles ur
SET is_primary = TRUE
FROM users u, gabah_roles r
WHERE ur.user_id = u.id::text
  AND ur.role_id = r.id
  AND r.role_key = CASE
    WHEN u.role IN ('Admin GABAH', 'Superadmin') THEN 'superadmin'
    WHEN u.role = 'IT' THEN 'it'
    WHEN u.role = 'GA' THEN 'ga'
    WHEN u.role = 'Auditor' THEN 'auditor'
    WHEN u.role = 'Humas' THEN 'humas'
    WHEN u.role = 'Sekretaris Direksi' THEN 'sekretaris_direksi'
    WHEN u.role IN ('RPC', 'PIBC', 'Karyawan') THEN 'karyawan'
    ELSE lower(regexp_replace(u.role, '[^a-zA-Z0-9]+', '_', 'g'))
  END;

CREATE UNIQUE INDEX IF NOT EXISTS gabah_user_roles_one_primary_uq
  ON gabah_user_roles (user_id)
  WHERE is_primary = TRUE;
