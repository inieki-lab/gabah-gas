# GABAH — Implementation Truth Register

**Baseline reviewed:** `main` at `57b69b3` (PR #264 merge)  
**Review date:** 24 November 2026  
**Status:** Source-inspection snapshot with linked CI evidence; not a production-readiness approval.

This register separates owner-approved intent from behavior actually visible in the source. “IMPLEMENTED” below means the relevant code path was found by inspection only; it does not mean integration/UAT has passed.

## 1. Verified source behavior (inspection only)

| Area | Source behavior found | Status / evidence |
|---|---|---|
| API authentication | Browser sessions use the HttpOnly `gabah_session` cookie with SameSite protection; legacy Bearer transport remains for compatibility. Mutating cookie-authenticated requests require same-origin validation. | PR #256 merged; PR #262 CI verifies cross-instance cookie sessions; browser UAT and production HTTPS/proxy validation remain |
| PostgreSQL Dynamic RBAC | `server/rbac-policy.ts` loads assigned roles, permissions, and scopes from PostgreSQL. Each application process refreshes its local policy cache every 5 seconds in addition to immediate refresh after local mutations; overlapping refreshes are serialized and failed refreshes clear grants (default-deny). | IMPLEMENTED; CI integration covers two-process grant revocation/restoration and policy-query failure/recovery; deployment network fault UAT remains |
| Superadmin | PostgreSQL mode resolves Superadmin from assigned role metadata, not merely the legacy `ServerUser.role` label. Auditor precedence blocks Superadmin elevation when Auditor is also assigned. | IMPLEMENTED by source inspection; test assignment combinations |
| Auditor/read-only | `isAuditorActor()` and `isAuditorUserId()` special-case the fixed role key `auditor` in PostgreSQL mode; middleware blocks non-GET requests except narrowly allowed logout/notification-read actions. A custom role with an independently configured read-only intent does not automatically inherit this behavior. | IMPLEMENTED for the fixed Auditor template; PARTIAL against fully configurable capability semantics. Owner decision/architecture needed before generalizing read-only policy; verify every mutation route and exception |
| Asset read scope | `GabahDomainService.getScopedAssets()` combines dynamic asset scopes with a specific read-only IT workstation capability limited to owner IT + categories HLT/HPC. | IMPLEMENTED by source inspection; verify list, search, dashboard, export, and direct-ID parity |
| Asset creation | `GabahDomainService.createAsset()` rejects owner codes SC, PIBC, and UNASSIGNED; requires an active owner master; then requires `assets.create` plus matching owner scope. IT hardware/software is forced to owner IT; INV-F is forced to GA. | Source + CI regression: PR #265/#267 merged; CI #3420 passed 119/119; CR-04/CR-05 passed 185/185 including custom GA+RPCSC role and fail-closed Karyawan/Auditor cases |
| Asset create-options UI | `GET /api/assets/create-options` returns only active owner masters allowed by `assets.create` + explicit owner scope; categories are active and restricted to returned owners. `CreateAssetModal` consumes the typed API client, uses server-derived choices, and fails closed on loading/error/empty results. | PR #265/#267 merged; CI #3420 passed 119/119; CR-04/CR-05 185/185; issue #122 closed |
| Asset legacy taxonomy | `server/taxonomy.ts` still contains legacy SC/PIBC category entries and resolver fallbacks so historical records remain readable. The create service guard is what blocks those owners for new assets. | PARTIAL; keep legacy data readable and test all new-write paths |
| Loan approval/rejection | `GabahDomainService.canOperateLoan()` requires the operation permission plus matching owner scope in PostgreSQL mode; Superadmin is global and Auditor denied. | IMPLEMENTED by source inspection; test per action, owner, borrower, and status transition |
| Asset number generation and UI | PostgreSQL mode reserves sequence values transactionally through `asset_number_sequences` using an atomic UPSERT shared by app instances; startup reconciliation seeds historical maxima without lowering existing counters. PostgreSQL failure is fail-closed. File-store development retains the in-memory counter. Create-asset UI no longer fabricates a `0001` preview; server issues the number on save. | Backend PR #258/#260 evidence; UI copy and preview correction PR #290 merged, exact-head CI run #45565766684 passed 119/119 |
| Contract number generation | PostgreSQL mode reserves `CTR-YYYY-NNNN` values through durable yearly `contract_number_sequences` with atomic UPSERT, startup reconciliation, and fail-closed behavior. File-store development retains the in-memory fallback. | PR #261 merged; CI run #3397 passed 117/117 including two-instance creation and restart continuation |
| Administration legacy UI fallback | `DEFAULT_DIVISIONS` now contains only IT/GA functional division defaults; the dormant static permission matrix has no SC/PIBC options. The legacy SC/PIBC owner-master rows remain a separate backend issue: they are still returned by `/api/master/divisions` and may be treated active if no `is_active=false` marker exists. | UI fallback fixed by PR #287, exact-head CI #45564612013 passed 119/119. Backend legacy owner-master retirement is tracked in issue #291; no historical rows have been deleted |
| Browser/API authentication transport | Browser client uses `credentials: 'same-origin'` and HttpOnly `gabah_session` cookie (SameSite=Strict, Secure in production, 7-day max age); server also accepts Bearer for non-browser clients and legacy `x-auth-token`. Cookie mutations require same-origin Origin. Sessions are memory-only; legacy `user_sessions` schema is not used at runtime. | Source inspected in `server.ts`, `server/auth.ts`, `server/runtime-hardening.ts`, `src/services/gabahApi.ts`; browser/API UAT and legacy-table cleanup remain separate checks |
| Login alias compatibility | `server.ts` retains a hard-coded fallback alias map for canonical/legacy accounts (e.g. IT, GA, Humas, Sekretariat Direksi, Supply Chain, PIBC, Auditor) after exact email lookup. Password verification is still mandatory; this map does not define primary profiles or grant permissions. | Compatibility-only; new/custom function roles should use explicit account email, not role-derived login aliases. Remove legacy aliases after account/UAT migration is approved |
| PostgreSQL recovery snapshot | After successful PostgreSQL commit, exact committed payload is written to `gabah_state.json`; session data is excluded. Snapshot is not an automatic fallback after PostgreSQL runtime failure. | Source inspected in `server/persistence.ts`; main CI #45565025273 passed 119/119 on PR #287 merge head |
| Employee profile model | `ServerUser.role` is an employee profile; IT/GA/Auditor/Humas/Sekretariat Direksi are secondary Dynamic RBAC assignments. Migration `048_dynamic_employee_profile_normalization.sql` makes Karyawan the primary profile and retires Supply Chain/PIBC role templates. SC/RPC and PIBC remain Karyawan profiles with distinct office locations. | PR #260 merged; CI run #3386 passed 117/117 including PostgreSQL assertions for role, location, job level, and unit fields |
| Employee asset baseline | `getScopedAssets()` no longer checks a fixed list of employee role labels; non-Superadmin/non-Auditor users receive the personal/loanable baseline plus explicit dynamic scopes. | IMPLEMENTED by source inspection; verify effective role assignments and all scope regressions in CI/UAT |
| Last-active Superadmin invariant | Role assignment, user PATCH (demotion/deactivation), and user DELETE acquire the same PostgreSQL session-level advisory lock. PATCH/DELETE recheck the acting administrator and read target status + active Superadmin count from PostgreSQL under the lock; PostgreSQL failure is fail-closed. | PR #264 merged; CI run #3410 passed 119/119 including two-connection race: first demotion allowed, second waited then denied, one active Superadmin remained |

## 2. Important interpretation

- The two primary profiles are Admin GABAH and Karyawan. The number and names of additional function roles are not fixed. Any role-name-specific compatibility branch must be isolated, labeled, and tested as legacy; production authorization must use PostgreSQL assignments, permissions, and scopes.
- The fixed `auditor` role-key deny-write rule is a known exception to fully generic role behavior. Do not claim that any custom role can be configured as read-only until a generic, explicit policy mechanism is implemented and tested (issue #289).
- SC/PIBC remain legacy entries in the shared `divisions`/owner master even though they are office-location aliases in the current business model. Do not grant new owner/contract scope from those legacy codes; retirement without deleting historical references is tracked in issue #291.

- A PostgreSQL Dynamic RBAC grant can authorize a custom role for supported permission/scope checks. Legacy role labels remain only in explicit import/backfill and compatibility branches; they are not valid primary profiles after migration `048`.
- Role, job level, org unit, office location, asset owner, asset location, and custodian must remain distinct in the product model. Where code still uses legacy role labels for compatibility, record it as a migration gap—not as a new business rule.
- SC/PIBC legacy taxonomy entries are not permission to create new assets under those owners. Do not delete or bulk-reclassify existing records without approved mapping and rollback.
- The configured owner master can be extensible. The current create path rejects SC/PIBC/UNASSIGNED specifically; future owner domains require an explicit approved master entry and grants.
- A route's presence in `server.ts` does not prove its authorization, validation, transaction behavior, or UI workflow is correct.

## 3. Required follow-up verification

1. Keep asset create/import parity under regression coverage; PR #265/#267 now cover server-authorized create-options, active category filtering, and custom owner scopes. Review alternate import/internal callers whenever they change.
2. Remove remaining employee baseline visibility decisions based on legacy role labels only after an explicit replacement capability/policy is approved and UAT fixtures are migrated.
3. Run deployment-level Dynamic RBAC fault UAT under a PostgreSQL network interruption; CI already covers two-process role revocation/restoration and policy-query failure/recovery.
4. Test asset read scope parity across list, search, detail-by-ID, dashboards, exports, and linked records.
5. Confirm the company-approved asset numbering format and owner taxonomy before changing any existing pattern; do not alter existing patterns without owner approval.
6. Perform deployment-level UAT for last-active-Superadmin protection under PostgreSQL network interruption and recovery; CI covers the two-connection concurrency invariant.
7. Reconcile each API route with middleware, handler permission, domain service, DB transaction, frontend action, and UAT case.
8. Apply all SQL migrations to a fresh PostgreSQL database and a representative legacy snapshot; compare actual tables/columns/indexes/constraints/triggers with Database Design.

## 4. Evidence boundary

- This document records source behavior on the baseline SHA above and links to current implementation evidence where available.
- PR #258 CI run #3371 passed 117/117 checks, including two-instance concurrent asset issuance; PR #259 CI run #3377 passed 117/117 checks, including two-process RBAC propagation and policy-query failure/recovery.
- PR #260 CI run #3386 passed 117/117 checks, including asset counter restart and migration-048 employee/location persistence assertions.
- PR #261 merged; CI run #3397 passed 117/117 for PostgreSQL atomic contract numbering, two-instance concurrency, and restart continuation.
- PR #262 merged; CI run #3401 passed 117/117 for cross-instance HttpOnly session verification.
- PR #263 merged; CI run #3404 passed 117/117 for explicit trusted reverse-proxy configuration. Main workflow #3405 passed.
- PR #264 merged; CI run #3410 passed 119/119, including PostgreSQL two-connection Superadmin demotion race and all three guarded account mutation paths. Issue #247 closed.
- Browser UAT, production HTTPS/reverse-proxy validation, PostgreSQL network interruption UAT, and penetration testing remain separate release gates.
- Recheck the register whenever the base branch changes or the referenced implementation changes.
