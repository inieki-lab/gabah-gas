---
name: gabah-documentation
description: "GABAH documentation standard. PRD, architecture, DB schema/ERD, API docs, RBAC matrix, permission matrix, workflows, deployment, backup/restore, testing plan, change log, known issues. Keep docs accurate to implementation."
version: 1.0
category: software-development
created: "2026-11-10"
---

# GABAH Documentation Standard

## The 13 required docs

1. **PRD** — product requirements, roles, workflows, business rules.
2. **System Architecture** — frontend/backend/db layers, data flow, container layout.
3. **Database Schema / ERD** — tables, FKs, indexes, migration version.
4. **API Documentation** — endpoints, request/response, status codes, RBAC notes.
5. **RBAC Matrix** — role × module × action matrix.
6. **Permission Matrix** — permission × module × scope.
7. **User Workflow** — per role: login → dashboard → primary actions.
8. **Helpdesk Workflow** — ticket lifecycle, assignment, resolution, verification.
9. **Asset Workflow** — inventory, movement, maintenance, loans.
10. **Deployment Guide** — docker-compose, env, build, production run.
11. **Environment Configuration** — `.env.example`, variables, secrets.
12. **Backup & Restore** — PostgreSQL dump/restore, upload volume backup.
13. **Testing Plan** — unit, integration, E2E, regression, UAT.
14. **Change Log** — per commit/SHA.
15. **Known Issues** — open findings with owner + fix status.

## Maintenance rules

- Documentation is **living**: update immediately when a feature changes.
- Never assert a feature is "done" without passing tests (see `gabah-testing-qa` DoD).
- Each doc is cross-referenced to code paths and migration versions.
- Keep ASCII diagram / table formats for portability.

## Modification flow

- PR-based: `hermes/<scope>-<short>` branch → PR → review → merge.
- After merge, run `npm run build` + `npm run lint` + relevant `scripts/*.verify` → record results in `docs/` + `CHANGELOG.md`.
- Known issues: each entry has `severity`, `impact`, `owner`, `fix_status`.
