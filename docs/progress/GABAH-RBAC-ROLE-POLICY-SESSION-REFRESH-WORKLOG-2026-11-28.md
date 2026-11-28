# GABAH RBAC Role Policy Session Refresh Worklog

**Tanggal:** 28 November 2026  
**Repository:** `inieki-lab/gabah-gas`  
**Base:** `main`  
**Branch:** `fix/rbac-role-change-session-refresh-2026-11-28`  
**Status:** IMPLEMENTED — exact-head CI pending; browser UAT pending.

## Temuan terkonfirmasi

- Dynamic RBAC role permission updates run through `PUT /api/admin/rbac/roles/:id/permissions` and refresh the server-side policy cache.
- Role scope updates run through `PUT /api/admin/rbac/roles/:id/scopes` and refresh the server-side policy cache.
- Unlike per-user role assignment, both role-level update routes did not revoke sessions for users assigned to the changed role.
- The frontend `currentUser.permission_keys` and role labels are a login-time snapshot. Therefore an already-open browser could continue showing stale Sidebar menus after Superadmin changed a role's permissions or scopes, while backend policy had already changed. This can produce visible menu items whose actions now return 403, or hide newly granted menus until the next login/reload.
- User assignment route already revokes the target user's sessions; role permission/scope changes needed equivalent invalidation for all users assigned to that role.

## Perbaikan

- Before mutating role permissions or scopes, collect the distinct user IDs assigned to that role inside the same PostgreSQL transaction.
- After the transaction commits, revoke sessions for all affected users except the acting Superadmin.
- Refresh the server RBAC policy cache after invalidation.
- Return only an affected-user count (not user IDs) to the caller.
- Administration UI now informs the Superadmin that affected employees must log in again so Sidebar/menu and effective access snapshots are refreshed.
- Add source regression test, npm script, and CI step for both permission and scope routes.

## File berubah

- `server.ts`
- `src/components/modals/AdministrationModal.tsx`
- `scripts/rbac-role-change-session-refresh-verify.mjs`
- `package.json`
- `.github/workflows/ci.yml`
- Dokumen worklog ini.

## Validation

- Source inspection of role permission route, role scope route, user role assignment route, and Admin UI save handlers: DONE.
- Regression contract added for affected-user lookup, session revocation, Superadmin exclusion, affected count response, and user-facing re-login notice.
- Local test, TypeScript/build, PostgreSQL integration, exact-head CI, and browser UAT: pending/not run.
- UAT wajib: assign test users to a custom role; open a browser session for each; change role permission and role scope; verify old sessions are invalidated and affected users must log in again; verify new Sidebar and API 200/403 behavior matches the new effective policy.

## Safety

- No role permission grants, scope rows, user-role assignments, database schema, migrations, or business data are changed by this code patch.
- Existing Superadmin actor is excluded from session revocation for these role policy changes.
- No merge to `main` without explicit owner approval.
