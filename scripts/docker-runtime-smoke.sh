#!/usr/bin/env bash
set -Eeuo pipefail

NETWORK="gabah-ci-${GITHUB_RUN_ID:-local}-$$"
DB_CONTAINER="gabah-ci-db-$$"
APP_CONTAINER="gabah-ci-app-$$"
UPLOAD_VOLUME="gabah-ci-uploads-$$"
APP_PORT="${GABAH_DOCKER_SMOKE_PORT:-39173}"
DB_PASSWORD="ci-admin-only-${GITHUB_RUN_ID:-local}-password"
APP_DB_PASSWORD="ci-app-only-${GITHUB_RUN_ID:-local}-password"
DB_ADMIN_USER="gabah_ci_admin"
DB_APP_USER="gabah_ci_app"

cleanup() {
  docker rm -f "$APP_CONTAINER" "$DB_CONTAINER" >/dev/null 2>&1 || true
  docker network rm "$NETWORK" >/dev/null 2>&1 || true
  docker volume rm "$UPLOAD_VOLUME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker network create "$NETWORK" >/dev/null

docker run -d \
  --name "$DB_CONTAINER" \
  --network "$NETWORK" \
  --health-cmd "pg_isready -U ${DB_ADMIN_USER} -d gabah_ci" \
  --health-interval 2s \
  --health-timeout 3s \
  --health-retries 30 \
  -e POSTGRES_DB=gabah_ci \
  -e POSTGRES_USER="$DB_ADMIN_USER" \
  -e POSTGRES_PASSWORD="$DB_PASSWORD" \
  postgres:17-alpine >/dev/null

DB_HEALTH=""
for attempt in $(seq 1 60); do
  DB_HEALTH="$(docker inspect --format '{{.State.Health.Status}}' "$DB_CONTAINER" 2>/dev/null || true)"
  [[ "$DB_HEALTH" == "healthy" ]] && break
  sleep 2
done
[[ "$DB_HEALTH" == "healthy" ]] || {
  docker logs "$DB_CONTAINER" || true
  echo "PostgreSQL smoke container did not become healthy." >&2
  exit 1
}

# Simulate an existing database object still owned by the bootstrap account.
docker exec "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_ADMIN_USER" -d gabah_ci \
  -c 'CREATE TABLE public.gabah_admin_owned_fixture (id integer PRIMARY KEY); INSERT INTO public.gabah_admin_owned_fixture (id) VALUES (1); CREATE EXTENSION btree_gist;' >/dev/null

# Provision the non-superuser app login and transfer existing database ownership.
docker run --rm --network "$NETWORK" --entrypoint /bin/sh \
  -v "$PWD/scripts/provision-postgres-app-role.sh:/scripts/provision-postgres-app-role.sh:ro" \
  -e PGHOST="$DB_CONTAINER" \
  -e PGPORT=5432 \
  -e PGDATABASE=gabah_ci \
  -e PGADMIN_USER="$DB_ADMIN_USER" \
  -e PGADMIN_PASSWORD="$DB_PASSWORD" \
  -e PGAPP_USER="$DB_APP_USER" \
  -e PGAPP_PASSWORD="$APP_DB_PASSWORD" \
  postgres:17-alpine /scripts/provision-postgres-app-role.sh

# Existing objects must now be owned by the app role, so app migrations can evolve them.
docker exec "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_APP_USER" -d gabah_ci \
  -c 'ALTER TABLE public.gabah_admin_owned_fixture ADD COLUMN migrated_by_app boolean NOT NULL DEFAULT true; CREATE EXTENSION IF NOT EXISTS btree_gist;' >/dev/null

docker run -d \
  --name "$APP_CONTAINER" \
  --network "$NETWORK" \
  -p "127.0.0.1:${APP_PORT}:3000" \
  -e NODE_ENV=production \
  -e PGHOST="$DB_CONTAINER" \
  -e PGPORT=5432 \
  -e PGDATABASE=gabah_ci \
  -e PGUSER="$DB_APP_USER" \
  -e PGPASSWORD="$APP_DB_PASSWORD" \
  -e GABAH_INITIAL_ADMIN_PASSWORD="Ci-Admin-${GITHUB_RUN_ID:-local}-Only" \
  -e GABAH_INITIAL_USER_PASSWORD="Ci-User-${GITHUB_RUN_ID:-local}-Only" \
  -e GABAH_UPLOAD_DIR=/app/uploads \
  -e GABAH_REMINDER_SCHEDULER_DISABLED=true \
  -e GABAH_REMINDER_RUN_ON_BOOT=false \
  -v "$UPLOAD_VOLUME:/app/uploads" \
  gabah-gas:ci >/dev/null

APP_HEALTH=""
for attempt in $(seq 1 90); do
  if curl --fail --silent "http://127.0.0.1:${APP_PORT}/api/health" > "/tmp/gabah-docker-health-$$.json"; then
    APP_HEALTH="$(cat "/tmp/gabah-docker-health-$$.json")"
    break
  fi
  APP_HEALTH=""
  sleep 2
done

if [[ -z "$APP_HEALTH" ]] || ! grep -q '"persistence":"postgresql"' <<<"$APP_HEALTH"; then
  docker logs "$APP_CONTAINER" || true
  echo "Production image did not report PostgreSQL health." >&2
  exit 1
fi

ROLE_FLAGS="$(docker exec "$DB_CONTAINER" psql -U "$DB_ADMIN_USER" -d gabah_ci -Atc "SELECT concat_ws(',', rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls) FROM pg_roles WHERE rolname='$DB_APP_USER'")"
[[ "$ROLE_FLAGS" == "false,false,false,false,false" ]] || {
  echo "Expected least-privilege app role, got: $ROLE_FLAGS" >&2
  exit 1
}
DB_OWNER="$(docker exec "$DB_CONTAINER" psql -U "$DB_ADMIN_USER" -d gabah_ci -Atc "SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname='gabah_ci'")"
[[ "$DB_OWNER" == "$DB_APP_USER" ]] || {
  echo "Expected app role to own the GABAH database, got: $DB_OWNER" >&2
  exit 1
}
OTHER_DB_OWNER="$(docker exec "$DB_CONTAINER" psql -U "$DB_ADMIN_USER" -d gabah_ci -Atc "SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname='postgres'")"
[[ "$OTHER_DB_OWNER" == "$DB_ADMIN_USER" ]] || {
  echo "Provisioning must not transfer the unrelated postgres database; got owner: $OTHER_DB_OWNER" >&2
  exit 1
}
APP_OWNED_TABLESPACES="$(docker exec "$DB_CONTAINER" psql -U "$DB_ADMIN_USER" -d gabah_ci -Atc "SELECT count(*) FROM pg_tablespace WHERE spcowner=(SELECT oid FROM pg_roles WHERE rolname='$DB_APP_USER')")"
[[ "$APP_OWNED_TABLESPACES" == "0" ]] || {
  echo "App role must not become owner of cluster tablespaces." >&2
  exit 1
}
EXTENSION="$(docker exec "$DB_CONTAINER" psql -U "$DB_ADMIN_USER" -d gabah_ci -Atc "SELECT count(*) FROM pg_extension WHERE extname='btree_gist'")"
[[ "$EXTENSION" == "1" ]] || {
  echo "Expected btree_gist extension to be installed by the non-superuser app role." >&2
  exit 1
}

NODE_VERSION="$(docker exec "$APP_CONTAINER" node -p 'process.versions.node')"
[[ "$NODE_VERSION" == 22.* ]] || {
  echo "Expected Node 22 runtime, got $NODE_VERSION." >&2
  exit 1
}

docker exec "$APP_CONTAINER" sh -c 'touch /app/uploads/.runtime-write-test && rm /app/uploads/.runtime-write-test'
echo "PASS — production image booted on Node $NODE_VERSION with PostgreSQL, non-superuser app role, existing-object ownership transfer, and writable persistent uploads."
rm -f "/tmp/gabah-docker-health-$$.json"
