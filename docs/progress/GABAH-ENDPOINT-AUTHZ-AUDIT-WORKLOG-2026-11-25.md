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
