# GABAH Master Completion Tracker

Updated: 2026-11-27
Integration base: `main`
Working branch: `ai/chatgpt/vendor-knowledge-rbac-hardening`

## Current work

### Authorization: Vendor and Knowledge Base writes
- [x] Added a Dynamic RBAC guard for Vendor and Knowledge Base write operations.
- [x] Vendor create/update now require `vendors.create` / `vendors.update` through Dynamic RBAC.
- [x] Vendor owner-domain checks use Dynamic RBAC scopes in PostgreSQL mode; development file-store retains only the existing narrow IT/GA owner compatibility path.
- [x] Knowledge Base create/update require `knowledge.create` / `knowledge.update` in PostgreSQL mode; development file-store retains the explicit Superadmin/IT/GA allowlist.
- [x] Added static contract verification for all four write routes, including production fail-fast on PostgreSQL startup failure and bounded development file-store compatibility.
- [x] Added the verification script to package scripts and GitHub Actions.
- [x] Initial CI identified four stale contract assertions; they were corrected to validate the intended PostgreSQL Dynamic RBAC plus bounded development fallback contract.
- [x] CI then exposed one existing asset-scope contract that confirms file-store compatibility; route behavior and tests now preserve that development contract without changing production PostgreSQL authorization.\n- [ ] Follow-up exact-HEAD CI after compatibility correction: pending.
- [ ] Runtime PostgreSQL integration and role-by-role UAT: not yet verified.

## Prior stabilization work retained for reference

Earlier branch `ai/hermes/authorization-endpoint-audit` contains candidate fixes for asset owner derivation, generic asset status mutation, Maintenance authorization, multi-asset loan prevalidation, and numbering-preview labeling. Its latest CI was green on `febb4e7725d5a8b0dc6bf33f98bc01b3c6a1cac8` (run 45907223713), but that branch is 662 commits ahead and 439 behind current `main`. PR #340 was closed without merge to avoid importing a stale/diverged history. Those changes are **not claimed as merged into main**; they must be reviewed and ported individually when needed.

## Verification and release gates

- Static contract script: included in CI; result pending.
- TypeScript/lint, production build, Docker/PostgreSQL integration: pending for this branch.
- Manual browser UAT for Superadmin, IT, GA, Auditor, and ordinary staff: not verified.
- No production data changes or deployment performed.
- No merge to `main` yet.

## Next steps

1. Wait for exact-head CI and fix any genuine failures.
2. Continue independent endpoint audit (user administration, permission assignments, read/export/search/aggregate endpoints).
3. Review and port any uniquely useful fixes from the closed stale branch into this clean `main`-based branch.
4. Open PR to `main`; merge only after exact-head CI is green and PR diff is focused.
5. After merge, provide the exact `main` commit for user testing.
