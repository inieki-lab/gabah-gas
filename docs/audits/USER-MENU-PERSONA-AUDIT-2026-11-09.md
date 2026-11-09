# GABAH — Audit Menu, Persona, and Location Model (2026-11-09)

**Status:** Source-code audit in progress; this document is not a declaration of browser UAT completion.  
**Repository baseline:** `main` as inspected on 2026-11-09.  
**Policy confirmed in this review:** PIBC and RPC are office/work locations. They are not ticket categories, application roles, or automatic permission/asset-owner grants. New Helpdesk requests target IT, GA, or ME; ME is the Tim Perawatan unit under PIBC. Historical records must be preserved pending record-level review.

## 1. Model that every menu must follow

| Dimension | Meaning | Examples |
|---|---|---|
| Primary role | Baseline application identity | Karyawan, IT, GA, Auditor, Admin GABAH |
| Additional role/capability | Explicit extra responsibility | Humas documentation queue, Sekretariat Direksi priority override |
| Job level | Organizational position | Kadiv, Kasi, Staf |
| Organizational unit | Actual work group when verified | Must come from approved HR/org master |
| Office/work location | Where the employee works | HO, PIBC, RPC, Pangsub, Kantor Perawatan |
| Asset physical location | Where an asset is installed/stored | Office, warehouse, room, site |
| Asset owner domain | Function accountable for the asset | Must be explicitly approved; never inferred from PIBC/RPC-SC location |
| Helpdesk service queue | Team that handles the request | IT or GA |

**Hard rule:** A location never grants a role, owner scope, ticket queue, approval right, or cross-location data access by itself.

## 2. Persona and menu review

The review distinguishes menu visibility, page controls, and backend authorization. A menu being visible does not prove the corresponding API action is authorized.

| Persona / menu | Expected baseline | Source review finding | Status |
|---|---|---|---|
| Admin GABAH — Administration | Manage users, roles, permissions, scopes, masters, audit and settings | RBAC role and permission checkboxes exist. However `refreshRbac()` used `Promise.all`; failure of either roles or permission catalogue cleared both lists. This can make the user-role assignment dialog appear to have no roles. Fixed in this audit branch using independent results and an explicit retry/error state. Admin check now also recognizes `is_superadmin`. | Code fix in branch; CI pending |
| Custom role — Role & Permission | Only selected permissions and scopes | Create-role form has permission checkboxes; selected-role editor has permission checkboxes and separate scope controls. The data-loading failure above can hide available roles. Must test against PostgreSQL with catalogue and assignment endpoints independently. | Partially fixed; UAT pending |
| All employees — Dashboard | Personal data and quick actions allowed by effective permissions | Quick actions were hidden only for Auditor and asset registration depended on static role names. Custom roles could see actions they could not execute, or miss actions they were granted. Dashboard card descriptions also use legacy role labels. | P1 follow-up |
| Karyawan / Humas / Sekretariat Direksi — My Assets | Only assigned assets or explicitly scoped records | Navigation uses `assets.read`; backend scopes assets. Must verify direct detail, dashboard cards, export and search use the same scope. | UAT required |
| IT / GA / custom owner-scope roles — Assets | Read/write according to permission plus owner scope | Main create/import controls use permission keys; edit uses the dynamic permission helper. Some legacy owner codes and taxonomy defaults still reference SC/PIBC. Do not migrate old assets automatically. | Partial; owner-master policy unresolved |
| Employees — Loans | See own loans; request borrowing if permitted | Backend filters by borrower or explicit owner scope. UI still identifies employee views from a static list of role labels and hides create only for Auditor. Custom roles and legacy location-labelled users can receive inconsistent labels/controls. | P1 follow-up |
| IT / GA / employees — Helpdesk | Reporter sees own ticket; IT/GA queues depend on explicit ticket permission/scope | Backend GET is reporter/assignee/explicit category-scope based. The page no longer treats SC/PIBC as queues; new service targets are IT, GA, ME. ME tickets carry `assigned_unit_id=UNIT-PIBC-ME`, and notifications are unit-targeted. Create button follows `tickets.create`. Historical SC/PIBC ticket categories remain readable. | Code fix in branch; CI pending |
| IT / GA / employees — Maintenance | Read personal/scoped schedules; create/update by permission plus owner scope | Backend uses `maintenances.read/create/update` and owner scope. UI used a hard-coded Admin/IT/GA list, hiding actions from custom roles with valid permissions. Corrected in this audit branch with separate create/update permission checks. | Code fix in branch; CI pending |
| All permitted employees — Meeting Rooms | Create own reservations; queue capabilities by explicit permission | Backend already separates room approval, IT-facility, Humas documentation and Sekdir priority capabilities. UI used static GA/Humas/Sekdir role-name checks for room master, documentation, approvals and booking. Corrected in this audit branch to use the corresponding permission keys. | Code fix in branch; CI pending |
| Employees — Knowledge Base | Read/vote; create/update only with explicit permission | View uses `knowledge.create/update` permission keys, with file-store fallback. | Looks aligned; API/UAT verification pending |
| Contract owners / PIC / Auditor — Contracts | Scoped contract access, explicit create/upload/renewal capabilities; Auditor read-only | View uses permission keys in PostgreSQL mode, but file-store fallback still lists legacy Supply Chain/PIBC role names. Confirm that no location label grants owner scope. | Review fallback and API scope |
| Vendor maintainers — Vendors | Explicit vendor permission plus owner scope | View uses `vendors.create/update`; API has explicit owner master and scope checks. | Looks aligned; UAT pending |
| Report readers — Reports | Data must match each module's scope and explicit report permissions | Component has no local role checks; it depends on scoped source collections/API. Need verify every report/export/aggregate and direct endpoint, not just the screen. | P1 backend/data-scope audit |
| All personas — Sidebar/navigation | Menu follows effective permissions in PostgreSQL mode | Navigation policy uses permission keys when supplied. Legacy role map remains for file-store compatibility. Sidebar role labels/descriptions/badges still use primary role names for presentation. | Mostly aligned; verify custom roles |

## 3. Confirmed cross-cutting defects and risks

### P1 — Location labels still leak into business model
- `server/taxonomy.ts` seeds new asset categories with owner `SC` and `PIBC` (for example `KDR-SC`, `MSN`, `MSN-PIBC`).
- `server/db.ts` fallback organization data includes `UNIT-SC`, `UNIT-PIBC`, owner divisions `SC`/`PIBC`, and legacy role labels.
- `server/migrations/006_org_model_masters.sql` seeds SC/PIBC as divisions and units, while also creating office locations PIBC and RPC.
- Historical migration comments and old documents still describe RPC/SC as an asset-owning function.
- **Safe action:** preserve existing owner values and history. Do not mass-map operational machinery/trucks to IT or GA without an approved asset-owner decision. New owner master choices and asset-category defaults need a separate controlled decision/migration.

### P1 — Dashboard and Loans still use role names for UI capabilities
- Replace role-based action visibility with effective permissions, and ensure UI controls mirror API permissions.
- In PostgreSQL mode, do not re-filter API-scoped records using a single primary role label.
- Ensure Auditor read-only is enforced by permissions and server policy, not only hidden buttons.

### P1 — Ticket queue policy is IT/GA/ME
- New ticket creation targets IT, GA, or ME. ME is assigned to `UNIT-PIBC-ME` under PIBC.
- The API uses `assigned_unit_id` to expose ME tickets to members of that unit and unit-targeted notifications use `recipient_unit_id`.
- Individual `assigned_agent_id` is still separate from queue routing and is not auto-assigned.

### P1 — Reports and dashboard aggregates need endpoint-by-endpoint scope verification
- Compare list, detail, dashboard aggregate, search, export, notification and report totals for each persona.
- No aggregate should reveal counts/details from records outside that persona's permitted scope.

### P2 — Legacy role and master-data cleanup
- Supply Chain/PIBC role labels remain for historical account compatibility; they must not be offered as new primary employee profiles or grant queues/owner access.
- Job level (Kadiv/Kasi/Staf), unit, office location and additional capability must remain independent.
- The current Administration screen still contains legacy static permission matrix vocabulary and owner-master examples. Mark legacy rows as historical or remove them from new assignment paths only after confirming database references.

## 4. Required persona-by-menu UAT matrix

Run each applicable persona through every menu and direct API endpoint. Capture a positive test and a negative cross-scope test.

| Persona | Dashboard | My Assets | Assets | Loans | Tickets | Maintenance | Rooms | Knowledge | Contracts | Vendors | Reports | Administration |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Super Admin | Global | Global | Global | Global | Global | Global | Manage | Manage | Global | Global | Global | Manage |
| IT | IT/scoped | Assigned + permitted | IT owner scope | IT owner scope | IT queue + own | IT owner scope | IT facility capability | By permission | By permission/scope | By permission/scope | By permission/scope | Deny |
| GA | GA/scoped | Assigned + permitted | GA owner scope + optional IT workstation read-only | GA owner scope | GA queue + own | GA owner scope | Room/facility capability | By permission | By permission/scope | By permission/scope | By permission/scope | Deny |
| Karyawan | Personal | Assigned only | Deny catalog unless granted | Own + request | Own + create | Personal asset schedules if permitted | Own reservation | Read/vote if granted | Deny unless granted | Deny unless granted | Deny unless granted | Deny |
| Humas capability | Personal + assigned docs | Assigned only | Deny unless granted | Own + request | Own + create | Personal if permitted | Documentation queue only | Read/vote | Deny unless granted | Deny unless granted | Deny unless granted | Deny |
| Sekretariat Direksi capability | Personal + agenda | Assigned only | Deny unless granted | Own + request | Own + create | Personal if permitted | Priority override only when granted | Read/vote | Deny unless granted | Deny unless granted | Deny unless granted | Deny |
| Auditor | Read-only scoped audit | Read-only scope | Read-only scope | Read-only scope | Read-only | Read-only scope | Read-only | Read-only | Read-only | Read-only | Read-only | Deny |
| Custom role | Exactly granted permissions and scopes | Exactly granted scope | Exactly granted permission + owner scope | Exactly granted permission + owner scope | Exactly granted queue scope | Exactly granted permission + owner scope | Exactly granted reservation capabilities | Exactly granted | Exactly granted | Exactly granted | Exactly granted | Deny |

**Location test:** Repeat employee scenarios with office location HO, PIBC, RPC, Pangsub, and Kantor Perawatan. Changing only the location must not change role, owner scope, ticket queue, or permissions.

## 5. Work sequence

1. Complete CI for the current ticket/form PR and keep browser UAT as a separate gate.
2. Complete the permission-based view fixes in this branch and run typecheck/build/regression scripts.
3. Audit every server endpoint for list/detail/create/update/approve/export/search/aggregate scope parity.
4. Review master data and migration history. Build a read-only inventory report of users, units, owner domains, asset categories and asset records carrying SC/PIBC values. Do not mutate production data in this step.
5. Obtain approval for the owner of legacy operational assets before any record-level migration.
6. Run persona-by-menu UAT against PostgreSQL, including direct URL/API denial cases, then update the production-readiness gate.

## 6. Explicitly not claimed
- No browser UAT has been completed by this source inspection.
- No production database was queried or modified.
- No legacy user, asset, unit, owner, or ticket records were mass-migrated.
- SC/PIBC legacy owner records and ticket categories are not evidence that those labels are current owner domains.
