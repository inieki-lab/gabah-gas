# GABAH Worklog — Authoritative Empty Collection Refresh

- Date: 2026-11-27
- Branch: `fix/authoritative-empty-list-refresh-2026-11-27`
- Base: `fix/login-module-status-init-race` at `91418ab330321f9ee459deb4a3b188e57ab6c1e3`
- Latest code/test commit: `2f61269b50c171048a3841ca2ad51262c108c2f1`
- Status: implementation pushed; CI pending; browser UAT not run.

## Problem found

Source inspection found that `refreshData()` converted every failed API request into `[]` using `.catch(() => [])`. The UI therefore could not distinguish a legitimate empty collection from an API/network/authorization failure.

The same function also retained seeded data when the server legitimately returned an empty list for maintenance, vendors, and knowledge articles. In the Docker/PostgreSQL runtime, this could leave stale/demo rows visible after the authoritative server returned no rows.

## Change

- Replaced `Promise.all` plus per-request empty fallbacks with `Promise.allSettled`.
- Added a typed collection application helper:
  - fulfilled array (including `[]`) replaces the current collection;
  - rejected or malformed result preserves last-known data and logs the collection-specific failure.
- Retained the existing generation guard so responses from a previous identity are not applied after role switch/logout.
- Extended `scripts/effective-permission-ui-verify.mjs` with source-contract regressions for successful empty arrays, rejected API calls, and the maintenance/vendor/knowledge collections.

## Files changed

- `src/App.tsx`
- `scripts/effective-permission-ui-verify.mjs`
- `docs/progress/GABAH-AUTHORITATIVE-EMPTY-COLLECTION-REFRESH-WORKLOG-2026-11-27.md`

## Validation and limits

- Source patch inspected after push.
- Local TypeScript/build: NOT RUN (no local repository runtime in this session).
- Automated regression: NOT RUN in this session; CI must execute it on the exact PR head.
- Browser UAT: NOT RUN.
- No database, migration, Docker volume, or user data changed.

## Next

1. Check exact-head CI.
2. If CI passes, keep PR Draft until the user can UAT the affected pages.
3. Continue the independent menu-to-view and role-to-permission audit; do not wait for this CI to finish.
