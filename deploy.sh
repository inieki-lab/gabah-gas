#!/usr/bin/env bash
set -Eeuo pipefail

APP_URL="${GABAH_HEALTH_URL:-http://127.0.0.1:${GABAH_WEB_PORT:-8080}/api/health}"
MAX_ATTEMPTS="${GABAH_HEALTH_ATTEMPTS:-30}"
WAIT_SECONDS="${GABAH_HEALTH_WAIT_SECONDS:-5}"

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

printf '%s\n' "GABAH deployment — preflight"

command -v docker >/dev/null 2>&1 || fail "Docker belum terpasang. Install Docker Engine dan Compose Plugin melalui prosedur resmi server."
docker compose version >/dev/null 2>&1 || fail "Docker Compose Plugin tidak tersedia."
command -v curl >/dev/null 2>&1 || fail "curl diperlukan untuk health check."

[[ -f .env ]] || fail "File .env tidak ditemukan. Salin .env.example dan isi kredensial produksi terlebih dahulu."
awk -F= '$1 == "PGPASSWORD" && length($2) > 0 { found=1 } END { exit(found ? 0 : 1) }' .env \
  || fail "PGPASSWORD kosong/tidak ditemukan pada .env."
docker compose config --quiet || fail "Konfigurasi Docker Compose tidak valid."

printf '%s\n' "Preflight PASS. Membangun image aplikasi dari Dockerfile yang memakai lockfile."
# Build before touching the running application.
docker compose build app

# Ensure PostgreSQL is running without recreating an existing healthy container.
docker compose up -d database
DB_CONTAINER="$(docker compose ps -q database)"
[[ -n "$DB_CONTAINER" ]] || fail "Container PostgreSQL tidak ditemukan setelah start."
DB_HEALTH=""
for ((attempt=1; attempt<=30; attempt++)); do
  DB_HEALTH="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$DB_CONTAINER" 2>/dev/null || true)"
  [[ "$DB_HEALTH" == "healthy" ]] && break
  printf 'Menunggu PostgreSQL sehat (%s/30): %s\n' "$attempt" "${DB_HEALTH:-unknown}"
  sleep 2
done
[[ "$DB_HEALTH" == "healthy" ]] || fail "PostgreSQL belum healthy; aplikasi tidak akan diganti."

# Replace only the app container. Database and both named volumes remain intact.
docker compose up -d --no-deps --force-recreate app

printf 'Menunggu health check: %s\n' "$APP_URL"
for ((attempt=1; attempt<=MAX_ATTEMPTS; attempt++)); do
  if curl --fail --silent --show-error "$APP_URL"; then
    printf '\nHealth check PASS. Status container:\n'
    docker compose ps
    exit 0
  fi
  printf 'Belum sehat (%s/%s); tunggu %s detik...\n' "$attempt" "$MAX_ATTEMPTS" "$WAIT_SECONDS"
  sleep "$WAIT_SECONDS"
done

printf '%s\n' "Health check gagal. Ringkasan container dan log terakhir:"
docker compose ps || true
docker compose logs --tail=80 app database || true
fail "Deployment belum terverifikasi sehat. Jangan anggap rilis berhasil; periksa log dan lakukan rollback sesuai runbook."
