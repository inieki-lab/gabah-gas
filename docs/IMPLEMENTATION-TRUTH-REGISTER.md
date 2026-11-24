# GABAH — Implementation Truth Register

**Baseline reviewed:** `main` at `3cb832a472a897e6e811dd5ad21623e612386cdd`  
**Review date:** 24 November 2026  
**Status:** Source-inspection snapshot with linked CI evidence; not a production-readiness approval.

This register separates owner-approved intent from behavior actually visible in the source. “IMPLEMENTED” below means the relevant code path was found by inspection only; it does not mean integration/UAT has passed.

## 1. Verified source behavior (inspection only)

| Area | Source behavior found | Status / evidence |
|---|---|---|
| API authentication | `server/runtime-hardening.ts` makes only `/api/health` and `/api/auth/login` public. Other API requests require a valid session. `server/auth.ts` currently reads `Authorization: Bearer` tokens. | IMPLEMENTED by source inspection; browser/API integration tests still required |
| PostgreSQL Dynamic RBAC | `server/rbac-policy.ts` loads assigned roles, permissions, and scopes from PostgreSQL. Each application process refreshes its local policy cache every 5 seconds in addition to immediate refresh after local mutations; overlapping refreshes are serialized and failed refreshes clear grants (default-deny). | IMPLEMENTED; CI integration covers two-process grant revocation/restoration and policy-query failure/recovery; deployment network fault UAT remains |
| Superadmin | PostgreSQL mode resolves Superadmin from assigned role metadata, not merely the legacy `ServerUser.role` label. Auditor precedence blocks Superadmin elevation when Auditor is also assigned. | IMPLEMENTED by source inspection; test assignment combinations |
| Auditor | `isAuditorActor()` resolves the assigned Auditor role in PostgreSQL mode. `gabahSecurityMiddleware` blocks non-GET requests except narrowly allowed logout/notification-read actions. | IMPLEMENTED by source inspection; verify every mutation route and notification exception |
| Asset read scope | `GabahDomainService.getScopedAssets()` combines dynamic asset scopes with a specific read-only IT workstation capability limited to owner IT + categories HLT/HPC. | IMPLEMENTED by source inspection; verify list, search, dashboard, export, and direct-ID parity |
| Asset creation | `GabahDomainService.createAsset()` rejects owner codes SC, PIBC, and UNASSIGNED; requires an active owner master; then requires `assets.create` plus matching owner scope. IT hardware/software is forced to owner IT; INV-F is forced to GA. | IMPLEMENTED by source inspection for this service path; bulk-import and every alternate creation path still need parity tests |
| Asset legacy taxonomy | `server/taxonomy.ts` still contains legacy SC/PIBC category entries and resolver fallbacks so historical records remain readable. The create service guard is what blocks those owners for new assets. | PARTIAL; keep legacy data readable and test all new-write paths |
| Loan approval/rejection | `GabahDomainService.canOperateLoan()` requires the operation permission plus matching owner scope in PostgreSQL mode; Superadmin is global and Auditor denied. | IMPLEMENTED by source inspection; test per action, owner, borrower, and status transition |
| Number generation | PostgreSQL mode reserves sequence values transactionally through `asset_number_sequences` using an atomic UPSERT shared by app instances; startup reconciliation seeds historical maxima without lowering existing counters. PostgreSQL failure is fail-closed. File-store development retains the in-memory counter. | CI run #3371 passed two-instance concurrent issuance; PR #260 adds post-restart counter continuation assertion before final status update |
| Employee profile model | `ServerUser.role` is an employee profile; IT/GA/Auditor/Humas/Sekretariat Direksi are secondary Dynamic RBAC assignments. Migration `048_dynamic_employee_profile_normalization.sql` makes Karyawan the primary profile, preserves those job capabilities as secondary roles, and retires Supply Chain/PIBC role templates. | CI regression and fresh-PostgreSQL account assertions added in PR #260; pending CI result |
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
3. Run deployment-level Dynamic RBAC fault UAT under a PostgreSQL network interruption; CI already covers two-process role revocation/restoration and policy-query failure/recovery.
4. Test asset read scope parity across list, search, detail-by-ID, dashboards, exports, and linked records.
5. Confirm the company-approved asset numbering format and owner taxonomy before changing any existing pattern; concurrency-safe PostgreSQL issuance is implemented and covered by two-instance CI.
6. Reconcile each API route with middleware, handler permission, domain service, DB transaction, frontend action, and UAT case.
7. Apply all SQL migrations to a fresh PostgreSQL database and a representative legacy snapshot; compare actual tables/columns/indexes/constraints/triggers with Database Design.

## 4. Evidence boundary

- This document records source behavior on the baseline SHA above and links to current implementation evidence where available.
- PR #258 CI run #3371 passed 117/117 checks, including two-instance concurrent asset issuance; PR #259 CI run #3377 passed 117/117 checks, including two-process RBAC propagation and policy-query failure/recovery.
- PR #260 adds explicit restart-continuation and migration-048 account assertions; those tests are pending.
- Browser UAT, production HTTPS/reverse-proxy validation, PostgreSQL network interruption UAT, and penetration testing remain separate release gates.
- Recheck the register whenever the base branch changes or the referenced implementation changes.
