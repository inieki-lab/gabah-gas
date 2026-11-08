#!/usr/bin/env bash
set -Eeuo pipefail

NETWORK="gabah-ci-${GITHUB_RUN_ID:-local}-$$"
DB_CONTAINER="gabah-ci-db-$$"
APP_CONTAINER="gabah-ci-app-$$"
APP_PORT="${GABAH_DOCKER_SMOKE_PORT:-39173}"
DB_PASSWORD="ci-only-${GITHUB_RUN_ID:-local}-password"

cleanup() {
  docker rm -f "$APP_CONTAINER" "$DB_CONTAINER" >/dev/null 2>&1 || true
  docker network rm "$NETWORK" >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker network create "$NETWORK" >/dev/null

docker run -d \
  --name "$DB_CONTAINER" \
  --network "$NETWORK" \
  --health-cmd "pg_isready -U gabah_ci -d gabah_ci" \
  --health-interval 2s \
  --health-timeout 3s \
  --health-retries 30 \
  -e POSTGRES_DB=gabah_ci \
  -e POSTGRES_USER=gabah_ci \
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

docker run -d \
  --name "$APP_CONTAINER" \
  --network "$NETWORK" \
  -p "127.0.0.1:${APP_PORT}:3000" \
  -e NODE_ENV=production \
  -e PGHOST="$DB_CONTAINER" \
  -e PGPORT=5432 \
  -e PGDATABASE=gabah_ci \
  -e PGUSER=gabah_ci \
  -e PGPASSWORD="$DB_PASSWORD" \
  -e GABAH_INITIAL_ADMIN_PASSWORD="Ci-Admin-${GITHUB_RUN_ID:-local}-Only" \
  -e GABAH_INITIAL_USER_PASSWORD="Ci-User-${GITHUB_RUN_ID:-local}-Only" \
  -e GABAH_UPLOAD_DIR=/app/uploads \
  -e GABAH_REMINDER_SCHEDULER_DISABLED=true \
  -e GABAH_REMINDER_RUN_ON_BOOT=false \
  -v "gabah-ci-uploads-$$:/app/uploads" \
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

NODE_VERSION="$(docker exec "$APP_CONTAINER" node -p 'process.versions.node')"
[[ "$NODE_VERSION" == 22.* ]] || {
  echo "Expected Node 22 runtime, got $NODE_VERSION." >&2
  exit 1
}

docker exec "$APP_CONTAINER" sh -c 'touch /app/uploads/.runtime-write-test && rm /app/uploads/.runtime-write-test'
echo "PASS — production image booted on Node $NODE_VERSION with PostgreSQL and writable persistent uploads."
rm -f "/tmp/gabah-docker-health-$$.json"
