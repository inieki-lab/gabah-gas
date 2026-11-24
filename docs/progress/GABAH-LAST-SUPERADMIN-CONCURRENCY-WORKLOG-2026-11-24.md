# GABAH Last-Active-Superadmin Concurrency Guard — 2026-11-24

## Finding
Issue #247 identified a cross-instance race in the invariant that at least one active Superadmin must remain. Role assignment already used a transaction, but its last-admin count was not serialized against concurrent PATCH/deactivation and DELETE paths. PATCH and DELETE also used a process-local RBAC cache for the count, which is not authoritative across replicas.

## Implementation in this branch
- Added `withLastSuperadminGuard()` in `server/persistence.ts`. It holds one stable PostgreSQL session-level advisory lock for the complete account mutation workflow, including helper writes that use other pool connections.
- Applied the same guard to:
  1. `PUT /api/admin/rbac/users/:id/roles`
  2. `PATCH /api/users/:id`
  3. `DELETE /api/users/:id`
- PATCH and DELETE now read the target's active Superadmin status and the active Superadmin count from PostgreSQL while holding the guard. The file-store development path retains the existing in-memory check.
- Each route rechecks that the acting user is still an active Superadmin after acquiring the lock, preventing a stale per-process session/policy cache from authorizing a queued mutation.
- The guard rejects a latched PostgreSQL persistence failure with HTTP 503; it does not proceed on a degraded database state.
- If the PostgreSQL lock cannot be acquired, the mutation fails closed with HTTP 503.
- Added a real PostgreSQL two-connection regression to `scripts/cr04-cr05-verify.mjs`: two independent demotions contend for the same advisory lock; the second must wait, observe one remaining Superadmin, and be denied. The test restores original role assignments in its isolated throwaway database.
- Added regression assertions that all three account mutation routes use the shared guard and that PATCH/DELETE use database-backed counts.

## Verification status
- PR: pending creation / CI.
- PostgreSQL integration requires the existing CI CR-04/CR-05 fresh-database job.
- This branch does not change user data, seed accounts, or role assignments outside the isolated test database.
- No merge until full CI passes and the concurrency test is green.

## Related issue
- #247 — Serialize last-active-Superadmin protection across concurrent account changes.
