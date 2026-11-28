# GABAH Per-User Menu UAT Matrix

**Tanggal:** 28 November 2026  
**Repository:** `inieki-lab/gabah-gas`  
**Purpose:** Expected menu and persona behavior for role-based browser UAT.  
**Status:** Draft test oracle; actual account assignments and browser results still need verification.

## Rules

1. A menu is visible only when its module is globally active **and** the user has the menu's effective read permission(s).
2. Effective permissions are the union of all active roles assigned to that user, after read-only restrictions.
3. A user's primary profile may remain `Karyawan` while additional capabilities (IT, GA, Auditor, Humas, Sekdir, ME queue) come from secondary roles.
4. Location names such as HO, PIBC, RPC/SC, Pangsub, and Kantor Perawatan are not roles. They affect data scope, not menu persona.
5. Backend permission and owner/unit/location scope remain authoritative even if a menu is visible.
6. Removing a permission from a role changes the menu snapshot for affected users; they must re-login after the role policy update. Global module disable hides the module for everyone.

## Expected seeded menu matrix

All rows assume the relevant modules are globally Active. Custom role grants can extend or narrow these results.

| Persona / assigned capabilities | Expected menus | Menus not expected by default | Data/action boundary |
|---|---|---|---|
| Superadmin | All 12 menus | None | Full access; still subject to business validation |
| IT | Dashboard, My Assets, Meeting Rooms, Assets, Maintenance, Loans, Tickets, Software & SaaS, Contracts, Vendors, Knowledge Base, Reports | None | IT owner scope; IT assets all locations; IT queue/maintenance and licensed software |
| GA | Dashboard, My Assets, Meeting Rooms, Assets, Maintenance, Loans, Tickets, Contracts, Vendors, Knowledge Base, Reports | Software & SaaS | GA owner scope; IT read-only exception limited to HLT/HPC workstations; no IT software/license access by default |
| Auditor | All 12 menus | None | Read-only policy; no create/update/approve/assign/handover |
| Karyawan baseline | Dashboard, My Assets, Meeting Rooms, Maintenance, Loans, Tickets, Knowledge Base | Assets catalog, Software & SaaS, Contracts, Vendors, Reports | Own assets/loans/tickets, loanable pool, common room booking, and permitted knowledge data |
| Humas (Karyawan + Humas capability) | Karyawan baseline | Assets catalog, Software & SaaS, Contracts, Vendors, Reports | Humas-specific photo/request and notification actions; ordinary staff data scope |
| Sekdir (Karyawan + Sekdir capability) | Karyawan baseline | Assets catalog, Software & SaaS, Contracts, Vendors, Reports | Priority/secretariat reservation capability; ordinary staff data scope |
| ME queue operator (Karyawan + `tickets.queue.me`) | Karyawan baseline, Tickets view labeled ME queue | Assets catalog, Software & SaaS, Contracts, Vendors, Reports | Ticket queue only for assigned ME unit; assignment permission is separate |
| RPC/PIBC/Pangsub/HO/Kantor Perawatan employee | Based on actual assigned capabilities (usually Karyawan baseline plus job capability) | No menu should be inferred from location label alone | Location/unit scopes constrain records; location is not a role |

## 12 menu permission contract

| Menu | Required effective permission(s) |
|---|---|
| Dashboard | `dashboard.read` |
| My Assets | `assets.read` |
| Meeting Rooms | `meeting_rooms.read` AND `room_reservations.read` |
| Assets | `assets.read` AND (`assets.catalog.read` OR `assets.audit.read`) |
| Maintenance | `maintenances.read` |
| Loans | `loans.read` |
| Tickets | `tickets.read` |
| Software & SaaS | `licenses.read` AND `assets.read` |
| Contracts | `contracts.read` |
| Vendors | `vendors.read` |
| Knowledge Base | `knowledge.read` |
| Reports | `reports.read` AND at least one of `assets.read`, `loans.read`, `tickets.read`, `maintenances.read` |

## Browser UAT checklist per account

For each test account, record its user ID/email in the private UAT sheet (do not commit personal data), primary profile, every assigned role, location/unit, and read-only status.

- [ ] Login/reload restores identity and module status; no permanent “Memuat status modul…”.
- [ ] Visible menus match the matrix after effective role union.
- [ ] Hidden menus cannot be opened by direct URL/state manipulation.
- [ ] Visible menus show only records in the user's owner/unit/location scope.
- [ ] IT-only ticket filter does not show GA/ME categories; GA-only does not show IT/ME; ME operator shows ME queue only.
- [ ] GA sees HLT/HPC IT workstation hardware read-only but not Software & SaaS or IT license records.
- [ ] Auditor is labeled “Audit & Pemantauan” / “Dashboard Auditor” and all mutation attempts are denied.
- [ ] Role permission/scope change revokes affected sessions; unchanged save does not; users return to login and receive fresh menus after re-authentication.
- [ ] Global module disable removes the menu after refresh/focus/re-login; backend rejects direct API calls while disabled.
- [ ] Verify each mutation's positive and negative case: create, edit, assign, approve, reject, handover, return, close, reopen, check-in, check-out.

## Evidence required before marking complete

- Exact account assignment snapshot from a non-production test database.
- Expected vs actual menu list per account.
- API 200/403/404 results for representative reads and mutations.
- Browser screenshots or recorded test results per persona.
- Exact branch/commit and CI run.
- No production account or data changes during this UAT.

**Important:** This is an expected baseline matrix derived from migrations and current navigation policy, not a claim that every real employee account has the listed role assignments. Actual per-account assignment validation remains incomplete until a non-production DB snapshot or browser test is available.
