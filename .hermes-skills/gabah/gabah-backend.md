---
name: gabah-backend
description: "GABAH backend API/service architecture standard. Server-authoritative business logic, domain services, PostgreSQL persistence, RBAC guards. Use when creating or editing Express routes, domain services, or the persistence layer."
version: 1.0
category: software-development
created: "2026-11-10"
---

# GABAH Backend Standard

## Architecture (server-authoritative)

```
React (Vite + TS + Tailwind) → Express + TSX REST API → Domain Services → PostgreSQL 17
```

- **Frontend** fetches via `src/services/gabahApi.ts` (Bearer tokens). Menu visibility is client-side only.
- **Backend** (`server/`) owns business logic: asset numbering, division ownership scope, loan conflict validation, ticket lifecycle, RBAC, audit logging, notification.
- **Persistence** (`server/persistence.ts`) wraps PostgreSQL; `server/db.ts` seeds canonical data. `server/data/gabah_state.json` is a runtime-only fallback (gitignored).

## Backend file map

| File | Responsibility |
|---|---|
| `server.ts` | Express app, routes, middleware, RBAC guards, auth serializer |
| `server/auth.ts` | Session tokens, PBKDF2, rate limiting, session rotation |
| `server/persistence.ts` | DB pool, migration runner (`schema_migrations`), transaction scoped |
| `server/rbac-policy.ts` | `isRbacSuperadmin`, `hasRbacPermission`, `getEffectivePermissionKeys`, policy cache |
| `server/services.ts` | Domain services (asset, loan, ticket, lifecycle, audit, reconciliation) |
| `server/runtime-hardening.ts` | `requireRbacPermission`, `actorFor`, security middleware |
| `server/asset-location.ts` | Asset location master, location path resolution |
| `server/taxonomy.ts` | Asset taxonomy, division ownership scope |
| `server/numbering.ts` | Server-authoritative asset/loan/ticket numbering |

## Route guard convention (always)

```ts
// Authentication
app.post('/api/auth/login', ...)          // PBKDF2 + session; rotate on login
app.post('/api/auth/logout', ...)         // destroy session token
app.get('/api/auth/me', ...)              // return sanitized user + permission_keys

// RBAC guards (server.ts)
app.post('/api/admin/rbac/roles', requireRbacSuperadmin, ...)   // stable DB superadmin
app.patch('/api/admin/rbac/roles/:id', requireRbacSuperadmin, ...) // RBAC_SUPERADMIN_PROTECTED
app.delete('/api/admin/rbac/roles/:id', requireRbacSuperadmin, ...) // RBAC_SUPERADMIN_PROTECTED

// Permission guard (express-async-error handled)
app.get('/api/assets', requireRbacPermission('assets.read'), ...)      // or requireRbacPermission('dashboard.read')
```

## Authorization contract

- **superadmin**: `getEffectivePermissionKeys(userId) === ['*']` → wildcard allow.
- **named permission**: `hasRbacPermission(userId, 'assets.read')` → true/false from PostgreSQL effective policy.
- **scope**: `hasRbacScope(userId, type, value, module)` — division/unit/location scoping.
- **data visibility**: server filters by `asset.asset_location_id` / `owner_division` / `managing_unit_id` scope chain. Never rely on frontend civilian.

## Testing backend changes

- Add regression to `scripts/dynamic-rbac-foundation-verify.mjs` (129/129 target).
- Add regression to `scripts/p0-security-verify.mjs` (37/37 target).
- `npm run lint` → `tsc --noEmit` → **0 errors**.
- Run `npm run build` → `dist/server.cjs` compiled.

## PR/PRD alignment

- New endpoints must be documented in `docs/` and appear in `gabah-frontend` menu with matching permission `permission_keys` exposed in `/api/auth/me`.
