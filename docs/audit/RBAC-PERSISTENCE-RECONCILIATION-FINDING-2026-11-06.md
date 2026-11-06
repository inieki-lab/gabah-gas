# GABAH RBAC — Persistence Reconciliation Finding

Date: 2026-11-06
Branch reviewed: `fix/phase-1-user-role-audit`
Scope: Dynamic user-role assignment persistence

## Finding

**High priority — recurring legacy-role reconciliation can remove valid dynamic role assignments.**

Repository evidence:

1. `persistPostgresState()` invokes `backfillDynamicRbacUserRoles()` on every PostgreSQL persistence cycle, not only during first-time migration/bootstrap.
2. `backfillDynamicRbacUserRoles()` deletes assignments to canonical roles when the assigned role key differs from the user's single legacy `users.role` value.
3. The Superadmin-protected `PUT /api/admin/rbac/users/:id/roles` endpoint accepts an array of role IDs and replaces the user's complete dynamic assignment set transactionally.
4. `refreshRbacPolicy()` loads every active assigned role and unions permissions across the user's role policies.

Consequently, assigning multiple canonical roles to one user is not durable: the next successful persistence cycle can delete canonical assignments that do not match the one legacy role string. This can silently change effective authorization after an unrelated successful API write.

## Why this matters

- The assignment endpoint and policy loader support multiple roles.
- The recurring compatibility bridge treats one legacy role as authoritative and can undo part of a multi-role assignment.
- A normal state-changing request may trigger the deletion; the user need not edit roles again.
- Current static verification checks that stale canonical assignments are deleted, but does not test preservation of an intentionally multi-role assignment across a persistence cycle.

## Required decision before code change

The project must explicitly choose one of these contracts:

A. **Single-role model:** enforce exactly one dynamic role per user in the API, UI, database tests, and documentation. Keep legacy `users.role` as the explicit source of truth during transition.

B. **Multi-role model:** make `gabah_user_roles` authoritative for assignments. Convert legacy role synchronization into a one-time, idempotent bootstrap/backfill (or a controlled migration with explicit audit), and stop deleting dynamic assignments during ordinary persistence. Define how legacy user create/edit/import flows interact with dynamic assignments.

Do not silently choose A or B in code. The existing endpoint's array contract and policy loader currently suggest multi-role support, while the recurring bridge enforces single legacy-role reconciliation.

## Required regression tests

- Assign two canonical roles to one user, trigger an unrelated successful state-changing request, and verify both assignments remain.
- Assign one canonical plus one custom role; verify both remain after persistence.
- Change a legacy `users.role` through the existing user-management flow and verify the documented reconciliation behavior.
- Verify revoked assignments remain revoked and are not recreated unexpectedly.
- Verify effective permissions and scopes after restart, not only in the in-memory cache.

## Status

- Code-level finding confirmed by repository inspection.
- No live database mutation performed.
- No production role assignment changed.
- No fix applied pending an explicit single-role vs multi-role contract.
