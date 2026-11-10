# GABAH — RBAC Matrix

**Application:** GABAH (General Asset & Business Administration Hub)
**Organization:** PT Food Station Tjipinang Jaya (Perseroda)
**Date:** 2026-11-10
**Version:** 1.0
**Lead:** Hermes Engineering Agent

> Authority is derived solely from the **active database role assignment** (`gabah_user_roles` +
> `gabah_roles.is_superadmin`). Role labels are bootstrap signals only. Backend enforcement is
> always authoritative; menu visibility is UI-only.

## 1. Application Roles (9, login roles)

| # | Role | Persona | Email/alias | Primary scope |
|---|---|---|---|---|
| 1 | Admin GABAH | Budi Santoso | admin@foodstation.co.id | Enterprise |
| 2 | IT | Dani Setiawan | it@ / it.support@ | Divisi IT |
| 3 | GA | Siti Rahmawati | ga@ | Divisi GA |
| 4 | Sekretaris Direksi | Dewi Anggraini | sekdir@ | Sekretariat |
| 5 | Humas | Rina Kartika | humas@ | Humas |
| 6 | Supply Chain | Agus Pratama | sc@ | Divisi SC |
| 7 | PIBC | Bambang Hermawan | pibc@ | Divisi PIBC |
| 8 | Karyawan | Hendra Wijaya | karyawan@ | Supply Chain |
| 9 | Auditor | Maya Indriani | auditor@ | Read-only (ditolak/403) |

> Management, Vendor, and Pangsub are not login roles. Pangsub is deactivated; data retained.

---

## 2. RBAC Matrix (role × module × action)

Legend: `R` read, `W` write, `A` admin (management), `D` denied.

| Module | Permission key(s) | Admin GABAH | IT | GA | Supply Chain | PIBC | Karyawan | Auditor |
|---|---|---|---|---|---|---|---|---|
| **Dashboard** | `dashboard.read` | R | R | R | R | R | R | R |
| **Helpdesk / Tickets** | `tickets.create` | W | — | — | — | — | W | D |
| | `tickets.delegate` | W | — | — | — | — | D | D |
| | `tickets.read` | R | — | — | — | — | W | R |
| | `tickets.update` | W | — | — | — | — | D | D |
| **Assets** | `assets.read` | R | R | R | R | R | R | R |
| | `assets.create` | W | — | — | — | — | W | D |
| | `assets.update` | W | — | — | — | — | W | D |
| | `assets.assign` | W | — | — | — | — | W | D |
| | `assets.move` | W | — | — | — | — | W | D |
| | `assets.lifecycle` | W | — | — | — | — | W | D |
| | `assets.catalog.read` | W | — | — | — | — | W | D |
| **Loans (BAST)** | `loans.create` | W | — | — | — | — | W | D |
| | `loans.approve` | W | — | — | — | — | D | D |
| | `loans.reject` | W | — | — | — | — | D | D |
| | `loans.handover` | W | — | — | — | — | W | D |
| | `loans.return` | W | — | — | — | — | W | D |
| **Maintenance** | `maintenances.read` | R | R | R | R | R | R | R |
| | `maintenances.create` | W | R | R | D | D | D | D |
| | `maintenances.update` | W | R | R | D | D | D | D |
| **Contracts** | `contracts.read` | R | R | R | R | R | R | R |
| | `contracts.create` | W | R | R | R | R | D | D |
| | `contracts.update` | W | R | R | R | R | D | D |
| **Users & Roles** | `users.read` | R | — | — | — | — | — | R |
| | `users.create` | W | — | — | — | — | — | D |
| | `users.update` | W | — | — | — | — | — | D |
| | `users.deactivate` | W | — | — | — | — | — | D |
| | `roles.read` | R | — | — | — | — | — | D |
| | `roles.create` | A | — | — | — | — | — | D |
| | `roles.update` | A | — | — | — | — | — | D |
| | `roles.delete` | A | — | — | — | — | — | D |
| | `roles.permissions.manage` | A | — | — | — | — | — | D |
| | `roles.scopes.manage` | A | — | — | — | — | — | D |
| **Organization** | `divisions.read/create/update` | W | — | — | — | — | — | D |
| | `locations.read/create/update` | W | — | — | — | — | — | D |
| | `categories.read/create/update` | W | — | — | — | — | — | D |
| **Reports** | `reports.read` | R | R | R | R | R | R | R |
| | `reconciliation.read` | R | R | R | R | R | R | R |
| | `audit.read` | R | R | R | R | R | R | R |
| **Notifications** | `notifications.read` | R | R | R | R | R | R | R |
| **Settings** | `system.admin` | A | D | D | D | D | D | D |

> Notes:
> - `D` = 403 denied (backend enforced). Frontend menus for D-permissions are hidden, but access
>   must never be granted via frontend alone.
> - `A` = administration: create/update/delete/grant permission & scope.
> - Blank = no entry (action not present in module).

---

## 3. Scope matrix (data visibility)

| Role | Division | Unit | Location |
|---|---|---|---|
| Admin GABAH | All | All | All |
| IT | Div IT | IT operational unit | All (match) |
| GA | Div GA | GA operational unit | All (match) |
| Supply Chain | Div SC | SC operational unit | All (match) |
| PIBC | Div PIBC | PIBC operational unit | All (match) |
| Karyawan | Div SC | SC unit | All (match) |
| Auditor | All (read-only) | — | — |

---

## 4. Permission keys reference

| Permission key | Module | Action |
|---|---|---|
| `dashboard.read` | dashboard | read |
| `tickets.create / read / update / delegate` | tickets | create/read/update/delegate |
| `assets.read / create / update / assign / move / lifecycle / catalog.read` | assets | — |
| `loans.create / approve / reject / handover / return` | loans | — |
| `maintenances.read / create / update` | maintenances | — |
| `contracts.read / create / update` | contracts | — |
| `users.read / create / update / deactivate` | users | — |
| `roles.read / create / update / delete / permissions.manage / scopes.manage` | roles | — |
| `divisions.{read,create,update}`, `locations.{read,create,update}`, `categories.{read,create,update}` | org | — |
| `reports.read`, `reconciliation.read`, `audit.read` | reports/settings | — |
| `notifications.read` | notifications | — |
| `system.admin` | settings | — |

---

## 5. Verification commands

```bash
# Dynamic RBAC foundation (129/129 target)
node scripts/dynamic-rbac-foundation-verify.mjs

# Security/authorization (37/37 target)
node scripts/p0-security-verify.mjs

# Branch migration safety (5/5 target)
node scripts/branch-migration-safety-verify.mjs

# Backend type check (0 errors target)
npm run lint
```
