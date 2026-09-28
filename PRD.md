# GABAH — Product Requirements Document

**Status:** Authoritative working specification  
**Last Updated:** 2026-09-28

## 1. Product

GABAH (Gerbang Aset & Bantuan Andal Terpadu) is an internal enterprise portal for asset management, helpdesk/support, maintenance, loans, meeting-room reservations, and operational administration for PT Food Station Tjipinang Jaya (Perseroda).

## 2. Goals

1. Establish one authoritative operational application.
2. Keep business rules enforced by the backend, not only by the UI.
3. Make asset ownership, assignment, movement, and lifecycle traceable.
4. Provide a practical internal helpdesk workflow.
5. Prevent double-booking/conflicting asset loans.
6. Provide audit trails for privileged changes.
7. Support corporate/Accurate asset-number reconciliation without replacing the GABAH asset number.
8. Provide a stable foundation for human and AI-assisted maintenance/testing.

## 3. Core Modules

- Authentication and sessions
- Dashboard / attention center
- Asset management and My Assets
- Asset assignment, movement and lifecycle
- Asset loans and BAST
- Helpdesk tickets
- Maintenance
- Vendors / service partners
- Software and licenses
- Meeting rooms and reservations
- Meeting facilities and IT support notifications
- Knowledge base
- Reports, audit and reconciliation
- QR asset label and scanner
- Administration
- Global search

## 4. Users

Seven final login roles:
1. Admin GABAH
2. IT
3. GA
4. Supply Chain
5. PIBC
6. Karyawan
7. Auditor

Management and Vendor are not login roles.

## 5. Product Principles

- Server is authoritative for security and business rules.
- PostgreSQL is authoritative for operational persistence.
- Frontend is a client, not a security boundary.
- Least privilege is preferred.
- Privileged mutations should be auditable.
- GABAH asset number and corporate/Accurate number are separate fields.
- Laravel/PHP is not part of the active architecture.

## 6. Non-Goals

GABAH does not replace Accurate/ERP, does not act as a public marketplace, does not expose internal operational data publicly, and does not introduce a separate PHP/Laravel backend.

## 7. Release Success Criteria

A release is product-ready when all seven roles authenticate according to permissions; critical operations are enforced server-side; asset numbering is server-generated; loan conflicts are rejected server-side; privileged changes are auditable; PostgreSQL data survives restart; production build succeeds; obsolete architecture references are removed; and critical workflows are covered by UAT.
