# GABAH Worklog — New Employee Legacy Division Default

- Date: 2026-11-27
- Branch: `fix/admin-new-user-legacy-division-default`
- Base: `fix/admin-empty-user-list-sync-2026-11-26`
- Parent PR: #339 (Administration user-list synchronization)
- Status: implementation and regression committed; CI/browser UAT pending.

## Finding
The Administration new-user form initialized `division` to `SC`, even though SC/Supply Chain is a retired owner-domain label and RPC/PIBC are locations, not divisions or roles. The form's reset path already used an empty division, so only the first creation on a fresh modal silently preselected the legacy value.

## Change
- Changed the initial new-user division to an empty selection.
- Added a focused regression for initial form state and post-create reset state.
- Registered the regression in the npm scripts and CI workflow.
- No server schema, historical user record, role assignment, or production data was changed.

## Validation
- Static source review confirms the form exposes an explicit “Pilih divisi” option.
- Regression is registered; execution and exact-head CI are pending.
- Browser UAT pending: open Administration → Pengguna → Tambah Pengguna; verify Divisi initially shows “Pilih divisi”, then create a test user with the correct organizational value.
- No database or Docker volume accessed.

## Next
Run exact-head CI and test the new-user form against the active organization master. Do not merge to `main` without owner approval.
