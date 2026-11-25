# GABAH — UAT Legacy User Reset Safety

**Date:** 26 November 2026  
**Branch:** `security/uat-user-reset-safety-2026-11-26`  
**Base:** `main`  
**Status:** Code change pushed; exact-head CI pending. No database was accessed or modified.

## Finding

The legacy `scripts/reset-temporary-users.mjs` utility performed a broad destructive rewrite:
- Replaced the entire `gabah_state.payload.users` collection with six hard-coded users.
- Upserted legacy primary role values such as IT, GA, Supply Chain, and PIBC, which conflict with the current two-profile Dynamic RBAC model.
- Deactivated every database user not in the hard-coded six-user list.
- Its connection-error handler logged a fallback message rather than reliably failing the command.

This is unsafe to retain as an executable utility, particularly because GABAH is moving to configurable role assignments and UAT data may be disposable only within a deliberately isolated test environment.

## Change

- Retired the legacy script. It now exits non-zero before importing a database driver or opening a database connection.
- Removed all SQL/data mutation logic from that script.
- Added `scripts/uat-reset-script-safety-verify.mjs`, asserting the script refuses to run and contains no database connection or destructive SQL.
- Registered the regression in `package.json` and CI.
- Updated README's script inventory to mark the utility as retired.

## Validation

- Static review of the old script confirmed whole-user-collection replacement and mass deactivation.
- Regression test added; exact-head CI execution pending.
- No local test execution in this session (no repository checkout/runtime attached).
- No PostgreSQL database, user, asset, role, or session was modified.

## Follow-up

A replacement UAT fixture provisioner should be designed separately. It must:
1. Require an explicit development/test/UAT mode and exact target-database confirmation.
2. Never disable or overwrite unrelated users.
3. Create test users with primary profile Karyawan/Admin GABAH only.
4. Assign functional roles, permissions, and scopes through Dynamic RBAC tables.
5. Be idempotent, transactional, auditable, and tested against a throwaway PostgreSQL database.

**Merge policy:** Do not merge without exact-head CI success and owner approval.
