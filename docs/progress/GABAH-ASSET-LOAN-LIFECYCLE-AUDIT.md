# GABAH Asset and Loan Lifecycle Audit

Updated: 2026-11-27
Base: `main` at `20c6e82e9e69f1d8f8fef713a047588bf1dc6bd7`
Branch: `ai/chatgpt/asset-loan-lifecycle-audit-main2`

## Asset owner authority

- [x] New asset owner is derived from the selected category master, not caller-supplied `owner_division`.
- [x] Shared-category resolution may use the selected owner as a lookup hint (e.g. MSN/KDR variants), but the final owner is always taken from the resolved taxonomy object; request data is never copied directly into the persisted owner.
- [x] IT hardware/software and INV-F corporate owner rules remain explicit; other categories use the category's configured owner.
- [x] Asset-scope regression verifies that payload owner cannot override taxonomy owner.

## Multi-asset loan request

- [x] Added `GabahDomainService.requestLoansBatch` with read-only preflight before any loan, notification, audit entry, or loan number is created.
- [x] Preflight validates actor read-only policy, borrower identity/active status, borrower phone, purpose, Jakarta-aware date range, unique asset IDs, asset existence, infrastructure exclusion, pool eligibility, current availability, outstanding physical loans, and confirmed schedule collisions.
- [x] Multi-asset POST route now calls the batch service.
- [x] Existing route-level snapshots remain as a second rollback layer for loan, notification, and audit collections if persistence fails unexpectedly.
- [x] Live HTTP regression verifies a valid first asset plus missing second asset creates no partial loan and no partial audit record.
- [x] Added source-contract assertions that the route uses the batch preflight service.
- [x] First CI caught a missing `actor` argument in the batch-service route call; corrected in commit `2bb9d20`.\n- [x] First CI caught a missing authenticated actor argument; corrected and verified by typecheck.\n- [x] Asset managing-unit regression caught a shared-category resolution compatibility issue; restored the resolver hint while keeping the final owner taxonomy-derived.\n- [ ] Follow-up exact-head CI after both corrections: pending.
- [ ] PostgreSQL multi-instance concurrency/transaction test: not yet verified. Current preflight is process-level and does not replace a database transaction/locking guarantee for concurrent requests.

## Existing main baseline confirmed

- Generic asset PATCH rejects direct lifecycle status changes.
- Asset PATCH snapshots the asset and audit log and restores on persistence failure.
- Server-backed numbering rule CRUD already exists; format remains unchanged.
- No production asset numbering format was changed.

## Release gate

- Merge only after exact-head CI passes and the PR diff is focused.
- No main merge or deployment performed.
- Manual local UAT is still required after merge.

## Next

1. Verify the batch service and owner policy via CI.
2. Audit database-level race protection for concurrent overlapping loan requests.
3. Continue endpoint audit for lifecycle and numbering integrity.
