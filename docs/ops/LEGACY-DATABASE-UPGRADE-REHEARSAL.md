# GABAH — Legacy PostgreSQL Upgrade Rehearsal

**Purpose:** prove that the application can upgrade a *copy* of a pre-098 GABAH database without losing historical tickets, notifications, or legacy SC/PIBC ownership values.

**Status:** procedure prepared; rehearsal has **not** been executed. This document is not evidence of a successful upgrade and is not production approval.

## Safety rules

- Never point this procedure at production as the target.
- Never run `docker compose down -v` against the source environment.
- The source is read-only: create a logical dump, then restore it into a separate Compose project/database.
- Keep the dump, baseline query output, post-upgrade query output, application logs, and CI run link as the rehearsal evidence.
- If the source database already records migration `098`, it is not a valid pre-098 upgrade fixture. Obtain a backup from before PR #121's migration instead.
- Stop on any migration error, missing row, changed legacy owner/category, unexpected count delta, or unhealthy app. Do not repair the rehearsal copy by hand and then call it a pass.

## 1. Prepare a separate rehearsal environment

On a trusted operator workstation with Docker Compose and PostgreSQL 17 client tools:

1. Take a consistent logical dump from the existing database. Use a read-only database credential if available.

```bash
export SOURCE_DATABASE_URL='postgresql://READ_ONLY_USER:REDACTED@SOURCE_HOST:5432/gabah_db'
pg_dump --format=custom --no-owner --no-acl "$SOURCE_DATABASE_URL" > gabah-pre098-rehearsal.dump
```

2. Create a separate `.env.rehearsal` file. Use unique ports and a new strong test password; do not copy production secrets.

```dotenv
PGDATABASE=gabah_rehearsal
PGUSER=gabah_user
PGPASSWORD=REPLACE_WITH_A_NEW_LONG_RANDOM_TEST_SECRET
GABAH_DB_PORT=15433
GABAH_WEB_PORT=18080
GABAH_INITIAL_ADMIN_PASSWORD=REPLACE_WITH_A_NEW_TEST_PASSWORD
GABAH_INITIAL_USER_PASSWORD=REPLACE_WITH_A_DIFFERENT_TEST_PASSWORD
```

3. Start an isolated Compose project. The small override removes the repository's fixed container names so this project can coexist with the normal GABAH stack; it receives its own project-prefixed volume and network.

```bash
docker compose -p gabah-rehearsal -f docker-compose.yml -f docker-compose.rehearsal.yml --env-file .env.rehearsal up -d database
docker compose -p gabah-rehearsal -f docker-compose.yml -f docker-compose.rehearsal.yml --env-file .env.rehearsal ps
```

4. Restore the dump into the isolated database. This pipes the archive into the PostgreSQL 17 container; it does not write to the source database.

```bash
pg_dump --format=custom --no-owner --no-acl "$SOURCE_DATABASE_URL" | \
  docker compose -p gabah-rehearsal -f docker-compose.yml -f docker-compose.rehearsal.yml --env-file .env.rehearsal exec -T database \
  pg_restore --username "$PGUSER" --dbname "$PGDATABASE" --clean --if-exists --single-transaction --no-owner --no-privileges
```

If the restore reports errors, stop and resolve the fixture/restore issue before proceeding. Do not continue with a partial restore.

## 2. Capture the pre-upgrade baseline

Run the following against the rehearsal database (host port 15433):

```bash
export PGPASSWORD='THE_REHEARSAL_PGPASSWORD'
psql -h 127.0.0.1 -p 15433 -U gabah_user -d gabah_rehearsal -v ON_ERROR_STOP=1
```

Capture these results in the evidence folder:

```sql
SELECT version, name
FROM schema_migrations
WHERE version = '098';

SELECT 'tickets' AS table_name, count(*) AS row_count FROM tickets
UNION ALL
SELECT 'notifications', count(*) FROM notifications
UNION ALL
SELECT 'assets', count(*) FROM assets;

SELECT id, category, assigned_agent_id
FROM tickets
WHERE category IN ('SC', 'PIBC')
ORDER BY id;

SELECT id, asset_number, d.code AS legacy_owner
FROM assets a
JOIN divisions d ON d.id = a.owner_division_id
WHERE d.code IN ('SC', 'PIBC')
ORDER BY a.asset_number;

SELECT id, recipient_role, recipient_user_id
FROM notifications
WHERE recipient_role IN ('Supply Chain', 'PIBC', 'SC')
   OR recipient_division IN ('SC', 'PIBC')
ORDER BY id;
```

**Gate:** the migration 098 query must return zero rows. Record the exact legacy ticket, asset, and notification IDs returned by the other queries. If the source has no legacy rows, record that fact; do not fabricate fixture evidence.

## 3. Apply the application upgrade to the copy

Build and start the app against the restored rehearsal database:

```bash
docker compose -p gabah-rehearsal -f docker-compose.yml -f docker-compose.rehearsal.yml --env-file .env.rehearsal up -d --build
docker compose -p gabah-rehearsal -f docker-compose.yml -f docker-compose.rehearsal.yml --env-file .env.rehearsal ps
docker compose -p gabah-rehearsal -f docker-compose.yml -f docker-compose.rehearsal.yml --env-file .env.rehearsal logs --tail=300 app
```

The app must become healthy and the logs must show migration `098_ticket_routing_unit_scope.sql` applied, followed by PostgreSQL persistence ready. A migration failure or fallback to file storage is an immediate FAIL.

## 4. Verify post-upgrade preservation and new ME setup

Connect to the rehearsal database again and rerun the baseline queries. The following must hold:

- The same legacy SC/PIBC ticket IDs remain, with their original categories and assigned agents.
- The same legacy SC/PIBC asset IDs/numbers remain associated with their original owner codes. No automatic reassignment to IT or GA is permitted.
- Existing notification IDs and recipient identities remain. New nullable unit-routing columns must not rewrite historical recipients.
- The total row counts must not decrease. Explain any increase caused by documented startup seeding/backfill; unexplained changes are FAIL.
- `schema_migrations` contains version `098` exactly once.
- `org_units` contains active `UNIT-PIBC-ME` with `division_code='Umum'` and `office_location_id='OFF-PIBC'`.
- ME operator permissions and the exact `tickets` unit scope are present; no user account is automatically assigned to the new roles.

Verification SQL:

```sql
SELECT version, name, count(*)
FROM schema_migrations
WHERE version = '098'
GROUP BY version, name;

SELECT id, name, division_code, office_location_id, is_active
FROM org_units
WHERE id = 'UNIT-PIBC-ME';

SELECT r.role_key, p.permission_key
FROM gabah_roles r
JOIN gabah_role_permissions rp ON rp.role_id = r.id
JOIN gabah_permissions p ON p.permission_key = rp.permission_key
WHERE r.role_key IN ('ga_helpdesk_operator', 'admin_tiket_me',
                     'pemohon_tiket_ga', 'pemohon_tiket_me')
ORDER BY r.role_key, p.permission_key;

SELECT r.role_key, s.module, s.scope_type, s.scope_value
FROM gabah_roles r
JOIN gabah_role_division_scopes s ON s.role_id = r.id
WHERE r.role_key IN ('ga_helpdesk_operator', 'admin_tiket_me')
  AND s.module = 'tickets'
ORDER BY r.role_key, s.scope_type, s.scope_value;

SELECT r.role_key, count(ur.user_id) AS assigned_users
FROM gabah_roles r
LEFT JOIN gabah_user_roles ur ON ur.role_id = r.id
WHERE r.role_key IN ('ga_helpdesk_operator', 'admin_tiket_me',
                     'pemohon_tiket_ga', 'pemohon_tiket_me')
GROUP BY r.role_key
ORDER BY r.role_key;
```

Expected ME unit: one active row at PIBC. Expected scopes: GA operator → division GA; Admin Tiket ME → unit UNIT-PIBC-ME. The four template roles must have zero assigned users unless the operator deliberately assigns approved UAT accounts after the migration check.

## 5. Browser smoke checks and evidence

At `http://localhost:18080`, use only rehearsal accounts:

- Superadmin can see Administration and the new ME role templates.
- A normal PIBC employee does not see the ME operator queue merely because their office location is PIBC.
- An explicitly assigned ME requester can create a ME ticket; it targets UNIT-PIBC-ME.
- An explicitly assigned Admin Tiket ME can see and manage only the ME unit queue.
- A legacy SC/PIBC ticket remains readable according to its existing reporter/assignment/explicit-scope rules; its category is not silently rewritten.
- GA staff without the explicit GA operator role cannot dispatch or manage the GA queue.
- Auditor remains read-only.

Save the following together: source dump checksum, source migration ledger, pre/post SQL outputs, app logs, browser screenshots, exact Git commit SHA, CI run URL, operator name, date/time, and PASS/FAIL decision.

## 6. Cleanup

Only after evidence is copied out:

```bash
docker compose -p gabah-rehearsal -f docker-compose.yml -f docker-compose.rehearsal.yml --env-file .env.rehearsal down -v
```

This command intentionally deletes the **rehearsal project's** database and uploads volumes. Confirm the project name is exactly `gabah-rehearsal`; never run it against the regular `gabah-gas` project.

## Sign-off

| Gate | Result | Evidence / reviewer |
|---|---|---|
| Source confirmed pre-098 | NOT RUN | |
| Logical dump + restore into isolated DB | NOT RUN | |
| Migration 098 applied once | NOT RUN | |
| Legacy ticket/notification/asset IDs preserved | NOT RUN | |
| ME unit, role templates, and exact scopes verified | NOT RUN | |
| Browser smoke per persona | NOT RUN | |
| Business / IT owner sign-off | NOT RUN | |

**Release decision remains NO-GO until this rehearsal and the full persona UAT are executed and signed off.**
