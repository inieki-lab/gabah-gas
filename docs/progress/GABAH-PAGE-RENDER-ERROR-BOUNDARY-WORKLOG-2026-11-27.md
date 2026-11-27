# GABAH Worklog — Page Render Error Boundary

- Date: 2026-11-27
- Branch: `fix/page-render-error-boundary-v2-2026-11-27`
- Base: PR #352 corrected branch head `ea7729e556a62b5c2cc6ea73adf28f8c0bb9cd1e`
- Latest code/test commits before this worklog: `b08b841c588cec162acd6db3c3248722aa6ea573`, `e8831906777d9c22b3d59fdc6708857c2046dc4e`, `f765ba344b3765370b248585751c484bf5d693f3`
- Status: implementation pushed; CI pending; browser UAT not run.

## Finding

Source inspection of `src/main.tsx` found that the React root renders `App` under StrictMode without an Error Boundary. A render/lifecycle exception in any page component can therefore bubble to the root and leave the entire application blank, including the navigation shell.

This is a plausible failure mode for “menu clicked, then blank screen”, but it is not yet confirmed as the user's exact runtime cause because browser console/stack traces were not available.

## Change

- Added `src/components/PageErrorBoundary.tsx`.
- Wrapped the main content pane in the boundary while keeping Header and Sidebar outside it.
- Keyed the boundary by active tab so navigating to another menu resets a prior page error.
- Added a visible fallback with an error message and full-reload action.
- Added regression assertions to `scripts/effective-permission-ui-verify.mjs`.

## Validation

- Source patch inspected after push.
- Local TypeScript/build and test execution: NOT RUN.
- Exact-head CI: PENDING.
- Browser UAT: NOT RUN; specifically verify that an induced page render error does not hide the sidebar and selecting another tab recovers.

## Safety

- No database, migration, Docker volume, or business data changed.
- Draft only; do not merge to `main` without explicit owner approval.


## Shared regression alignment

- The parent data-refresh PR exposed an obsolete source assertion in the shared `effective-permission-ui` test that expected swallowed API failures.
- Removed that obsolete assertion on this stacked branch as well, keeping the test aligned with the new `Promise.allSettled` contract.
- Latest test commit: `f919ccd98405f6a8e3c70571a36e5a088862dacb`.


## Exact-head CI result and correction

- CI run `46001490790` (run #3888) failed at TypeScript typecheck with `TS2339: Property 'props' does not exist on type 'PageErrorBoundary'`.
- Updated the component to extend the explicitly imported `Component` type and import `ErrorInfo`/`ReactNode` as types.
- Correction commit: `7b73dc7c94d9ef27f35a4350953e580b956d52ad`.
- Exact-head CI must rerun; no PASS is claimed.


## Follow-up type safety

- To avoid depending on the inferred inherited `props` member in this repository's React type setup, the boundary now stores its child content explicitly in the constructor and renders that field.
- Latest implementation commit: `05536d31f4b68e096fcc078bfe9952500b828c0a`.
- Exact-head typecheck/CI still pending.


## Shared regression assertion correction

- The parent CI run failed because the refresh contract test scanned the entire rest of `App.tsx`, not only `refreshData()`, and matched unrelated `length > 0` code.
- Scoped the test to the refresh function boundaries on this stacked branch as well.
- Correction commit: `cbbcb63a837a75686d8479f1e19422a5528aa566`.
- Exact-head CI must rerun; no PASS is claimed.


## Rebased parallel PR

The original PR #354 branch had a failed CI attempt and did not receive a fresh exact-head run after follow-up pushes. To get a clean run from the corrected parent branch, this work was replayed on a new branch based on the latest PR #352 branch head.

- New branch: `fix/page-render-error-boundary-v2-2026-11-27`
- Base: `ea7729e556a62b5c2cc6ea73adf28f8c0bb9cd1e`
- App change: `70382c4d82cbb22030b6ad9ffd1b6dcf2b1114c8`
- Test change: `10bc36c99299c13f9157369caa71dc573e2f09e7`
- Boundary component: `084d573cf59ea11af01657d151f7a50392d6b014`
- CI must run on the new PR head; no PASS claimed.


## Expected 403 handling inherited from parent refresh fix

- Global data refresh calls endpoints across modules even when a user has only a subset of module permissions. A 403 for an unassigned or globally inactive module is expected, not a server outage.
- API errors now preserve HTTP status/code/module key; expected 403 results clear that collection without showing a false outage banner. Unexpected failures remain visible.
- Added regression assertions on this stacked branch.
- Latest commits: App `0800cf5ad03a536a43df9d727c146861b850e318`, API `e3f6f81738a79d49dd2e5f7ab448c33d70845759`, test `bcd8f4ab8dcdc2c61a8736c9abac39fd1e7a6945`.
- Exact-head CI must rerun.


## Reactive children correction

- Review found that storing `children` in the constructor would freeze the first render and prevent refreshed page props/data from flowing through the boundary.
- Replaced the cached field with a declared, explicitly typed `props` member and render `this.props.children` so parent updates remain reactive.
- Added a regression asserting that the boundary does not cache initial children.
- Latest commits: boundary `e0669298544426ad19cc2d86b0ebd312be7ddd79`; test `1625180cac2eb7aed1ad27ff869fbf9fad0f3414`.
- Exact-head CI still pending; verify typecheck and re-render behavior before UAT.


## Startup demo seed removal inherited from parent refresh fix

- Vendor, knowledge-base, and maintenance collections now start empty instead of being prefilled with mock/demo arrays before the authoritative API responds.
- This prevents a first-load API failure from leaving demo records visible as if they were live PostgreSQL data.
- Regression assertions were added on this stacked branch.
- Latest App commit: `149cad244fa1a75a92f61497446c522d7c8cc5cd`; test commit: `074be6f8e3d5442c7f82451276e49956020d1cba`.
- Exact-head CI must rerun.


## JSX typecheck correction

- CI run `46002339822` (run #3902) failed at TypeScript because the custom boundary JSX type did not accept React's special `key` attribute in this project type setup.
- Replaced the special key with an explicit `resetKey` prop and `componentDidUpdate` reset logic. The boundary still keeps live children reactive and resets after the user navigates to another tab.
- Latest commits: boundary `801f7f5cd055ec3c53b31470156c2d844b2e1e1a`; App `8b517848d8410c7b4b2b0441e6473be2bfd0da6b`; test `5fffd251c3487c821f25f2fb1ddf911f999f0320`.
- Exact-head CI must rerun; no PASS is claimed.


## Regression assertion alignment

- CI run #3908 passed typecheck and production build but failed in `effective-permission-ui` because one earlier assertion still expected the old special `key` prop after the implementation moved to `resetKey`.
- Updated the assertion to match the actual `resetKey` contract.
- Correction commit: `5df4a25912ddd434bb7e3dbc96ef647319a1ea4a`.
- Exact-head CI must rerun; no PASS is claimed yet.


## Missing reset lifecycle found by CI

- CI run #3915 failed in the Error Boundary regression because the component had a `resetKey` prop but the implementation did not yet reset `hasError` when navigation changed.
- Added `componentDidUpdate` to clear the failed state when `resetKey` changes; this allows the next selected page to render without a full reload.
- Fix commit: `8465a551f97062457119bdbb09660472d2108363`.
- Exact-head CI rerun is pending.
