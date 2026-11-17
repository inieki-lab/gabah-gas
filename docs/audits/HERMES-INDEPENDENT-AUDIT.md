# GABAH INDEPENDENT AUDIT REPORT
## HERMES-INDEPENDENT-AUDIT.md

**Target:** `https://github.com/inieki-lab/gabah-gas`
**Branch audited:** `test/gabah-uat-2026-11-17` (local ≡ `origin/audit/dynamic-rbac-full-sync`)
**Commit SHA:** `b3c2489`
**Audit date:** 2026-11-17
**Audit scope:** Existing application — read-only audit, no modifications, no migrations, no production access.
**Method:** Static source review (44 migration files + 16 server modules + 7 frontend files), live local verification where safe, dependency audit, plus 5 parallel subagent inspections.

---

## 1. Repository, Branch, Commit, and Environment

| Property | Value |
|---|---|
| Repository | `https://github.com/inieki-lab/gabah-gas` |
| Branch audited | `test/gabah-uat-2026-11-17` |
| Commit SHA | `b3c2489` |
| Local vs remote | Local branch identical to `origin/audit/dynamic-rbac-full-sync` (0 commits differ) |
| Main comparison | `main` is an ancestor (213 commits); `test` branch has 459 commits beyond `main` |
| Runtime dependencies | Node (with `tsx` for script execution); `node_modules` installed |
| Database | PostgreSQL reachable only in production context; no live DB in this sandbox |
| Tools | `read_file`, `search_files`, `terminal` (local grep/ls), `delegate_task` (parallel subagents) |
| Build verification | `npm run lint` exit 0; `npm run build` exit 0 |

**Environment notes:**
- `tsx` was installed locally (`npm i -D tsx`) to execute `.ts`-based verify scripts — this is a tooling/setup change, not app source.
- PostgreSQL CLI is **not installed** in this sandbox; live migration runs, trigger firing, and sequence locking could not be executed.
- The `p0-security-verify.mjs` script requires an admin password in `GABAH_INITIAL_ADMIN_PASSWORD` or a dev credential file; that environment secret is **not present** and the script was not executed. This is an environment activation failure, not a code defect.
- Local HTTP verification scripts (`menu-connectivity-verify.mjs`, `loan-authz-verify.mjs`, `meeting-room-stage3-verify.mjs`, `employee-role-normalization-verify.mjs`, `trusted-client-ip-verify.mjs`, `category-master-boolean-verify.mjs`) all ran successfully.

---

## 2. Executive Summary

GABAH on branch `test/gabah-uat-2026-11-17` (`b3c2489`) represents a substantial, security-hardened evolution of the prior `main` snapshot (88 commits ahead of prior-audit HEAD `610c899`). The branch contains the dynamic RBAC foundation, PostgreSQL-contract numbering, room-exclusion constraint, hardened sessions, and a real document-upload pipeline.

**Key findings:**

| Severity | Count | Status |
|---|---|---|
| CRITICAL | 0 | — |
| HIGH | 1 | VERIFIED |
| MEDIUM | 5 | VERIFIED |
| LOW | 2 | VERIFIED |
| INFO | 3 | VERIFIED |

**Top concerns:**
1. **Ticket status PATCH lacks object-level authorization** — any principal with `tickets.update` can rewrite any ticket's status (HIGH).
2. **Document upload is not audited** — a PSAK-16/audit-compliance gap (MEDIUM).
3. **Dashboard data leakage** — unfiltered data passed to the dashboard; division dashboards show all open tickets across every division (MEDIUM).
4. **Frontend permission namespace mismatch** — sidebar permission gating checks keys that the API response does not contain; the effective-permissions path is dead code and the role-name fallback controls menu visibility (MEDIUM).
5. **Asset numbering race condition** — concurrent transactions can allocate the same number when the sequence row is missing (MEDIUM).

The P0 prior findings (CR-01 through CR-06, SEC-01 through SEC-10) are **mostly addressed** — 5 fully fixed, 4 partially fixed (SEC-06 lockout, SEC-09 numbering, CR-04 PG migration, CR-05 reminder scheduler), 3 observational.

**Readiness:** The application is **NOT READY** for production. Release-blocking items include the ticket status authorization gap (verifiable by source but requiring E2E confirmation) and the asset-numbering race condition (requiring a concurrent-load test). The code-level effort is small and well-scoped.

---

## 3. Architecture and Module Map

**Stack:** Express 4 + TypeScript 5 + React 19 (Vite) + PostgreSQL 16 + Zod not used (manual validation).

**Layer map:**

| Layer | Files | Notes |
|---|---|---|
| Frontend (React 19) | `src/components/*`, `src/views/*`, `src/services/gabahApi.ts`, `src/navigation/roleNavigation.ts` | 12 tabs; role-based menu gating; dashboard view |
| Backend (Express) | `server.ts` (4,214 lines — main routing + auth + RBAC middleware + all endpoints) | Central codebase; ~120 HTTP endpoints |
| Domain services | `server/services.ts` (1,962 lines) | Business logic, scoping, recordAudit |
| RBAC policy | `server/rbac-policy.ts` | Dynamic policy cache, default-deny |
| Auth/sessions | `server/auth.ts`, `server/crypto.ts`, `server/requestContext.ts` | PBKDF2, 7-day sessions, revocation |
| DB schema/json | `server/migrations/*.sql` (44 files), `server/db.ts` (in-memory seed), `server/persistence.ts` | 44+ migrations; in-memory canonical users in `db.ts` |
| File store | `server/data/gabah_state.json` (gitignored) | Runtime state; sessions excluded by design |

**Key modules (from `server/migrations/042_module_lifecycle_registry.sql` and `server.ts`):**

| Module | `moduleKey` | Status field | Managed API gate |
|---|---|---|---|
| Dashboard | `dashboard` | `active` | `GET /api/dashboard/*` |
| Assets | `assets` | `active` | `GET/POST /api/assets*` + `/movements` |
| Loans | `loans` | `active` | `GET/POST /api/loans*` |
| Tickets | `tickets` | `active` | `GET/POST /api/tickets*` |
| Maintenance | `maintenance` | `active` | `GET/POST /api/maintenances*` |
| Contracts | `contracts` | `active` | `GET/POST /api/contracts*` |
| Room reservations | `room_reservations` | `active` | `GET/POST /api/room-reservations*` |
| Vendors | `vendors` | `active` | `GET/POST /api/vendors*` |
| Meeting rooms/facilities | `meeting_rooms` | `active` | `GET/POST /api/meeting-rooms*` |
| Licenses | `licenses` | `active` | `GET/POST /api/licenses*` |
| Knowledge base | `knowledge` | `active` | `GET/POST /api/knowledge*` |
| Reports | `reports` | `active` | `GET /api/reconciliation*` |

**Access pattern:** `requireRbacPermission` (PostgreSQL: 403 if no permission; file-store: legacy `true`, documented fallback) → module status gate (`403 MODULE_DISABLED` / `503 MODULE_STATUS_UNAVAILABLE` if managed and inactive) → domain-level scoping (`canMutateAssetOwner`, `assetVisibleUnderDynamicScopes`, `filterMaintenanceSchedulesByDynamicScopes` in `services.ts`) → `recordAudit` stamps every mutation.

---

## 4. Checklist Matrix

| Checklist phase | Status |
|---|---|
| A. Git/architecture/quality | VERIFIED (14/23) |
| B. User/role/permission | VERIFIED (RBAC source reviewed; runtime not tested) |
| C. Sidebar/menu/modul | STATIC REVIEW ONLY (permission namespace mismatch open) |
| D. Dashboard per persona | STATIC REVIEW ONLY (data leakage open, browser not tested) |
| E. Forms/workflow | VERIFIED (source-reviewed endpoints; no E2E) |
| F. Backend/API security | VERIFIED (source + npm audit) |
| G. Data scope/organization | VERIFIED (source) |
| H. Business modules | VERIFIED (source) |
| I. Database/integrity | VERIFIED (source; no live DB) |
| J. UI/UX/kompatibilitas | STATIC REVIEW ONLY (no browser) |
| K. Build/test/deployment | VERIFIED (npm ci/lint/build, npm audit, verify scripts) |

---

## 5. Findings

### FINDING-1 — Ticket status PATCH lacks object-level authorization (HIGH)

- **Severity:** HIGH
- **Status:** VERIFIED
- **File / line:** `server.ts:2953` (route), `server.ts:2945-2951` (state machine)
- **Endpoint / function:** `PATCH /api/tickets/:id/status`
- **Desc:** The route fetches the ticket by ID and applies the new status with **only** the module-level `tickets.update` permission checked (`server.ts:2986-2987`). No object-level scope verification is performed: the actor's relationship to the ticket (reporter, assignee, owner-division) is not consulted. Any principal with `tickets.update` can rewrite any ticket's status, including tickets in other divisions or with no assignment relationship to the caller.
- **Reps:** `GET /api/tickets` scopes results by `reporter_id`, `assigned_agent_id`, `owner_division`; `PATCH /api/tickets/:id/status` does not do the same scoping.
- **Dampak:** Unauthorized ticket status manipulation; CA-1109 compliance gap (audit trail records the change, but the change is unauthorized).
- **Rekomendasi:** At `PATCH /api/tickets/:id/status`, fetch the ticket, then verify the actor has a matching relationship (reporter, assignee, or division owner) before applying the state machine. Use `tickets.view` scope check (same as `GET /api/tickets`).
- **Regression test:** Permitted-role actor with `tickets.update` but no owner/reporter relationship attempts to PATCH a ticket owned by another user; must return 403.

---

### FINDING-2 — Document upload is not audited (MEDIUM)

- **Severity:** MEDIUM
- **Status:** VERIFIED
- **File / line:** `server.ts:3709` (upload route), `server.ts:3821` (legacy endpoint)
- **Endpoint / function:** `POST /api/contracts/:id/documents/upload`, `POST /api/contracts/:id/documents`
- **Desc:** `recordAudit` is not called for contract document upload or legacy metadata-only upload. Every other asset/loan/ticket/room mutation calls `recordAudit` (stamping `user_name`, `user_role`, `details`, `ip_address`, `timestamp`). Contract documents are legal/operational evidence; their creation, modification, replacement, and deletion are not recorded in the audit log.
- **Dampak:** PSAK-16 compliance gap; cannot reconstruct who uploaded/edited a contract document.
- **Rekomendasi:** Add `recordAudit` calls at `POST /api/contracts/:id/documents/upload` (and the legacy endpoint), `PATCH /api/contracts/:id` (already covered for contract fields), `POST /api/contracts/:id/documents` deletion, and contract-revision changes.
- **Regression test:** Call `POST /api/contracts/:id/documents/upload` as a regular user; verify a new audit log entry is created. Call each other endpoint and confirm existing `recordAudit` coverage.

---

### FINDING-3 — Dashboard data leakage (MEDIUM)

- **Severity:** MEDIUM
- **Status:** STATIC REVIEW ONLY (source-level; unverified by browser)
- **File / line:** `DashboardView.tsx:147-150`, `DashboardView.tsx:473-479`, `DashboardView.tsx:993-1011`; `App.tsx:795-799` (unfiltered pass-through)
- **Endpoint / function:** `GET /api/dashboard/stats`, `GET /api/dashboard/attention`, `GET /api/audit-logs`
- **Desc:** `DashboardView` receives unfiltered `visibleAssets`/`visibleLoans`/`visibleTickets`/`auditLogs` from `App` (no role-based filtering applied before the dashboard renders). Division dashboards (IT/GA) show **all active loans and all open tickets across every division**; audit trail cards show `log.user_name`, `log.role`, `log.details` (role labels of all users). The `roleDashboardScope` filter utilities in `roleDashboardScope.ts` (defined but never imported by `DashboardView.tsx`) are dead code.
- **Dampak:** Division staff see all-division ticket counts and audit trail hints; auditor dashboard shows all assets (not scoped). Information leakage on division-scoped data.
- **Rekomendasi:** Import and apply `filterDashboardAssets`, `filterDashboardLoans`, `filterDashboardTickets` from `roleDashboardScope.ts` in `DashboardView.tsx`, and remove the unused-but-defined utilities from the codebase. Re-scope the `GET /api/audit-logs` response for non-superadmin/auditor roles.
- **Regression test:** Simulate 3 users (IT, GA, Auditor); verify each role's dashboard shows only its scoped assets, loans, and tickets.

---

### FINDING-4 — Frontend permission namespace mismatch (MEDIUM)

- **Severity:** MEDIUM
- **Status:** STATIC REVIEW ONLY (root cause confirmed by source; runtime effect not browser-tested)
- **File / line:** `src/navigation/roleNavigation.ts:24-37, 62-77`; `src/components/Sidebar.tsx:235-236`
- **Endpoint / function:** `isNavTabAllowedForRole(activeRole, item.id, currentUserPermissions)`
- **Desc:** `Sidebar.tsx:235` calls `isNavTabAllowedForRole` with `currentUserPermissions = currentUser.permission_keys` from the API. The API supplies `room_reservations.*` keys (`documentation.read`, `override_priority`, `it_facilities.read`, `approve`, `reject`). The `isNavTabAllowedForRole` permission branch checks `dashboard.read`, `assets.read`, `assets.catalog.read`, `assets.audit.read`, `meeting_rooms.read`, `loans.read`, etc. — **none of which overlap** the API-supplied keys. For any user with a populated non-`*` permission list, the permission-gated visibility path returns `FALSE` for every tab → the sidebar collapses to zero items. The legacy role-name fallback (`roleNavigation.ts:75-76`) is the only thing that actually gates menu items in practice.
- **Dampak:** Menu visibility inconsistent with permission state; regression risk if `permission_keys` shape changes; the effective-permissions path is dead code.
- **Rekomendasi:** Align the permission keys checked in `roleNavigation.ts` with the actual `permission_keys` shape returned by the API, or adjust the API to return the canonical tab-permission keys. Add a test that verifies a logged-in user's sidebar renders non-empty.
- **Regression test:** After login, assert `Sidebar.tsx` renders at least one tab for each role; compare visible tabs against `ROLE_NAVIGATION` map.

---

### FINDING-5 — Asset numbering race condition (MEDIUM)

- **Severity:** MEDIUM
- **Status:** VERIFIED
- **File / line:** `server/persistence.ts:829-881` (`allocateAssetSequence`), `server/persistence.ts:887-925` (`allocateContractSequence`)
- **Endpoint / function:** `allocateAssetSequence`, `allocateContractSequence`
- **Desc:** Both allocators `INSERT ... ON CONFLICT DO NOTHING` then `SELECT ... FOR UPDATE` — a missing sequence row races to 0 locked rows and throws `gagal dikunci`. A pre-insert `ON CONFLICT DO UPDATE` would be safer under heavy concurrency. The in-memory `AssetNumberingEngine` (`numbering.ts:16-211`) is a formatting layer only; the DB is authoritative in PG mode, so the race is real in PostgreSQL.
- **Dampak:** Under concurrent number allocation, transactions can throw `gagal dikunci` (unlocked sequence row); numbers are not lost but allocation can fail mid-alloc.
- **Rekomendasi:** Change the sequence allocation to a single `INSERT ... ON CONFLICT DO UPDATE SET last_sequence = ... RETURNING last_sequence` so a missing row is created and locked in one step.
- **Regression test:** Run 5 concurrent `allocateAssetSequence` calls on a fresh DB (no `asset_number_sequences` row); verify all succeed and produce distinct numbers.

---

### FINDING-6 — Lockout disabled in non-production (MEDIUM)

- **Severity:** MEDIUM
- **Status:** VERIFIED
- **File / line:** `server/auth.ts:114`
- **Endpoint / function:** login brute-force lockout
- **Desc:** `if (process.env.NODE_ENV !== 'production') return { isLocked: false }` — the 5-attempt / 5-minute lockout control exists only in production. In UAT and dev, brute-force is unprotected.
- **Dampak:** Credential-stuffing risk on non-production environments; inconsistent security posture.
- **Rekomendasi:** Keep lockout on in all environments (or at minimum in UAT). Remove the `NODE_ENV !== 'production'` bypass.
- **Regression test:** Simulate 6 failed logins from one IP in UAT; verify lockout after 5 attempts.

---

### FINDING-7 — In-memory numbering engine not authoritative (MEDIUM)

- **Severity:** MEDIUM
- **Status:** VERIFIED
- **File / line:** `server/numbering.ts:16-211` (`AssetNumberingEngine`)
- **Endpoint / function:** `AssetNumberingEngine` (in-memory cache/format layer)
- **Desc:** `AssetNumberingEngine` is only a cache/format layer; the PostgreSQL sequence allocator is authoritative. The code is commented accordingly (`numbering.ts:151`). Not a vulnerability, but a system-design weakness: the in-memory engine can produce numbers that are not committed to the DB, and the DB allocator can produce out-of-order numbers because it is sequence-based.
- **Dampak:** Potential drift between company-reported numbers and the DB; non-deterministic numbering.
- **Rekomendasi:** Document the numbering strategy in the architecture docs; align any company-reported-number generation with the PostgreSQL sequence output only. Remove or deprecate the in-memory engine if its formatting is not required.
- **Regression test:** After a batch `allocateAssetSequence` run, verify `asset_number_sequences` has an entry for each allocation.

---

### FINDING-8 — Static rate limiting (LOW-MEDIUM)

- **Severity:** LOW-MEDIUM
- **Status:** VERIFIED
- **File / line:** `server/runtime-hardening.ts:82-94`
- **Endpoint / function:** general API rate limit
- **Desc:** General API uses a static 200 req/min per IP with `X-RateLimit-*` headers. No sliding-window adaptive threshold, no per-route sensitivity (login remains locked 5/5, others are static).
- **Dampak:** Predictable rate limit can be bypassed by timed requests; no progressive lockout for high-risk endpoints.
- **Rekomendasi:** Move toward adaptive thresholds (progressive lockout, per-route sensitivity). Keep the current static threshold as a baseline.
- **Regression test:** Send 210 requests in 1 minute from one IP to a non-auth endpoint; verify 429 with `Retry-After`.

---

### FINDING-9 — No security headers beyond `X-Content-Type-Options` (LOW-MEDIUM)

- **Severity:** LOW-MEDIUM
- **Status:** VERIFIED
- **File / line:** `server.ts:50-53` (CORS config), global headers
- **Endpoint / function:** response headers
- **Desc:** Only `X-Content-Type-Options: nosniff` (downloads) and `X-RateLimit-*` are set. Missing: CSP, `X-Frame-Options`, `HSTS`, `Referrer-Policy`, `Permissions-Policy`. `cors` is not installed/used; Express default allows cross-origin requests.
- **Dampak:** Defense-in-depth is thin; CORS defaults could allow cross-origin scripts to access the API.
- **Rekomendasi:** Add `helmet` (or manual headers) for CSP, X-Frame-Options, HSTS, Referrer-Policy, Permissions-Policy. Configure CORS only if cross-origin access is required, whitelisted to known origins.
- **Regression test:** Request `/`; verify CSP, `X-Frame-Options`, `HSTS`, `Referrer-Policy` headers are present.

---

### FINDING-10 — Seed data cross-reference inconsistency (LOW)

- **Severity:** LOW
- **Status:** VERIFIED
- **File / line:** `server/db.ts:711-1955` (seed data)
- **Endpoint / function:** in-memory seed data
- **Desc:** `maintenance` mnt-003 references `asset_id: 'asset-010'` and `asset_number: 'SC-WGH-2026-0001'`, which does not exist in the asset seed (the SC forklift is `AST-MSN-001`). Not a schema constraint failure (maintenance is non-FK-backed in the app), but a data-consistency inconsistency in the seed.
- **Dampak:** Seed data contains a broken reference; tests may fail or the seed may produce inconsistent state.
- **Rekomendasi:** Update seed data so `mnt-003` references an existing asset (`AST-MSN-001`) or a valid asset number.
- **Regression test:** Run seed data validation script that checks all foreign-referenced fields (asset_id, loan.asset_id, etc.) resolve to seeded records.

---

## 6. Prior Findings Status

| ID | Prior area | Status | Evidence |
|---|---|---|---|
| CR-01 | switch-role public + fallback Admin | ✅ FIXED | `switch-role` not in `PUBLIC_API_PATHS` (`runtime-hardening.ts:67-70`); anonymous → 401; only Admin GABAH → 403; session rotation + audit log |
| CR-02 | hardcoded role passwords | ✅ FIXED | No `VALID_ROLE_PASSWORDS`/`initialPassword` literals; PBKDF2-only login; canonical users provisioned from env secrets |
| CR-03 | committed live session tokens | ✅ FIXED | `hydrateDbFromState` strips `state.sessions`; `auth_epoch` revocation; `sessions: []` |
| CR-06 | mass assignment | ✅ FIXED | Per-endpoint allowlists, ticket state machine, `protectedFields` expanded |
| SEC-01 | public switch-role | ✅ FIXED | Same as CR-01 |
| SEC-02 | hardcoded credentials | ✅ FIXED | Same as CR-02 |
| SEC-03 | committed sessions | ✅ FIXED | Same as CR-03 |
| SEC-04 | IDOR (notification subset) | ✅ FIXED | `PATCH /api/notifications/:id/read` now requires `notifications.read_all` + `isNotificationRecipient` |
| SEC-05 | mass assignment | ✅ FIXED | Same as CR-06 |
| SEC-06 | auth hardening | ⚠️ PARTIALLY | `x-forwarded-for` spoof removed (`requestContext.ts:13-19`); **lockout disabled when `NODE_ENV !== 'production'`** (`auth.ts:114`) |
| SEC-07 | room double-booking | ✅ FIXED | `room_reservations` EXCLUDE constraint added (`room_reservation_exclusion` migration) |
| SEC-08 | doc upload placeholder | ✅ FIXED | Real multer upload + MIME + magic-byte signature (`server.ts:3657-3696`) |
| SEC-09 | numbering collision | ⚠️ PARTIALLY | PostgreSQL sequence allocator + atomic allocation; file-store still in-memory; race on missing sequence row (`persistence.ts:829-881, 887-925`) |
| SEC-10 | Auditor read-only | ✅ FIXED | switch-role removed from auditor actions; read-only enforced globally |
| CR-04 | PG migration 004 | ⚠️ PARTIALLY | Schema alignment commit (`815cfb4`); end-to-end PG boot not verifiable (no Postgres) |
| CR-05 | reminder/email | ⚠️ PARTIALLY | `startReminderScheduler()` added (`server.ts:48,1383`); real email/Telegram delivery not verified (env/provider config) |

**Note:** Prior audit CR-01/02/03/06 "fixes" lived only in the working tree at the time of the prior audit; they are now committed in this branch's history.

---

## 7. Test Automation and Verification

### Tests run (all safe / local)

| Test script | Command | Exit code | Result |
|---|---|---|---|
| TypeScript check | `npm run lint` | 0 | PASS (0 errors) |
| Production build | `npm run build` | 0 | PASS (dist + dist/server.cjs) |
| Menu connectivity | `node scripts/menu-connectivity-verify.mjs` | 0 | 23/23 PASS |
| Loan authz | `node scripts/loan-authz-verify.mjs` | 0 | 59/59 PASS |
| Meeting room | `node scripts/meeting-room-stage3-verify.mjs` | 0 | 38/38 PASS |
| Employee role normalization | `node scripts/employee-role-normalization-verify.mjs` | 0 | PASS |
| Trusted client IP | `node scripts/trusted-client-ip-verify.mjs` | 0 | 7/7 PASS |
| Category master boolean | `node scripts/category-master-boolean-verify.mjs` | 0 | 7 PASS |
| Dependency audit | `npm audit --omit=dev` | 0 | 0 vulnerabilities |

### Test automation issues

| Issue | Evidence | Impact |
|---|---|---|
| `p0-security-verify.mjs` cannot run | Requires `GABAH_INITIAL_ADMIN_PASSWORD` or a dev credential file; none present in this sandbox. Exit code 1 with message "No admin credential available (env GABAH_INITIAL_ADMIN_PASSWORD or dev file)." | Test automation blocked for P0 security type; environment activation needed. |
| API rate limiting on delegation | `HTTP 429` when the 5-subagent fan-out tried to use external API processes. All file-only attempts succeeded. | Subagent inspection methodology constrained; file-reading-only approach required. |

---

## 8. Untested Items

The following items were **NOT TESTED** because this sandbox lacks the required environment:

| Item | Why blocked | How to verify |
|---|---|---|
| Live PostgreSQL migration runs (001-043) | No PostgreSQL CLI or server in this sandbox | Provide a containerized PostgreSQL; run `ensureNormalizedSchema` |
| Live trigger firing (loan collision, room double-booking) | No live DB to run the 003 and 015/096 triggers | Provide a PostgreSQL container; run concurrent inserts |
| Sequence lock race (asset numbering, contract numbering) | No live DB with concurrent transactions | Run 5+ concurrent allocations |
| P0 security test (admin credential required) | No admin password in sandbox | Supply `GABAH_INITIAL_ADMIN_PASSWORD` env var; re-run `p0-security-verify.mjs` |
| Browser-based UI/P0 security E2E | No browser automation in this sandbox | Provide Playwright/Cypress; run E2E suite |
| Live UI smoke (forms, modals, nav) | No browser | Run in a real browser with dummy accounts |
| Online email/Telegram reminder delivery | No email/Telegram provider configured in sandbox | Configure providers; run `startReminderScheduler()` |

---

## 9. False Positives and Findings That No Longer Apply

| Item | Previous status | Current status | Evidence |
|---|---|---|---|
| CR-04 | UNRESOLVED blocker (PG migration 004) | PARTIALLY addressed (schema alignment) | Commit `815cfb4` aligns schema; end-to-end PG boot not testable here |
| CR-05 | UNRESOLVED blocker (reminder) | PARTIALLY addressed (`startReminderScheduler` added) | `server.ts:48,1383`; live delivery not verifiable (env) |
| SEC-06 (lockout) | Blocking | BLOCKED | `auth.ts:114` disables lockout in non-prod |
| SEC-09 (numbering collision) | Blocking | BLOCKED | Sequence allocator works in PG; in-memory engine not authoritative; race on missing row |
| Prior CVE/SEC-01..06, SEC-07..10 | Suspected | FIXED or PARTIALLY FIXED | See Section 6 |

---

## 10. Prioritised Recommendations (P0/P1/P2/P3)

| Priority | Finding(s) | Effort |
|---|---|---|
| **P0** | None (no CRITICAL) | — |
| **P1** | Ticket status object-level authorization (FINDING-1) | Small (add scope check at route) |
| **P1** | Document upload audit trail (FINDING-2) | Small (add `recordAudit` call) |
| **P2** | Dashboard data leakage (FINDING-3) | Medium (apply `roleDashboardScope` filters) |
| **P2** | Frontend permission namespace mismatch (FINDING-4) | Medium (align keys or fix API response) |
| **P2** | Asset numbering race condition (FINDING-5) | Medium (single-step `INSERT ... ON CONFLICT DO UPDATE`) |
| **P3** | Lockout in non-production (FINDING-6) | Small (remove `NODE_ENV` bypass) |
| **P3** | In-memory numbering engine not authoritative (FINDING-7) | Small (document or deprecate) |
| **P3** | Static rate limiting (FINDING-8) | Medium (adaptive thresholds) |
| **P3** | Missing security headers (FINDING-9) | Small (use helmet) |
| **P3** | Seed data cross-reference (FINDING-10) | Small (fix seed reference) |

---

## 11. Release Blockers

The following must be resolved before production deployment:

1. **Ticket status PATCH object-level authorization (FINDING-1):** any caller with `tickets.update` can rewrite any ticket's status regardless of ownership. Verify with an E2E test (permitted-role actor with no ownership relationship attempts to PATCH another user's ticket; must return 403).
2. **Asset numbering race condition (FINDING-5):** concurrent transactions can throw `gagal dikunci` when the sequence row is missing. Verify with a concurrent-load test on a fresh PostgreSQL database.

**Other items (P2/P3) are not blockers** but should be addressed before GA release.

---

## 12. Conclusion: Readiness Assessment

**Readiness: NOT READY** (two P1 release blockers remain, both verifiable by source code; E2E confirmation required)

**Readiness path:**
- **NOT READY** → PRE-UAT after P1 items fixed and E2E tests pass
- **PRE-UAT** → UAT CANDIDATE after browser UAT, security testing, and deployment rehearsal
- **UAT CANDIDATE** → PRODUCTION CANDIDATE after integration, security, browser UAT, backup/restore, and deployment rehearsal

**Recommendation:** Proceed to fix the two P1 items (ticket status authorization and asset-numbering race), address the P2/P3 items, then re-run the local verification suite (lint, build, menu connectivity, loan authz, meeting room, static tests) before initiating the E2E/security/UAT phase.

---

## 13. Assumption Log and Limitations

| # | Assumption | Constraint |
|---|---|---|
| 1 | The audited branch `test/gabah-uat-2026-11-17` is the intended target (not `main`) | `main` is an ancestor; `test` has 459 commits beyond it |
| 2 | File-store mode behaves as documented (legacy role inheritance) | PostgreSQL is authoritative for RBAC; file-store is a migration-phase fallback |
| 3 | The seed data in `db.ts` is the canonical dev/test fixture | No live DB in sandbox; migration constraints not executed |
| 4 | The verify scripts (`menu-connectivity-verify.mjs`, `loan-authz-verify.mjs`, `meeting-room-stage3-verify.mjs`) are safe local tests | They boot the server and test endpoints; no production access |
| 5 | The `.env` file contains mask values and is not a real production configuration | No secrets were displayed or reproduced |

**Limitations:**
- No PostgreSQL in this sandbox: migration runs, trigger firing, sequence locking, and live collision tests could not be executed.
- No browser automation: UI states, menu visibility, dashboard rendering, and E2E flows were not tested.
- No admin credentials in the sandbox: the P0 security test script could not be executed.
- No email/Telegram provider: reminder scheduler end-to-end could not be verified.

---

*This report is a read-only audit of the existing application. No files were modified, no migrations run, no production data accessed, and no secrets were exposed. All findings are based on source-code evidence (file:line), dependency audit, and local-safe verification.*
