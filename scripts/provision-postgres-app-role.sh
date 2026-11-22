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

-- Only migrate ownership when this dedicated database is still owned by the
-- bootstrap administrator. This keeps repeat starts idempotent and refuses
-- unrelated databases owned by a third role.
SELECT 1 / CASE WHEN datdba IN (
  (SELECT oid FROM pg_roles WHERE rolname = :'admin_user'),
  (SELECT oid FROM pg_roles WHERE rolname = :'app_user')
) THEN 1 ELSE 0 END
FROM pg_database WHERE datname = current_database();

SELECT format('REASSIGN OWNED BY %I TO %I', :'admin_user', :'app_user')
WHERE (SELECT datdba FROM pg_database WHERE datname = current_database())
    = (SELECT oid FROM pg_roles WHERE rolname = :'admin_user')
\gexec

-- REASSIGN OWNED also transfers shared database/tablespace ownership. Keep
-- unrelated databases and tablespaces with the bootstrap administrator.
SELECT format('ALTER DATABASE %I OWNER TO %I', datname, :'admin_user')
FROM pg_database
WHERE datname <> current_database()
  AND datdba = (SELECT oid FROM pg_roles WHERE rolname = :'app_user')
\gexec

SELECT format('ALTER TABLESPACE %I OWNER TO %I', spcname, :'admin_user')
FROM pg_tablespace
WHERE spcowner = (SELECT oid FROM pg_roles WHERE rolname = :'app_user')
\gexec

SELECT format('ALTER DATABASE %I OWNER TO %I', current_database(), :'app_user')
WHERE (SELECT datdba FROM pg_database WHERE datname = current_database())
   <> (SELECT oid FROM pg_roles WHERE rolname = :'app_user')
\gexec

ALTER SCHEMA public OWNER TO :"app_user";
GRANT CONNECT, TEMPORARY ON DATABASE :"db_name" TO :"app_user";
GRANT USAGE, CREATE ON SCHEMA public TO :"app_user";
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO :"app_user";
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO :"app_user";
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO :"app_user";

-- Verify that the runtime login has no cluster-administration capabilities.
SELECT 1 / CASE WHEN NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
                     AND NOT rolreplication AND NOT rolbypassrls
                THEN 1 ELSE 0 END
FROM pg_roles WHERE rolname = :'app_user';

SELECT format('PostgreSQL app role %I is provisioned as non-superuser and owns database %I.', :'app_user', current_database());
SQL
