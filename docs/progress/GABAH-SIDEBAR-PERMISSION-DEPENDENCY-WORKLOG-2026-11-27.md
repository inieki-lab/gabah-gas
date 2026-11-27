# GABAH — Sidebar Permission Dependency Fix Worklog

**Date:** 27 November 2026  
**Branch:** `fix/admin-sidebar-permission-dependencies-2026-11-27`  
**Base:** PR #352 head `f1a40dc88b6edc3fb1ceac393f26d69240478248`  
**Status:** Draft PR; exact-head CI pending; browser UAT not run.

## Findings

The Administration → Roles → Sidebar Menu controls did not fully model the same composite read requirements as the actual navigation policy:

1. **Software & SaaS (Licenses):** actual navigation requires both `licenses.read` and `assets.read`, but the administration menu toggle listed only `licenses.read`. It could report the menu as enabled while Sidebar correctly hid it because the shared asset data permission was absent.
2. **Reports:** actual navigation requires `reports.read` plus at least one readable source collection (`assets.read`, `loans.read`, `tickets.read`, or `maintenances.read`). The administration toggle only checked `reports.read`, creating the same false-enabled state.
3. Menu dependency handling must not revoke shared grants when disabling one menu. In particular, disabling Licenses must remove `licenses.read` but preserve `assets.read`, which also powers My Assets and other asset-backed views.

## Changes

- Added pure permission dependency helpers in `src/navigation/sidebarMenuPermissions.ts`.
- Aligned Licenses toggle with both `licenses.read` and `assets.read`.
- Aligned Reports toggle with `reports.read` and one available source read permission; when enabling without a source grant, the helper adds the first active catalogue option.
- Kept disable operations scoped to the menu's own grants:
  - Licenses removes only `licenses.read`.
  - Reports removes only `reports.read`.
  - Assets removes only `assets.catalog.read` / `assets.audit.read`, preserving `assets.read`.
- Added `scripts/sidebar-menu-permission-sync-verify.ts` and wired it into package scripts and CI.

## Files changed

- `src/components/modals/AdministrationModal.tsx`
- `src/navigation/sidebarMenuPermissions.ts`
- `scripts/sidebar-menu-permission-sync-verify.ts`
- `package.json`
- `.github/workflows/ci.yml`

## Verification

- Added automated cases for Licenses, Reports, Assets, missing permission catalogue entries, and preserving shared grants.
- Exact-head GitHub CI has not completed yet.
- Browser UAT and actual Superadmin role editor interactions have not been run.
- No database migrations, user records, role assignments, or production data were changed.

## Commit / next step

- Implementation and test commits are on the branch above; retrieve current exact HEAD from GitHub before review.
- Next: wait for exact-head CI, fix any regression, then UAT the role editor using a disposable custom role. Do not merge to `main` without explicit owner approval.


## Typecheck correction

- CI run #3917 found that the existing RBAC permission list inferred `Set<unknown>` because the API catalogue's key field is untyped at this component boundary.
- Typed the set as `Set<string>` and normalized each key to a string before passing it to the pure helper.
- Fix commit: `0c1a633d9ec24bb1792b4ec084f41df26c816432`.
- Exact-head CI rerun pending.


## Exact-head CI result

- Run #3920 passed on implementation/test commit `0c1a633d9ec24bb1792b4ec084f41df26c816432`.
- Run #3921 passed on latest branch head `205b90a8e0aa6f375208ff2418d295e21157e34b` (documentation-only commit after the implementation/test commit).
- Both exact runs completed successfully; browser UAT remains not run.


## Baseline menu configurability finding

- A further comparison showed the role editor hard-coded Dashboard, My Assets, Loans, Tickets, and Knowledge Base as "always active" and disabled their checkboxes.
- PostgreSQL navigation does not actually bypass read grants for those menus; it still requires `dashboard.read`, `assets.read`, `loans.read`, `tickets.read`, and `knowledge.read`. A custom role created without those grants could therefore have no visible core menu while the role editor incorrectly reported them as always active.
- Removed that UI-only exemption. All 12 sidebar menus now reflect the effective permission grants and can be configured in the role editor. The permission dependency helper still preserves shared grants where needed.
- Added regression coverage for enabling/disabling the five baseline menus and for the role editor's editable checkbox behavior.
- Latest code commit: `a14d6db772181d36ca475f83571f8722d9e79417`; latest test commit: `c21555dafb4c39fc3d1046775befb383adbaf33c`.
- New exact-head CI pending.
