# GABAH Dynamic RBAC Cross-Instance Worklog — 2026-11-24

## Scope
Ensure role, permission, and scope changes made on one GABAH application process converge on every other process without restarting the peer node.

## Implementation
- `server/rbac-policy.ts` serializes overlapping refreshes, stages a complete policy map, atomically publishes healthy snapshots, and clears stale grants on query failure.
- Each PostgreSQL-backed process starts a 5-second bounded refresh timer after persistence initialization and its first successful policy load.
- Local RBAC mutation routes continue refreshing immediately.
- Timer is unreferenced and logs refresh errors; a failed refresh leaves the node default-deny until a later successful refresh.

## Live integration test
- The PostgreSQL CR-04/CR-05 integration now boots a second GABAH process against the same isolated database.
- Karyawan initially receives GA-scoped `contracts.read` on the peer.
- The primary process revokes the GA role; the peer must switch to HTTP 403 within the bounded polling window.
- The primary process restores the role; the peer must return to HTTP 200 without restart.
- Static regression checks cover serialized refresh, atomic replacement, and fail-closed behavior after refresh errors.

## Verification
- PR #259: https://github.com/inieki-lab/gabah-gas/pull/259
- CI is pending for the branch head.
- Production failure/recovery behavior still requires controlled runtime fault-injection before a production-ready claim.
