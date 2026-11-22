#!/usr/bin/env sh
set -eu

: "${PGHOST:=database}"
: "${PGPORT:=5432}"
: "${PGDATABASE:?PGDATABASE wajib diisi}"
: "${PGADMIN_USER:?PGADMIN_USER wajib diisi}"
: "${PGADMIN_PASSWORD:?PGADMIN_PASSWORD wajib diisi}"
: "${PGAPP_USER:?PGUSER aplikasi wajib diisi}"
: "${PGAPP_PASSWORD:?PGPASSWORD aplikasi wajib diisi}"

if [ "$PGADMIN_USER" = "$PGAPP_USER" ]; then
  echo "ERROR: akun administrator PostgreSQL dan akun aplikasi harus berbeda." >&2
  exit 1
fi
if [ "$PGAPP_USER" = "postgres" ]; then
  echo "ERROR: akun aplikasi tidak boleh memakai role bawaan postgres." >&2
  exit 1
fi
case "$PGDATABASE" in
  postgres|template0|template1)
    echo "ERROR: GABAH harus memakai database khusus, bukan database sistem PostgreSQL." >&2
    exit 1
    ;;
esac

export PGPASSWORD="$PGADMIN_PASSWORD"
psql --no-psqlrc --set=ON_ERROR_STOP=1 \
  --host="$PGHOST" --port="$PGPORT" --username="$PGADMIN_USER" --dbname="$PGDATABASE" \
  --set=admin_user="$PGADMIN_USER" --set=app_user="$PGAPP_USER" \
  --set=app_password="$PGAPP_PASSWORD" --set=db_name="$PGDATABASE" <<'SQL'
-- The bootstrap account must be a superuser for this one-shot provisioning step.
SELECT 1 / CASE WHEN rolsuper THEN 1 ELSE 0 END
FROM pg_roles WHERE rolname = current_user;

-- Create or rotate the application login as a non-superuser.
SELECT format(
  'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT',
  :'app_user', :'app_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user')
\gexec

SELECT format(
  'ALTER ROLE %I WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS NOINHERIT',
  :'app_user', :'app_password'
)
\gexec

-- The application login is standalone: it must not inherit or SET ROLE into
-- administrator/group roles that may have been assigned to a legacy login.
SELECT format('REVOKE %I FROM %I', parent.rolname, member.rolname)
FROM pg_auth_members membership
JOIN pg_roles parent ON parent.oid = membership.roleid
JOIN pg_roles member ON member.oid = membership.member
WHERE member.rolname = :'app_user'
\gexec

-- This must be a dedicated GABAH database owned by either the bootstrap
-- administrator (first provisioning) or the application role (repeat starts).
SELECT 1 / CASE WHEN datdba IN (
  (SELECT oid FROM pg_roles WHERE rolname = :'admin_user'),
  (SELECT oid FROM pg_roles WHERE rolname = :'app_user')
) THEN 1 ELSE 0 END
FROM pg_database WHERE datname = current_database();

SELECT format('ALTER DATABASE %I OWNER TO %I', current_database(), :'app_user')
WHERE (SELECT datdba FROM pg_database WHERE datname = current_database())
   <> (SELECT oid FROM pg_roles WHERE rolname = :'app_user')
\gexec

-- Change only GABAH-owned objects in this database. REASSIGN OWNED is avoided
-- because PostgreSQL also reassigns shared/system objects such as template DBs
-- and tablespaces, which must remain owned by the bootstrap administrator.
ALTER SCHEMA public OWNER TO :"app_user";

SELECT format('ALTER SCHEMA %I OWNER TO %I', n.nspname, :'app_user')
FROM pg_namespace n
WHERE n.nspowner = (SELECT oid FROM pg_roles WHERE rolname = :'admin_user')
  AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'public')
\gexec

SELECT format(
  CASE WHEN c.relkind = 'S'
       THEN 'ALTER SEQUENCE %I.%I OWNER TO %I'
       ELSE 'ALTER TABLE %I.%I OWNER TO %I' END,
  n.nspname, c.relname, :'app_user'
)
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relowner = (SELECT oid FROM pg_roles WHERE rolname = :'admin_user')
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
  AND NOT EXISTS (
    SELECT 1 FROM pg_depend d
    WHERE d.classid = 'pg_class'::regclass
      AND d.objid = c.oid
      AND d.refclassid = 'pg_extension'::regclass
      AND d.deptype = 'e'
  )
ORDER BY CASE WHEN c.relkind = 'S' THEN 2 ELSE 1 END, n.nspname, c.relname
\gexec

SELECT format(
  'ALTER ROUTINE %I.%I(%s) OWNER TO %I',
  n.nspname, p.proname, pg_get_function_identity_arguments(p.oid), :'app_user'
)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE p.proowner = (SELECT oid FROM pg_roles WHERE rolname = :'admin_user')
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND NOT EXISTS (
    SELECT 1 FROM pg_depend d
    WHERE d.classid = 'pg_proc'::regclass
      AND d.objid = p.oid
      AND d.refclassid = 'pg_extension'::regclass
      AND d.deptype = 'e'
  )
\gexec

SELECT format(
  CASE WHEN t.typtype = 'd'
       THEN 'ALTER DOMAIN %I.%I OWNER TO %I'
       ELSE 'ALTER TYPE %I.%I OWNER TO %I' END,
  n.nspname, t.typname, :'app_user'
)
FROM pg_type t
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE t.typowner = (SELECT oid FROM pg_roles WHERE rolname = :'admin_user')
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND t.typrelid = 0
  AND t.typelem = 0
  AND t.typtype IN ('b', 'd', 'e', 'r', 'm')
  AND NOT EXISTS (
    SELECT 1 FROM pg_depend d
    WHERE d.classid = 'pg_type'::regclass
      AND d.objid = t.oid
      AND d.refclassid = 'pg_extension'::regclass
      AND d.deptype = 'e'
  )
\gexec

GRANT CONNECT, TEMPORARY ON DATABASE :"db_name" TO :"app_user";
GRANT USAGE, CREATE ON SCHEMA public TO :"app_user";
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO :"app_user";
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO :"app_user";
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO :"app_user";

-- Fail closed if a GABAH table/sequence/function outside an extension remains
-- owned by the bootstrap role after the ownership migration.
SELECT 1 / CASE WHEN NOT EXISTS (
  SELECT 1
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relowner = (SELECT oid FROM pg_roles WHERE rolname = :'admin_user')
    AND n.nspname NOT IN ('pg_catalog', 'information_schema')
    AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
    AND NOT EXISTS (
      SELECT 1 FROM pg_depend d
      WHERE d.classid = 'pg_class'::regclass
        AND d.objid = c.oid
        AND d.refclassid = 'pg_extension'::regclass
        AND d.deptype = 'e'
    )
) THEN 1 ELSE 0 END;

-- Verify that the runtime login has no cluster-administration capabilities.
SELECT 1 / CASE WHEN NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
                     AND NOT rolreplication AND NOT rolbypassrls
                THEN 1 ELSE 0 END
FROM pg_roles WHERE rolname = :'app_user';

SELECT format('PostgreSQL app role %I is provisioned as non-superuser and owns database %I.', :'app_user', current_database());
SQL
