# GABAH — Architecture

**Status:** Authoritative architecture  
**Last Updated:** 2026-09-28

## 1. Canonical Architecture

GABAH is a single web application with React frontend, Node.js/Express backend, domain services and PostgreSQL 17 persistence.

**React 19 → Express REST API → Domain Services → PostgreSQL 17**

Docker Compose supplies the runtime containers.

## 2. Layers

### Frontend — src/
Renders UI, collects input, calls APIs and manages presentation state. It is not a security boundary.

### API / Runtime — server.ts
HTTP routing, request/response handling, authentication integration, runtime setup and Vite development integration.

### Authentication / Security
server/auth.ts, server/crypto.ts and server/runtime-hardening.ts handle password verification/hashing, sessions, brute-force protection and server-side authorization/security checks.

### Domain Services — server/services.ts
Business operations including asset creation, assignment, movement, lifecycle, loans, tickets, notifications and audit operations.

### Persistence
server/persistence.ts, server/db.ts and server/migrations/ manage PostgreSQL persistence and schema.

### Numbering — server/numbering.ts
Backend-owned generation of canonical GABAH asset identifiers.

### Taxonomy — server/taxonomy.ts
Canonical asset taxonomy and category resolution.

## 3. Database

Current migration set includes 001_gabah_normalized_schema.sql, 002_gabah_auth_hardening.sql and 003_loan_anti_collision_trigger.sql.

Operational entities include users, sessions, assets, assignments, movements, loans, tickets, notifications, maintenance, rooms/reservations and audit records. Exact schema must be derived from current migrations, not stale documentation.

## 4. Persistence Rules

PostgreSQL is the primary source of truth. server/data/gabah_state.json exists as a fallback/runtime data mechanism and must not be treated as the authoritative production database when PostgreSQL is available. Browser localStorage is not the operational datastore.

## 5. API Principle

Frontend components use the API/client service layer. Business-critical validation belongs on the server even when equivalent UI validation exists.

## 6. Security Boundary

The trusted boundary is the server. Never trust client-supplied role, division, actor ID, ownership or asset number as authoritative.

## 7. Runtime

Development: npm run dev  
Production build: npm run build  
Production start: npm run start

Docker Compose services: gabah_database and gabah_app.

## 8. Constraints

Do not introduce Laravel/PHP backend, competing persistence architecture, client-authoritative numbering, client-only RBAC, or a new login role without corresponding product/RBAC documentation. Avoid unrelated large refactors.

## 9. Release Verification

Verify PostgreSQL persistence after restart/recreate, login/session behavior, API-level RBAC for all seven roles, asset numbering, duplicate rejection, loan anti-collision, audit trail, production build, critical UI workflows and removal of obsolete backend references.
