---
name: gabah-architecture
description: "GABAH system architecture standard. Frontend → Express API → domain services → PostgreSQL 17. Use when reading or designing GABAH modules, tracing data flow, or planning new modules against the existing stack."
version: 1.0
category: software-development
created: "2026-11-10"
---

# GABAH Architecture

## Stack (do not migrate without strong justification + owner consent)

```text
React 19 (Vite + TS + Tailwind v4)  →  Express + TypeScript  →  Domain Services  →  PostgreSQL 17
```

- **Frontend** (`src/`) fetches via `src/services/gabahApi.ts` (Bearer tokens).
- **Backend** (`server/`) owns business logic: asset numbering, division scope, loan validation,
  ticket lifecycle, RBAC, audit logging, notification.
- **Persistence** (`server/persistence.ts`) wraps PostgreSQL; `server/db.ts` seeds canonical data.

## Deployment topology

| Container | Image | Role |
|---|---|---|
| `gabah_database` | `postgres:17-alpine` | PostgreSQL 17 (persistent volume `postgres_data`) |
| `gabah_app` | `gabah-gas:local` | Node 22 Alpine runtime (`dist/server.cjs`), non-root user |

Environment variables are read from `.env` (no secrets committed; `.env` is gitignored).

## Data flow (trace before edit)

1. Frontend renders a menu item tied to a `permission_key`.
2. Click → `gabahApi` fetches `/api/...` with the Bearer token.
3. Express route → `requireRbacPermission()` (or `requireRbacSuperadmin`) → 403 if denied.
4. Domain service (`server/services.ts`) validates and mutates the model.
5. Persistence layer writes/reads PostgreSQL; audit entry recorded.

## Design rules

- **Server-authoritative.** Backend owns grants; menu visibility is frontend-only.
- **Single source of truth.** No hidden duplicate state between frontend, API, DB, and reports.
- **Additive first.** New fields optional; legacy fields kept for backward compatibility.
- **Idempotent migrations only.** No destructive DDL; `schema_migrations` ledger owned by the runner.
