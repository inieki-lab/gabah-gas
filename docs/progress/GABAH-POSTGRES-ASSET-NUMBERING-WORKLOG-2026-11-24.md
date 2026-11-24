# GABAH PostgreSQL Atomic Asset Numbering Worklog — 2026-11-24

## Scope
Close the known multi-instance asset-number collision risk without changing the approved numbering pattern or rewriting historical asset numbers.

## Changes on this branch
- `server/persistence.ts`: PostgreSQL sequence reservation uses a transaction and `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` against `asset_number_sequences`.
- Current numbering rule is read with `FOR SHARE` in the same transaction; inactive rules reject issuance and the separator/digit format returned by PostgreSQL is used for the issued number.
- Startup reconciliation seeds durable counters from recognized existing asset numbers using `GREATEST`; a previously reserved counter is never reduced after a failed asset write.
- `server/services.ts`: `createAsset` is asynchronous and uses the PostgreSQL allocator when PostgreSQL is authoritative. It retains in-memory numbering only for file-store development.
- `server.ts`: single create and bulk-import paths await the asynchronous service.
- Regression checks and numbering documentation updated.

## Integrity behavior
- PostgreSQL failure is fail-closed for numbering; there is no fallback to a per-process counter.
- Concurrent app instances share the same database counter.
- Sequence gaps are allowed if reservation succeeds but the subsequent asset write fails. Reusing a potentially issued number is not allowed.
- Existing asset numbers and company-pending numbering format decisions remain unchanged.

## Verification status
- PR #258: https://github.com/inieki-lab/gabah-gas/pull/258
- CI run #3364 is running for the initial branch head; subsequent commits trigger a new run.
- Required before merge: all CI checks green, review of any failures, and a live concurrent issuance/restart check against PostgreSQL. This branch remains draft until those checks are complete.
