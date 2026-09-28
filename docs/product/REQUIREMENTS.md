# GABAH — Functional & Non-Functional Requirements

**Status:** Authoritative working requirements  
**Last Updated:** 2026-09-28

## Functional Requirements

### FR-01 Authentication
Authenticate users through the Node/Express backend and create server-managed sessions.

### FR-02 Authorization
Enforce RBAC at API/server level.

### FR-03 Asset Register
Authorized users can view/manage assets according to role and division scope.

### FR-04 Asset Numbering
New assets receive a server-generated GABAH asset number.

### FR-05 Assignment
Authorized users can assign assets and record movement/audit history.

### FR-06 Movement
Authorized users can record physical relocation with reason and actor information.

### FR-07 Lifecycle
Authorized users can perform supported lifecycle mutations with audit logging.

### FR-08 Duplicate Prevention
Reject duplicate serial numbers and duplicate corporate/Accurate asset numbers.

### FR-09 Loans
Users can request eligible asset loans. The server rejects conflicting reservations for the same asset/time period.

### FR-10 Loan Workflow
Authorized users can approve, hand over and receive returned loans according to role and workflow state.

### FR-11 Helpdesk
Users can create/view permitted tickets; support roles can manage relevant tickets.

### FR-12 Maintenance
Authorized users can create/manage maintenance records associated with assets/vendors.

### FR-13 Meeting Rooms
Users can request room reservations. Reservations requiring supported IT facilities can generate targeted IT support notifications.

### FR-14 Notifications
Provide role/division/user-targeted notifications for supported events.

### FR-15 Audit Trail
Privileged mutations create audit records containing actor, role, action, entity, entity ID where applicable, details and timestamp.

### FR-16 Reconciliation
Support linking GABAH assets to corporate/Accurate asset numbers without replacing the GABAH number.

### FR-17 QR
Support QR asset labels and scanning for supported workflows.

### FR-18 Search
Provide global search across supported operational records.

### FR-19 Administration
Authorized administrators can manage users and supported master/configuration data.

### FR-20 Persistence
Operational changes persist to PostgreSQL and remain available after application/container restart.

## Non-Functional Requirements

- Security: authorization is server-side.
- Data integrity: critical identifiers and state transitions are validated server-side.
- Auditability: privileged changes are traceable.
- Availability: restart must not destroy PostgreSQL data.
- Maintainability: business logic belongs in backend/domain services.
- Testability: critical workflows are testable at API/server and UI levels.
- Compatibility: changes remain compatible with the active React/Node/PostgreSQL architecture.
- Privacy: internal data is exposed only to authorized roles.

## Priority

**P0:** Authentication, RBAC, asset register/numbering, loans, tickets, persistence, audit.  
**P1:** Maintenance, meeting rooms, notifications, reconciliation, QR, administration, search.  
**P2:** Enhancements that do not affect core operational integrity.
