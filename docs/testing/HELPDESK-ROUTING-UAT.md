# Helpdesk IT / GA / ME — local UAT checklist

Run these checks after pulling the Helpdesk routing PR into the local test environment. Use PostgreSQL-backed mode; file-store mode does not exercise Dynamic RBAC queue scopes.

## Test identities and setup

- IT requester: ordinary Karyawan account.
- IT frontline: the active IT Support account with `tickets.update` and IT ticket scope.
- GA requester: an employee assigned `pemohon_tiket_ga`.
- GA dispatcher: the employee explicitly assigned `ga_helpdesk_operator`.
- ME requester: an employee assigned `pemohon_tiket_me`.
- ME dispatcher: an employee assigned `admin_tiket_me` with `unit_id=UNIT-PIBC-ME`.
- Optional ME UAT dummy identity: set `GABAH_ENABLE_ME_DUMMY_USER=true` outside production before first startup. Use the configured dev/UAT password policy.

## Scenarios

- [ ] Ordinary Karyawan can submit an IT ticket from HO, RPC, PIBC, Pangsub, or Perawatan location.
- [ ] Auditor cannot create IT, GA, or ME tickets and cannot change ticket status.
- [ ] User without `tickets.create.ga` cannot submit GA ticket; assigned GA requester can.
- [ ] User without `tickets.create.me` cannot submit ME ticket; assigned ME requester can.
- [ ] New ME ticket is stored as category ME and assigned to `UNIT-PIBC-ME`.
- [ ] ME notification is visible to the ME unit dispatcher, not every PIBC user.
- [ ] PIBC division scope alone does not reveal a unit-assigned ME ticket.
- [ ] IT ticket auto-assigns only when exactly one active IT frontline user has update permission and matching scope.
- [ ] If IT frontline candidates are zero or ambiguous, ticket stays in the IT queue.
- [ ] GA ticket is visible to the designated GA operator; generic GA role does not receive dispatch/update authority.
- [ ] GA operator can delegate only to an active GA user with `tickets.update` and GA scope.
- [ ] ME dispatcher can delegate only to an active user in `UNIT-PIBC-ME` with `tickets.update` and matching unit scope.
- [ ] A user from another division/unit cannot appear as an eligible assignee.
- [ ] Resolved/closed ticket cannot be reassigned until reopened.
- [ ] Assignment creates an audit event and a direct notification to the selected user.
- [ ] Historical SC/PIBC tickets remain visible as history; new ticket form offers only IT/GA/ME.

## Expected boundaries

- SC/RPC and PIBC are locations, not primary roles or new ticket categories.
- Requester capability does not grant ticket handling or dispatch.
- Generic GA role does not automatically become the GA Helpdesk Operator.
- ME dispatch authority is unit-scoped; division-level PIBC access is not a substitute.
