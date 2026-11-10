---
name: gabah-devops
description: "GABAH deploy, CI, and operations standard. Docker Compose, environment variables, healthchecks, backup/restore, rollback. Use when building, starting, or updating GABAH runtime or deployment."
version: 1.0
category: software-development
created: "2026-11-10"
---

# GABAH DevOps Standard

## Docker Compose topology

```text
services:
  database: postgres:17-alpine   (POSTGRES_DB/USER/PASSWORD; healthcheck via pg_isready)
  app:
    image: gabah-gas:local
    build: context=. dockerfile=Dockerfile
    environment: NODE_ENV=production, PG*, GABAH_INITIAL_ADMIN_PASSWORD, GABAH_UPLOAD_DIR
    volumes: uploads_data -> /app/uploads
    healthcheck: fetch http://127.0.0.1:3000/api/health
```

`docker compose up -d` starts both services (app builds first). `--no-cache` forces a clean rebuild.

## Environment variables (.env)

| Variable | Required | Purpose |
|---|---|---|
| `GABAH_INITIAL_ADMIN_PASSWORD` | — | Initial superadmin password |
| `GABAH_INITIAL_USER_PASSWORD` | — | Initial worker password |
| `PGPASSWORD` | — | PostgreSQL password (app DB + `POSTGRES_PASSWORD`) |
| `PGHOST / PGPORT / PGDATABASE / PGUSER / PGPASSWORD` | — | PostgreSQL connection parameters |
| `GABAH_IMAGE_TAG` | — | Image tag (default `local`) |
| `GABAH_ME_DUMMY_USER` / `GABAH_ME_DUMMY_PASSWORD` | — | ME dummy user (set `false` / empty to disable) |

Rules:
1. Secrets live in `.env` (gitignored); `.env.example` shows placeholder names only.
2. `PGPASSWORD` and other variables used by `docker compose` interpolation must be set either in `.env` **or** exported in the shell — the `${VAR:?msg}` construct checks the process environment.
3. Never commit real credentials.

## Verification checklist (before delivery)

1. `docker compose config` — no interpolation errors.
2. `docker compose build --no-cache app` — exits 0.
3. `docker compose up -d` — app healthy (`/api/health`).
4. `docker compose ps` — both services Up.
5. `node scripts/p0-security-verify.mjs` → **37/37**.
6. `node scripts/dynamic-rbac-foundation-verify.mjs` → **129/129**.

## Backup & Restore

- Database: `pg_dump` (full + scheduled) and `pg_restore` into a fresh DB.
- Uploads volume: `docker run ... tar czf ... /app/uploads`.
- Restore: stop app → restore DB → restore volume → `docker compose up -d` → verify `/api/health`.

## Rollback

1. Keep a good tag (`image:tag-good`).
2. `docker compose up -d --build` pointing at the good tag (or `docker tag`).
3. Verify `/api/health` + security/verify scripts before declaring done.
