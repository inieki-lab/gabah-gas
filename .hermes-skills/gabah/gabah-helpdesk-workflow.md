---
name: gabah-helpdesk-workflow
description: "GABAH helpdesk / ticket-assignment workflow. Ticket lifecycle, assignment to staff or unit, progress tracking, verification, audit trail. Use when implementing tickets, assignments, work orders, or helpdesk routing."
version: 1.0
category: software-development
created: "2026-11-10"
---

# GABAH Helpdesk Workflow Standard

## Business requirement (from PRD)

- A ticket owns: `category`, `location`, `reporter`, `description`, `priority`, `attachments`.
- Authorized officer **verifies** the ticket.
- Officer designates a **unit** or **staff agent**.
- Assignment is **persisted** to the database (not a frontend blip).
- Assigned staff see the ticket in their work queue.
- Staff may update `progress`/`status` only if permitted.
- Reporter monitors progress.
- Ticket **resolved** and **verified**.
- All activity logged in history + audit trail.

## Server-authoritative state machine (tickets)

Ticket statuses (canonical, stable across API): `open`, `in_progress`, `resolved`, `closed`, `cancelled`.

- `open → in_progress` (officer verified + assigned)
- `in_progress → resolved` (officer resolved)
- `resolved → closed` (reporter/superadmin closure)
- `open → cancelled` (officer cancelled)
- Forbidden transitions → `400` (e.g. `resolved → in_progress`, `closed → in_progress`).

## Assignment (work order)

- `assigned_agent_id` — staff employee (nullable; `null` allowed for unit-level tickets).
- `assigned_unit_id` — unit (`org_units`) — used for ME/facilities routing.
- Both stored in the `tickets` row and indexed.
- **Assignment is irreversible** unless explicitly cancelled by an authorized officer.

## Permission guards (checklist)

- Officer can **read/create/update** tickets where scope applies.
- Officer can **assign** only users with `tickets.assign` + matching scope.
- Officer can **resolve/verify** only users with `tickets.update` + matching scope.
- Reporter can **read** own tickets + **monitor** (read) only their tickets.
- Auditor is **read-only**; `tickets.create` denied.
- **Cross-location tickets** allowed only for superadmin or the ticket's assigned/owning scope.
- **Menu/action visibility** != **action permission** — backend must enforce.

## Data flow (end-to-end)

```
Create ticket (officer) → POST /api/tickets
  → validate category/location/reporter/priority
  → assign ticket to officer or default owner
  → INSERT tickets, notifications
  → recordAudit('TICKET_CREATED')

Assign ticket (officer) → POST /api/tickets/:id/assign
  → validate ticket status open/in_progress
  → validate agent/unit scope
  → UPDATE tickets (assigned_agent_id / assigned_unit_id)
  → recordAudit('TICKET_ASSIGNED')

Update progress (assigned staff) → PATCH /api/tickets/:id/status
  → validate transition
  → validate actor scope
  → UPDATE status, progress, updated_at
  → recordAudit('TICKET_PROGRESS')

Resolve (officer) → POST /api/tickets/:id/resolve
  → validate transition in_progress→resolved
  → validate scope
  → UPDATE, recordAudit('TICKET_RESOLVED')

Verify (officer) → POST /api/tickets/:id/verify
  → validate resolved→closed
  → recordAudit('TICKET_VERIFIED')
```

## Equipment for QA

- Unit-assigned ticket must appear only in that unit's queue.
- Agent-assigned ticket must not leak to other units.
- Cross-location ticket must return 403 for non-scope actors.
- Assignment to cancelled/closed tickets → 400.
- Duplicate assignment while already assigned → 409.
- Audit trail must contain `TICKET_ASSIGNED`, `TICKET_PROGRESS`, `TICKET_RESOLVED`, `TICKET_VERIFIED` entries.
