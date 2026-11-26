# GABAH Master Completion Tracker

Updated: 2026-11-27
Integration branch: `main`
Current HEAD: `012e0b51474acfd92c51554a7a789d60654add02`

## Recently merged to main

### PR #341 — Vendor and Knowledge Base Dynamic RBAC
- Merge commit: `20c6e82e9e69f1d8f8fef713a047588bf1dc6bd7`
- Exact-head CI: PASS, run [45909210166](https://github.com/inieki-lab/gabah-gas/actions/runs/45909210166).
- Vendor create/update and Knowledge Base create/update use Dynamic RBAC permissions in PostgreSQL mode.
- Vendor owner scopes are checked for both existing and requested owner.
- Development file-store retains only its bounded legacy allowlist; production startup fails if PostgreSQL is unavailable.

### PR #344 — Asset owner authority and multi-asset loan preflight
- Merge commit: `040d30288fc4c912294c379a83c680f6ac540f1f`
- Exact-head CI: PASS, run [45910357029](https://github.com/inieki-lab/gabah-gas/actions/runs/45910357029).
- New asset owner is taken from resolved category taxonomy; caller input is not copied directly to the final owner.
- Shared categories retain supported resolver hints, while final ownership remains taxonomy-derived.
- Multi-asset loan requests preflight every asset before the first loan, notification, audit entry, or sequence allocation.
- Existing route-level rollback remains as a second safeguard.
- Runtime loan authorization and asset managing-unit regressions passed.

## Known limitations and outstanding work

1. **Loan concurrency across multiple app instances:** the preflight prevents partial mutations within one application process. PostgreSQL transaction-level locking/constraint behavior for simultaneous overlapping loan requests still needs a dedicated integration test.
2. **User and role administration:** continue endpoint audit for profile updates, bulk import, role assignments, and session revocation.
3. **Role-by-role UAT:** manual browser testing for Superadmin, IT, GA, Auditor, and ordinary staff remains pending.
4. **Numbering standard:** server-managed numbering rules and sequence CRUD are present. Do not impose a final corporate number format until the company standard is confirmed.
5. **Production deployment:** no production data changes or deployment have been performed.

## Verification baseline

- TypeScript/lint: PASS on PR #341 and PR #344 exact-head runs.
- Production build: PASS on PR #344.
- Docker image build and runtime smoke (Node 22 + PostgreSQL 17): PASS on PR #344.
- PostgreSQL fresh-database/persistence integration: PASS on PR #344.
- Loan authorization and state-transition runtime suite: PASS on PR #344.
- Asset managing-unit regression: PASS on PR #344.
- Manual local UAT by the user: pending.

## Next actions

- Add PostgreSQL concurrency protection/verification for overlapping loan requests.
- Continue auditing user administration and remaining API read/export/search/aggregate endpoints.
- Complete role-by-role UAT after the user pulls this `main` commit.
