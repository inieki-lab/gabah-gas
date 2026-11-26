# GABAH — Asset, Dashboard, and Contract Owner-Scope Audit

**Date:** 26 November 2026  
**Repository:** `inieki-lab/gabah-gas`  
**Base dependency:** PR #328 (`fix/retire-legacy-owner-domains-2026-11-26`)  
**Branch:** `fix/asset-dashboard-owner-scope-audit-2026-11-26`  
**Status:** SOURCE AUDIT + REGRESSION GUARD COMPLETE — exact-head CI passed; runtime UAT remains pending.

## Purpose

Continue issue #123 after the owner-domain retirement work. The goal is to make asset lists, dashboards, and contracts consistently honor effective permission plus explicit owner scope, while preserving historical SC/PIBC records for authorized reads.

## Source evidence reviewed

All source files below were read from the dependency branch at the time of this audit:

- `server.ts`
- `server/contracts.ts`
- `server/taxonomy.ts`
- `src/components/views/AssetsView.tsx`
- `src/components/views/ContractsView.tsx`
- `src/components/views/DashboardView.tsx`

### Existing enforcement observed

1. **Asset catalogue API** — `GET /api/assets` requires `assets.read` and returns `GabahDomainService.getScopedAssets(actor)`. The client AssetsView derives owner filter choices only from the returned asset collection; it does not infer ownership from asset-number prefixes or physical location.
2. **Asset creation choices** — `GET /api/assets/create-options` requires `assets.create`, checks active owner master entries and `canMutateAssetOwner`, and excludes SC/PIBC. Categories must be active and have an eligible effective owner.
3. **Dashboard statistics** — `GET /api/dashboard/stats` uses scoped assets and separately scopes loans/tickets by module-specific owner scope (or self/assignment relationships).
4. **Dashboard attention** — `GET /api/dashboard/attention` scopes asset visibility before applying the attention-item filter; global visibility is limited to Superadmin/Auditor.
5. **Contract list/detail** — `ContractDomainService.listContracts/getContract` both call `canSeeContract`. PostgreSQL mode requires `contracts.read` and an explicit division scope; PIC visibility is retained. File-store fallback uses the user's primary division.
6. **Contract UI** — ContractsView derives its owner filter from contracts already returned by the API, preserving historical owner labels without granting access.
7. **Historical owner boundary** — PR #328 migration/hydration keeps SC/PIBC references but marks them inactive and blocks new owner assignment. No automatic rewrite of historical assets/contracts is intended.

## Risks and gaps still requiring verification

- Source inspection is not a substitute for executable regression tests. The matrix below must be exercised against PostgreSQL and API responses.
- Verify list, detail-by-ID, dashboard aggregates, attention feed, search/filter, and export cannot expose out-of-scope records.
- Verify a user with multiple explicit owner scopes sees the union of those scopes, not only `currentUser.division`.
- Verify a user with no owner scope sees only their permitted self/PIC/assignment records.
- Verify historical SC/PIBC records remain readable only where the actor has legitimate read access; their legacy values must not grant new scope.
- Verify read-only actors cannot mutate records through direct API calls even if UI controls are hidden.
- Review CSV/export and any alternate asset endpoints for parity; not yet claimed complete.
- File-store fallback has narrower primary-division semantics than PostgreSQL multi-scope RBAC; confirm this limitation is documented and covered, or remove fallback from supported UAT paths.

## Required regression/UAT matrix

| Persona | Asset list/detail | Dashboard | Contract list/detail | Direct ID / mutation |
|---|---|---|---|---|
| Superadmin | All active + historical | Global | All | Authorized mutations succeed |
| IT, IT owner scope | IT only (plus explicit extra scopes) | Scoped | Matching contract scope | Out-of-scope writes return 403 |
| GA read-only for IT assets | IT PC/laptop view only, no mutation | Only permitted summaries | Only permitted contract scope | IT asset writes return 403 |
| Multi-owner custom role | Union of explicit scopes | Same union | Same union | Out-of-scope writes return 403 |
| No owner scope / staff | Self/assigned only where policy allows | Self-service | PIC-only where policy allows | Unrelated direct IDs return 403/404 |
| Auditor | Global read-only per auditor policy | Global read-only | Global read-only | All writes return 403 |
| Legacy SC/PIBC records | Historical read only under legitimate scope | No legacy owner reactivation | Historical read only under legitimate scope | New SC/PIBC owner writes rejected |

## Data-safety boundary

- Dummy/example records may be replaced in development/UAT because GABAH has not entered operational use.
- This work does not delete or rewrite schema, foreign keys, master structure, historical ownership, or audit evidence.
- No production database was accessed or modified.
- No session/token rows are inspected, exported, or deleted by this workstream.
- Any demo-data reset must be explicitly restricted to development/UAT and must never be an implicit production migration.

## Follow-up implementation on this branch

- Added `scripts/asset-dashboard-contract-scope-verify.mjs` with source regression assertions for asset list/detail/mutation, PostgreSQL dynamic asset scopes, GA workstation read-only exception, dashboard stats/attention, contract list/detail, PIC visibility, and non-destructive legacy-owner migration.
- Registered `test:asset-dashboard-contract-scope` in `package.json` and `.github/workflows/ci.yml`.
- This is a source-level regression guard; it does not replace runtime authorization tests or live PostgreSQL/browser UAT.


### Additional custody-integrity finding (26 November 2026)

- Endpoint inventory confirms asset bulk import, direct-ID read, assign, move, and lifecycle routes; no separate asset export route was found in the current server route table.
- The service-level assign/move/lifecycle guards originally blocked only `approved` and `borrowed` loans. The shared dashboard/loan status model also treats `active` and `overdue` as custody states. An overdue asset could therefore have been reassigned, relocated, or lifecycle-mutated through these generic asset services despite remaining in custody.
- Updated all three service guards to block `active`, `approved`, `borrowed`, and `overdue`; added a regression assertion for each method. This is an integrity fix in addition to the original scope audit.
- Added a source regression assertion for all three service methods. The assertion was reviewed and corrected to inspect each method body and exact four-state allowlist. Exact-head CI for this follow-up is pending. PostgreSQL/browser persona UAT remains required; no production data accessed.

## Checks and evidence

- Source review: completed for the seven files listed above.
- New regression guard: registered; all 13 assertions passed in preflight and exact-head CI run **45715553138** completed **SUCCESS** on commit `d83a2e9b9badd403d464df0bd33288691889fe68`.
- The exact-head CI pipeline also passed typecheck, production build, Docker image/runtime smoke, PostgreSQL 17 fresh-database/persistence integration, live HTTP security checks, asset/dashboard/contract scope parity, and existing loan/ticket/module regression jobs.
- Local repository test execution: NOT RUN in this session (no repository checkout/runtime attached).
- PostgreSQL fresh-install/legacy-upgrade tests: pending.
- Browser UAT: NOT RUN.
- Production acceptance: NOT CLAIMED.

## Next steps

1. Continue endpoint inventory for asset search/filter/export and direct-ID paths; current route inventory did not identify a separate asset export endpoint.
2. Add or extend runtime tests for any discovered alternate read paths and verify scope parity.
3. Execute the persona matrix in browser UAT: Superadmin, IT, GA workstation read-only, multi-owner custom role, staff/no-scope, Auditor, and historical SC/PIBC.
4. Keep dependent PR #328 and this follow-up unmerged until browser UAT and owner review pass.

**Merge policy:** No merge to `main` without explicit owner approval.
