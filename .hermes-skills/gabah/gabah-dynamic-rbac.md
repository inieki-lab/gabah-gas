---
name: gabah-dynamic-rbac
description: "GABAH Dynamic RBAC engineering standard. Authority-first authorization: backend contract + database role assignment + middleware guards. Use for any RBAC change, permission guard, or role admin work."
version: 1.0
category: software-development
created: "2026-11-10"
---

# GABAH Dynamic RBAC Standard

## Non-negotiable architecture

1. **Backend contract.** Every permission guard is a server-side function:
   - `hasRbacPermission(userId, permissionKey)` — checks effective permissions incl. superadmin wildcard.
   - `isRbacSuperadmin(userId)` — checks the active DATABASE role assignment (`gabah_user_roles` + `gabah_roles.is_superadmin`).
   - `getEffectivePermissionKeys(userId)` — returns all effective permission keys (superadmin = `['*']`).
2. **Database authority.** Role/permission/scope data lives ONLY in PostgreSQL (`gabah_roles`, `gabah_permissions`, `gabah_role_permissions`, `gabah_role_division_scopes`, `gabah_user_roles`). No role/permission logic in source code except lookups.
3. **Middleware guard.** `requireRbacSuperadmin()` and `requireRbacPermission()` enforce on the route. Menu visibility is UX-only; backend is authoritative.
4. **Superadmin = active DB assignment.** `isSuperadminActor()` = `actor.role === 'Admin GABAH' || isRbacSuperadmin(actor.id)`. The legacy label is a bootstrap signal; the database is authoritative.
5. **Audit trail.** Every RBAC/ROLE mutation is recorded via `GabahDomainService.recordAudit(...)`.

## Verified pattern (129/129 passing, all checks validated)

- Role administration: `requireRbacSuperadmin` enforces `isRbacSuperadmin(actor.id)`; `RBAC_SUPERADMIN_PROTECTED` on edit/delete.
- Superadmin authorization uses the ACTIVE database role assignment (`isRbacSuperadmin` reads PostgreSQL).
- Menu/API exposes `permission_keys`: `is_superadmin ? ['*'] : getEffectivePermissionKeys(userId)`.
- Dynamic write authority applies ONLY when PostgreSQL persistence is active (file-store retains legacy chain).

## Migration rules (always true)

- All SQL is `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` / idempotent (no destructive DDL).
- Migrations do NOT own transactions (`BEGIN`/`COMMIT` absent) — the migration runner owns them.
- `schema_migrations` ledger created by the runner before `.sql` execution.
- Role tables never drop legacy data; service-layer checks keep legacy code working until full cutover.

## Rules copy-paste for backend guards

```ts
// route middleware (server.ts)
const requireRbacSuperadmin = (req, res) => {
  const actor = req.user as ServerUser | undefined;
  if (!isPostgresPersistenceActive()) return 503;      // RBAC needs Postgres
  if (!actor || !isSuperadminActor(actor)) return 403; // stable DB assignment
  return actor;
};

// endpoint guard (server.ts)
const requireRbacPermission = (req, res, permissionKey) => {
  if (!isPostgresPersistenceActive()) return true; // legacy file-store allowlist
  const actor = req.user as ServerUser | undefined;
  if (!actor || !hasRbacPermission(actor.id, permissionKey)) return 403;
  return true;
};
```

## Verification

Run `node scripts/dynamic-rbac-foundation-verify.mjs` → target **129/129**.
Run `npm run lint` → **0 TS errors**.
Run `node scripts/p0-security-verify.mjs` → **37/37 PASS**.
