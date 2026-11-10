# GABAH — Production Readiness Gates

**Owner:** PT Food Station Tjipinang Jaya (Perseroda)  
**Working integration branch:** `fix/user-menu-location-rbac-audit` (PR #36)  
**Status:** NO-GO / stabilization in progress  
**Last reviewed:** 10 November 2026

This checklist is the release control record. A green build is necessary but is not proof of production readiness. Every gate needs a timestamp, commit SHA, actual result, evidence, and reviewer.

## Release rules

1. Freeze feature expansion. Close demonstrated defects and finish existing workflows before adding modules.
2. One integration branch at a time. AI contributors use ai/agent-name/work-item branches and submit PRs to the integration branch.
3. Never merge a diverged branch wholesale. Port only reviewed, unique work.
4. Do not run production data migrations until backup, dry-run, impact report, rollback plan, and explicit approval are complete.
5. Do not deploy a draft PR. Production deploy must use a reviewed, merged commit/tag.
6. Keep secrets out of Git, logs, screenshots, and chat.

## G0 — Repository and code health

- [ ] Confirm the integration branch and exact HEAD SHA.
- [x] npm ci succeeds (CI #589).
- [x] npm run lint succeeds (CI #589).
- [x] npm run build succeeds (CI #589).
- [x] All CI verification scripts run and pass (CI #589).
- [x] Docker Compose validation passes with a dummy CI-only password (CI #587).
- [x] Node 22 multi-stage production image builds from package-lock and starts without bind-mounting source or installing dependencies at runtime (CI #587: Node 22.23.4 + PostgreSQL 17 smoke).
- [ ] No dead menu actions, placeholder routes, or hidden runtime exceptions remain.

## G1 — Database and persistence

- [x] PostgreSQL 17 boots from a completely empty test database (CI #588).
- [x] Fresh database applies all 35 migration entries; repeatability/ledger checks pass (CI #588).
- [x] PostgreSQL is authoritative in production; the app fails closed if production DB is unavailable (CI #588).
- [x] Create, update, read-back, restart, and re-read workflows pass (CI #588).
- [ ] Dynamic user-role assignments survive ordinary writes and restart.
- [ ] Migration path from a representative legacy snapshot is tested separately from fresh install.
- [ ] PostgreSQL backup and restore are demonstrated on an isolated test environment.
- [x] Contract uploads write durable bytes; download enforces contract scope (404) and file bytes survive restart (CI #588; Docker volume writable smoke #587).
- [ ] The uploads_data volume is backed up/restored together with PostgreSQL so contract metadata never outlives its file bytes.
- [ ] No production user/asset/owner/location mapping is inferred from a sample seed.

## G2 — Identity, organization, and Dynamic RBAC

- [x] Primary role and additional roles are assignable and displayed separately in the employee directory (CI #589).
- [ ] Role assignment is transactional, audited, and protects the last active Super Admin.
- [ ] Role additions persist after unrelated writes and restart.
- [x] Permission and scope are evaluated independently per module (Dynamic RBAC and asset scope suites, CI #589).
- [x] Unknown/inactive roles and missing/invalid scopes fail closed (CI #589).
- [x] Jabatan, unit, office location, asset location, owner domain, and custodian remain separate (org-model CI #589).
- [x] Current active office locations are exactly HO, PIBC, RPC, Pangsub, and Kantor Perawatan; Subang is inactive (org-model CI #589).
- [x] Future locations and owner domains can be added from master data without code changes (org/owner-scope CI #589).
- [ ] GA's broad owner scope (all except IT) remains an administrator-configurable policy, not an automatic grant.
- [x] GA's IT Laptop/PC visibility is read-only and controlled by assets.read.it_workstations (CI #589).
- [x] Auditor read-only behavior is tested through direct API calls, including Auditor as an additional role (PostgreSQL CI #544: write 403, authorized audit read 200).

## G3 — Workflow and role-based UAT

Run docs/testing/UAT.md in a browser against PostgreSQL using disposable test data. Test each relevant persona separately; do not infer a result from the Admin account.

- [ ] Login, logout, session expiry, session restore, and role-change behavior.
- [ ] Landing page, sidebar, direct route, loading/error/empty states.
- [ ] Asset create/edit/assign/move/lifecycle/import/export.
- [ ] Loans: request, approve/reject, handover, return, collision handling, BAST.
- [ ] Tickets: create, assign, status transitions, SLA, reporter/assignee visibility.
- [ ] Maintenance: list, create, update, completion, owner scope.
- [ ] Room reservations: request, conflict, approval, priority override, IT facility queue, Humas documentation queue, privacy redaction.
- [ ] Vendors and contracts: owner scope, CRUD, attachments, renewal, reminders, notification logs.
- [ ] Reconciliation, dashboard aggregates, reports, and audit visibility.
- [ ] No direct API or detail-by-ID access outside the user's permission/scope.

## G4 — Production deployment and rollback

- [ ] Approved candidate commit is merged to main; branch is not deployed directly.
- [ ] Production .env is created from .env.example with unique strong secrets and file permissions restricted.
- [ ] Production image tag is pinned/recorded for release and rollback; no floating source bind mount is used.
- [ ] PostgreSQL volume, backup schedule, restore procedure, firewall, DNS, TLS/reverse proxy, and monitoring are reviewed.
- [ ] Fresh-install and upgrade migrations are rehearsed on staging.
- [ ] Deploy, health check, smoke test, rollback, and data recovery are rehearsed.
- [ ] No test credentials, demo login shortcuts, file-store fallback, or debug endpoints are enabled in production.
- [ ] Business owner signs off UAT and records GO/NO-GO.

## Evidence record

| Gate | Commit SHA | Result | Evidence / run URL | Reviewer | Date |
|---|---|---|---|---|---|
| G0 | a1cd3d4ce082c547736f67a863d2981abb6dfcaa | PARTIAL PASS | CI #589: npm ci/lint/build, all regression suites, Docker Compose config, Node 22 image build + runtime smoke PASS; dead-action review remains | — | 8 Nov 2026 |
| G1 | 9feadd7f152c19975f2ae24e9b9c25f6491ca949 | PARTIAL PASS | CI #588: PostgreSQL 17 fresh DB, 35 migrations, CR-04/05 63/63, restart persistence, contract file upload/download/signature/scope/restart PASS; legacy snapshot upgrade and DB+uploads restore not run | — | 8 Nov 2026 |
| G2 | a1cd3d4ce082c547736f67a863d2981abb6dfcaa | PARTIAL PASS | CI #589: Dynamic RBAC 63/63, asset scope 37/37, P0 37/37, maintenance 33/33, Auditor additional-role denial/read, primary/additional role UI, org model PASS; live HR mapping and full endpoint review remain | — | 8 Nov 2026 |
| G3 | — | NOT VERIFIED | Manual browser UAT required | Business owners | — |
| G4 | — | NOT STARTED | Staging and production controls | Infrastructure owner | — |
| PR #36 current head | `2cd878fd4096d1c129d48f1483cd6f0992a72920` | CI PASS | [GitHub Actions run 42806766859](https://github.com/inieki-lab/gabah-gas/actions/runs/42806766859): verify SUCCESS — Compose config, deploy shell validation, lint, RBAC/regression suites, production Docker runtime smoke, PostgreSQL 17 fresh-database/persistence integration, live HTTP security checks, and module scope checks | — | 10 Nov 2026 |

## Current release decision

**NO-GO.** PR #36 current-head CI passed at commit `2cd878fd4096d1c129d48f1483cd6f0992a72920` (verify job success, including Docker runtime smoke and PostgreSQL 17 fresh-database/persistence integration). This is not production approval. Manual browser/API UAT, formal GA helpdesk operator assignment, legacy production-database upgrade rehearsal, production backup/restore rehearsal, staging deployment, TLS, monitoring, and business-owner sign-off remain outstanding.
