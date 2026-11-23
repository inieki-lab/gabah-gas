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
