# IT & GA Role Static Review

Status: STATIC REVIEW — not an automated or PostgreSQL-backed UAT pass.

## Policy baseline

- IT is the accountable owner for IT hardware across all physical sites. The authorization key is the asset owner domain (IT), not the employee's office location.
- GA manages GA-owned assets only.
- GA may receive the separate `assets.read.it_workstations` capability to view IT-owned laptops and desktops in canonical categories HLT and HPC. This is read-only visibility, not IT asset ownership.
- Job title, site (HO/PIBC/RPC-SC/Pangsub/Kantor Perawatan), and legacy profile labels do not create PostgreSQL permissions or scopes.
- Permission and data scope are separate: a user needs the operation permission and matching owner authority to mutate an asset.

## Source review findings

### IT

- PostgreSQL asset visibility is computed from explicit dynamic scopes. A division scope for IT matches `owner_division = IT` and is independent of `asset_location_id`, physical location text, and the user's office.
- Asset create resolves IT taxonomy/category ownership to IT and then requires `assets.create` plus the configured IT owner scope.
- Generic asset updates, assignment, movement, lifecycle, reconciliation linking, loan operations, and maintenance operations each have their own operation permission and owner-scope checks.
- Ticket visibility/operation is based on reporter, assignee, and explicit ticket owner scope; it is not inferred from the office location.

### GA

- Migration 021 grants `assets.read.it_workstations` to the GA role as a configurable default. It does not grant create/update/import/assign/move/lifecycle permissions.
- The special read path includes only assets with owner IT and category code HLT or HPC. It does not expose all IT assets (for example, licenses or other IT categories).
- The special workstation read permission is not consulted by the asset write-authority resolver. PostgreSQL mutations still require the requested operation permission and a matching owner scope.
- Maintenance explicitly excludes the GA IT-workstation read exception: seeing an IT laptop/PC does not expose the IT maintenance schedule or grant maintenance authority.
- GA's own asset management remains based on its explicit GA owner scope and operation permissions.

## Findings / gaps

1. **Dashboard persona classification — FIXED in follow-up.** The IT/GA labels now follow assigned IT/GA application role keys rather than unrelated room-facility queue permissions. Custom operational roles without IT/GA assignment remain labelled “Operasional”; no unrelated permission is granted to influence dashboard appearance. A dedicated Sekdir high-priority reservation card was also added, using only reservations returned by the scoped API.
2. **Legacy file-store mode remains a compatibility path.** Its role-label fallback is narrower than PostgreSQL RBAC but is not proof of production authorization. Production acceptance must use PostgreSQL.
3. **Runtime evidence is outstanding.** Static source assertions do not prove effective assignments in the target database, migration state, direct-ID API behavior, or browser rendering.

## Required automated and PostgreSQL UAT matrix

- IT user at HO reads and manages IT-owned laptop/PC assets physically located at HO, PIBC, RPC/SC, Pangsub, and Kantor Perawatan.
- IT user cannot mutate GA-owned assets without an explicit GA owner scope and relevant operation permission.
- GA user reads GA-owned assets and HLT/HPC IT-owned assets when `assets.read.it_workstations` is assigned.
- GA user cannot read other IT categories through the workstation exception; test both list and guessed direct asset ID.
- GA user cannot PATCH, bulk-import update, assign, move, lifecycle-change, reconcile, or schedule/update IT maintenance for an IT-owned workstation using only the special read permission.
- Revoking `assets.read.it_workstations` removes the cross-owner workstation rows without removing GA-owned asset access.
- Verify loan, ticket, maintenance, movement history, dashboard aggregates, search, export, and notification links against owner scope.
- Test multi-role combinations and ensure Auditor deny-write remains effective when Auditor is an additional role.
- Verify sidebar, default landing page, and IT/GA dashboard composition for standard and custom roles.

## Release decision

NOT READY for production sign-off. This review is static only. The three regression assertions added to `scripts/asset-scope-policy-verify.mjs` have not yet been executed. No build, lint, full test suite, PostgreSQL-backed authorization test, or browser UAT is claimed here.
