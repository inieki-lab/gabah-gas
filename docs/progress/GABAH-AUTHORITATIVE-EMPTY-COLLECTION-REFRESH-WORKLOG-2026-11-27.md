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


## Tambahan — error refresh ditampilkan kepada pengguna

- Menambahkan state error koleksi pada App.
- Kegagalan API sekarang ditampilkan sebagai banner peringatan yang menyebut koleksi yang gagal, mempertahankan data terakhir jika tersedia, dan menyediakan tombol **Coba muat ulang data**.
- Error state dibersihkan saat identitas direset dan setiap refresh baru dimulai.
- Regression contract diperluas untuk memastikan banner dan retry action ada.
- Ini belum membuktikan browser UAT; pastikan banner tidak menutupi halaman dan retry berhasil pada UAT.
- Latest code/test commits before this worklog update: `ce8aaa307116dd1745bf9737b71bb1a08e533f17` and `813a9a1653c9362a6932808bbbfd18d0ad125281`.


## Exact-head CI result and correction

- CI run `46001020681` (run #3884) on prior head `d1f3e70263cbd0443a038b22517c189cf9af539c` failed at the existing `test:effective-permission-ui` step.
- The failure was an outdated assertion that still required `gabahApi.getUsers().catch(() => [])`. That assertion encoded the old behavior this change intentionally removes.
- All steps before that regression passed, including TypeScript typecheck, production build, Docker image build, runtime smoke, and PostgreSQL integration; later steps were skipped after the failure.
- Removed the stale assertion. New test commit: `ca8c75b7dff36dca89fb0ffba9bfe64f11a930b5`.
- Exact-head CI must rerun on this new commit; no PASS is claimed yet.


## Second exact-head CI result and correction

- CI run `46001458576` (run #3887) passed typecheck/build/runtime checks up to the `Effective permission UI regression` step, then failed because the new source assertion searched the entire remainder of `App.tsx` for `length > 0` and accidentally matched unrelated later code.
- Narrowed the assertion's inspected source range to the `refreshData()` function only.
- Correction commit: `59773485c4ee115551707d77c6a00cf122e8202b`.
- Exact-head CI must rerun; no PASS is claimed.


## Expected 403 handling

- Audit of the global refresh pattern found that the app fetches collections for multiple modules on login, while each user is only authorized for a subset. Therefore 403 responses for unassigned modules or globally disabled modules are expected and must not be reported as application outages.
- API client now preserves HTTP status, stable error code, and module key on thrown errors.
- Collection refresh clears the inaccessible collection on 403 without adding it to the visible data-load error banner. Unexpected network/server failures still preserve last-known data and display the banner.
- Regression added for this distinction.
- Latest commits: App `47a02e4ddaae49267af0545a571c0e08b010068b`, API client `0d123bc9c263754c835c85b0278cfb123be3f7f8`, test `d10a0f646752365228733e1aa00089c18e823119`.
- Exact-head CI must rerun.


## Remove startup demo seeds from authoritative collections

- Further review found that preserving last-known data after a failed API call could still preserve initial demo seed arrays on the very first login.
- Removed startup seed values for operational vendor, knowledge-base, and maintenance collections; these now start empty and are populated only by successful API responses.
- Failed requests retain actual last-known state only when one exists; first-load failures leave the collection empty and display the data-load warning.
- Added regression assertions that these three collections do not initialize from mock/demo data.
- Latest App commit: `758228d44256d88c8889f5ed1e8e30b4a33d916b`; test commit: `10bcd96411c85e68f43b601cf31364ff6b90364a`.
- Exact-head CI must rerun.


## Final exact-head CI result (current head at this check)

- Exact PR head: `9561f12495c0b1bf765bd1a820eb5647743554fc`.
- CI run #3907 (`46002821162`) completed **SUCCESS** on that exact head.
- The immediately preceding run #3906 also passed on the test commit; run #3907 is the authoritative latest-head result.
- Typecheck, production build, Docker runtime smoke, PostgreSQL integration, and all remaining workflow steps completed successfully for this exact head.
- Browser UAT remains NOT RUN. CI success is not proof that the user-reported menus work in the local browser.
