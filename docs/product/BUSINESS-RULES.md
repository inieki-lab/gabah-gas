# GABAH — Business Rules

**Status:** Authoritative working business rules  
**Last Updated:** 2026-09-28

## 1. Asset Ownership

| Domain | Owner |
|---|---|
| IT Hardware | IT |
| IT Software / License | IT |
| Furniture (INV-F) | GA |
| GA operational assets | GA |
| Supply Chain assets | Supply Chain |
| PIBC assets | PIBC |

Physical location does not change ownership.

## 2. Asset Number

Canonical format: {OWNER_DIVISION}-{ASSET_CODE}-{YEAR}-{SEQUENCE}

Examples: IT-HPC-2026-0001, IT-SLIC-2026-0001, IT-HSV-2026-0001.

The GABAH asset number is separate from the corporate/Accurate number.

## 3. Registration Authority

Admin GABAH can register assets across the system. IT registers IT assets; GA registers GA assets; Supply Chain registers SC assets; PIBC registers PIBC assets. Karyawan and Auditor do not register assets.

## 4. Asset Visibility

- Admin GABAH: enterprise-wide.
- Auditor: enterprise-wide read-only/audit scope.
- IT: IT assets.
- GA: GA assets plus permitted read-only IT visibility.
- Supply Chain: SC assets.
- PIBC: PIBC assets and permitted PIBC-location scope.
- Karyawan: assigned assets and eligible loan pool.

The server enforces scope.

## 5. Assignment

Assignment changes the current assigned user and asset status and records movement/audit history. Unassignment returns the asset to the available/pool state where supported.

## 6. Loan

A loanable asset cannot be double-booked for overlapping periods. Availability is validated server-side.

Typical lifecycle: Pending → Approved → Handover/Sedang Dipinjam → Returned.

## 7. Ticket

Ticket visibility follows server-side reporter/role/division rules. Frontend state or URL manipulation must not grant access.

## 8. Maintenance

Maintenance records are associated with assets and may reference vendors/service partners. Supported frequencies include monthly, quarterly, semester, annual and incidental.

## 9. Meeting Reservation

Meeting reservations are subject to room availability. When supported IT facilities/equipment are requested, targeted IT support notification may be generated.

## 10. Audit

Privileged mutations should create an audit entry containing action, entity, actor name, actor role, timestamp, details and entity ID where available.

## 11. Roles

Only these seven roles are current application login roles: Admin GABAH, IT, GA, Supply Chain, PIBC, Karyawan, Auditor. Management and Vendor are not login roles.

## 12. Legacy

Old Laravel/PHP architecture descriptions are legacy and must not be used as the current architecture source of truth.
