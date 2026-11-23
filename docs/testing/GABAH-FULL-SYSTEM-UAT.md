# GABAH Full-System UAT

Status: NOT TESTED unless execution evidence is entered. Snapshot: 2026-11-23. Use isolated PostgreSQL 17 / Docker Compose only. Never use production data or include passwords/session tokens in evidence.

## Status rules

PASS means executed and passed. FAIL means executed and failed. NOT TESTED means not executed. BLOCKED requires a named unavailable prerequisite. Source inspection, file presence, typecheck or build alone does not prove end-to-end behavior. Record candidate commit, persona, steps, expected/actual, evidence and defect ID.

## Preflight

| Scenario | Status |
|---|---|
| Candidate branch and isolated test database | NOT TESTED |
| Docker Compose, PostgreSQL readiness and health endpoint | NOT TESTED |
| Disposable database backup and restore | NOT TESTED |
| Approved role accounts and browser run | BLOCKED — credentials/browser execution unavailable in this stage |

## Persona and organization matrix

Locations are not roles/divisions. Job titles can be assigned at any location. Subang is inactive. Check UI and direct API/object-ID access; backend scope is authoritative.

| Persona | Required checks | Status |
|---|---|---|
| Superadmin | Administration sections render; user assignment reaches recipient; numbering configurable | NOT TESTED |
| IT | IT assets across locations; tickets route to IT Support; spoofed scope denied | NOT TESTED |
| GA | GA asset management; configured PC/laptop IT read-only; mutations denied; Kasi GA not asset operator | NOT TESTED |
| PIBC ME/Admin ME | Queue, routing, assignment, transitions and audit | NOT TESTED |
| RPC/SC employee | RPC is a location label; explicit grants control access | NOT TESTED |
| General employee | Own records only; IDOR denied | NOT TESTED |
| Auditor | Mutations denied by backend | NOT TESTED |

## Module workflows

| Module | Required end-to-end scenario | Status |
|---|---|---|
| Authentication | Login, HttpOnly/SameSite cookie, restore, logout, password/role revocation, cross-origin mutation rejected | NOT TESTED |
| Administration/RBAC | User lifecycle; separate role/job/unit/location; permission persistence; stale sessions revoked | NOT TESTED |
| Assets/categories/numbering | Create/read/update/assign/move/lifecycle/audit; IT owner/category and configurable number; GA IT read-only | NOT TESTED |
| Loans | Request/approve/handover/return, condition, concurrency and pool availability | NOT TESTED |
| IT helpdesk | Create, route to IT Support, assignment delivery, comments/status/resolve, notification/audit | NOT TESTED |
| ME/GA maintenance | Create/assign/progress/close; unauthorized actions denied; audit durable | NOT TESTED |
| Ticket asset FK | Valid/missing/inaccessible/optional links; rollback; asset deletion behavior | NOT TESTED |
| Other modules | Contracts/vendors, licenses, knowledge, reports/export, notifications, rooms, lifecycle and audit logs | NOT TESTED |
| Security/deployment | Upload, CORS/headers, rate limits, secret/log audit, dependencies, container/DB privileges | NOT TESTED |
| Responsive/accessibility | Keyboard/focus/labels, viewport, loading/error/empty states, console/network | NOT TESTED |

## Mandatory regressions

| Regression | Evidence needed | Status |
|---|---|---|
| Administration blank / Rules of Hooks | Every section opened; console clean | NOT TESTED; static test exists |
| PostgreSQL health/RBAC accuracy | Compare database outage with health and fail-closed behavior | NOT TESTED |
| Stuck restoring session | Valid, expired and unavailable endpoint cold loads | NOT TESTED |
| Assignment not delivered | Recipient assignment, notification and audit verified | NOT TESTED |
| React error #310 | Admin and role dashboards with console evidence | NOT TESTED |
| tickets_related_asset_id_fkey | PostgreSQL relation, deletion and rollback | NOT TESTED |
| MacBook Air M2 IT-HLT-2026-0002 | Isolated fixture/test identities; sequential/concurrent loan checks | NOT TESTED; never production records |
| IT category/GA numbering | Fixture and configured numbering rule | NOT TESTED |
| IT and PIBC ME routing | Runtime ticket destination and recipient | NOT TESTED |

## Test execution record

| Check | Status | Evidence |
|---|---|---|
| TypeScript check | PASS | Local captured workspace; no type errors. Not remote PR CI. |
| Production build | PASS | Local captured workspace build succeeded; large chunk warning. Not remote PR CI. |
| Automated regression suite | NOT TESTED | Scripts inventoried, not run. |
| PostgreSQL integration/migration | NOT TESTED | No isolated DB run. |
| Docker runtime smoke | NOT TESTED | Not run. |
| Browser/API role matrix | BLOCKED | Approved test accounts and runtime execution unavailable. |
| Exact-head GitHub CI | NOT TESTED | Draft PR #248; check run not verified. |

Release decision: NOT APPROVED until relevant tests run and P0/P1 findings close or are explicitly accepted.

## Follow-up verification (2026-11-23)

| Check | Status | Evidence |
|---|---|---|
| Clean dependency reinstall | PASS | Workspace clean reinstall operation completed successfully. Literal npm ci invocation NOT TESTED. |
| TypeScript check | PASS | Current captured workspace; no errors. Not remote PR CI. |
| Production build | PASS | Isolated snapshot; 1,034 kB JS chunk warning. Not remote PR CI. |
| Regression/security/integration scripts | NOT TESTED | No execution interface available in this stage; no pass inferred. |
| Exact-head PR CI after lockfile sync | FAIL | Run 45113180356, verify completed failure. Detailed job log unavailable. |

Static auth transport review found no active browser Bearer or localStorage credential usage. Server still accepts legacy Bearer and x-auth-token for compatibility. Cookie/Origin/login/logout/restore/reset/upload and all API runtime scenarios remain NOT TESTED.

Latest exact-head GitHub CI: FAIL — run 45113547899 (verify; completed 2026-11-23 04:44:53Z). Logs unavailable; no cause inferred.


## Cookie-auth regression update (2026-11-23)

The live HTTP regression scripts now exercise cookie-based browser authentication: they retain `Set-Cookie`, send `gabah_session`, assert login response does not expose a token, and send same-origin `Origin` on mutations. CR-04/CR-05 covers Admin, IT, GA, Karyawan, Auditor, session restore, logout, invalid/missing Origin, anonymous access, and browser behavior after cookie Max-Age expiry. The cookie's `Max-Age=604800` is checked; the suite does not wait seven days or advance the server clock, so server-side absolute expiry is not independently time-simulated. A deliberate Bearer compatibility assertion remains only in P0 because the server still supports that non-browser transport.

| Verification | Status | Evidence |
|---|---|---|
| Cookie helper/login assertions and persona matrix present | NOT TESTED (assertions are present) | `scripts/cr04-cr05-verify.mjs`; source change only, not a runtime PASS. |
| PostgreSQL 17 fresh-database/persistence CI | FAIL | Exact-head run 45118658142 completed 2026-11-23 05:36:14Z with failure. Job logs were unavailable; failing step and per-scenario outcomes are unknown. |
| Invalid/missing Origin and logout runtime outcome | NOT VERIFIED | Assertions are included, but CI overall failed and logs are unavailable. |
| Browser UI manual UAT | NOT TESTED | No live browser session evidence. |

Release/UAT status remains NOT APPROVED. Do not infer that the scenarios passed from the presence of assertions. Retrieve the failing job log, fix the actual failing step without weakening assertions, and rerun the exact-head CI before closing this update.


## Latest regression follow-up (2026-11-23)

- Fixed remaining stale JSON token extraction in maintenance and RBAC live HTTP tests; migrated the core-module live HTTP auth suite to session cookies and same-origin requests. Branch scan covered all 108 scripts; only P0's explicit compatibility test still sends Bearer, matching current server support.
- Exact-head CI run **45121785796** failed (completed 2026-11-23 06:06:46Z). The job summary contains no failing-step details; individual scenarios remain **NOT VERIFIED**.
- Worklog/UAT status is not a green CI result. To proceed without weakening assertions, inspect/provide the failed-step log for run 45121785796, repair its actual cause, and rerun the workflow. No merge.


## CI completion correction (2026-11-23)

The earlier failing status above is superseded for the cookie test changes by exact code-head run **45122946585** on `981d811e830b27bcfb2b76d7a0ab6518a31cf655`: **PASS**, completed 06:18:02Z. The full `verify` workflow passed, including the PostgreSQL 17 fresh-database/persistence integration, P0 live HTTP security checks, and configured regressions.

| Scenario | Status | Evidence / limit |
|---|---|---|
| Admin, IT, GA, Karyawan, Auditor cookie login and session identity | PASS | CR-04/CR-05 live PostgreSQL integration in run 45122946585. |
| HttpOnly/SameSite cookie, no login JSON token, restore, logout/revocation | PASS | CR-04/CR-05 assertions passed in run 45122946585. |
| Invalid/missing Origin and unauthenticated/unknown session | PASS | CR-04/CR-05 negative assertions passed in run 45122946585. |
| Browser expiry behavior | PASS (bounded) | `Max-Age=604800` is checked and restore without a cookie is unauthorized; no seven-day wait or server-clock advance. |
| Legacy Bearer compatibility | PASS | Explicit P0 compatibility assertion passed; retained intentionally as non-browser transport. |
| `scripts/test-core-modules.ts` | NOT TESTED | Migrated to cookie transport but is not a configured CI step. |
| Manual browser UI UAT | NOT TESTED | CI HTTP tests do not substitute for manual browser workflows. |

Release/UAT scope remains limited by the manual browser scenarios above. PR #248 remains open/draft; no merge.
