# Karyawan Role — Static Review

Review date: 2026-11-17
Branch: `audit/dynamic-rbac-full-sync`
Status: STATIC REVIEW; no exact-head CI or PostgreSQL-backed browser/API UAT recorded.

## Benchmark fit

Compared conceptually with GLPI and Jira Service Management's requester/self-service patterns, Karyawan should see personal service workflows—not inventory administration or operational queues.

## Expected menu

- Dashboard
- Aset Saya
- Pinjaman
- Tiket
- Knowledge Base

The current legacy fallback in `src/navigation/roleNavigation.ts` matches this five-item workspace.

## Permission baseline

Migration 094 removes the Karyawan role's default grants for:
- `maintenances.read`
- `meeting_rooms.read`
- `room_reservations.read`

The migration is additive/idempotent and documents that Superadmin can explicitly grant these permissions when a business case exists. It does not introduce per-user permission overrides.

Migration 023 gives the shared employee baseline read access to loans, tickets, meeting rooms, room reservations, and knowledge; migration 094 removes the three operational/facility grants listed above for Karyawan. Loans, tickets, and knowledge remain part of the employee self-service baseline.

## Source-level behavior inspected

- Asset reads in PostgreSQL mode resolve through explicit RBAC scopes. Profile labels, job title, and office location do not themselves grant company-wide asset access.
- Loan list is limited to the employee's own loans plus records in an explicitly assigned owner scope for the loans module.
- Ticket list is limited to the employee's own reported tickets, assigned tickets, and tickets in an explicitly assigned owner scope.
- Maintenance list requires `maintenances.read` and is further restricted by explicit asset/maintenance scope or own-asset scope.
- Room reservation list requires `room_reservations.read`; removing that permission from the Karyawan role closes the default route/menu. Other personas receive only their authorized operational or sanitized views.

## Remaining tests

- Confirm the Karyawan dashboard has no inventory-management, maintenance-planning, or room-administration widgets.
- Confirm Aset Saya only shows assigned assets and approved loanable catalogue records; movement and maintenance history must not expose unrelated assets.
- Test direct API requests to maintenance, room-reservations, asset detail, loans, and tickets.
- Test own request creation, cancellation/withdrawal rules, ticket attachments, notification privacy, and status transitions.
- Test a Karyawan user with an additional operational role to ensure the intended extra permissions/scopes work without broadening unrelated data.
- Test inactive user, revoked role assignment, and expired session behavior.

## Release decision

NOT COMPLETE. This is source inspection, not runtime proof. No CI or PostgreSQL-backed UAT result is claimed for the current branch head.
