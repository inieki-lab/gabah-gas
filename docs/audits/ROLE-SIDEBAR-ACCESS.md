# Role-Based Sidebar Menu Access

## Configuration location

Superadmin manages sidebar visibility from **Administration → Roles → select a role → Menu Sidebar & Permission per Modul**.

The sidebar is permission-driven. A role receives a menu only when its effective read permission requirements are satisfied. The role editor persists these permissions through the existing Dynamic RBAC role-permission API; there is no separate browser-local menu setting.

## Menu visibility requirements

| Sidebar menu | Read permission requirement |
|---|---|
| Dashboard | `dashboard.read` |
| Aset Saya | `assets.read` |
| Reservasi Ruangan | Both `meeting_rooms.read` and `room_reservations.read` |
| Aset | `assets.read` and `assets.catalog.read`, or the explicit Auditor permission `assets.audit.read` |
| Maintenance | `maintenances.read` |
| Peminjaman Barang | `loans.read` |
| Helpdesk & Tiket | `tickets.read` |
| Software & SaaS | `licenses.read` |
| Contract Management | `contracts.read` |
| Vendor Rekanan | `vendors.read` |
| Knowledge Base | `knowledge.read` |
| Laporan & Audit | `reports.read` |

A global module lifecycle switch can additionally hide a menu for every role. It is intentionally separate from role permissions: module lifecycle is global; role permissions are per-role.

## Security invariants

- Hiding a sidebar item is a navigation convenience, not an authorization boundary. Backend routes continue to enforce their own permission and data-scope checks.
- A write permission alone must not reveal a read-only menu. The navigation policy requires the corresponding read permission(s).
- Disabling a menu by removing its read permission does not automatically remove unrelated write/approval permissions. Review the full role permission matrix when changing a role.
- Auditor asset catalogue visibility remains a deliberate exception through `assets.audit.read`; Auditor remains read-only through backend enforcement.
- User access is the union of assigned active roles, so a menu remains visible if another assigned role supplies its required read permission.
- Superadmin remains protected and cannot be narrowed by editing an ordinary role permission matrix.

## Validation

The navigation policy regression suite is `npm run test:navigation-policy`. It checks permission-first menu visibility, multi-permission room access, Auditor catalogue access, and that write-only permissions do not expose menus. Full lint/build, PostgreSQL-backed authorization tests, and browser UAT are still required before release.
