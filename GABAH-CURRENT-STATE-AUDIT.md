# GABAH — CURRENT STATE AUDIT

**Repository:** inieki-lab/gabah-gas  
**Status:** Current authoritative application architecture  
**Updated:** 2026-09-23

## 1. Executive Summary

GABAH is implemented as a single Node.js application with a React frontend, Express backend/API, and PostgreSQL 17 persistence.

The production direction is:

**React 19 → Express REST API → Domain Services → PostgreSQL 17**

There is no separate PHP backend in the application architecture.

## 2. Runtime Stack

- Frontend: React 19 + TypeScript + Vite 6 + Tailwind CSS v4
- Backend/API: Node.js + Express + TSX
- Database: PostgreSQL 17
- Database driver: `pg`
- Build: Vite + esbuild
- Container runtime: Docker Compose
- Production application container: Node.js 20 Alpine

## 3. Repository Structure

```text
/
├── server.ts
├── server/
│   ├── auth.ts
│   ├── crypto.ts
│   ├── db.ts
│   ├── migrations/
│   ├── numbering.ts
│   ├── persistence.ts
│   ├── runtime-hardening.ts
│   ├── services.ts
│   └── taxonomy.ts
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── components/
│   ├── data/
│   ├── services/
│   └── types.ts
├── scripts/
│   ├── build-server.cjs
│   └── reset-temporary-users.mjs
├── docker-compose.yml
├── package.json
└── vite.config.ts
```

## 4. Persistence

PostgreSQL is the authoritative persistence layer for operational data.

The application uses PostgreSQL tables for users, sessions, assets, assignments, movements, loans, tickets, notifications, maintenance records, and audit logs.

Browser `localStorage` is not the authoritative application database. It is limited to client session/token handling where required by the authentication flow.

## 5. Authentication & Authorization

Authentication is handled by the Node/Express backend.

The backend contains password hashing, session handling, rate limiting, server-side authorization, and audit logging.

Final application roles:

1. Admin GABAH
2. IT
3. GA
4. Supply Chain
5. PIBC
6. Karyawan
7. Auditor

Management and Vendor are not application login roles.

## 6. Server-Authoritative Business Logic

Business-critical operations must be enforced server-side, including:

- Asset numbering
- Asset ownership/division scope
- Asset assignment and movement
- Loan conflict validation
- Loan approval, handover, and return
- Ticket lifecycle
- RBAC authorization
- Audit logging
- Accurate/ERP asset-number reconciliation

The frontend is a client of these APIs and must not be treated as the source of truth for these rules.

## 7. Docker Runtime

`docker-compose.yml` defines:

- `gabah_database`: PostgreSQL 17
- `gabah_app`: Node.js 20 application

The application container builds the Vite frontend and Express server, then starts the compiled server.

## 8. Production Convergence Target

Before production/UAT sign-off, verify:

1. PostgreSQL persistence survives container restart.
2. Authentication and session invalidation are server-authoritative.
3. RBAC is enforced at API level.
4. Asset numbering is generated only by the backend.
5. Loan conflicts are rejected server-side.
6. Audit logs are written for privileged mutations.
7. Production build completes successfully.
8. Docker restart/recreate does not lose database data.
9. All seven final roles pass UAT.
10. No obsolete backend implementation or architecture remains referenced by the active application.

## 9. Conclusion

The authoritative GABAH architecture is **React + Node.js/Express + PostgreSQL 17**.

Development, UAT, and production work should continue on this stack.