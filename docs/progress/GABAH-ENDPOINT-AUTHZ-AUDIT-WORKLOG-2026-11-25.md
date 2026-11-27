# GABAH Endpoint Authorization Audit — Batch 1 Worklog

**Tanggal:** 2026-11-25  
**Repository:** `inieki-lab/gabah-gas`  
**Base:** `main` @ `152c69757c3a60805d019af522d38e01a0179a08`  
**Branch:** `audit/endpoint-authz-batch-1-2026-11-25`  
**Audit type:** Static source inspection (GitHub source at exact base SHA)  
**Status:** PARTIAL — findings recorded; runtime/API integration tests not executed in this environment.

## 1. Scope

Batch 1 focused on authentication/session, identity resolution, user administration, Dynamic RBAC administration, and the global authorization middleware. A route-registration inventory was also extracted from `server.ts` to identify routes requiring follow-up.

Sources inspected:
- `AGENTS.md`, `PROJECT-RULES.md`
- `docs/GABAH-DOCUMENTATION-CONTROL.md`
- `docs/PROJECT-CONTEXT.md`
- `docs/IMPLEMENTATION-TRUTH-REGISTER.md`
- `docs/AI-CHANGE-GUARDRAILS.md`
- `.agents/skills/gabah-maintainer/SKILL.md`
- `docs/product/BUSINESS-RULES.md`
- `docs/architecture/RBAC.md`
- `server.ts`, `server/auth.ts`, `server/rbac-policy.ts`, `server/runtime-hardening.ts`
- Relevant scripts: `dynamic-rbac-foundation-verify.mjs`, `observer-route-rbac-verify.mjs`, `notification-rule-persistence-verify.mjs`, `system-settings-persistence-verify.mjs`
- `docs/testing/UAT.md`, `docs/architecture/API-DESIGN.md`

## 2. Source-observed results

### Authentication and session boundary

- `gabahSecurityMiddleware` is mounted globally before business API routes in `server.ts`.
- The explicitly public API path list in `server/runtime-hardening.ts` contains only `/api/health` and `/api/auth/login`.
- Other API routes require a valid server-side session. `/api/auth/logout` is not public; an authenticated request is required before it can destroy its session.
- Cookie-authenticated mutating requests require a same-origin `Origin` header.
- Identity is resolved from the session token. `x-user-id` without a valid session is rejected as a spoof attempt; a client-supplied identity is not used to select the actor.
- API path checks normalize case and trailing slashes before applying middleware-level route protections.
- API rate-limit-store failure is fail-closed (except health probes); PostgreSQL failure-latch blocks operational API traffic.

### Primary profile and Dynamic RBAC

- Owner-approved model is retained: only primary profiles `Admin GABAH` and `Karyawan`; function roles/capabilities are additional Dynamic RBAC assignments.
- Nine Dynamic RBAC administration routes were identified:
  - GET permissions, roles, user-assignments
  - POST roles
  - PATCH/DELETE roles
  - PUT role permissions, role scopes, and user role assignments
- All nine call `requireRbacSuperadmin`, which requires PostgreSQL RBAC to be active and an effective Superadmin assignment.
- User create/import/update/delete/reset-password endpoints are guarded by `isSuperadminActor`.
- `POST /api/auth/switch-role` requires an authenticated effective Superadmin and rotates the session token; it is not a public route.
- Role assignment preserves the primary profile assignment, validates active role IDs, rejects Auditor + Superadmin combinations, and applies last-active-Superadmin protection in a transaction.

### Business API route inventory

- Static extraction from `server.ts` identified 140 Express route/middleware registration statements; this is a source inventory, not a runtime route test.
- Operational modules generally apply `requireRbacPermission` and domain-level ownership/scope checks. The audit specifically confirmed explicit permission checks on assets, loans, tickets, maintenance, vendors, contracts, meeting rooms/reservations, notifications, dashboard, reconciliation, and audit-log endpoints.
- Read endpoints for the company profile and notification-rule status require authentication and active PostgreSQL. Existing regression scripts explicitly expect an authenticated Karyawan to read these values; their write endpoints require Superadmin. These reads are therefore not classified as authorization defects.
- No confirmed unauthenticated route bypass or Dynamic RBAC administration bypass was established by this static review. Runtime negative tests remain required before treating the boundary as tested.

## 3. Findings

| ID | Severity | Finding | Evidence / status |
|---|---|---|---|
| AUTHZ-01 | RESOLVED IN CODE; BROWSER UAT PENDING | Generic Dynamic RBAC read-only policy is implemented. `security.read_only` enforces deny-write precedence for any role; `isAuditorActor()` remains distinct so a custom read-only role does not inherit global observer visibility. | PR #301 merged to `main`; exact-head CI run #3534 SUCCESS. `scripts/cr04-cr05-verify.mjs` creates a custom non-Auditor role with both read and write grants, confirms the marker/effective permissions, verifies read endpoints and rejects POST with 403. Remaining: browser UAT and additional direct-ID/out-of-scope visibility cases before declaring release acceptance. |
| API-01 | MEDIUM | Report/export endpoints are not implemented on the audited `main` source, although the permission catalog includes `reports.read` and `reports.export`. There is consequently no backend report/export endpoint whose authorization can be verified. | No `/api/reports` or `/api/exports` route registration found in `server.ts`; repository code search returned no matches for those route paths. Treat as a missing feature/contract gap, not an unauthenticated access bypass. |
| AUTH-02 | LOW / INFORMATIONAL | Login retains a hard-coded legacy alias fallback for old role labels/accounts after exact email lookup. Password verification is still mandatory and alias matching does not itself grant permissions. | `server.ts` login resolver; exact email/prefix match takes precedence. Remove only after account migration and UAT are approved. |

## 4. PR #301 dependency review

- PR: https://github.com/inieki-lab/gabah-gas/pull/301
- Head branch: `feat/dynamic-read-only-policy-capability`
- Exact head: `aef08cebc66439df6bb7be715772b27072ed637c`
- Base: `main` @ `152c69757c3a60805d019af522d38e01a0179a08`
- State: OPEN, not merged.
- Exact-head CI run `45573751004`: SUCCESS.
- Source review of the proposal confirms a `security.read_only` permission marker, generic read-only actor resolution, Superadmin suppression when read-only is assigned, and a migration that adds the marker to the legacy Auditor template.
- This audit does not merge PR #301. Its change must remain a separate review/integration decision. Do not describe generic read-only as active on `main`.

## 5. Tests and verification

| Check | Result |
|---|---|
| GitHub source inspection at exact `main` SHA | DONE |
| Route registration extraction from `server.ts` | DONE (static only) |
| Review of existing auth/RBAC regression scripts and CI declarations | DONE (source inspection only) |
| `npm run lint` | NOT RUN — no executable repository checkout/runtime in this session |
| Production build | NOT RUN |
| PostgreSQL integration / negative HTTP authorization tests | NOT RUN |
| Browser UAT by persona | NOT RUN |
| Exact-head CI for PR #301 | PASS — run 45573751004; applies to PR branch only, not `main` |

No test is claimed PASS unless the execution result was directly observed. Existing test-script source was inspected but not executed in this audit.

## 6. Decisions and safety boundaries

- No code, database migration, user assignment, role assignment, permission, or operational data was changed in this batch.
- No branch was merged; no deployment was performed.
- Do not reintroduce nine legacy primary roles.
- Do not merge PR #301 or any other PR without owner authorization.
- Do not build report/export routes without confirming their product requirements, data scope, output format, and access policy.

## 7. Next work

1. Complete review and owner decision for PR #301; after integration, rerun generic read-only regression against the integrated exact head.
2. Add a dedicated UAT scenario for a custom non-Auditor read-only role that also has write grants: reads within explicit scope succeed; all mutating HTTP methods/actions are denied; Superadmin elevation is suppressed; notification-read/logout exceptions are narrowly preserved.
3. Define the Reports & Exports product contract (report catalogue, fields, data scopes, CSV/PDF formats, audit trail, and permissions) before implementing endpoints.
4. Continue Batch 2 with business endpoint-by-endpoint checks for object ownership, data scope, approval transitions, exports/downloads, and mutation atomicity.

**Handoff status:** Batch 1 source review recorded; runtime validation remains OPEN. This worklog is not a production-readiness or go-live approval.


## 8. Batch 2 — asset custody, loans, tickets, and numbering routes (2026-11-25)

**Review basis:** `main` @ `152c69757c3a60805d019af522d38e01a0179a08`. Static source inspection; no runtime mutation was performed.

### Loan workflow checks

Reviewed `requestLoan`, `approveLoan`, `rejectLoan`, `canOperateLoan`, `handoverLoan`, `returnLoan`, and `persistLoanMutation` in `server/services.ts`, plus the associated route/API/test references.

- Request creation binds the borrower to the authenticated actor; creating on behalf of another employee requires effective Superadmin.
- Approval/rejection/handover require the operation permission plus a matching loan owner-domain scope (or effective Superadmin); Auditor is denied.
- Approval is restricted to `pending_approval`, rejects self-approval for non-Superadmin, checks outstanding loans, date collisions, and revalidates asset loanability/status.
- Handover is restricted to `approved` and revalidates the reserved asset state.
- Return is restricted to `borrowed` / `overdue`; the borrower can return only their own loan, while other actors need owner-scope return authority or Superadmin. Auditor is denied.
- Loan mutations snapshot affected collections and restore them if durable persistence fails.
- Existing CI/test-script references cover loan authorization, state transitions, timezone handling, and mutation atomicity. Their source was inspected; they were not executed separately in this session.

**Result:** No new confirmed loan IDOR or workflow-state bypass found in the reviewed service methods. This is a static finding, not a live HTTP assurance.

### Asset mutation checks

- Assignment, relocation, and lifecycle mutation each check the corresponding operation permission and owner-domain authority through `canMutateAssetOwner`.
- Generic assignment, relocation, and lifecycle transitions reject assets with active approved/borrowed loans, preventing these paths from bypassing loan custody.
- Assignment validates an active target user; direct unassignment returns the asset to pool state.
- Existing lifecycle path separately requires effective Superadmin for disposal approval.

**Result:** No new confirmed owner-scope bypass found in the inspected methods.

### Ticket and numbering route checks

- Existing ticket regression references assert reporter/assignee/owner-scope/Superadmin authorization for status mutation and explicit ticket read permission. The ticket creation domain method validates category, bounded text, linked asset visibility, and linked contract visibility.
- Numbering rule create/update/delete endpoints each enforce effective Superadmin and `numbering.manage`; update/delete additionally protect rules with historical usage and validate format/collision constraints.
- `GET /api/taxonomy/categories` is behind the global authenticated API middleware; mutation is restricted to effective Superadmin. This is treated as authenticated master-data visibility, not an anonymous endpoint.

**Result:** No confirmed ticket or numbering authorization bypass established from the reviewed excerpts. Continue with room-reservation, notification ownership, maintenance/vendor/contract download paths and live HTTP negative tests.

### CI status update

- PR #302 (`audit/endpoint-authz-batch-1-2026-11-25`) exact head `21bb99428b0d9402b3bd54ebe0721deb641eaf38`: CI run `45603803729` completed SUCCESS, 119/119 steps. PR remains OPEN and unmerged.
- PR #301 remains OPEN at exact head `aef08cebc66439df6bb7be715772b27072ed637c`. The previously posted review concern about label-based global visibility in `ContractDomainService.getNotificationLogs()` has no maintainer response or fix visible as of this update. Keep PR #301 blocked from merge pending correction and regression coverage.

**Batch 2 status:** STATIC REVIEW COMPLETE for the above areas; no runtime tests executed and no code defect confirmed in these reviewed methods.
## 9. Batch 3 — room reservation privacy and database concurrency (2026-11-25)

### Revalidation of historical security-report findings

The older GABAH-AUDIT-REPORT.md / GABAH-P0-SECURITY-HARDENING-REPORT.md contains findings that are stale relative to current main. The following were rechecked against current source and should not be repeated as still-open vulnerabilities without new evidence:

- PATCH /api/notifications/:id/read now requires notifications.read and checks isNotificationRecipient(actor, notif); non-recipient IDs return 404. read-all separately requires notifications.read_all.
- GET /api/notifications filters records through isNotificationRecipient.
- GET /api/room-reservations requires room_reservations.read and redacts private agenda/attendee/phone/consumption/documentation/rejection/interruption details for operational queues. IT facility and Humas documentation queues are separately filtered and redacted.
- Room approve/reject/check-in/check-out/cancel domain methods enforce explicit capability/organizer ownership and valid state transitions. Their persistence path captures/restores domain snapshots on failure.
- Contract document upload/download is implemented in current source. Existing dynamic-rbac-foundation-verify.mjs asserts permission + visible-contract checks, MIME/signature validation, storage-path confinement, and persistent upload volume. The older report's claim that there is no physical upload/download endpoint is stale.

### Confirmed database invariant gap — PR #303

A current-source comparison found a genuine gap in room anti-double-booking:

1. Migration 015_room_reservations.sql creates idx_room_reservations_no_double_booking as a partial GiST index, not an EXCLUDE constraint. A normal GiST index does not itself prohibit overlapping ranges.
2. Its predicate covers pending, approved, in_use, and checked_in.
3. Current application code creates a non-auto-approved reservation with status pending_approval, which is absent from that predicate and the legacy trigger's active-status predicate.
4. The prior concurrency verification updates fixtures to pending, not the real application status pending_approval; it therefore did not verify the actual pending approval state.

A focused correction is open as PR #303:
- URL: https://github.com/inieki-lab/gabah-gas/pull/303
- Branch: fix/room-reservation-exclusion-constraint-2026-11-25
- Exact head: 06573108f0306c1c8f721cd428190c6d6af1cb5f
- Adds migration 105 with a true PostgreSQL GiST exclusion constraint including pending_approval.
- Fails closed if historical active rows overlap; it does not silently rewrite/cancel business records.
- Removes the redundant non-enforcing partial GiST index after the exclusion constraint is installed.
- Updates the PostgreSQL two-connection test to use pending_approval and accept SQLSTATE 23P01 as well as the existing trigger's P0001.
- CI run 45618201678 was QUEUED at the time of this worklog update; no test result is claimed.

Important deployment note: migration 105 has not been run against production. Before production rollout, check for existing overlapping active reservations and resolve them with business approval and a backup. The migration intentionally fails rather than making an automatic data decision.

### Batch 3 status

- Notification ownership and reservation queue privacy: source-reviewed; no current bypass found.
- Room reservation state transitions: source-reviewed; no current bypass found.
- Contract document upload/download: current implementation and regression assertions located; runtime test not executed here.
- Room double-booking: confirmed schema/predicate/test-fixture mismatch; fix proposed in PR #303, CI pending.
- No production database or operational records changed.

## 10. Batch 4 — vendor, maintenance, reports, and audit-log review (2026-11-25)

### Vendor endpoints
- GET /api/vendors requires vendors.read and filters non-global readers by the explicit vendor owner_division; ownerless legacy rows are hidden from scoped readers.
- POST /api/vendors requires vendors.create in PostgreSQL mode, validates the active owner master, and requires matching vendor division scope (or effective Superadmin).
- PATCH /api/vendors/:id requires vendors.update, validates both existing and requested owner domains, and requires scope over both before allowing an owner transfer. Input fields are allowlisted and validated.
- Create/update call persistBeforeSuccess before returning success; audit events are appended.
- No confirmed vendor authorization bypass found in the reviewed handlers.

### Maintenance endpoints
- GET /api/maintenances requires maintenances.read. PostgreSQL-mode non-global readers are limited to schedules whose linked assets are visible under dynamic owner scopes, plus their own assigned-asset baseline where applicable.
- GA's special read-only IT workstation inventory permission is explicitly not reused to reveal IT maintenance schedules.
- POST /api/maintenances requires maintenances.create plus owner-domain authority inherited from the linked asset; vendor references are resolved and validated.
- PATCH /api/maintenances/:id requires maintenances.update plus scope over the schedule's stored owner domain. Server-owned asset identity/owner fields are excluded from the update allowlist; vendor references are revalidated.
- Mutations use persistBeforeSuccess. No confirmed maintenance owner-scope bypass found in the reviewed handlers.

### Reports, exports, and audit
- Sidebar navigation requires reports.read for the Reports workspace. The current ReportsView is a client-side aggregation/export view, not a separate /api/reports or /api/exports backend. It receives assets, loans, tickets, and maintenance schedules already loaded through their respective API handlers; CSV exports operate on the current filtered arrays.
- Current source has reports.read (seeded for Superadmin, IT, GA, Auditor) but no reports.export permission. This is a policy/design gap only if the business requires export entitlement to be narrower than report viewing; no such rule is assumed in this audit. Record an owner decision before introducing a new permission.
- GET /api/audit-logs requires audit.read. Migration 025 grants that global audit capability to the intended Auditor/Superadmin roles; current route returns the audit log collection. ReportsView receives an auditLogs prop but does not currently render or export it. No separate audit export route was found in the reviewed API paths.
- Reconciliation GET requires reconciliation.read and builds output from the actor's scoped assets (global Superadmin/Auditor receives global view). POST link requires reconciliation.link plus assets.update owner mutation authority; global API mutation persistence middleware commits successful writes before sending the response.
- No confirmed authorization defect found in vendor, maintenance, report aggregation, or audit-log paths reviewed in this batch. These conclusions are static-source observations; no live account/HTTP UAT was run here.

### Merged work and current CI
- PR #303 merged to main as commit 6826116d7647502198c06a3f228433f0bb085040 after CI run 45618201678 completed SUCCESS (119/119 steps) on exact head 06573108f0306c1c8f721cd428190c6d6af1cb5f.
- PR #302 merged to main as commit 17e2126fbaa8dc0ca05ed571c168918d46e7a5d6 after CI run 45618338825 completed SUCCESS on exact head e63b56d720bdf5648366b01d852e8db501072823.
- PR #301's contract notification-log effective-Superadmin correction and regression assertion were committed to its existing branch; exact head adc706edcb038b41a35bbfb2ea429f0293777169. CI run 45625865976 was IN_PROGRESS at this update; PR remains OPEN pending exact-head CI and final review.

### Batch 4 status
- Vendor, maintenance, reports, and audit-log source review: COMPLETE for the handlers and UI data path described above.
- No new confirmed application defect in this batch.
- Open policy question: whether report export should have a separate reports.export permission. Do not invent or grant it until business owner confirms.
- Continue with module lifecycle, dashboard aggregates, search, licences, and direct-ID endpoint coverage while PR #301 CI runs.

## 11. Batch 5 — dashboard, global search, module lifecycle, and directory (2026-11-25)

### Dashboard aggregates and attention
- GET /api/dashboard/stats requires dashboard.read. Assets are sourced through getScopedAssets; loans are restricted to own borrower records or explicit loans owner scope; tickets are restricted to reporter, assigned agent, explicit ticket owner scope, or assigned unit scope. Counts are computed only from these filtered collections.
- GET /api/dashboard/attention requires dashboard.read. PostgreSQL notification-rule settings fail closed when unavailable; attention items are scoped in the service and by the runtime response filter. Existing dashboard-scope and attention-scope regression suites cover the route/data contract.
- Dashboard UI consumes the already scoped arrays; no client-side role-label filter is treated as the security boundary.

### Global search
- No standalone /api/search route exists. GlobalSearchModal performs local search over assets, loans, and tickets passed from App state.
- App passes each collection only when the current effective permissions allow the relevant workspace; each collection is populated from its own backend endpoint, which enforces permission and object scope. Search therefore does not create a second data access path.
- Search result selection is also guarded by the same effective workspace permission before opening an asset/loan/ticket.
- No independent search endpoint bypass found in the inspected UI path.

### Module lifecycle
- GET /api/modules requires an authenticated session and returns module registry status so the client can hide inactive modules.
- GET /api/modules/:moduleKey/audit and PATCH /api/modules/:moduleKey require effective Superadmin. The update validates module key, strict boolean status, and mandatory 5–500 character reason, then writes module state and audit history transactionally.
- Runtime module-status enforcement occurs before business handlers; disabled modules return 403, including for Superadmin. Existing module-lifecycle API/UI and registry regression scripts cover these rules.
- No confirmed authorization bypass found in the inspected module lifecycle routes.

### Employee directory and sanitized identity payload
- GET /api/users requires users.read in PostgreSQL mode; migration 028 grants this to Superadmin, IT, and GA for operational assignment/helpdesk routing. File-store fallback is explicitly limited to the same operational custodians.
- Responses use sanitizeUser; password hash/salt and temporary password are excluded, and Telegram chat ID is included only for effective Superadmin.
- Additional review found authVersion is documented server-only but was not previously removed by sanitizeUser. A focused fix is open as PR #306 to redact authVersion and add a regression assertion.

### PR and CI state at this worklog update
- PR #301 merged to main as `18f068bc2b0a5f5b8137abcf3bf656b3a6f934e6`; exact-head CI run 45625865976 SUCCESS. Its contract notification-log shortcut now uses effective Superadmin and has a regression assertion.
- PR #304 merged to main as `3872c14b8466e802bfb3f1a57ca1cc7e84ffcdcd`; exact-head CI run 45626176102 SUCCESS.
- PR #305 contains license/report navigation alignment and dynamic renewal KPI. CI runs 45627202504 and 45627504766 failed only at the navigation-policy test's outdated default-landing expectation. The test has been corrected on exact current head `5403c4bfe1985f35108449076cca0c5bf7f40fb2`; new CI run pending at this update. No merge until exact-head CI passes.
- PR #306 redacts server-only authVersion; exact head `333edd1a893571ce78168da90577c65439287728`; CI run 45627752964 was in progress at this update.

### Batch 5 status
- Dashboard scope, attention response filtering, local search data path, module lifecycle authorization, and employee-directory gate: STATIC REVIEW COMPLETE.
- No new confirmed data-scope bypass found in these areas.
- authVersion payload exposure: confirmed low-severity internal metadata leak; correction proposed in PR #306.
- Continue auditing remaining direct-ID routes, BAST/document exports, and role-specific menu/page actions while CI runs.

## 12. Batch 6 — BAST document workflow review (2026-11-25)

### Confirmed BAST workflow issues
- LoansView previously exposed Cetak BAST for every status except rejected. This included pending_approval before approval, contrary to the UI comment that BAST is available only after approval/active/return.
- Permanent asset-assignment BAST was fabricated as a Loan object in App.tsx. The generated object included a hardcoded borrower phone (021-5000-888), synthetic due date, and synthetic approved status. BastDocumentModal therefore rendered it as a loan BAST rather than its existing asset-assignment mode.
- Asset-to-loan matching for BAST omitted backend statuses borrowed and overdue, so an active loan could be mistaken for a permanent assignment.
- BastDocumentModal inferred the responsible division from category_type and defaulted unknown/non-IT owners to GA. This violated the canonical owner-domain rule; category/service type is not asset ownership.

A focused fix is open as PR #308:
- URL: https://github.com/inieki-lab/gabah-gas/pull/308
- Branch: fix/bast-document-authorization-and-data-accuracy-2026-11-25
- Latest exact head at this update: 2f8708a0d9bc39765275a3684768f52d43527217
- Loan BAST button is limited to normalized approved/active/returned states; pending_approval and rejected are hidden.
- Permanent assignment BAST now passes the actual asset directly to BastDocumentModal, without synthesizing a loan or contact/due-date values.
- Existing loan detection includes active, borrowed, approved, overdue, and returned.
- BAST responsible division/number now uses owner_division; missing owner is displayed as UNASSIGNED rather than inferred from category.
- State is cleared on logout/role switch; regression coverage added to test:loan-status-contract.
- CI on intermediate heads failed only because an existing source-boundary assertion still expected the old App.tsx comment. The assertion has been updated; CI for the latest exact head is pending.

### Related PR and CI state
- PR #305 merged to main as `de7334bf5b5bea4dfdc6bbe0ae05862c355abb05`; exact-head CI run 45627849061 SUCCESS. License/report workspace permissions and live renewal KPI are now on main.
- PR #307 merged to main as `2d83ff7d6f0134fc337c0630564af043b385f8ed`; exact-head CI run 45628009554 SUCCESS. Dashboard/search/module lifecycle audit worklog is now on main.
- PR #306 latest head `f249a2b1e42116403107b8f92bdc1b6e2c7a4f9d`; an earlier CI failure exposed a stale Telegram redaction test assertion. That test now checks both Telegram ID and authVersion redaction; new CI run 45628963545 is in progress.
- PR #308 latest exact head and CI run 45629379626 are in progress.

### Batch 6 status
- BAST state visibility, synthetic document data, active-loan matching, and owner-domain labeling: source-reviewed; confirmed UI/data integrity issues are addressed in PR #308.
- No database records are created or changed by BAST document generation in this change.
- Do not merge PR #306 or #308 until CI passes on their exact latest heads.

## 13. Batch 7 — secondary Auditor fallback consistency (2026-11-25)

### Confirmed compatibility-path defect
- `GabahService.isAuditor()` already recognizes Auditor in `role_keys` (additional role), and `isReadOnly()` therefore denies writes for an account whose primary profile is Karyawan and additional role is Auditor.
- `isTicketVisibleToUser()` PostgreSQL path trusts the already scoped API response and is not affected. Its file-store compatibility fallback, however, still checked only `user.role === 'Auditor'` before returning global ticket read visibility.
- Result: an additional Auditor assignment in file-store mode was correctly read-only but saw only tickets reported by that account, rather than the global read-only Auditor ticket view. This is a confirmed behavior inconsistency, not a PostgreSQL authorization bypass.

Fix is open as PR #311:
- URL: https://github.com/inieki-lab/gabah-gas/pull/311
- Branch: fix/auditor-secondary-role-ticket-visibility-v2-2026-11-25
- Exact head: f4f3429866d4b76a3602720810c494e8f5e7dbdb
- Replaces the primary-label check with `this.isAuditor(user)` and adds a source-contract regression assertion.
- CI run 45630883977 was IN_PROGRESS at the time of this worklog update; no green result is claimed.

### Related merged fixes
- PR #308 merged to main as `0171bc6a0a0d9788627f57bcf570d8ebff1ce22d`; exact-head CI run 45630247071 SUCCESS. BAST loan status, permanent assignment document mode, owner-domain labeling, and assignment edit authority are corrected.
- PR #306 merged to main as `42d5852d71271578cacf222834a2bd8fc34509a6`; exact-head CI run 45628963545 SUCCESS. `sanitizeUser()` no longer exposes server-only `authVersion`.
- PR #309 merged to main as `72c4491e83a033e771db39df78a4c169a2b633ba`; exact-head CI run 45629634761 SUCCESS. Batch 6 findings are recorded in the audit worklog.

### Batch 7 status
- Additional Auditor ticket visibility fallback: defect confirmed and fix proposed in PR #311.
- PostgreSQL ticket scope and backend authorization unchanged.
- No ticket records or operational data modified.
- Continue scanning remaining legacy-primary-role branches while PR #311 CI runs.

## 14. Batch 8 — secondary-role UI capability parity (2026-11-25)

### Merged work after Batch 7
- PR #314 merged to main as `0fe041d29301667a53e81112b219d7357fd4f6c4`; exact-head CI run `45632931632` SUCCESS (119/119). It aligns additional IT/GA capabilities across contract creation, vendor/knowledge UI, and notification badges.
- PR #315 is open at exact head `f9ab1553d0fb14380675b5c2541032827c799b9d`; CI run `45633864278` was IN_PROGRESS (48/118 at last poll).

### Confirmed residual UI inconsistency — PR #315
- `AssetsView` file-store compatibility fallback checked only `currentUser.role` for IT/GA, while the canonical profile is Karyawan and functional roles are retained in `role_keys`.
- This hid asset create/import controls for a Karyawan account with an additional IT or GA function in file-store mode. This is a UI compatibility issue, not a PostgreSQL backend authorization bypass.
- Updated fallback to `GabahService.hasLegacyCapability(currentUser, 'it'|'ga')` and added a regression check.
- During test review, found the LicensesView secondary-IT assertion had been appended after `process.exit()` in `asset-scope-policy-verify.mjs`; moved it into the counted `checks` array so CI actually executes it.
- No role assignment, database rows, or asset data changed.

### Other related merged fixes revalidated
- PR #305 merged; its exact-head CI `45627849061` SUCCESS. License workspace requires both `licenses.read` and backing `assets.read`; renewal KPIs derive from actual expiration dates and distinguish overdue from upcoming.
- PR #306 merged; exact-head CI `45628963545` SUCCESS. `sanitizeUser()` excludes server-only `authVersion` from client payloads.
- PR #308 merged; exact-head CI `45630247071` SUCCESS. BAST is hidden before loan approval, permanent assignment BAST no longer synthesizes loan/contact/due-date data, owner division comes from `owner_division`, and edit authority is rechecked.
- PR #311 merged; Auditor additional-role file-store ticket visibility uses effective Auditor membership. PostgreSQL scoped response path unchanged.
- PR #307/#309/#312 are audit documentation batches; merged to main after their CI checks.

### Scope and validation boundary
- Dashboard stats and attention endpoints require `dashboard.read`; assets are resolved through `getScopedAssets`; loans/tickets are filtered by borrower/reporter/assignee plus explicit owner/unit scopes. Global Superadmin/Auditor behavior is explicit.
- Global search is client-side over the already scoped asset/loan/ticket collections; it introduces no separate search endpoint or broader server query.
- Module registry read requires authenticated actor; module audit and status changes require effective Superadmin. Status change requires a validated reason and writes audit history transactionally.
- `GET /api/users` requires `users.read`; `sanitizeUser()` removes password material, Telegram chat ID unless Superadmin, and now authVersion.
- These remain source/CI-contract observations. No new live browser UAT or production PostgreSQL UAT was performed in this session.

### Batch 8 status
- Secondary IT/GA UI consistency: one residual AssetsView fallback fixed in PR #315; CI pending.
- PR #314 and all merged PRs above are on main; PR #315 must not merge until exact-head CI succeeds.
- Continue checking remaining frontend compatibility helpers and endpoint-level object scope; do not stop while PR #315 CI is running.

## 15. Batch 9 — reconciliation external-number input validation (2026-11-25)

### Confirmed validation gap — PR #317
- `POST /api/reconciliation/link` required `reconciliation.link` and asset owner mutation authority, but accepted `corporateAssetNumber` without type/length/NUL validation before calling `.trim()`.
- Non-string input could throw a TypeError instead of a controlled 400; oversized or NUL-containing values could be persisted to the external identifier and audit trail.
- PR #317 validates string/null/undefined, caps text at 120 characters, rejects NUL, trims values, treats blank as unlink, and distinguishes link/unlink audit descriptions. Existing permission and owner-scope checks remain unchanged.
- Exact head `b555659f167e044f763b05e7211fab3c2da55dd3`; CI pending. Regression source-contract was added to `asset-scope-policy-verify.mjs`.

### Concurrent PR state at this update
- PR #315 exact head `f9ab1553d0fb14380675b5c2541032827c799b9d`; CI run `45633864278` in progress (48/118 at last poll).
- PR #316 is the documentation PR for Batches 8–9; CI pending after its latest update.
- PR #317 is the reconciliation input-validation fix; CI pending.
- PR #314 merged successfully; no changes are made to primary profile definitions or role templates by PR #315/#317.

### Batch 9 status
- Reconciliation write authorization and input validation: source-reviewed; input-validation correction proposed in PR #317.
- No production DB, asset, or reconciliation records changed.
- Continue independent source review while both code PRs await CI.

### CI completion and merge update (2026-11-25)
- PR #315 merged to main as `e376f44dc61d1616cdbbcf94478d9f3516cadd8d`; exact-head CI run `45633864278` SUCCESS (119/119).
- PR #317 merged to main as `b34492d76ba2f72260241d1e4d0e5d4c37725f11`; exact-head CI run `45634628920` SUCCESS (119/119).
- PR #316 documentation CI run `45634694803` was still IN_PROGRESS (79/118 at last poll); the latest documentation update will start a fresh exact-head run.
- Main branch CI run `45634781924` on `e376f44dc61d1616cdbbcf94478d9f3516cadd8d` was IN_PROGRESS at last poll; PR #317 merge triggers a new main run.



## 16. Batch 10 — ticket workflow authorization and mutation integrity (2026-11-25)

**Base:** `main` @ `db1e91e96e16023b98e4c62eeeb97fab5c259316` (after PR #316 merge).  
**Method:** Static source review of ticket routes, shared scope helpers, UI/API contract tests, and CI result. No live DB or browser mutation was performed.

### Reviewed paths and controls

- `GET /api/tickets/:id/assignees` and `PATCH /api/tickets/:id/assignment`: require `tickets.assign`, then enforce object-level owner-division or assigned-unit scope. Read-only actors are rejected by the assignment policy.
- Candidate assignees must be active, non-read-only, non-Superadmin users with `tickets.update` and matching division/unit scope in PostgreSQL. File-store compatibility recognizes secondary functional roles while canonical primary profile remains Karyawan.
- Assignment changes are restricted to `open`/`assigned`; started work returns HTTP 409. New assignee receives an in-app notification, changes are audited, and persistence failure restores ticket/notification/audit snapshots.
- `GET /api/tickets/:id/comments`: requires `tickets.read` plus per-ticket visibility. PostgreSQL query binds ticket ID and joins user display names.
- `POST /api/tickets/:id/comments`: rejects read-only actors; only reporter or authorized operational handler can write. Body must be non-empty text and at most 4,000 characters. Writes use a PostgreSQL transaction; file-store mode returns 503 rather than pretending comments were saved.
- `PATCH /api/tickets/:id/status`: requires authenticated ticket-read capability plus object-level reporter/handler rules, and operational handlers additionally need `tickets.update`. Reporter-only transitions are limited to confirming resolved tickets or reopening closed tickets. State machine rejects skipped transitions.
- Server-computed `allowed_actions` are used by the ticket UI; client controls do not independently grant authority.

### Existing regression coverage found

- `test:ticket-assignment-api`
- `test:ticket-comments-api`
- `test:ticket-reporter-transition`
- `test:ticket-lifecycle-no-skip`
- `test:ticket-mutation-atomicity`
- `test:ticket-allowed-actions`

The scripts assert permission/scope checks, active-user eligibility, read-only handling, state transitions, bounded comment input, transactional persistence, rollback, audit, notifications, and UI/API wiring. These scripts were inspected as source; their execution is not separately claimed here.

### Result

- No new confirmed authorization defect was found in these reviewed ticket paths; no speculative code change was made.
- PR #316 documentation update merged successfully as `db1e91e96e16023b98e4c62eeeb97fab5c259316`.
- PR #316 exact-head CI run `45635218073`: **SUCCESS**; its `verify` job completed successfully.
- No ticket, user, role, scope, notification, or audit records were changed.
- This is not live PostgreSQL/browser UAT and does not authorize production go-live.

### Next batch

1. Review maintenance schedule and work-order endpoints: create/update/delete, assignment, status transitions, vendor linkage, costs, and asset ownership/scope.
2. Check that maintenance write paths preserve server-owned identifiers and do not permit cross-owner asset mutation through client-supplied fields.
3. Review maintenance regression scripts and CI coverage before proposing any code change.


## 17. Batch 11 — maintenance lifecycle and input boundary (2026-11-25)

**Base:** `main` @ `f67934e3a3e613c365d9c6f3d6f83dea7239cee2`.  
**Fix:** PR #319 merged as `ff49b04d2c7d2e782f30e604e1dfcab0971118bb`.

### Confirmed defect and correction

- Before the fix, `validateMaintenanceInput` checked that a status belonged to the enum but `PATCH /api/maintenances/:id` did not enforce a lifecycle. A caller could jump directly from `scheduled` to `completed`, reopen a completed schedule, or create a new schedule already completed.
- The UI exposes the operational flow `scheduled → in_progress → completed`; server enforcement now matches that flow while retaining explicit `overdue` and `cancelled` paths:
  - `scheduled → in_progress | overdue | cancelled`
  - `overdue → in_progress | cancelled`
  - `in_progress → completed | cancelled`
  - `completed` and `cancelled` are terminal.
- New schedules must start as `scheduled`; the server does not accept a client-supplied initial terminal/work status.
- `last_completed_at` is written only when the schedule actually transitions into `completed`, not on unrelated edits to an already-completed schedule.
- The input validator now rejects null, undefined, array, and non-object JSON payloads before route code dereferences fields.

### Regression and CI evidence

- Extended `scripts/maintenance-authz-verify.mjs` with live HTTP assertions for null payloads, initial-completed creation, skipped transition rejection, valid start/completion, and terminal completion.
- Extended `scripts/maintenance-input-validation-verify.mjs` with lifecycle and object-payload source-contract assertions.
- Initial exact-head CI `45638372764` caught a stale source-test expectation after the stricter body validation change; this was a test-contract mismatch, not a runtime failure. The test was corrected.
- Final exact-head CI run `45639035905`: **SUCCESS**. Typecheck, production build, Docker runtime smoke, PostgreSQL 17 fresh-database/persistence, P0 live HTTP security, maintenance authorization live HTTP, maintenance dynamic-scope, vendor reference, and maintenance input/lifecycle checks all completed successfully.
- PR #319 merged to main as `ff49b04d2c7d2e782f30e604e1dfcab0971118bb`.

### Boundaries

- No schema migration or production maintenance record was changed.
- CI verifies isolated test data only; no production browser UAT or owner sign-off was performed.

## 18. Batch 12 — notification recipient ownership and contract document file access (2026-11-25)

**Review basis:** `main` after PR #319 merge. Static route/domain review plus existing CI regression source and PostgreSQL integration coverage.

### Notification recipient authorization

- `GET /api/notifications` requires `notifications.read` and returns only records accepted by `isNotificationRecipient`.
- Recipient precedence is explicit user ID, then assigned unit, then effective role, then division. A user-specific recipient cannot be widened by notification title/message text.
- `PATCH /api/notifications/:id/read` requires `notifications.read` and returns 404 for a missing or non-recipient notification; `POST /api/notifications/read-all` separately requires `notifications.read_all` and only marks the actor's own recipient set.
- Unit-targeted ME ticket notifications use explicit unit scope in PostgreSQL; file-store compatibility uses the ME function capability.
- Existing `test:notification-recipient-rbac` is a source-contract test. No dedicated live HTTP recipient-IDOR matrix was found in the current CI workflow; retain this as a UAT/test-coverage gap rather than claiming runtime proof.

### Contract document upload/download and notification logs

- Upload middleware requires `contracts.documents.upload`, resolves the contract, and verifies `canEditContract` before multipart parsing. The handler rechecks permission/scope before writing.
- Uploads enforce bounded multipart resources/concurrency, validate file signatures, normalize names, generate random storage names, write under a contract-specific directory, and remove file/metadata on failed persistence.
- Download requires `contracts.read` and `canSeeContract`; inaccessible contracts/documents return 404. File paths are constrained to the contract-specific storage directory; documents are not served from a public static directory.
- `scripts/cr04-cr05-verify.mjs` covers invalid signatures, upload persistence, exact-byte download, out-of-scope Karyawan denial, authorized Auditor additional-role download, and bytes surviving application restart. `scripts/upload-security-verify.mjs` covers concurrency and multipart bounds.
- `GET /api/contracts/:id/notification-logs` requires `contracts.read`. `getNotificationLogs` uses effective Superadmin/Auditor checks; other users see logs only for contracts returned by `listContracts(user)`. No display-label-based global access fallback remains.

### Result and next work

- No new confirmed notification recipient or contract file-access bypass found in the reviewed paths.
- Contract document upload/download has live PostgreSQL integration coverage in CI; notification recipient isolation remains source-contract coverage and should receive a focused live HTTP negative test.
- Next: add a disposable-user notification recipient IDOR HTTP matrix, then continue direct-ID authorization review for remaining administration/master-data and download endpoints. Keep browser UAT and release gates open.


## 19. Batch 13 — role-targeted notification privacy correction (2026-11-25)

**Confirmed defect:** `isNotificationRecipient` passed the notification's functional `recipient_role` label through `primaryRoleKey()`. That helper intentionally maps user-facing primary profile labels to the canonical `superadmin` or `karyawan` profile. It is not a function-role normalizer. Because operational users have the canonical Karyawan primary profile plus additional function roles, an IT/GA/Humas notification could be matched against Karyawan rather than its intended function role. This could make notifications invisible to the intended operator or visible to unrelated Karyawan users.

### Correction

- Added `notificationRoleKey()` to normalize functional recipient labels independently from primary profile mapping.
- `isNotificationRecipient` now resolves role recipients against effective function roles in PostgreSQL and legacy function-role labels in file-store mode.
- Explicit user recipient precedence remains unchanged; unit/division recipient behavior remains unchanged.
- Unknown role labels fail closed because they do not match an assigned effective role.

### Live regression coverage

- Extended `test:notification-recipient-rbac` with an isolated live HTTP server in file-store mode.
- The test covers IT role notification `NOTIF-001`, GA role notification `NOTIF-002`, Humas role-only notification `NOTIF-HUMAS-001`, and an IT ticket notification targeted by division.
- Cross-role list visibility is denied; cross-role `PATCH /api/notifications/:id/read` returns 404; the intended recipient can mark their own notification read.
- The live test uses canonical test credentials, an OS-assigned localhost port, disables PostgreSQL by setting an empty `DATABASE_URL`, and restores/removes its disposable state snapshot.

### CI and merge

- Initial CI run `45641006835` failed in the new test harness because its credential-file parser split on the literal characters `\\n` instead of actual newlines. Application typecheck/build and earlier suites passed; the login failures were test setup failures, not an application authorization result.
- Corrected the parser and retained explicit file-store isolation.
- Final exact-head CI run `45641748515`: **SUCCESS**. Full verify job passed, including TypeScript, production build, Docker runtime smoke, PostgreSQL 17 fresh database/persistence integration, P0 live HTTP security, notification recipient live HTTP, and the complete regression suite.
- PR #321 merged to main as `e87e6a107e3f4cdf8d9be15e9f5de94836fdaf82`.

### Validation boundary

- The live recipient matrix verifies file-store compatibility. PostgreSQL effective-role resolution is covered by the source contract and the full PostgreSQL CI integration; the new recipient matrix is not yet a dedicated PostgreSQL multi-role notification fixture.
- No production notifications or user-role assignments were modified.
- Browser UAT remains required for real role personas and production notification delivery.

### Next batch

1. Continue direct-ID endpoint review for user administration, master data, knowledge records, and download handlers.
2. Add runtime negative tests where source-only assertions are still the only evidence.
3. Keep the production release gates open until per-persona browser UAT, legacy database upgrade rehearsal, backup/restore, staging deploy/rollback, and owner sign-off are recorded.


## 20. Batch 14 — direct-ID administration and master-data authorization (2026-11-25)

**Review basis:** source review of `server.ts`, RBAC helpers, domain services, and current CI regression inventory. No production records were modified.

### User and Dynamic RBAC administration

- No `GET /api/users/:id` endpoint exists. `GET /api/users` requires `users.read` in PostgreSQL; file-store compatibility limits it to Superadmin, IT, and GA. Returned records pass through `sanitizeUser`, excluding password material, server-only authVersion, and Telegram chat ID except for Superadmin.
- `POST/PATCH/DELETE /api/users/:id` and password reset are Superadmin-only. The update/delete paths validate primary profile values and preserve last-active-Superadmin protections.
- Dynamic role/permission/scope mutations require effective Superadmin, validate active role IDs and scope values, and persist through the RBAC transaction layer.
- Module audit history and module activation changes are Superadmin-only; module keys and change reasons are validated and changes are audited.

### Master data and taxonomy

- Authenticated users can read reference masters (divisions, job levels, organizational units, office/asset locations, facility locations, and taxonomy lookups). These endpoints return reference data only; no account secrets or operational records were found in the reviewed responses.
- Master-data mutations are Superadmin-only. Direct-ID updates first resolve the target and return 404 when the ID is absent.
- Organization-unit updates validate the referenced division and strict boolean `is_active`; office/asset-location updates validate active flags and asset-location parent/cycle rules.
- Taxonomy deletion is guarded when categories are referenced; asset-location hierarchy uses disable rather than hard delete.
- `PATCH /api/knowledge/:id` requires `knowledge.update`, resolves the article ID, and uses an explicit field allowlist; vote/view counters have dedicated endpoints and permissions. Knowledge articles are global internal guidance, so no per-owner object scope is expected.

### Direct operational IDs

- Asset detail uses the same `getScopedAssets(actor)` resolver as the list; out-of-scope direct reads return 404.
- Asset update/assign/move/lifecycle routes require the corresponding operation permission and shared owner-scope policy. The mutation routes currently return 403 for a known but out-of-scope asset; this is consistent with existing regression expectations, while read detail conceals it with 404. This is a response-code consistency/privacy consideration, not a demonstrated data disclosure of asset fields.
- Loan, ticket, maintenance, vendor, contract-document, room-reservation, and module direct-ID routes were previously reviewed in their respective batches; no new bypass was found in this pass.
- Meeting type/facility updates require their dedicated manage permissions and domain-service ID/reference checks.

### Existing regression evidence

- `test:user-admin-validation`, `test:primary-role-policy`, `test:module-lifecycle-api`, `test:numbering-rules`, `test:org-master-active`, `test:division-reference-integrity`, `test:t2b1`, `test:t2b2`, `test:t2b3`, `test:asset-scope-policy`, and `test:asset-mutation-http-status` cover the reviewed areas.
- PR #322 documentation update merged as `9d2873972d3b541990fc521556cec1b1d972fef0`; exact-head CI run `45642438601`: **SUCCESS, 119/119**.

### Remaining caveats

- The legacy facility `PATCH /api/master/locations/:id` path has weaker field-type validation than the newer organization/asset-location masters. Malformed non-string fields can yield a 500; no authorization bypass was found. Track as input-hardening work, not an access-control defect.
- Several master-data read endpoints intentionally rely on global session authentication rather than per-role read permissions. Revisit only if master data becomes confidential or contains operational personal data.
- No full browser UAT by each operational persona was performed.

### Next batch

1. Review direct-ID mutation response consistency and object-level scope across assets/loans/tickets/contracts/rooms.
2. Add negative tests for any remaining source-only scope checks.
3. Keep production release blocked on browser UAT, database upgrade rehearsal, backup/restore, staging deployment/rollback, and business-owner sign-off.


## 21. Batch 15 — legacy facility-location payload validation and atomicity (2026-11-25)

**Confirmed defect:** `POST/PATCH /api/master/locations` used `.trim()` on client-supplied fields without validating their types. On PATCH, an earlier valid field (such as `name`) could be mutated before a later invalid field (such as numeric `address`) threw a TypeError. The route then returned 500 while leaving the in-memory object partially changed.

### Correction

- Reject null, array, and non-object JSON payloads before accessing fields.
- Validate `name`, `address`, and `capacity` as strings, enforce maximum lengths, and reject NUL bytes.
- Reject blank names.
- Validate the complete PATCH payload before changing any field; invalid requests leave the existing record unchanged.
- New facility-location IDs use `crypto.randomUUID()` rather than millisecond timestamps.

### Regression and CI

- Extended live `scripts/org-model-verify.mjs` checks:
  - PATCH with valid name plus invalid numeric address returns 400.
  - Follow-up GET confirms the name was not partially changed.
  - PATCH with JSON null returns 400.
  - POST with a non-string name returns 400.
- PR #324 merged as `a5a104909dba68eb68132ce24825d55035625cdb`.
- Exact-head CI run `45643550850`: **SUCCESS**. TypeScript, production build, Docker runtime smoke, PostgreSQL 17 integration, P0 live HTTP security, organization-model live HTTP checks, and the full 118-step verification workflow passed.

### Boundary

- No schema migration or existing facility-location record was changed.
- The route remains Superadmin-only; this fix hardens malformed input and atomicity, not role grants.
- Browser UAT of the facility master screen remains part of release acceptance.

### Next batch

1. Review consistency of 403/404 behavior for direct-ID mutations without changing existing role contracts accidentally.
2. Add runtime negative tests for any remaining source-only authorization assertions.
3. Continue per-persona browser UAT preparation and keep production go-live blocked until backup/restore, migration rehearsal, staging deploy/rollback, and owner sign-off are recorded.


## 22. Batch 16 — direct-ID mutation response semantics (2026-11-25)

**Review basis:** source review of object-level guards and existing regression assertions after Batches 10–15. No application behavior was changed in this batch.

### Read and mutation response behavior

- Scoped read detail paths conceal missing/out-of-scope records with 404: asset detail uses `getScopedAssets`; contract detail uses `canSeeContract`; ticket detail actions use `canAccessTicket`; notification read uses recipient membership.
- Mutations require the corresponding operation permission before invoking the domain method. Asset update/assign/move/lifecycle and maintenance/vendor update paths additionally check owner scope; ticket actions check per-ticket visibility; contract mutation uses `canEditContract`; room reservation check-in/out/cancel allows the organizer or an explicitly authorized GA operator.
- Vendor update checks both the existing owner and requested new owner scope before applying a transfer, preventing a user from moving a vendor out of or into a domain they cannot manage.
- Room approval/rejection remains a GA operation guarded by `room_reservations.approve/reject`; organizer self-service applies to check-in/out/cancel as configured by the domain policy.
- Some mutation endpoints return 403 for a known but out-of-scope ID while corresponding read endpoints return 404. These mutation errors return no protected record payload; the asset and maintenance messages may disclose the owner-domain label. Existing tests explicitly expect 403 for operation authorization failures. This is a response-consistency/privacy consideration, not a demonstrated authorization bypass; do not mass-convert to 404 without product/security decision and updated tests.

### Evidence

- `test:asset-mutation-http-status`, `test:asset-scope-policy`, `test:maintenance-authz`, `test:maintenance-dynamic-scope`, `test:ticket-assignment-api`, `test:ticket-comments-api`, `test:ticket-reporter-transition`, `test:loan-authz`, `test:contract-owner-filter`, `test:meeting-room`, and `test:room-domain-persistence` cover the reviewed mutation/read paths.
- PR #325 documentation update merged as `e4918deb6c79592b4034551d30c7fd1f8145ea64`; exact-head CI run `45644113840`: **SUCCESS, 118/118**.

### Result and next stage

- No new direct-ID authorization bypass was confirmed in this pass.
- Endpoint authorization static/live regression coverage is substantially broader, but it does not replace browser UAT with actual business personas.
- Next release work is operational acceptance: per-persona browser UAT, migration rehearsal against a copy of the existing PostgreSQL database, backup/restore verification, staging deployment and rollback rehearsal, and named business-owner sign-off. Do not declare production-ready until those are recorded.


### Addendum — AUTHZ-01 generic read-only implementation (26 November 2026)

PR #301 (`adc706edcb038b41a35bbfb2ea429f0293777169`) is merged to `main`. GitHub Actions CI run `45625865976` (#3534) completed SUCCESS. The custom-role integration fixture in `scripts/cr04-cr05-verify.mjs` deliberately combines `security.read_only` with `assets.create` and `assets.update`; effective permissions retain only explicit read capabilities, while POST asset creation returns 403. The generic policy does not identify the user as Auditor, preserving the separation between deny-write and global observer visibility. Browser UAT and direct-ID/out-of-scope checks remain open.
