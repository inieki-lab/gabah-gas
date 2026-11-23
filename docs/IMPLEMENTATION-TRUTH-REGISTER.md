# GABAH — Implementation Truth Register

**Baseline reviewed:** `main` at `f39db6b8fd819d301f49815c7a33a04c80b2a6c0`  
**Review date:** 23 November 2026  
**Status:** Source-inspection snapshot; not test evidence and not a production-readiness approval.

This register separates owner-approved intent from behavior actually visible in the source. “IMPLEMENTED” below means the relevant code path was found by inspection only; it does not mean integration/UAT has passed.

## 1. Verified source behavior (inspection only)

| Area | Source behavior found | Status / evidence |
|---|---|---|
| API authentication | `server/runtime-hardening.ts` makes only `/api/health` and `/api/auth/login` public. Other API requests require a valid session. `server/auth.ts` currently reads `Authorization: Bearer` tokens. | IMPLEMENTED by source inspection; browser/API integration tests still required |
| PostgreSQL Dynamic RBAC | `server/rbac-policy.ts` loads assigned roles, permissions, and scopes from PostgreSQL into a process cache via `refreshRbacPolicy()`. Permission checks use explicit keys; scope checks are module-aware. | IMPLEMENTED by source inspection; cache invalidation, cold-start, failure and concurrency tests required |
| Superadmin | PostgreSQL mode resolves Superadmin from assigned role metadata, not merely the legacy `ServerUser.role` label. Auditor precedence blocks Superadmin elevation when Auditor is also assigned. | IMPLEMENTED by source inspection; test assignment combinations |
| Auditor | `isAuditorActor()` resolves the assigned Auditor role in PostgreSQL mode. `gabahSecurityMiddleware` blocks non-GET requests except narrowly allowed logout/notification-read actions. | IMPLEMENTED by source inspection; verify every mutation route and notification exception |
| Asset read scope | `GabahDomainService.getScopedAssets()` combines dynamic asset scopes with a specific read-only IT workstation capability limited to owner IT + categories HLT/HPC. | IMPLEMENTED by source inspection; verify list, search, dashboard, export, and direct-ID parity |
| Asset creation | `GabahDomainService.createAsset()` rejects owner codes SC, PIBC, and UNASSIGNED; requires an active owner master; then requires `assets.create` plus matching owner scope. IT hardware/software is forced to owner IT; INV-F is forced to GA. | IMPLEMENTED by source inspection for this service path; bulk-import and every alternate creation path still need parity tests |
| Asset legacy taxonomy | `server/taxonomy.ts` still contains legacy SC/PIBC category entries and resolver fallbacks so historical records remain readable. The create service guard is what blocks those owners for new assets. | PARTIAL; keep legacy data readable and test all new-write paths |
| Loan approval/rejection | `GabahDomainService.canOperateLoan()` requires the operation permission plus matching owner scope in PostgreSQL mode; Superadmin is global and Auditor denied. | IMPLEMENTED by source inspection; test per action, owner, borrower, and status transition |
| Number generation | `AssetNumberingEngine.generateAssetNumber()` increments a process-memory `Map`. It syncs from existing assets at boot; the `asset_number_sequences` table is not used by this generator for atomic allocation. | IMPLEMENTED limitation; multi-process collision safety NOT IMPLEMENTED |
| Employee profile model | `ServerUser.role` is now an open display/profile string, while create/edit API validation permits only `Admin GABAH` and `Karyawan`. Bulk import accepts known historical labels but stores non-admin users as Karyawan. Migration `048_dynamic_employee_profile_normalization.sql` preserves IT/GA/Auditor/Humas/Sekretariat Direksi as secondary Dynamic RBAC assignments, sets Karyawan as the primary profile, and disables Supply Chain/PIBC role templates. | IMPLEMENTED by source change; migration execution and account-by-account PostgreSQL verification NOT YET TESTED |
| Employee asset baseline | `getScopedAssets()` no longer checks a fixed list of employee role labels; non-Superadmin/non-Auditor users receive the personal/loanable baseline plus explicit dynamic scopes. | IMPLEMENTED by source inspection; verify effective role assignments and all scope regressions in CI/UAT |

## 2. Important interpretation

- A PostgreSQL Dynamic RBAC grant can authorize a custom role for supported permission/scope checks. Legacy role labels remain only in explicit import/backfill and compatibility branches; they are not valid primary profiles after migration `048`.
- Role, job level, org unit, office location, asset owner, asset location, and custodian must remain distinct in the product model. Where code still uses legacy role labels for compatibility, record it as a migration gap—not as a new business rule.
- SC/PIBC legacy taxonomy entries are not permission to create new assets under those owners. Do not delete or bulk-reclassify existing records without approved mapping and rollback.
- The configured owner master can be extensible. The current create path rejects SC/PIBC/UNASSIGNED specifically; future owner domains require an explicit approved master entry and grants.
- A route's presence in `server.ts` does not prove its authorization, validation, transaction behavior, or UI workflow is correct.

## 3. Required follow-up verification

1. Add regression tests proving all asset create paths (single create, bulk import, migration/import jobs, and any internal service callers) reject SC/PIBC/UNASSIGNED as new owner values while preserving legacy reads.
2. Remove remaining employee baseline visibility decisions based on legacy role labels only after an explicit replacement capability/policy is approved and UAT fixtures are migrated.
3. Test Dynamic RBAC cache refresh after role/permission/scope changes, including multi-process deployment and PostgreSQL failure/recovery.
4. Test asset read scope parity across list, search, detail-by-ID, dashboards, exports, and linked records.
5. Move asset number allocation to a PostgreSQL transaction/UPSERT or equivalent concurrency-safe mechanism; test simultaneous allocation across two app processes before claiming concurrency safety.
6. Reconcile each API route with middleware, handler permission, domain service, DB transaction, frontend action, and UAT case.
7. Apply all SQL migrations to a fresh PostgreSQL database and a representative legacy snapshot; compare actual tables/columns/indexes/constraints/triggers with Database Design.

## 4. Evidence boundary

- This document was prepared by inspecting source files on the baseline SHA above.
- No TypeScript check, build, PostgreSQL integration test, Docker smoke test, browser UAT, concurrency test, or penetration test was run as part of this register.
- Do not convert source-inspection status into TESTED or PASS without a test run and exact commit evidence.
- Recheck the register whenever the base branch changes or the referenced implementation changes.
