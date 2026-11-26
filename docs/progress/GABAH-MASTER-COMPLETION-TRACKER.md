# GABAH Master Completion Tracker

Updated: 2026-11-27
Integration base: `main`
Working branch: `ai/chatgpt/vendor-knowledge-rbac-hardening`

## Current work

### Authorization: Vendor and Knowledge Base writes
- [x] Added a PostgreSQL-backed RBAC guard that returns HTTP 503 with `RBAC_UNAVAILABLE` when authorization cannot be verified.
- [x] Vendor create/update now require `vendors.create` / `vendors.update` through Dynamic RBAC.
- [x] Vendor owner-domain checks no longer fall back to legacy role-name checks on write paths.
- [x] Knowledge Base create/update now require `knowledge.create` / `knowledge.update`; legacy Superadmin/IT/GA allowlist fallback removed.
- [x] Added static contract verification for all four write routes.
- [x] Added the verification script to package scripts and GitHub Actions.
- [ ] GitHub Actions on this branch: pending verification.
- [ ] Runtime PostgreSQL integration and role-by-role UAT: not yet verified.

## Prior stabilization work retained for reference

Earlier branch `ai/hermes/authorization-endpoint-audit` contains fixes for asset owner derivation, generic asset status mutation, Maintenance authorization, multi-asset loan prevalidation, and numbering-preview labeling. Its latest CI was green on `febb4e7725d5a8b0dc6bf33f98bc01b3c6a1cac8` (run 45907223713), but that branch is 662 commits ahead and 439 behind current `main`. PR #340 was closed without merge to avoid importing a stale/diverged history. Those changes are **not claimed as merged into main**; they must be reviewed and ported individually when needed.

## Verification and release gates

- Static contract script: included in CI; result pending.
- TypeScript/lint, production build, Docker/PostgreSQL integration: pending for this branch.
- Manual browser UAT for Superadmin, IT, GA, Auditor, and ordinary staff: not verified.
- No production data changes or deployment performed.
- No merge to `main` yet.

## Next steps

1. Wait for exact-head CI and fix any genuine failures.
2. Continue independent endpoint audit (user administration, permission assignments, read/export/search/aggregate endpoints).
3. Review and port any uniquely useful fixes from the closed stale branch into this clean `main)-based branch.
4. Open PR to `main`; merge only after exact-head CI is green and PR diff is focused.
5. After merge, provide the exact `main` commit for user testing.
