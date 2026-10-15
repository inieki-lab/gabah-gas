-- Dynamic RBAC foundation — additive and idempotent.
-- The existing users.role field remains authoritative until a later migration
-- backfills stable role keys and the backend authorization layer is switched.
-- Do not drop or rename legacy role data in this stage.

BEGIN;

CREATE TABLE IF NOT EXISTS gabah_roles (
  id BIGSERIAL PRIMARY KEY,
  role_key VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  is_superadmin BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gabah_roles_key_format CHECK (role_key ~ '^[a-z][a-z0-9_]{1,79}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS gabah_roles_name_ci_uq
  ON gabah_roles (LOWER(name));

CREATE TABLE IF NOT EXISTS gabah_permissions (
  permission_key VARCHAR(120) PRIMARY KEY,
  module VARCHAR(80) NOT NULL,
  action VARCHAR(80) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gabah_permissions_key_format CHECK (permission_key ~ '^[a-z][a-z0-9_.:-]{1,119}$')
);

CREATE TABLE IF NOT EXISTS gabah_role_permissions (
  role_id BIGINT NOT NULL REFERENCES gabah_roles(id) ON DELETE CASCADE,
  permission_key VARCHAR(120) NOT NULL REFERENCES gabah_permissions(permission_key) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role_id, permission_key)
);

CREATE TABLE IF NOT EXISTS gabah_role_division_scopes (
  role_id BIGINT NOT NULL REFERENCES gabah_roles(id) ON DELETE CASCADE,
  scope_type VARCHAR(20) NOT NULL CHECK (scope_type IN ('all', 'division', 'unit', 'location', 'own')),
  scope_value VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gabah_role_scope_value_check CHECK (
    (scope_type IN ('all', 'own') AND scope_value IS NULL)
    OR (scope_type IN ('division', 'unit', 'location') AND scope_value IS NOT NULL AND LENGTH(TRIM(scope_value)) > 0)
  ),
  UNIQUE (role_id, scope_type, scope_value)
);

-- User IDs are stored as text to match the application's existing IDs.
-- No FK to the persistence-specific users table is added in this foundation
-- stage because the application currently supports JSON and PostgreSQL modes.
CREATE TABLE IF NOT EXISTS gabah_user_roles (
  user_id TEXT NOT NULL,
  role_id BIGINT NOT NULL REFERENCES gabah_roles(id) ON DELETE RESTRICT,
  assigned_by_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS gabah_user_roles_role_idx ON gabah_user_roles(role_id);
CREATE INDEX IF NOT EXISTS gabah_role_permissions_permission_idx ON gabah_role_permissions(permission_key);
CREATE INDEX IF NOT EXISTS gabah_role_scopes_lookup_idx ON gabah_role_division_scopes(role_id, scope_type);

-- These are initial records only, not a fixed or protected nine-role catalogue.
-- The application layer will protect the Superadmin capability, not the display name.
INSERT INTO gabah_roles (role_key, name, description, is_superadmin)
VALUES
  ('superadmin', 'Admin GABAH', 'Pemegang kendali tertinggi konfigurasi dan akses sistem.', TRUE),
  ('it', 'IT', 'Data awal role IT; permission akan dimigrasikan pada tahap berikutnya.', FALSE),
  ('ga', 'GA', 'Data awal role GA; permission akan dimigrasikan pada tahap berikutnya.', FALSE),
  ('supply_chain', 'Supply Chain', 'Data awal role Supply Chain; permission akan dimigrasikan pada tahap berikutnya.', FALSE),
  ('pibc', 'PIBC', 'Data awal role PIBC; permission akan dimigrasikan pada tahap berikutnya.', FALSE),
  ('karyawan', 'Karyawan', 'Data awal role Karyawan; permission akan dimigrasikan pada tahap berikutnya.', FALSE),
  ('auditor', 'Auditor', 'Data awal role Auditor; permission akan dimigrasikan pada tahap berikutnya.', FALSE),
  ('sekretaris_direksi', 'Sekretaris Direksi', 'Data awal role Sekretaris Direksi; permission akan dimigrasikan pada tahap berikutnya.', FALSE),
  ('humas', 'Humas', 'Data awal role Humas; permission akan dimigrasikan pada tahap berikutnya.', FALSE)
ON CONFLICT (role_key) DO NOTHING;

COMMIT;
