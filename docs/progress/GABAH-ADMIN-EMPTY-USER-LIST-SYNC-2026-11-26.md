# GABAH — Administration Empty User-List Synchronization

**Date:** 26 November 2026  
**Branch:** `fix/admin-empty-user-list-sync-2026-11-26`  
**Base:** `fix/asset-dashboard-owner-scope-audit-2026-11-26`  
**Status:** Implementation and CI regression added; exact-head CI pending.

## Finding

`AdministrationModal` synchronized its local user list only when `users.length > 0`. If the authoritative API result legitimately became an empty array (for example after deleting the final account in a test environment, or when an authorized scope returns no users), the modal retained its previous local list. This could leave stale/demo accounts visible after the server had returned no users.

## Change

- The user list now mirrors the authoritative `users` prop for both populated and empty arrays, and safely falls back to an empty list for a non-array value.
- Added `test:admin-empty-user-sync` with regression checks for empty-array synchronization, dependency tracking, and hook declarations remaining before the closed-modal early return.
- Registered the regression in GitHub Actions CI.

## Checks and limits

- Source review confirms all 107 detected hook calls in `AdministrationModal` are declared before `if (!isOpen) return null;`; this change does not move hooks or add conditional hook calls.
- The new regression is source-level; exact-head CI is pending.
- No local browser test, PostgreSQL test, or production data change was performed.
- This work does not delete user records. It corrects stale UI state when the server's authoritative result is empty.


## CI compatibility note

- The first exact-head CI run (`45756205575`) reached the asset lifecycle regression and failed because the stacked base still contained an older assertion expecting only `approved` and `borrowed`. The asset custody implementation and the 14 new asset/dashboard/contract checks passed.
- Updated the inherited assertion on this branch to expect the four custody states (`active`, `approved`, `borrowed`, `overdue`) in the normalized status comparison. Rerun pending.

## Next steps

1. Verify exact-head CI and fix any regression exposed by the pipeline.
2. Browser UAT: load a non-empty user list, then return an empty list and confirm the table shows its empty state without stale accounts.
3. Verify normal create/edit/disable flows still refresh the table.

**Merge policy:** No merge to `main` without exact-head CI, browser UAT, and explicit owner approval.
