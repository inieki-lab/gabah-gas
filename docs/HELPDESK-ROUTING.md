# Helpdesk routing policy

## Canonical categories

New Helpdesk tickets use only three service categories:

| Category | Purpose | Routing |
|---|---|---|
| IT | Company-wide employee IT support, including PC/laptop, network, software, account and license requests | Automatically assigned only when exactly one active IT frontline user has `tickets.update` and the IT ticket scope; otherwise remains in the IT queue |
| GA | General Affairs facilities and office services | Requester needs `tickets.create.ga`; handling belongs to an explicitly assigned `ga_helpdesk_operator` capability |
| ME | Mechanical, Electrical and maintenance requests handled by Tim Perawatan | Requester needs `tickets.create.me`; ticket is assigned to unit `UNIT-PIBC-ME` and notified to users with that unit scope |

Historical SC and PIBC ticket categories remain readable for old records. They are not offered for new tickets. SC/RPC and PIBC are organizational locations, not ticket-handling roles.

## Dispatch and authorization

- Ticket creation and ticket handling are separate capabilities.
- GA requesters and ME requesters receive only their respective create permission; requester roles do not grant read/update/dispatch privileges.
- A GA employee is not automatically a Helpdesk dispatcher because their primary profile is GA. Superadmin assigns `ga_helpdesk_operator` to the designated operator.
- `admin_tiket_me` is scoped to `UNIT-PIBC-ME` and carries read/update/dispatch permissions for that queue.
- The optional dummy ME UAT account is provisioned only when `GABAH_ENABLE_ME_DUMMY_USER=true` and `NODE_ENV` is not production.
- Dispatch lookup and assignment require `tickets.assign`, queue scope, an active target user, and target `tickets.update` permission plus matching division/unit scope.
- Closed/resolved tickets cannot be reassigned until reopened.
- Assignment writes an audit event and sends a direct notification to the selected operator.

## Data integrity

- `tickets.assigned_unit_id` stores unit-targeted ME queue assignment.
- `notifications.recipient_unit_id` stores unit-targeted notifications.
- ME is mapped to owner division PIBC only for division-level compatibility checks; its actual queue is the dedicated ME unit.
- Existing ticket history and descriptive snapshots are preserved during the category transition.
