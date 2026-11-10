---
name: gabah-database
description: "GABAH PostgreSQL 17 database standard. Migrations, canonical data, schema rules, and persistence layer. Use when writing migrations, changing database schema, or working with server/persistence.ts."
version: 1.0
category: software-development
created: "2026-11-10"
---

# GABAH Database Standard

## Persistence architecture

- `server/persistence.ts` owns the PostgreSQL connection pool and the migration runner.
- The runner creates a `schema_migrations` ledger table, then executes `.sql` files inside a single transaction per file (idempotent only).
- In non-production (`NODE_ENV !== 'production'`), `persistence.ts` falls back to a file-store (`server/data/gabah_state.json`) — **this is a development convenience, NOT production**. The Docker Compose `app` service runs in `NODE_ENV=production` and requires Postgres; if Postgres is unavailable the container must exit (healthcheck marks it unhealthy).

## Migration rules (always)

1. **No destructive DDL.** Never `DROP TABLE`, `DROP COLUMN`, `ALTER COLUMN ... TYPE` without a migration + rollback strategy.
2. **Idempotent SQL only.** `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`.
3. **The migration runner owns transactions.** `.sql` files do NOT contain `BEGIN`/`COMMIT`.
4. **Schema ledger.** `schema_migrations` tracks applied migrations; never drop tables or columns because they are "not used" — keep historical data.
5. **Foreign keys, indexes, constraints** are defined in migrations; verify integrity after every change.

## Canonical data

- Seed data lives in `server/db.ts` (known users, roles, permissions, divisions, locations).
- Locations: HO, PIBC, RPC, Pangsub (inactive). Subang is inactive — historical data for it must not be deleted.
- Asset/loan/ticket numbering is server-authoritative (`server/numbering.ts`); integers are never trusted from clients.

## Verification

- Every DB change: `npm run lint` → `tsc --noEmit` → **0 errors** → `npm run build`.
- Verify against a real Postgres container (`gabah_database`); the local `tsx server.ts` uses file-store fallback and does not exercise Postgres paths.
