# GABAH — Contract Owner Scope Options Worklog

**Date:** 26 November 2026  
**Repository:** `inieki-lab/gabah-gas`  
**Base:** `main`  
**Branch:** `fix/contract-owner-scope-options-2026-11-26`  
**Status:** IMPLEMENTED ON BRANCH — CI pending; not merged.

## Finding

Issue #296 remained open after PR #297 because non-admin users were shown at most the owner matching `currentUser.division`. This does not support users with multiple effective division scopes and incorrectly makes a profile field the source of owner authorization.

## Changes

- Added `ContractDomainService.listCreatableOwnerDomains(actor)`.
  - Requires the existing `contracts.create` capability.
  - Superadmin receives all active owner domains.
  - PostgreSQL-backed users receive only active owner domains for which the backend confirms `contracts` division scope.
  - File-store fallback remains restricted to the actor's legacy primary division; it does not grant extra scopes.
  - Retired location aliases (SC, Supply Chain, PIBC, RPC) are excluded.
- Added authenticated `GET /api/contracts/create-options`; route checks `contracts.create` before returning the service result.
- Added `gabahApi.getContractCreateOwnerOptions()`.
- Updated Create Contract UI to use only server-authorized choices. It no longer loads all divisions or derives owner from `currentUser.division`. If exactly one option exists it is preselected; with multiple choices the user must select explicitly.
- Direct POST validation remains independently enforced by `createContract`; UI choices are not treated as authorization.
- Added source-contract regression script and registered it in CI.

## Validation

- Source inspection confirms route, service, UI and API client are connected.
- Local test execution: NOT RUN (no local repository checkout/runtime attached).
- Exact-head CI: PENDING. No PASS is claimed.
- Browser UAT: NOT RUN.

## Remaining work

1. Exact-head CI and fix all failures.
2. Add/execute live PostgreSQL cases for Superadmin, single scope, multiple scopes, no scope, and direct out-of-scope POST (403).
3. Browser UAT using distinct test personas.
4. Close issue #296 only after all acceptance cases pass.

**Merge policy:** no merge to main until exact-head CI and owner approval.


## CI correction note

- Initial CI run `45713076046` found a TypeScript reference left behind after removing the primary-division assumption (`ownDivision`); corrected by using the selected `ownerDivision` state.
- The same run also showed two older source-contract assertions still expected the global divisions endpoint and client-side legacy-code filter. Updated `scripts/contract-owner-filter-verify.mjs` to assert the server-authorized options endpoint and backend filtering instead.
- Exact-head CI after these corrections: PENDING. Do not treat earlier partial source checks as a full pass.


## Successful CI evidence

- Corrected implementation/test head `19952cb7f4dc984ad47dfd2e526d6c1cd25acd67`: CI run `45713527575` (#3621) completed SUCCESS, including TypeScript, the new contract owner-scope guard (10/10), and the updated legacy owner-filter guard (8/8).
- Live PostgreSQL multi-scope and browser persona UAT remain outstanding; CI success is not a substitute for those acceptance cases.
- This worklog-only commit creates a newer PR head; recheck its CI before considering the latest PR head fully green.
