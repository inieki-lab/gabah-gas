# GABAH RBAC — Persistence & Navigation Findings

Date: 2026-11-06
Branch reviewed: `fix/phase-1-user-role-audit`
Scope: Dynamic user-role assignment persistence and role-specific navigation

## Finding 1 — High priority: recurring legacy-role reconciliation can remove valid dynamic role assignments

Repository evidence:

1. `persistPostgresState()` invokes `backfillDynamicRbacUserRoles()` on every PostgreSQL persistence cycle, not only during first-time migration/bootstrap.
2. `backfillDynamicRbacUserRoles()` deletes assignments to canonical roles when the assigned role key differs from the user's single legacy `users.role` value.
3. The Superadmin-protected `PUT /api/admin/rbac/users/:id/roles` endpoint accepts an array of role IDs and replaces the user's complete dynamic assignment set transactionally.
4. `refreshRbacPolicy()` loads every active assigned role and unions permissions across the user's role policies.

Consequently, assigning multiple canonical roles to one user is not durable: the next successful persistence cycle can delete canonical assignments that do not match the one legacy role string. This can silently change effective authorization after an unrelated successful API write.

### Why this matters

- The assignment endpoint and policy loader support multiple roles.
- The recurring compatibility bridge treats one legacy role as authoritative and can undo part of a multi-role assignment.
- A normal state-changing request may trigger the deletion; the user need not edit roles again.
- Current static verification checks that stale canonical assignments are deleted, but does not test preservation of an intentionally multi-role assignment across a persistence cycle.

### Required decision before code change

The project must explicitly choose one of these contracts:

A. **Single-role model:** enforce exactly one dynamic role per user in the API, UI, database tests, and documentation. Keep legacy `users.role` as the explicit source of truth during transition.

B. **Multi-role model:** make `gabah_user_roles` authoritative for assignments. Convert legacy role synchronization into a one-time, idempotent bootstrap/backfill (or a controlled migration with explicit audit), and stop deleting dynamic assignments during ordinary persistence. Define how legacy user create/edit/import flows interact with dynamic assignments.

Do not silently choose A or B in code. The existing endpoint's array contract and policy loader currently suggest multi-role support, while the recurring bridge enforces single legacy-role reconciliation.

### Required regression tests

- Assign two canonical roles to one user, trigger an unrelated successful state-changing request, and verify both assignments remain.
- Assign one canonical plus one custom role; verify both remain after persistence.
- Change a legacy `users.role` through the existing user-management flow and verify the documented reconciliation behavior.
- Verify revoked assignments remain revoked and are not recreated unexpectedly.
- Verify effective permissions and scopes after restart, not only in the in-memory cache.

## Finding 2 — High priority: role switch does not reset or authorize the active tab

Repository evidence:

1. `handleSelectUser()` and `handleSwitchRoleSimulation()` replace `currentUser` after the server accepts the switch, but do not reset `currentTab`.
2. The Humas-specific effect redirects only when Humas is on `my_assets` or `assets`; there is no general active-tab authorization guard for all roles.
3. The main content pane renders views directly from `currentTab`, independently of the Sidebar's role-filtered menu list.
4. Sidebar visibility therefore does not guarantee the currently rendered page is permitted after an account/role switch.

A user switching from a role that can open a page (for example Reports) to a role whose Sidebar hides that page may retain the previous `currentTab`; the main pane can continue rendering that view. This is a frontend route-state authorization gap. Backend endpoint checks remain essential and must be audited separately.

### Required correction

- On every confirmed identity/role change, reset navigation to a safe role landing tab (normally `dashboard`).
- Add one central tab-access policy and enforce it before rendering each view, not only by filtering Sidebar links.
- If the active tab is not allowed, redirect to the role's approved landing tab.
- Test switching between every pair of representative roles while positioned on a restricted tab.
- Do not treat this frontend guard as a replacement for server-side authorization.

## Status

- Both findings confirmed by repository code inspection.
- No live database mutation performed.
- No production role assignment changed.
- No runtime/browser test performed in this review.
- No code fix applied pending a confirmed role cardinality/source-of-truth contract and focused implementation tests.
