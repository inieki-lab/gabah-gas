# GABAH Worklog — RBAC Assignment Reauthentication Notice

- Date: 2026-11-27
- Branch: `fix/admin-rbac-assignment-reauth-message`
- Base: `fix/admin-category-owner-options`
- Parent stack: PR #339 → #346 → #347 → #348 → #349 → #350 → this change
- Status: implementation and regression committed; CI/browser UAT pending.

## Finding
The per-user RBAC assignment endpoint deliberately revokes all existing sessions for the target account after a successful role-set change, then refreshes effective policy. This is a security safeguard so an old session cannot continue using stale privileges. The Administration UI only showed “Assignment role pegawai berhasil disimpan”, so the administrator was not told that the target employee must authenticate again. This can look like an assignment did not reach the employee.

## Change
- Clarify the success message: the target session was revoked and the employee must log in again for the new access to become active.
- Add a regression tying the UI message to the server-side session-revocation behavior.
- No RBAC semantics or session-revocation behavior changed.

## Validation
- Source check confirms UI call and server revocation path.
- Regression execution, TypeScript/build, exact-head CI, and browser UAT pending.
- UAT: assign a role to a test account, confirm session revocation, then sign in again and verify the new permission/menu.
- No database or production data changed.

## Next
Run exact-head CI and role-assignment persona UAT. Keep Draft until parent stack and release gates are complete.
