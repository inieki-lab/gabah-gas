# GABAH Full-System UAT

Status: NOT TESTED unless execution evidence is entered. Snapshot: 2026-11-23. Target an isolated PostgreSQL 17 / Docker Compose environment only. Never use production data or include passwords/session tokens in evidence.

## Status rules

PASS means executed and passed. FAIL means executed and failed. NOT TESTED means not executed. BLOCKED requires a named unavailable prerequisite. Source inspection, file presence, typecheck or build alone does not prove an end-to-end scenario. Record candidate commit, persona, steps, expected/actual result, evidence and defect ID.

## Preflight

| Scenario | Expected evidence | Status |
|---|---|---|
| Candidate branch and isolated test database | SHA recorded; no production data | NOT TESTED |
| Docker Compose and PostgreSQL health | PostgreSQL-backed app health; no fallback persistence | NOT TESTED |
| Backup and restore | Disposable UAT fixture restored and checked | NOT TESTED |
| Approved test accounts and browser | Persona accounts provisioned | BLOCKED — credentials/browser run not supplied |

## Role and organization matrix

Locations are not roles/divisions. Job titles can be assigned at any location. Subang is inactive. Validate both UI and direct API/object-ID access; backend scope is authoritative.

| Persona | Required checks | Status |
|---|---|---|
| Superadmin | Administration renders all sections; user assignment persists and reaches recipient; numbering rules configurable | NOT TESTED |
| IT | IT assets managed across locations; IT tickets route to IT Support; spoofed identity/scope denied | NOT TESTED |
| GA | GA asset management; configured PC/laptop IT read-only access; IT mutation denied; Kasi GA not asset operator | NOT TESTED |
| PIBC ME/Admin ME | ME queue, routing, assignment, transitions and audit | NOT TESTED |
| RPC/SC employee | RPC location label only; explicit grants control access | NOT TESTED |
| General employee | Own records only; other-user IDOR denied | NOT TESTED |
| Auditor | Mutation endpoints denied regardless of UI visibility | NOT TESTED |

## Module workflows

| Module | End-to-end checks | Status |
|---|---|---|
| Authentication/session | Login, HttpOnly/SameSite cookie, session restore, logout, password/role session revocation, cross-origin mutation rejection | NOT TESTED |
| User/admin/RBAC | Create/update/deactivate test user; separate role/job/unit/location; permission/scope persistence and stale session revocation | NOT TESTED |
| Assets/categories/numbering | Create/read/update/assign/move/lifecycle/audit; IT ownership/category; configured numbering; GA IT read-only | NOT TESTED |
| Loans | Request/approve/handover/return, condition, concurrency and pool availability | NOT TESTED |
| IT tickets | Creation, IT Support routing, recipient assignment, comments/status/resolution, notification and audit | NOT TESTED |
| ME/GA maintenance | Create/assign/progress/close; unauthorized denial; durable audit | NOT TESTED |
| Ticket asset relation | Existing, missing, inaccessible and optional asset link; invalid relation rollback; asset delete FK behavior | NOT TESTED |
| Other modules | Contracts/vendors/documents, licenses, knowledge, reports/export, notifications, rooms, lifecycle, audit logs | NOT TESTED |
| Security/deployment | Upload validation, CORS/headers, rate limits, secrets/logging, dependency policy, container and DB privileges | NOT TESTED |
| Responsive/accessibility | Keyboard/focus/labels, viewport, loading/error/empty states, console/network | NOT TESTED |

## Required regression checks

| Regression | Required evidence | Status |
|---|---|---|
| Administration blank / Rules of Hooks | Login, every admin section, clean console | NOT TESTED; static test exists |
| PostgreSQL health and RBAC status | Compare actual DB failure with health and fail-closed behavior | NOT TESTED |
| Stuck restoring session | Valid, expired and unavailable session endpoint cold loads | NOT TESTED |
| Superadmin assignment not delivered | Verify recipient assignment, notification and audit | NOT TESTED |
| React error #310 | Role dashboard/admin navigation and browser console | NOT TESTED |
| tickets_related_asset_id_fkey | PostgreSQL integration for valid/missing links and deletion/rollback | NOT TESTED |
| MacBook Air M2 pool case IT-HLT-2026-0002 | Isolated fixture and test identities; sequential and concurrent loan checks | NOT TESTED; never use production records |
| IT category/GA numbering | Sample IT asset category and configured number rule | NOT TESTED |
| IT and PIBC ME routing | Runtime ticket creation and queue/recipient check | NOT TESTED |

## Execution status

| Check | Status | Evidence |
|---|---|---|
| TypeScript lint/typecheck | NOT TESTED | Not executed |
| Production build | NOT TESTED | Not executed |
| Automated regression suite | NOT TESTED | Scripts inventoried only |
| PostgreSQL integration/migration tests | NOT TESTED | No isolated DB run |
| Docker smoke test | NOT TESTED | Not executed |
| Browser/API role matrix | BLOCKED | Approved UAT accounts and runtime execution unavailable |
| CI/security dependency checks | NOT TESTED | No audit PR run |

Release approval: NOT APPROVED until relevant tests are executed and P0/P1 findings closed or accepted.
