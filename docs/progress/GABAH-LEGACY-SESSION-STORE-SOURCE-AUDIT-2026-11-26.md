# GABAH — Legacy Session Store Source Audit Worklog

**Date:** 26 November 2026  
**Repository:** `inieki-lab/gabah-gas`  
**Base:** `main` @ `ec4e648281363e63effcf6d2642ebc9c457b2333`  
**Branch:** `test/legacy-session-runtime-guard-2026-11-26`  
**PR:** [#329](https://github.com/inieki-lab/gabah-gas/pull/329)  
**PR head at creation:** `3977d85e054b67e7dae9eb2317b6c32d87bf6bb0`  
**Status:** SOURCE CONTRACT GUARD ADDED — exact-head CI pending; issue #293 remains open.

## Scope

This parallel lane covers only the code-level part of issue #293: prove that the active runtime does not depend on the legacy PostgreSQL `user_sessions` table. It does not inspect production data, enumerate live token values, revoke legacy rows, or drop the table.

## Source findings

- `server/auth.ts` creates, resolves, and destroys sessions through the in-memory `db.sessions` registry.
- `server/persistence.ts` serializes `sessions: []`, discards persisted session state during hydration, and contains no executable SQL read/write against `user_sessions`.
- Migration 002 remains the historical creator of the table. The table may still exist in databases upgraded from older releases.
- Current runtime non-use does not prove that old rows are absent or that no supported rollback/deployment still depends on the schema.

## Changes

- Added `scripts/legacy-session-store-verify.mjs` to guard in-memory session creation/lookup/logout, empty persistence payload, hydrate reset, and absence of SQL access from runtime entrypoints.
- Registered `npm run test:legacy-session-store` in `package.json` and the GitHub Actions CI workflow.
- Corrected ADR-006 in `docs/architecture/DECISIONS.md` so it no longer claims active sessions are stored in `user_sessions`; documented cookie/Bearer transport, memory-only registry, epoch/authVersion revocation, and Dynamic RBAC.

## Validation

- **Local execution:** NOT RUN in this session (no repository checkout/runtime attached).
- **CI:** PENDING on this branch.
- **Live database inventory:** NOT RUN; requires a protected backup/restore rehearsal database.
- **Production token inspection:** NOT PERFORMED and must not be performed for this task.

## Remaining acceptance criteria (issue #293)

1. Inventory table existence, row count, token age, and references on a protected backup/restore rehearsal database without exposing token values.
2. Run fresh-install and upgrade migration tests; verify login/logout, cookie auth, Bearer API client, restart re-authentication, and revocation.
3. Prepare owner-approved revoke/expire procedure and rollback plan.
4. Drop the legacy table only after backup, restore verification, rollback/deployment dependency review, and explicit owner approval.

**Do not close issue #293 based on this source-only PR.**
