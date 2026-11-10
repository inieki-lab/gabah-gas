# GABAH — Backup & Restore

## Overview

GABAH data is stored in PostgreSQL (authoritative). Upload binaries (assets, attachments) live in a
named Docker volume. Always back up both the database and the uploads volume on a schedule and before
any targeted migration.

---

## 1. Prerequisites

- PostgreSQL client (`pg_dump`, `pg_restore`) available on the backup host.
- Docker available (for upload-volume backup).
- Write access to the backup destination directory.

```bash
PGBENCH_HOST=localhost
PGBENCH_USER=gabah_user
PGBENCH_DB=gabah_db
PGBENCH_PASSWORD=<set>
VOL=gabah_uploads
BK=./backups
mkdir -p "$BK"
```

---

## 2. PostgreSQL dump

### Full (recommended, scheduled)

```bash
pg_dump --host="$PGBENCH_HOST" --username="$PGBENCH_USER" --dbname="$PGBENASE_DB" \
  --no-owner --no-privileges -Fc -f "$BK/gabah_full_$(date +%Y%m%d_%H%M%S).dump"
```

### Logical (row-level, for point-in-time restore)

```bash
pg_dump --host="$PGBENCH_HOST" --username="$PGBENCH_USER" --dbname="$PGBENASE_DB" \
  --table=public.tickets --table=public.assets --format=c \
  -f "$BK/gabah_tickets_$(date +%Y%m%d_%H%M%S).dump"
```

### Verify the dump

```bash
pg_dump --help >/dev/null 2>&1 && echo "pg tools present" || echo "install postgresql-client"
ls -la "$BK"
```

---

## 3. Restore PostgreSQL

### On a fresh database

```bash
dropdb --if-exists gabah_db
createdb gabah_db
pg_restore --clean --no-owner --no-privileges -h localhost -U gabah_user \
  -d gabah_db gabah_full_2026-11-10_120000.dump
```

### Into an existing database (with data-preserving care)

```bash
pg_restore --clean --no-owner --no-privileges -h localhost -U gabah_user \
  -d gabah_db gabah_full_2026-11-10_120000.dump
```

> Always snapshot the running database before restoring (reversible: restore to a new DB and test).

---

## 4. Uploads volume backup

```bash
docker run --rm -v "$VOL":/srv/uploads -v "$BK":/bak alpine \
  tar czf "/bak/uploads_$(date +%Y%m%d_%H%M%S).tar.gz" -C /srv/uploads .
```

## Restore uploads volume

```bash
mkdir -p /tmp/uploads-restore
docker run --rm -v /tmp/uploads-restore:/srv/uploads -v "$BK":/bak alpine \
  tar xzf "/bak/uploads_2026-11-10_120000.tar.gz" -C /srv/uploads
```

Then attach the restored volume (update `docker-compose.yml` volume mount, or redeploy).

---

## 5. Restore checklist

1. Snapshot the current database (so rollback is possible).
2. Stop the app (`docker compose down`).
3. Restore PostgreSQL (new DB preferred).
4. Restore uploads volume.
5. Start the app (`docker compose up -d`).
6. Verify `/api/health`, then run `node scripts/p0-security-verify.mjs` and
   `node scripts/dynamic-rbac-foundation-verify.mjs` to confirm integrity.

---

## 6. Retention

Store N daily backups, keep weekly/monthly for 30/90 days respectively. Automate with a cron job:

```cron
0 3 * * * cd /opt/gabah && pg_dump ... > backups/gabah_$(date +\%F).dump
```

## Security

Backups contain user data (tickets, assets, users). Encrypt at rest and restrict access to
authorized operators (see `GABAH-DEPLOYMENT-GUIDE.md` Environment variables).
