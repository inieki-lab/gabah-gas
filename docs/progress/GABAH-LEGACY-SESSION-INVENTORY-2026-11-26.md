# GABAH — Legacy Session Table Read-Only Inventory

**Date:** 26 November 2026  
**Branch:** `security/legacy-session-inventory-2026-11-26`  
**Base:** `main`  
**Related issue:** #293  
**Status:** Guarded inventory utility and CI regression added; exact-head CI passed. No database was accessed.

## Scope

Migration `002_gabah_auth_hardening.sql` created `public.user_sessions`. Current runtime source audit says active sessions are held in process memory and the legacy table is not read or written by the current runtime. Existing database contents have not yet been inventoried.

## Change

Added `scripts/legacy-session-inventory.mjs` for a controlled backup/restore rehearsal database only.

Safety controls:
- Requires `GABAH_APP_MODE=test|uat`.
- Requires exact confirmation `GABAH_LEGACY_SESSION_AUDIT_CONFIRM=READ_ONLY_REHEARSAL_ONLY`.
- Requires `GABAH_LEGACY_SESSION_AUDIT_DATABASE` and `DATABASE_URL`; connected database name must match exactly.
- Refuses database names marked prod/production/live.
- Begins a PostgreSQL `READ ONLY` transaction and rolls it back.
- Reports only table existence, aggregate row counts, expired-row count, distinct user count, and oldest/newest creation timestamps.
- Never selects or prints token values, IP addresses, user agents, session IDs, or user IDs.
- Performs no delete, revoke, update, or schema change.

Added `scripts/legacy-session-inventory-safety-verify.mjs`, npm registration, and CI step.

## Validation boundary

- Source-level safety regression added; exact-head CI run **45716922943** completed **SUCCESS** on commit `7db6ad8679acbc5d88846bb6bf1c7e1ce290ebf8`.
- No database connection was attempted in this session.
- No production database or backup was accessed.
- No session tokens were read, copied, revoked, exported, or deleted.

## Next steps

1. Run this inventory only against an isolated backup/restore rehearsal DB after the DBA confirms the target.
2. Record aggregate output and table existence without exposing identifiers.
3. Decide whether legacy rows require controlled revocation/expiry; do not drop the table until runtime independence and restore/rollback are proven.
4. If removal is approved, implement a separate reviewed migration with a backup and rollback plan.

**Merge policy:** No merge to `main` without exact-head CI and owner approval.
