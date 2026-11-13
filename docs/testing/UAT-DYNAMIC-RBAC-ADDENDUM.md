# GABAH — Dynamic RBAC UAT Addendum

**Purpose:** Replace legacy role-name assumptions in browser UAT with tests against the effective PostgreSQL Dynamic RBAC assignments.
**Status:** Test protocol only. No permission is granted by this document.
**Environment:** Isolated UAT/staging database with disposable test identities and synthetic records. Never use production accounts or mutate production assignments for these tests.

## 1. Preconditions and test evidence

Before each run, record:
- Candidate commit SHA, deployment image tag, database migration version, and test timestamp.
- Test user ID, active status, primary role, additional roles, effective permission keys, and module scopes as read from the administration API/database.
- Organizational unit, job level, and office location as separate attributes.
- Asset owner domain, physical location, and custodian as separate attributes for each test asset.
- Expected result, actual HTTP/UI result, evidence reference, and tester/reviewer.

Do not infer effective access from a job title, unit name, office location, or menu visibility. If the business owner has not approved a permission/scope mapping, mark that scenario **BLOCKED — policy decision required**, not PASS.

## 2. Test identities (provision explicitly in UAT)

| Persona | Identity/assignment under test | Required assertion |
|---|---|---|
| Super Admin | One active account with the designated superadmin capability | Can administer users, role templates, permissions, scopes, and audit; last active Super Admin cannot be removed or demoted |
| IT | IT application role with explicitly configured module permissions and IT owner scopes | Sees and mutates only records allowed by each module permission and IT owner scope |
| GA | GA application role with explicitly configured module permissions and GA owner scopes | Sees and mutates only GA-owned records; IT workstation read is absent unless the dedicated read-only permission is enabled |
| Karyawan | Primary employee identity, no additional operational role | Sees own assigned assets, own loans, own tickets, and own permitted requests; cannot browse other employees' records |
| Karyawan + additional role | Same employee identity with one explicitly assigned additional application role | Additional role grants only its configured permission/scope; primary identity and personal baseline remain intact after unrelated profile updates and restart |
| Auditor | Auditor as primary role and, in a separate test, as an additional role | Authorized reads work; all create/update/delete/approve/assign operations are denied by API, not merely hidden in UI |
| Sekretariat Direksi capability | Employee identity with explicitly approved secretariat capability | Only approved executive reservation/meeting actions appear and succeed; no implicit global asset or contract access |
| Humas capability | Employee identity with explicitly approved Humas capability | Sees only documentation-request queue items; other people's private contacts, attendee lists, IT facilities, consumption details, and internal notes are redacted |
| Supply Chain employee | Primary Karyawan; unit/location attributes identify RPC | Supply Chain is not required as an application role; location alone grants no owner scope or module permission |
| PIBC employee | Primary Karyawan; unit/location attributes identify PIBC | PIBC is not required as an application role; location alone grants no owner scope or module permission |

Use the currently approved office-location master: HO, PIBC, RPC, Pangsub, and Kantor Perawatan. Subang is inactive and must remain historical; do not provision it as an active office location.

## 3. Cross-module authorization matrix

Run each applicable row for every test identity. Test both the UI and direct HTTP API using that user's own session/token.

| Surface | Positive test | Negative test |
|---|---|---|
| Sidebar and route | Only navigation supported by effective permissions is shown; permitted direct route loads | Hidden menu is not treated as security; direct URL without permission is denied |
| Assets | List, detail, search, and export return only assets in effective scope | Guess another asset ID; attempt create/update/delete/assign/move/lifecycle without the matching permission and owner scope |
| My Assets | Employee sees assets assigned to their own stable user ID | Similar employee names, stale names, and another user's asset must not match |
| Loans | Borrower sees own loan; owner operator sees records within explicit loans scope | Cross-owner loan detail, approval, handover, or return outside permission/scope is denied |
| Tickets | Reporter and assigned agent see permitted tickets; owner queue follows explicit tickets scope | Other reporter's ticket and unauthorized assignment/status transition are denied |
| Dashboard and attention | Counts/cards reflect the same scoped source records as the underlying module | Direct attention endpoint must not reveal another user's ticket, loan, or asset details |
| Maintenance | Employee sees own assigned-asset schedules; IT/GA/custom role sees only explicit asset scope | Other owner's schedule and IT maintenance are not exposed by GA's optional workstation inventory-read permission |
| Movements | History follows the same canonical asset visibility as asset list/detail | Direct assetId for an out-of-scope asset returns no history / denied response |
| Room reservations | Each configured capability sees and performs only its assigned queue/actions | Humas cannot retrieve private reservation fields for another organizer; unauthorized priority override is denied |
| Vendors and contracts | Read/write follows module permission and owner scope; PIC access follows the approved contract policy | Cross-owner detail, document download, renewal, and replacement-contract linkage are denied |
| Reports, reconciliation, audit, search, notifications | Every result and aggregate follows the relevant permission and scope | Search snippets, counts, exports, notification links, and direct-ID routes must not bypass the same policy |

For every mutation workflow, test valid input, invalid input, wrong owner, missing scope, inactive user/role, unknown role/scope, and replay/retry where relevant. Expected denial must be enforced server-side (normally 403; 404 is acceptable where the API intentionally conceals record existence).

## 4. Required multi-role and persistence scenarios

1. Assign a primary Karyawan role plus one approved additional role through the administration UI/API.
2. Confirm the assignment is transactional and auditable; invalid role IDs or inactive roles are rejected.
3. Confirm the additional role does not change the employee ID, job level, organizational unit, or office location.
4. Update an unrelated user profile field, restart the application, and re-read the role assignments and effective permissions.
5. Confirm all intended additional roles remain assigned and the primary role remains singular.
6. Remove an additional role and confirm only the permissions/scopes contributed by that role disappear.
7. Attempt to remove/deactivate the last active Super Admin; the operation must be rejected.
8. Test a user with no valid active role and a user with an invalid/inactive scope; both must fail closed.

## 5. Asset owner and location scenarios

Create synthetic assets with distinct owner domains and locations. Include at least:
- IT-owned laptop at PIBC;
- IT-owned network device at HO;
- GA-owned furniture at RPC;
- GA-owned facility asset at Pangsub;
- a legacy/uncertain owner record reserved for Super Admin review.

Verify that physical location does not change owner authority. IT's cross-location scope must not grant GA-owned asset mutation; GA's cross-location scope must not grant IT-owned asset mutation. If GA's `assets.read.it_workstations` permission is enabled, verify Laptop/PC read succeeds but every mutation attempt is denied.

Do not reclassify legacy SC/PIBC owner records from location labels alone. They remain review-only until an approved record-by-record mapping exists.

## 6. Exit criteria

A persona is PASS only when all applicable positive and negative UI/API scenarios pass and evidence is recorded. The UAT cycle is **NOT COMPLETE** if any of these remain:
- untested persona or additional-role combination;
- untested direct URL/API path;
- unexplained mismatch between list, detail, search, export, dashboard, or notification;
- failed or flaky persistence/restart assertion;
- unresolved owner/location mapping or unapproved permission policy;
- missing business-owner sign-off.

Record defects with exact route, user persona, record scope, expected/actual status, sanitized request/response, and reproduction steps. Never attach bearer tokens, passwords, personal contact details, or production records.

**Release rule:** A green CI run is necessary but does not replace this browser/API UAT, legacy-database upgrade rehearsal, backup-and-restore rehearsal, staging deployment, or business-owner approval. Production remains NO-GO until all release gates are signed off.

## 7. Helpdesk queue routing — IT / GA / ME
- Submit IT, GA, and ME tickets from employee accounts at HO, PIBC, RPC, Pangsub, and Kantor Perawatan. Confirm each ticket's category is the service team, not the submitter's location.
- For ME, confirm `assigned_unit_id=UNIT-PIBC-ME`; only users whose `unit_id=UNIT-PIBC-ME` can see the unit queue and receive unit-targeted notifications. A user at PIBC without that unit assignment must not see ME queue tickets.
- Confirm a user in Tim Perawatan can see ME queue tickets regardless of their office location, but cannot see IT/GA queue tickets without their own permission/scope.
- Confirm legacy ticket categories SC/PIBC remain visible as historical data and cannot be newly submitted.
- Confirm notification read/read-all authorization follows the same recipient unit rule.


## 8. Explicit GA helpdesk operator handover

Migration 039 creates the role template `ga_helpdesk_operator` and its `tickets.read`, `tickets.update`, and `tickets.assign` permissions, scoped to division `GA`. It deliberately does **not** assign the role to any employee. The migration also removes `tickets.update` and `tickets.assign` from the generic `ga` role so ticket dispatch authority is held by a designated operator rather than every GA user.

Before applying this migration to a database used by real GA staff, the process owner must identify the actual employee(s) who handle GA helpdesk intake and delegation. Do not infer the operator from the job title Kasi, department, or sample seed identity.

Acceptance checks in an isolated UAT database:
1. Record the designated GA operator's user ID and approval from the GA process owner.
2. Assign `ga_helpdesk_operator` explicitly to that test user through the Super Admin administration workflow; verify the assignment and GA division scope persist after restart.
3. Verify the designated operator can read, update, and assign GA tickets within GA scope, but cannot dispatch IT or ME tickets without separate permissions/scopes.
4. Verify a generic GA user without the operator assignment cannot update/assign GA tickets, while their other approved GA permissions (assets, facilities, vendors, contracts, reports) remain unchanged.
5. Verify removing the operator assignment removes only the ticket-handling capability and is reflected in the audit trail.
6. Do not perform production assignment or migration until the actual operator is named, the change is approved, a database backup is verified, and the production change window is authorized.

**Release blocker:** If no GA operator has been formally designated, mark GA ticket dispatch as **BLOCKED — operator assignment pending**. Do not mark the GA helpdesk workflow PASS and do not silently grant the role to all GA users.

## UAT — Dummy Admin Tiket ME

Akun uji ME bersifat opt-in dan tidak dibuat secara default. Aktifkan hanya pada environment development/staging dengan:

- `GABAH_ENABLE_ME_DUMMY_USER=true` pada `.env` environment development/staging (Docker Compose meneruskan flag ini ke container).
- Atur `GABAH_ME_DUMMY_PASSWORD` sebagai secret khusus akun dummy. Docker Compose meneruskannya ke container; aplikasi hanya menggunakannya jika `GABAH_ENABLE_ME_DUMMY_USER=true` dan akun belum memiliki password hash.
- Jika password khusus tidak diisi, mekanisme credential canonical yang ada menggunakan `GABAH_INITIAL_USER_PASSWORD` atau password acak dev. Password akun yang sudah pernah dibuat tidak ditimpa otomatis.

Identitas akun uji:
- Nama: Dimas Pratama (Dummy Admin ME)
- Email/login: `admin.me.dummy@foodstation.co.id`
- User ID: `USR-ME-ADMIN-001`
- Primary role: Karyawan
- Additional role: Admin Tiket ME
- Unit: Tim Perawatan (ME) — `UNIT-PIBC-ME`
- Lokasi penempatan: Kantor Perawatan — `OFF-PERAWATAN`

Acceptance checks:
1. Akun muncul pada direktori pegawai saat opt-in aktif.
2. Akun menerima antrean tiket yang memiliki `assigned_unit_id=UNIT-PIBC-ME`.
3. Akun dapat membaca notifikasi antrean ME dan memperbarui status/catatan tiket ME sesuai permission.
4. Akun tidak dapat mengelola tiket IT/GA, data aset PIBC secara umum, atau modul Maintenance.
5. Saat `GABAH_ENABLE_ME_DUMMY_USER` tidak aktif, akun dummy tidak dibuat. Jangan aktifkan flag ini pada production.
