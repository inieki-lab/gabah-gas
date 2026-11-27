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
