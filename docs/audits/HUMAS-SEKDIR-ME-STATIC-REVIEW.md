# Humas, Sekretaris Direksi & ME — Static Workflow Review

Status: STATIC REVIEW. No PostgreSQL-backed integration test or browser UAT has been run for this review.

## Humas — documentation workflow

Verified source behavior:
- The Humas queue is a capability, `room_reservations.documentation.read`, not a primary-role-only gate in PostgreSQL mode.
- The reservation API filters the Humas queue to records with `documentation_requested = true`.
- For other people's reservations, the API redacts agenda title, description, attendee list, organizer phone, facility requests, consumption details, general notes, rejection reason, and interruption reason. The documentation brief/type and schedule fields remain available for the assignment.
- Humas photo/documentation notifications are restricted by the same documentation capability in PostgreSQL mode. Explicit user-targeted notifications take precedence and remain private to that user.
- The dashboard's Humas card counts the documentation requests returned by the already-filtered API; it does not fetch a global reservation list from the browser.

Regression coverage added:
- Assert that the Humas queue only includes documentation-requested reservations and redacts private meeting details.
- Assert that the IT facility queue is limited to IT facilities and redacts private agenda details.

## Sekretaris Direksi — priority reservation workflow

Verified source behavior:
- `room_reservations.override_priority` is a separate capability seeded to the Sekretariat Direksi role by migration 034.
- Priority override is capability-based, not granted by a hard-coded display name.
- The user must still have the normal reservation-create capability; the override capability only authorizes the priority/interruption branch under its validation rules.
- Reservation reads remain personal unless the user separately receives an operational queue or audit capability.
- Added a dedicated dashboard card for active HIGH-priority reservations returned by the API, linking to the room reservation workspace. The card does not grant additional data access.

## ME / Mechanical-Electrical-Perawatan — implementation blocker

The current helpdesk domain is not yet ready to safely route a distinct ME queue:
- `TicketCategory` currently supports only `IT | GA | SC | PIBC`.
- The ticket form, API/domain types, owner-scope resolver, dashboard ticket scopes, and PostgreSQL persistence normalization use the existing divisional categories.
- A PIBC employee's physical location must not be treated as an ME role or owner scope. ME is an operational function within PIBC, not the PIBC location itself.
- Simply adding an `ME` label in the form would be unsafe/incomplete: list and direct-ID authorization, ticket assignment, SLA/queue counts, notification recipients, dashboard aggregates, and PostgreSQL constraints/normalization would all need a matching explicit ME owner-domain policy.

Safe next implementation sequence:
1. Add an explicit ME operational owner/function code distinct from office location PIBC.
2. Register an `admin_me` or equivalent configurable role template with only the ticket queue capabilities required (read, update, assign/close as approved).
3. Add an ME ticket category/routing target and PostgreSQL migration; ensure ME scope is required for queue-wide access while reporter/assignee visibility remains intact.
4. Add a configurable routing rule for facility tickets (e.g. wastafel, pintu, AC) to ME, with IT and GA routing kept separate.
5. Create a test account only after an approved account identifier is supplied; do not seed a fake employee or password in production data.
6. Test cross-scope denial, direct ticket IDs, attachments, status transitions, notifications, exports, dashboard counts, and multi-role combinations.

## Additional correction

The GA ticket selector used legacy category `General` while the canonical client type and persisted domain use `GA`. It now submits `GA`, and the existing ticket-related-asset regression script asserts the canonical category values.

## Release gate

NOT READY for production sign-off. Static review and source assertions are not a substitute for CI, a fresh PostgreSQL migration run, or browser UAT. ME routing remains explicitly BLOCKED pending the distinct owner-domain and role-template implementation above.
