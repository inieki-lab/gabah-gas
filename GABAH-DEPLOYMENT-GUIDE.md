# GABAH — Deployment Guide

**Application:** GABAH (General Asset & Business Administration Hub)
**Repository:** https://github.com/inieki-lab/gabah-gas
**Date:** 2026-11-10

---

## 1. Stack (current — see GABAH-ARCHITECTURE-BASELINE.md)

- **Frontend:** React 19 + TypeScript + Vite 6 + Tailwind CSS v4
- **Backend/API:** Node.js (Express) + TypeScript
- **Database:** PostgreSQL 17
- **Container:** Docker Compose (Node 20 Alpine app + PostgreSQL 17)

---

## 2. Quick Start (development / local)

### 2.1 Clone & configure

```bash
git clone https://github.com/inieki-lab/gabah-gas.git
cd gabah-gas
cp .env.example .env
# Edit .env: set GABAH_INITIAL_ADMIN_PASSWORD, GABAH_INITIAL_USER_PASSWORD, DATABASE_URL, PGPASSWORD
```

### 2.2 Install & run

```bash
npm install
npm run build        # builds dist/server.cjs + frontend bundle
npm run dev          # tsx server.ts (file-store development fallback)
# OR use docker compose:
docker compose up --build
```

### 2.3 Port & endpoints

- App: `http://localhost:3000`
- API: `http://localhost:3000/api/*`
- Health: `GET /api/health` → `{ status, app, version, persistence, scheduler }`

---

## 3. Production deployment

### 3.1 Build for production

```bash
npm ci --production
npm run build            # frontend + server bundle
```

Push the Docker image and tag it (set `GABAH_IMAGE_TAG=<sha>` in `.env` or `deploy.sh`).

### 3.2 docker-compose.yml (production)

```bash
cp .env.example .env
# Fill strong values:
GABAH_INITIAL_ADMIN_PASSWORD=<strong-random>
GABAH_INITIAL_USER_PASSWORD=<strong-random>
PGPASSWORD=<strong-random>
GABAH_IMAGE_TAG=<prod-tag>
```

```bash
docker compose pull
docker compose up -d
docker compose ps        # verify app health: /api/health
```

**Production fail-fast:** PostgreSQL is explicitly configured; the app refuses to fall back to
file-store (security, CR-04). If Postgres is unavailable, the container exits and the healthcheck
marks it unhealthy.

---

## 4. Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `GABAH_INITIAL_ADMIN_PASSWORD` | dev | Initial superadmin password (production: set strong) |
| `GABAH_INITIAL_USER_PASSWORD` | dev | Initial worker password |
| `DATABASE_URL` | prod | PostgreSQL connection string |
| `PGHOST` / `PGPORT` / `PGDATABASE` / `PGUSER` / `PGPASSWORD` | prod | Legacy PostgreSQL env |
| `PORT` | — | App port (default 3000) |
| `NODE_ENV` | — | `development` | `production` |

---

## 5. Backup & Restore

### 5.1 PostgreSQL dump (recommended)

```bash
# Dump
 PGDATABASE=gabah_db PGUSER=gabah_user PGPASSWORD=<pw>
 pg_dump -h localhost -U gabah_user -d gabah_db -F c -f gabah_backup_$(date +%F).dump

# Restore
 pg_restore -h localhost -U gabah_user -d gabah_db -v gabah_backup_2026-11-10.dump
```

### 5.2 Upload volume

```bash
# Backup (data owned by root inside container)
docker run --rm -v gabah_uploads:/app/uploads -v "$(pwd)":/backup alpine \
  tar czf /backup/uploads.tar.gz -C /app/uploads .
```

### 5.3 Restore checklist

1. Stop the app container (`docker compose down`).
2. Restore the PostgreSQL dump (new DB or replace).
3. Restore the upload volume.
4. Start the app (`docker compose up -d`), verify `/api/health`.

---

## 6. Rollback procedure

1. Tag the last known-good image (e.g., `gabah-gas:<sha>-good`).
2. `docker compose pull` then `docker compose up -d --no-deps app` (uses the known-good image).
3. Verify `/api/health` and key APIs.
4. If the new image introduced issues, keep the good image tagged and redeploy.

---

## 7. Health & observability

- `/api/health` — application + persistence status.
- Scheduler status: `GET /api/.../scheduler` (contract reminders; `runOnce` for one-shot).
- Logs: container stdout + `server/data/gabah_state.json` (runtime-only, gitignored).

---

## 8. Supply-chain & hardening

- `npm audit` — dependency supply-chain (run `npm audit fix`).
- `security` CI scans node_modules, plugins, MCP servers (OSV.dev).
- Frontend bundle code-split (chunks < 500 KB after minification).
