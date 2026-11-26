# GABAH — Overdue Loan Collision Guard

**Date:** 26 November 2026  
**Branch:** `fix/loan-overdue-collision-guard-2026-11-26`  
**Base:** `main`  
**Status:** Implementation and regression committed; exact-head CI pending.

## Finding

The loan workflow already treats `overdue` as outstanding physical custody in stale-asset checks, but schedule-collision checks were inconsistent:
- The PostgreSQL trigger in migration 098 omitted `overdue` from both the new-row and existing-row status sets.
- The client-side schedule pre-check omitted `overdue`.
- Domain schedule overlap checks did not consistently classify overdue rows as active reservations.

An overdue loan means the physical unit has not been returned. It must remain unavailable even if an inventory snapshot incorrectly says `available`.

## Changes

- Added migration 107 to replace the PostgreSQL collision trigger and include `overdue` in both status sets.
- Preserved the per-asset `FOR UPDATE` lock to serialize concurrent approvals.
- Updated server and client schedule-collision checks to include `overdue`.
- Clarified BR-03.2 and added a changelog entry.
- Added `test:loan-overdue-collision` and registered it in CI.

## Safety

- No existing loan, asset, borrower, or inventory record was modified.
- No production database was accessed.
- Migration changes trigger behavior only; it does not rewrite business data.

## Validation

- Source-level regression added for trigger, row lock, server guard, and client pre-check.
- First CI attempt exposed malformed JSON in the new package script registration (`EJSONPARSE`); corrected immediately in commit `00dd801d2f4bab3a8a59893ceef4b844107421ca`.\n- Exact-head CI for the corrected commit: awaiting GitHub Actions.
- Local runtime/PostgreSQL rehearsal and browser UAT: not run in this session.

## UAT still required

1. Rehearse migration 107 on a disposable PostgreSQL 17 database upgraded from the current schema.
2. Create an overdue loan for an asset while inventory is deliberately stale as `available`; confirm a new overlapping approval is rejected.
3. Confirm unrelated assets can still be borrowed concurrently.
4. Confirm return workflow releases the asset and subsequent valid loan can proceed.

**Merge policy:** Keep this PR draft; do not merge to `main` without owner approval.
