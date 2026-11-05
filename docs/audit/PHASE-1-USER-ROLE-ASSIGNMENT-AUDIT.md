# GABAH Phase 1 — User & Role Assignment Audit

Status: In progress  
Base: `main` at `07adb964a55cb60a0d49329d9febad7456c97eca`  
Working branch: `fix/phase-1-user-role-audit`

## Objective

Establish one reliable identity and role-assignment model before changing navigation, landing pages, forms, or other business modules. Do not rebuild the application and do not change production user assignments until the live PostgreSQL data has been inspected and reconciled.

## Confirmed code observations (repository review)

1. Dynamic RBAC tables and routes are present in `server.ts`, including:
   - `gabah_roles`
   - `gabah_permissions`
   - `gabah_role_permissions`
   - `gabah_role_division_scopes`
   - `gabah_user_roles`
2. `PUT /api/admin/rbac/users/:id/roles` replaces a user's complete role assignment set inside a transaction, validates active role IDs, and protects the last superadmin assignment.
3. `AdministrationModal.tsx` contains Dynamic RBAC role/permission state, but the inspected file has no reference to `role_ids`, `rbacSelectedUser`, or the assignment endpoint. The user-to-role assignment UI therefore appears unimplemented/unconnected in this component.
4. A read-only Superadmin-protected endpoint, `GET /api/admin/rbac/user-assignments`, has now been added on this branch. It returns each normalized user, the legacy `users.role`, and their dynamic role assignments (including role activity and superadmin metadata). It is an inventory endpoint only; it does not change assignments.
5. The frontend API client now exposes `getRbacUserAssignments()` so the administration UI can consume this inventory in a subsequent UI step.
4. `AdministrationModal.tsx` still initializes a legacy `permissions` state from browser `localStorage` key `gabah_role_permissions`, separate from the PostgreSQL Dynamic RBAC state. Trace all reads/writes before deciding how to retire it; do not remove it blindly.
6. `GET /api/users` is behind `gabahSecurityMiddleware`, which rejects unauthenticated API requests. The handler itself does not apply a narrower role check, so the exact business need for exposing the full user directory to every authenticated account remains to be assessed.
7. `GET /api/auth/me` returns `sanitizeUser(actor)`; inspect whether this exposes effective multi-role assignments and effective permissions. Do not assume that it does.
8. Repository review cannot reveal the live PostgreSQL user population or prove deployment state. Production database reconciliation remains pending until executed in the intended environment.

## Required audit outputs

- [ ] Inventory every user: stable ID, display name, email, active/disabled status, division/unit/location, legacy `users.role`.
- [ ] Inventory every active and inactive RBAC role, role key, superadmin flag, and assignment count.
- [x] Add a read-only Superadmin-protected API inventory for users and their dynamic role assignments.
- [ ] Inventory every user-role assignment in `gabah_user_roles` using the new endpoint against the intended live PostgreSQL database.
- [ ] Produce a discrepancy report: no role, inactive role, unknown legacy role, legacy/dynamic mismatch, duplicate assignment, inactive account with active session, and unexpected superadmin.
- [ ] Confirm canonical role mapping with business owners; do not infer role from job title or division alone.
- [ ] Confirm whether multi-role is permitted per user and define how effective permissions are combined.
- [ ] Confirm behavior for zero assigned roles: fail closed; never grant Admin/Superadmin fallback.
- [ ] Verify assignment, replacement, and revocation are audited and transactional.
- [ ] Verify only authorized Superadmin can read/change assignments.
- [ ] Add tests for valid assignment, multiple roles, duplicate IDs, inactive/unknown role IDs, unknown user, empty role list, unauthorized caller, and last-superadmin protection.
- [ ] Test both PostgreSQL persistence and development file-store behavior; document differences.
- [ ] Do not alter production assignments until a reviewed mapping and rollback/export plan are approved.

## Data inspection SQL (read-only)

Run against the intended PostgreSQL database after confirming the database name and environment. These queries are read-only and should be used to prepare the discrepancy report.

```sql
-- Users and their legacy role
SELECT id, name, email, role, is_active
FROM users
ORDER BY name, email;

-- Defined roles and current assignment counts
SELECT r.id, r.role_key, r.name, r.is_active, r.is_superadmin,
       COUNT(ur.user_id)::int AS assigned_users
FROM gabah_roles r
LEFT JOIN gabah_user_roles ur ON ur.role_id = r.id
GROUP BY r.id
ORDER BY r.is_superadmin DESC, r.name;

-- Effective dynamic assignments per user
SELECT u.id AS user_id, u.name, u.email, u.role AS legacy_role,
       r.id AS role_id, r.role_key, r.name AS assigned_role,
       r.is_active AS role_active, r.is_superadmin
FROM users u
LEFT JOIN gabah_user_roles ur ON ur.user_id = u.id
LEFT JOIN gabah_roles r ON r.id = ur.role_id
ORDER BY u.name, r.name;

-- Users with no dynamic role assignment
SELECT u.id, u.name, u.email, u.role
FROM users u
LEFT JOIN gabah_user_roles ur ON ur.user_id = u.id
WHERE ur.user_id IS NULL
ORDER BY u.name;

-- Assignments to inactive roles (should normally be empty)
SELECT u.id, u.name, u.email, r.role_key, r.name AS role_name
FROM gabah_user_roles ur
JOIN users u ON u.id = ur.user_id
JOIN gabah_roles r ON r.id = ur.role_id
WHERE r.is_active = FALSE
ORDER BY u.name, r.name;
```

Before running these queries, verify actual column names from the live schema/migrations. If `users.is_active` differs or does not exist, adjust the read-only inventory query to the actual schema; do not guess or mutate data.

## Acceptance criteria — Phase 1 complete

- Every active account has an explicitly reviewed role assignment (or an explicitly approved no-role state).
- No unknown/inactive role is silently accepted.
- Legacy `users.role` and Dynamic RBAC precedence/migration behavior is documented and deterministic.
- User assignment management UI reads and writes PostgreSQL-backed assignments, with no hidden local-only source of truth.
- Server-side authorization protects user listing and role assignment endpoints.
- `/api/auth/me` exposes a stable, minimal effective identity/permission contract for the frontend.
- Assignment changes are auditable, atomic, and covered by automated tests.
- No regression to login, account administration, or existing business modules.

## Guardrails

- No direct changes to `main`.
- No bulk role migration before discrepancy review and explicit mapping approval.
- No broad dashboard/sidebar redesign during Phase 1.
- Preserve existing features; make the smallest safe changes.
- Every code change must include focused tests and a regression check.
