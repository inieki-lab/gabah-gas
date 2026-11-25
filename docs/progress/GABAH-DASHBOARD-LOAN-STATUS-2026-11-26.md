# GABAH — Dashboard Loan Status Counts

**Date:** 26 November 2026  
**Branch:** `fix/dashboard-loan-status-counts-2026-11-26`  
**Base:** `main`  
**Status:** Fix and regression added; exact-head CI pending.

## Finding

Source audit found a mismatch between backend loan lifecycle states and dashboard aggregation:
- Backend `POST /api/loans` creates requests with `pending_approval`; approval changes them to `approved`; handover changes them to `borrowed`; overdue handling uses `overdue`.
- `GET /api/loans` returns those server lifecycle values without normalizing them.
- Dashboard aggregate counts previously treated only `pending` as awaiting approval and omitted `borrowed` from active loans.
- The employee-specific pending count already used `pending_approval`, so the global and employee dashboard cards could disagree.

Impact: dashboard tiles could under-report pending approvals and loans currently in employee custody.

## Change

- Added shared pure status classifiers in `src/utils/dashboardLoanStatus.ts`.
- Pending states: `pending` (legacy compatibility) and `pending_approval`.
- Active/reservation states: `active` (legacy), `approved`, `borrowed`, and `overdue`.
- Updated global and employee dashboard counts to use the same classifiers.
- Added a regression test for positive and terminal states, registered in npm and CI.

## Validation

- Source evidence reviewed in `server.ts` loan API and `DashboardView.tsx`.
- Regression added; exact-head CI pending.
- No local runtime or browser UAT in this session.
- No database or user data changed.

## Next

1. Verify exact-head CI.
2. Confirm dashboard counts in browser UAT using one pending_approval, one approved, one borrowed, one overdue, and terminal returned/rejected fixtures.
3. Keep merge gated on CI and UAT.

**Merge policy:** No merge to `main` without owner approval.
