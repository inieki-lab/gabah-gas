# Auditor Role — Static Authorization Review

Review date: 2026-11-17
Branch: `audit/dynamic-rbac-full-sync`
Review status: STATIC REVIEW; automated tests and browser/API UAT are not yet verified on this exact head.

## Intended workspace

The Auditor navigation baseline is:
1. Dashboard
2. Aset
3. Vendor
4. Contract Management
5. Laporan & Audit

Auditor is read-only. The backend middleware denies non-GET requests for any principal with the effective `auditor` role, including when Auditor is an additional role. Logout and notification-read actions remain explicit exceptions.

## Findings and changes

### Fixed in commit `37ed52d28a3d9c2334459f587b046c06e64bec96`

Vendor list visibility was inconsistent with Contract Management:
- Contract visibility in PostgreSQL allowed an Auditor to read cross-owner contracts only when the user had `audit.read` plus explicit `all` scope for module `audit`.
- Vendor list visibility only checked division scope for module `vendors`, so the same Auditor could pass the global audit gate for contracts but receive no vendor catalogue.
- The vendor list now recognizes the same explicit global audit grant (`audit.read` + `all/audit`) and returns the vendor catalogue. This does not grant mutation access; the global Auditor deny-write middleware remains in force.
- Added a static regression assertion in `scripts/asset-scope-policy-verify.mjs` (commit `96b001ecd433c6348ccdc81f03b015643c72ff95`).

### Existing authorization behavior confirmed by source inspection

- Asset catalogue: `assets.audit.read` is a dedicated read-only permission explicitly described by migration 023 as cross-owner audit catalogue access. This is intentional, distinct from ordinary `assets.catalog.read`.
- Contract list/detail and contract document download: record visibility is checked through `canSeeContract`; global Auditor visibility requires `audit.read` plus explicit `all/audit` scope in PostgreSQL mode. Document download checks both contract visibility and that the resolved file remains inside the contract-specific storage directory.
- Audit log route: middleware requires Auditor + `audit.read` + explicit `all/audit` scope; the route also checks `audit.read`.
- Vendor list: now follows the same explicit global audit grant as contracts; otherwise it requires vendor owner scope.
- Write operations: Auditor is globally deny-write at middleware level, not merely hidden in the UI.

## Remaining verification gates

- Run `npm run lint`, `npm run test:asset-scope-policy`, `npm run test:navigation-policy`, `npm run test:dynamic-rbac-foundation`, and the full regression suite on this exact commit.
- Test with PostgreSQL-backed Auditor accounts: no audit scope; explicit global audit scope; Auditor as an additional role; Auditor plus another operational role.
- Verify list, direct detail, document download, exports, global search, dashboard aggregates, and audit trail.
- Confirm vendor contract counts and report aggregates do not reveal out-of-scope records for non-global users.
- Confirm every write route returns 403, including bulk import, upload, lifecycle, approval, and contract sub-resources.
- Confirm the Auditor account is intentionally assigned either the global audit scope or narrower approved module scopes. Do not infer global scope from the role name.

## Release decision

NOT READY TO MARK COMPLETE. This review is static source inspection plus a source-level regression assertion. No CI workflow result or browser/API UAT result is available for commit `96b001ecd433c6348ccdc81f03b015643c72ff95`.
