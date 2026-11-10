# GABAH — API Documentation

**Application:** GABAH — General Asset & Business Administration Hub
**Base URL:** `http://localhost:3000/api` (production behind reverse proxy)
**Auth:** Bearer token (`Authorization: Bearer <token>`) — token obtained from `/api/auth/login`.
**Persistence:** PostgreSQL 17 (file-store development fallback). Server-authoritative logic.

---

## 1. Auth

| Method | Path | Description | Auth |
|---|---|---|---|
| `POST` | `/api/auth/login` | Authenticate. Returns `token`, `user`, `is_superadmin`, `permission_keys`, `role_keys` | None |
| `POST` | `/api/auth/logout` | Invalidate session | Bearer |
| `GET` | `/api/auth/me` | Current user + effective permissions | Bearer |
| `POST` | `/api/auth/switch-role` | Switch to another authenticated user/role | Bearer |
| `POST` | `/api/auth/password` | Change password | Bearer |
| `POST` | `/api/auth/refresh` | Refresh token | Bearer |

**Login body:** `{ email, password }`. Alias prefixes recognized (`admin`, `it`, `ga`, `sekdir`, `humas`, `sc`, `pibc`, `karyawan`, `auditor`, `spi`).
**Response (200):** `{ token, user: { id, name, email, role, ... }, permission_keys: string[], role_keys: string[] }`.

---

## 2. Tickets (Helpdesk)

| Method | Path | Description | Auth |
|---|---|---|---|
| `GET` | `/api/tickets` | List tickets (scoped by role) | Bearer |
| `POST` | `/api/tickets` | Create ticket | `tickets.create` |
| `GET` | `/api/tickets/:id` | Get ticket | scope |
| `PATCH` | `/api/tickets/:id/status` | Update status (state machine) | `tickets.update` |
| `GET` | `/api/tickets/:id/assignees` | Eligible assignees | `tickets.assign` |
| `PATCH` | `/api/tickets/:id/assign` | Assign agent/unit | `tickets.assign` |
| `POST` | `/api/tickets/:id/verify` | Verify & close | `tickets.update` |
| `POST` | `/api/tickets/:id/assign` | Re-assign / delegate | `tickets.assign` |

**Create ticket body:** `{ title, description, category ('IT'|'GA'|'ME'), priority ('low'|'medium'|'high'|'urgent'), related_asset_id?, contract_id?, location? }`.
**Response (201):** `{ success, data: { id, ticket_number, status, sla_hours, sla_resolution_deadline, ... } }`.

**Status transitions (authoritative):** `open`/`assigned → in_progress → resolved → closed`,
`in_progress → open` (reopen). Arbitrary status rejected (400).

---

## 3. Assets

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/assets` | Scoped asset inventory |
| `POST` | `/api/assets` | Create asset |
| `GET` | `/api/assets/:id` | Asset detail |
| `PATCH` | `/api/assets/:id` | Update asset (protected fields rejected) |
| `POST` | `/api/assets/:id/assign` | Assign asset to user |
| `POST` | `/api/assets/:id/move` | Move asset between locations |
| `GET` | `/api/movements` | Asset movement history |
| `GET` | `/api/maintenances` | Maintenance schedules |
| `POST` | `/api/maintenances` | Create maintenance |
| `PATCH` | `/api/maintenances/:id` | Update maintenance |

Permissions: `assets.read / create / update / assign / move / lifecycle / catalog.read`.

---

## 4. Loans (BAST)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/loans` | List loans |
| `POST` | `/api/loans` | Request loan |
| `POST` | `/api/loans/:id/approve` | Approve (Admin GABAH) |
| `POST` | `/api/loans/:id/reject` | Reject |
| `POST` | `/api/loans/:id/handover` | Handover (in-use) |
| `POST` | `/api/loans/:id/return` | Return |

Permissions: `loans.create / approve / reject / handover / return`.

---

## 5. Users & Roles

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/users` | List users (scoped) |
| `POST` | `/api/users` | Create user |
| `PATCH` | `/api/users/:id` | Update user |
| `DELETE` | `/api/users/:id` | Deactivate user |
| `GET` | `/api/roles` | List roles & permissions |
| `POST` | `/api/admin/rbac/roles` | Create custom role |
| `PATCH` | `/api/admin/rbac/roles/:id` | Update role |
| `DELETE` | `/api/admin/rbac/roles/:id` | Delete role (protected) |
| `PUT` | `/api/admin/rbac/roles/:id/permissions` | Manage role permissions |
| `PUT` | `/api/admin/rbac/roles/:id/scopes` | Manage role scopes |
| `PUT` | `/api/admin/rbac/users/:id/roles` | Assign role(s) to user |

Permissions: `users.*`, `roles.*`, `roles.permissions.manage`, `roles.scopes.manage`.

---

## 6. Organization & Master Data

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/divisions` | Divisions |
| `POST/PUT/DELETE` | `/api/divisions` | Division CRUD |
| `GET/POST/PUT/DELETE` | `/api/locations` | Locations |
| `GET/POST/PUT/DELETE` | `/api/categories` | Asset categories |

---

## 7. Reports & Audit

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/audit-logs` | Audit trail |
| `GET` | `/api/reconciliation` | Asset reconciliation |
| `GET` | `/api/reports` | Reports |

---

## 8. Security

- Authentication via Bearer token; `Authorization` header required for `/api/*`.
- `401` on missing/expired token; `403` on insufficient permission.
- IDs are opaque (`TKT-…`, `AST-…`); no IDOR via direct resource ID unless scoped.
- Vendor substitution / mass-assignment rejected on `PATCH`.
- Sensitive fields (`password_hash`, `password_salt`, `temp_password`) never returned.
- Migration runner owns transactions; `.sql` files are additive/idempotent only.

---

## 9. Versioning

No API version header. Contract fields are additive only; legacy fields remain for backward
compatibility. Breaking changes require a new major version.
