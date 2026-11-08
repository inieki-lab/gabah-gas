# GABAH — Production Readiness Gates

**Owner:** PT Food Station Tjipinang Jaya (Perseroda)  
**Working integration branch:** fix/role-based-navigation (PR #18)  
**Status:** NO-GO / stabilization in progress  
**Last reviewed:** 8 November 2026

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
- [ ] npm ci succeeds.
- [ ] npm run lint succeeds.
- [ ] npm run build succeeds.
- [ ] All verification scripts listed in package.json run and pass.
- [ ] Docker Compose validation passes with a dummy CI-only password.
- [ ] No dead menu actions, placeholder routes, or hidden runtime exceptions remain.

## G1 — Database and persistence

- [ ] PostgreSQL 17 boots from a completely empty test database.
- [ ] Every migration applies once and is idempotent where intended.
- [ ] PostgreSQL is authoritative in production; the app fails closed if production DB is unavailable.
- [ ] Create, update, read-back, restart, and re-read workflows pass.
- [ ] Dynamic user-role assignments survive ordinary writes and restart.
- [ ] Migration path from a representative legacy snapshot is tested separately from fresh install.
- [ ] Backup and restore are demonstrated on an isolated test environment.
- [ ] No production user/asset/owner/location mapping is inferred from a sample seed.

## G2 — Identity, organization, and Dynamic RBAC

- [ ] Primary role and additional roles are displayed and assignable by Super Admin.
- [ ] Role assignment is transactional, audited, and protects the last active Super Admin.
- [ ] Role additions persist after unrelated writes and restart.
- [ ] Permission and scope are evaluated independently per module.
- [ ] Unknown/inactive roles and missing/invalid scopes fail closed.
- [ ] Jabatan, unit, office location, asset location, owner domain, and custodian remain separate.
- [ ] Current active office locations are exactly HO, PIBC, RPC/SC, Pangsub, and Kantor Perawatan; Subang is inactive.
- [ ] Future locations and owner domains can be added from master data without code changes.
- [ ] GA's broad owner scope (all except IT) remains an administrator-configurable policy, not an automatic grant.
- [ ] GA's IT Laptop/PC visibility is read-only and controlled by assets.read.it_workstations.
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
- [ ] PostgreSQL volume, backup schedule, restore procedure, firewall, DNS, TLS/reverse proxy, and monitoring are reviewed.
- [ ] Fresh-install and upgrade migrations are rehearsed on staging.
- [ ] Deploy, health check, smoke test, rollback, and data recovery are rehearsed.
- [ ] No test credentials, demo login shortcuts, file-store fallback, or debug endpoints are enabled in production.
- [ ] Business owner signs off UAT and records GO/NO-GO.

## Evidence record

| Gate | Commit SHA | Result | Evidence / run URL | Reviewer | Date |
|---|---|---|---|---|---|
| G0 | — | NOT VERIFIED | — | — | — |
| G1 | 398ba8fa61ddef9f5cf63dc22ff330cd7d1a0f33 | PARTIAL PASS | CI #544: PostgreSQL 17 fresh DB, 35 migrations, CR-04/05 57/57, restart persistence; legacy snapshot upgrade and backup/restore not run | — | 8 Nov 2026 |
| G2 | 398ba8fa61ddef9f5cf63dc22ff330cd7d1a0f33 | PARTIAL PASS | CI #544: Dynamic RBAC 63/63, asset scope 37/37, Auditor additional-role denial/read test; live HR mapping and full endpoint review remain | — | 8 Nov 2026 |
| G3 | — | NOT VERIFIED | Manual browser UAT required | Business owners | — |
| G4 | — | NOT STARTED | Staging and production controls | Infrastructure owner | — |

## Current release decision

**NO-GO.** PostgreSQL fresh-boot and persistence integration has been exercised in CI, but the complete current-head CI must pass. Manual browser UAT, production backup/restore rehearsal, staging deployment, TLS, monitoring, and business-owner sign-off remain outstanding.
