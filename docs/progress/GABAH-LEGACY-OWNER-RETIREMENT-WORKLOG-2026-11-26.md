# GABAH — Legacy Owner Domain Retirement Worklog

**Date:** 26 November 2026  
**Repository:** `inieki-lab/gabah-gas`  
**Base:** `main` @ `ec4e648281363e63effcf6d2642ebc9c457b2333`  
**Branch:** `fix/retire-legacy-owner-domains-2026-11-26`  
**Implementation/code+test head before PR:** `1b7ba5316c2ece22c4bf69d7c05ac19df27c55c1`  
**Draft PR:** [#328](https://github.com/inieki-lab/gabah-gas/pull/328)  
**PR head at creation:** `3c45a4661cd7ac2a0461cf5d72f81beffb1698f8`  
**Status:** IMPLEMENTED ON BRANCH — exact-head CI pending; not merged. PR metadata is the authority for the latest branch HEAD after this worklog synchronization.

## 1. Finding

Issue #291 documented that the legacy owner-master rows `SC` and `PIBC` could remain active because seed entries omitted `is_active: false`, and older persisted snapshots could overwrite the seed. The contract creation domain also accepted any active owner row plus a matching scope. This conflicted with the approved organization model: RPC/SC and PIBC are locations/operational units, not active asset/contract owner domains.

## 2. Changes on this branch

- `server/db.ts`: seed SC and PIBC master rows as inactive without deleting them.
- `server/persistence.ts`: force SC/PIBC inactive after loading older snapshots; also mark categories whose owner is SC/PIBC inactive. Historical asset/category values remain readable.
- `server/migrations/106_retire_legacy_owner_domains.sql`: idempotently deactivate existing SC/PIBC division rows and their owner-linked asset-category rows. No asset, contract, user, unit, ticket, vendor, maintenance, loan, or history rows are deleted or rewritten.
- `server/contracts.ts`: reject new contract creation with owner SC/PIBC using HTTP 409, even if a stale master/scope remains.
- `scripts/asset-scope-policy-verify.mjs`: add source-contract checks for seed, snapshot normalization, migration safety, and contract guard.
- `scripts/cr04-cr05-verify.mjs`: add live PostgreSQL/API checks that legacy master rows and categories remain present but inactive, and direct contract creation with SC is rejected.
- `docs/product/BUSINESS-RULES.md`, `docs/architecture/DATABASE-DESIGN.md`, `docs/testing/UAT.md`: record the approved boundary, migration, and UAT gate.

## 3. Tests and evidence

The CI workflow already registers both:
- `npm run test:asset-scope-policy`
- `node scripts/cr04-cr05-verify.mjs` (PostgreSQL 17 fresh-database/persistence integration)

**Local execution:** NOT RUN in this session (no repository checkout/runtime attached).  
**Initial CI run:** workflow `45710772212` failed at `test:asset-scope-policy` with 107/108 checks passing. The only failure was an overly strict test regex that expected `UPPER(owner.code)` while migration 106 correctly uses `UPPER(BTRIM(owner.code))`; the assertion was corrected in commit `aeddeab293103a5ca1d58673d7494f27a78422be`. All earlier steps, including TypeScript lint, passed.  
**Second CI run:** workflow `45711177123` again stopped at `test:asset-scope-policy` (107/108). The remaining assertion expected `UPPER(code)` while migration 106 uses `UPPER(BTRIM(code))`; corrected in commit `2e6d4e821805e6c68fd12d7a04ce62a53dea55bb`.  
**Exact-head CI:** rerun pending on the latest corrected PR head; no PASS is claimed yet.  
**Browser UAT:** NOT RUN. Scenario 2E was added to `docs/testing/UAT.md`.

## 4. Data-safety boundary

- No production database was accessed or modified.
- Existing owner references, numbers, asset records, contracts, assignments, locations, unit records, tickets, and audit history are preserved.
- SC/PIBC remain as inactive master rows for foreign-key and historical compatibility.
- No mass owner reclassification is included.
- Migration 106 must be tested on fresh PostgreSQL and a protected copy of a representative legacy database before release.

## 5. Remaining work / parallel follow-ups

1. Review exact-head CI and fix every failure before considering this PR complete.
2. Issue #296 remains separate: contract owner choices for users with multiple effective owner scopes need a server-authorized create-options endpoint; do not substitute `currentUser.division` for RBAC scope.
3. Issue #293 remains separate: inventory legacy `user_sessions` table metadata/row counts on a protected backup/restore rehearsal only. Do not inspect/export token values or drop the table without owner approval.
4. Browser UAT per persona, legacy DB upgrade rehearsal, backup/restore, staging deploy/rollback, and business-owner sign-off remain release gates.

**Merge policy:** Keep this PR unmerged until exact-head CI and review pass. Do not merge to `main` without explicit owner approval.


## CI correction and verification update

- Earlier live CR-04/CR-05 run `45711348504` exposed that `GET /api/taxonomy/categories` re-normalized the category catalog but did not apply the retired-owner filter at the API boundary; 193/194 checks passed. Added explicit SC/PIBC category deactivation to the response and a source regression assertion for that endpoint.
- Corrected migration-source assertions to match `UPPER(BTRIM(...))` in migration 106.
- Exact code/test head `3ee9cfd7fc05f0ad5945692624e6335ec59467da`: CI run `45713396569` (#3619) completed SUCCESS.
- The following worklog-only commit will create a newer PR head; recheck its CI before treating the PR as fully green.
