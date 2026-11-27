# Navigation runtime guard audit — 26 November 2026

## Scope
Add integration-level source regression coverage on top of the existing Dynamic RBAC navigation policy tests.

## Findings
- Navigation helper tests already cover permission-to-tab mapping, custom roles, wildcard Superadmin, and default landing selection.
- The app separately revalidates the active page and click navigation against effective permissions and active module state.
- Sidebar visibility also combines permission checks with active module membership.
- The helper-only tests did not explicitly protect these App/Sidebar integration guards from accidental removal.

## Change
- Extended `scripts/navigation-policy-verify.ts` with source assertions for:
  - unknown module state fails closed;
  - active rendered tab requires effective read permission and active module;
  - click navigation rejects unauthorized or inactive tabs;
  - sidebar menu visibility requires permission and active module;
  - wildcard navigation comes from the server permission payload.
- Runtime behavior unchanged; no DB, migration, or seed changes.

## Validation
- Added to a dedicated branch from current `main`: `fix/navigation-runtime-guard-2026-11-26`.
- Exact-head GitHub Actions CI pending; do not report PASS until the workflow completes.
- Browser UAT remains necessary for each persona and module activation/deactivation.

## Safety
- No production database access or mutation.
- No merge to `main`.

## Next
1. Verify exact-head CI.
2. Review Superadmin + additional role, IT/GA operator, ordinary employee, Humas, Sekdir, custom read-only, and inactive-module behavior in browser UAT.
