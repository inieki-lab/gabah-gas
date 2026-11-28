# GABAH Worklog — Menu-to-View Contract Audit

- Date: 2026-11-27
- Branch: `test/menu-to-view-contract-2026-11-27`
- Base: `main` at `4f10d7a3aada9f41cd9e6cd2abe980b52054839e`
- Latest test commit: `80c381be7649072998fa2c1e5dd7b741ea71f58e`
- Status: regression contract added; CI pending; browser UAT not run.

## Scope

The current complaint is that several visible menus do not work. This task adds a minimum structural contract so the 12 declared sidebar navigation items cannot silently drift away from the App page-render branches.

## Changes

- Extended `scripts/navigation-policy-verify.ts` to assert:
  - all 12 expected navigation items exist in Sidebar configuration;
  - all 12 have a corresponding `activeTab === '<tab>'` page-render branch in `src/App.tsx`;
  - Sidebar item clicks call the navigation callback;
  - App navigation checks effective permission and active module status before changing tabs.
- No runtime application code or data was changed.

## Validation

- Source patch inspected after push.
- Local execution of `npm run test:navigation-policy`: NOT RUN.
- TypeScript/build: NOT RUN.
- Exact-head CI: PENDING.
- Browser UAT: NOT RUN.

## Findings and limits

The baseline source has 12 declared tabs and corresponding App render branches. This proves only structural wiring, not that the page component itself loads data, that buttons work, or that runtime permission/module state is correct. Those remain separate audit items.

## Next

Use the test result as a guardrail, then inspect each view's data dependencies and action handlers. Do not merge to `main` without explicit approval.


## Backend read-permission alignment

- Extended the same CI regression to check backend read endpoint existence and required RBAC permission for dashboard, assets, loans, tickets, meeting rooms/reservations, maintenance, contracts, vendors, knowledge, and audit logs.
- Added assertions that the frontend menu read grants expose the same corresponding endpoint permissions; reports remain partial-data capable and require reports.read plus at least one source data permission.
- This is still source-contract verification, not runtime API testing under real test accounts.
- Latest test commit: `5736d64a8e46ab7bff63ba815b80c5490cceaee8`.
- Exact-head CI pending.


## Required page callback wiring regression

- Extended the menu-to-view contract to read each of the 12 page component prop interfaces.
- Every non-optional callback declared by a page must now be passed by `App.tsx`; optional callbacks may use their documented fallback.
- This catches a menu that opens a page but leaves a required action handler disconnected.
- Latest test commit: `3f4622f5aee51d69ff6b465f4932ae8ea0bdcd13`.
- Exact-head CI pending.


## Exact-head CI result

- Exact code head: `4fa96561a6736d85b1d7dcc4ff7ce65b0d20e128`.
- GitHub Actions #3930 (run ID `46005322324`) completed **SUCCESS**.
- CI result covers the workflow's TypeScript, test, integration, production build, and Docker smoke steps for this exact code head.
- Browser UAT remains NOT RUN; CI success does not prove the local browser menu flow works for every role.
