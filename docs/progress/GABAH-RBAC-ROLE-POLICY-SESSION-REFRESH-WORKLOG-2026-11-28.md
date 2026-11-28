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


## Exact-head CI result

- CI #4001 (run ID 46129237879) completed SUCCESS, 121/121 workflow steps, on exact PR head 163d26f3630bbed164f4a17380c4458bbf74590d.
- This includes the new RBAC role permission/scope session invalidation regression, TypeScript/build, PostgreSQL integration, and Docker/runtime checks.
- Browser UAT remains pending.


## Safety refinement — no-op save does not log users out

- Review identified that a Superadmin may open a role and save the same permission/scope set without making a change.
- Session invalidation is now conditional on the effective permission or scope set actually changing.
- No-op saves do not rewrite the role mapping and do not revoke any session.
- Regression assertions cover both changed and unchanged permission/scope paths.


## CI feedback — explicit Set typing

- CI #4013 (run ID 46130099862) caught TypeScript errors in the no-op comparison refinement: query result Set elements were inferred as unknown.
- Added explicit `Set<string>` typing for current/next permission and scope key sets in commit a788453e1baababec83e8acad0097b6374541354.
- Exact-head CI rerun is pending.


## Client handling for revoked sessions

- Review found that `refreshData()` treated every collection error as an empty array. A revoked user's 401 could therefore be swallowed while the browser kept the old `currentUser.permission_keys` snapshot and stale menu.
- API errors now retain HTTP status/code.
- Data refresh propagates 401 instead of converting it to an empty collection.
- App session-expiry handler clears role-scoped data, clears the current user, and returns to the login screen with an explanatory message.
- Module-status refresh uses the same 401 handler, so a revoked session cannot remain in the portal with stale navigation.
- Regression assertions cover both normal data refresh and module-status refresh 401 paths.


- Final review also ensures the revoked-session handler clears the global loading indicator; otherwise a 401 during bulk refresh could return the app to login while leaving the spinner state active.
- Regression assertion added for loading-state cleanup.
