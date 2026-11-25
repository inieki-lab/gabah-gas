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
| AUTHZ-01 | MEDIUM | Read-only behavior on `main` is still tied to the fixed `auditor` role key. A custom Dynamic RBAC role cannot receive the same explicit deny-write policy marker. This is a capability/configuration gap, not evidence that a custom role currently bypasses a granted deny-write rule. | `server/rbac-policy.ts` exports `isAuditorActor`; `server/runtime-hardening.ts` blocks mutations based on Auditor identity; `docs/IMPLEMENTATION-TRUTH-REGISTER.md` already records this as PARTIAL. PR #301 proposes `security.read_only` and generic deny-write behavior. PR #301 exact-head CI run 45573751004 is SUCCESS, but PR remains OPEN and its code is not in `main`. |
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
