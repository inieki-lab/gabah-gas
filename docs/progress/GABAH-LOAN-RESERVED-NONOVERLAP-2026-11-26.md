# GABAH — Allow Non-Overlapping Reservations on Reserved Assets

**Date:** 26 November 2026  
**Branch:** `fix/allow-nonoverlap-reserved-loans-2026-11-26`  
**Base:** `fix/loan-overdue-collision-guard-2026-11-26`  
**Related work:** PR #336 — overdue loan collision guard  
**Status:** Regression updated after CI exposed a stale UI eligibility assertion; second CI run also exposed that the first test edit changed its description but not the regex body. Corrected the actual regex to assert the `['available', 'reserved']` status allowlist; third exact-head CI **SUCCESS** (run `45752593162`, commit `d7a1c185e054c518b7332fbe7c50c2a59e8af187`). New non-overlap regression and all loan service/state checks passed. No database outside disposable CI was accessed.

## Finding

The loan request and approval services required `asset.status === 'available'`. However, approving a future-dated loan changes the asset status to `reserved`. That global status check then rejected every later request for the same asset, even when the requested date range did not overlap the already-approved reservation.

This contradicted the product rule that collision detection is per physical asset and per overlapping date range. A reservation for one future window should not block a different, non-overlapping future window. Physical custody remains a separate, unconditional blocker.

## Change

- Request and approval now accept an asset in `available` or `reserved` status.
- The loan picker now also lists reserved pool assets; its existing date-specific conflict check flags overlapping selections and permits non-overlapping windows. Assets with active/borrowed/overdue custody remain excluded.
- Existing active custody checks remain authoritative: `active`, `borrowed`, and `overdue` loans block another request/approval even if inventory incorrectly says available.
- Existing date-range collision checks remain authoritative for `approved`, `borrowed`, `active`, and `overdue` records.
- Approval continues to mark the asset `reserved`.
- Returning one healthy loan now restores `reserved` (not `available`) if another approved reservation for the same asset still exists; damaged returns remain `damaged`.
- Added `test:loan-reserved-nonoverlap` and registered it in CI. The regression verifies request/approval status gates, UI pool filtering, custody checks, date-range checks, return-state preservation, and the PostgreSQL per-asset `FOR UPDATE` lock.

## Validation boundary

- New non-overlap source regression passed in CI.
- First and second CI runs exposed the pre-existing `Loanable asset pool UI eligibility regression` assertion, which still required `available` only. Corrected the assertion to check the exact `available`/`reserved` allowlist. Third exact-head CI run `45752593162` completed **SUCCESS** on code commit `d7a1c185e054c518b7332fbe7c50c2a59e8af187`.
- No local PostgreSQL integration test or browser UAT was run in this session.
- No loan, asset, borrower, or production database record was changed.
- This branch is stacked on PR #336 so the overdue-custody protection is included.

## UAT required

1. Approve a future reservation for an IT laptop.
2. Confirm the reserved laptop appears in the loan picker. Submit a second request for the same laptop on a non-overlapping date range; it should be accepted.
3. Submit a third request whose dates overlap either approved reservation; it must be rejected with HTTP 409.
4. Set a loan to `borrowed` or `overdue` while inventory is stale as `available`; new requests and approvals must remain blocked.
5. Return the first physical loan while another approved future reservation exists; confirm the asset remains `reserved` and the later approved reservation can be handed over.
6. Return the final physical loan; confirm the asset becomes `available`.

**Merge policy:** Keep draft; do not merge without exact-head CI, disposable PostgreSQL rehearsal, browser UAT, and owner approval.
