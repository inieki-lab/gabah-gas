# GABAH Asset and Loan Lifecycle Audit

Updated: 2026-11-27
Base: `main`
Branch: `ai/chatgpt/asset-loan-lifecycle-audit`

## Asset owner authority\n\n- [x] New asset owner is now resolved from the selected category master, not from caller-supplied `owner_division`.\n- [x] Taxonomy resolution no longer uses the request owner as a hint, preventing payload input from steering ambiguous category resolution.\n- [x] IT hardware/software and INV-F corporate owner rules remain explicit; other categories use their configured taxonomy owner.\n- [x] Added regression coverage in asset scope policy verification.\n\n## Multi-asset loan request

- [x] Added `GabahDomainService.requestLoansBatch` with a complete read-only preflight before any loan, notification, audit entry, or loan number is created.
- [x] Preflight validates actor read-only policy, borrower identity/active status, borrower phone, purpose, Jakarta-aware date range, unique asset IDs, asset existence, infrastructure exclusion, pool eligibility, current availability, outstanding physical loans, and confirmed schedule collisions.
- [x] Multi-asset POST route now calls the batch service.
- [x] Existing route-level snapshots remain as a second rollback layer for loan, notification, and audit collections if persistence fails unexpectedly.
- [x] Extended live HTTP regression to verify a valid first asset plus missing second asset creates no partial loan and no partial audit record.
- [x] Added source-contract assertions that the route uses the batch preflight service.
- [ ] Exact-head CI: pending.
- [ ] PostgreSQL multi-instance concurrency/transaction test: not yet verified. The current preflight is process-level and does not replace a database transaction/locking guarantee for concurrent requests.

## Existing main baseline confirmed

- Generic asset PATCH already rejects direct lifecycle status changes.
- Asset PATCH already snapshots the asset and audit log and restores on persistence failure.
- Existing asset lifecycle/loan workflow regression scripts are present in main.
- No asset numbering format was changed.

## Release gate

- Merge only after exact-head CI passes and the PR diff is focused.
- No main merge or deployment performed.
- Manual local UAT is still required after merge.

## Next

1. Verify the batch service via CI and correct any real failures.
2. Audit database-level race protection for concurrent overlapping loan requests.
3. Continue endpoint audit for asset owner derivation, lifecycle, and numbering configuration.
