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
