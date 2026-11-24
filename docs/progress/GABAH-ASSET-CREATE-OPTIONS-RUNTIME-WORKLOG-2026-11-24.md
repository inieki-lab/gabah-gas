# GABAH Asset Create-Options Runtime Verification — 2026-11-24

## Scope
Issue #122 asked that asset-owner choices come from server-side effective permission + owner scope, rather than the primary role label or hard-coded SC/PIBC options.

## Implementation verified on main
- `GET /api/assets/create-options` requires `assets.create`.
- The server calculates owner domains with `canMutateAssetOwner(actor, owner, 'assets.create')`.
- The endpoint excludes legacy SC/PIBC owner codes, filters inactive owners/categories, and mirrors IT hardware/software/license + INV-F corporate ownership overrides.
- `CreateAssetModal` loads this endpoint through the typed `gabahApi.getAssetCreateOptions()` client and fails closed if choices cannot be loaded or no authorized choices exist.
- The modal no longer infers write authority from primary role labels or static SC/PIBC options.
- Backend `createAsset()` remains authoritative and validates permission + owner scope again on POST.

## Added live PostgreSQL checks
- Superadmin receives active owner choices (including IT and GA) but no SC/PIBC/UNASSIGNED owner values.
- IT receives IT only.
- GA receives GA only; read-only IT workstation visibility does not become IT write authority.
- Karyawan and Auditor without `assets.create` receive HTTP 403.
- RPC/SC and PIBC accounts remain primary Karyawan profiles with no implicit `assets.create` grant, verified from PostgreSQL role/permission assignments.
- Returned categories must be active and belong to one of the returned owner domains.
- A custom role with `assets.create` + explicit RPCSC owner scope, assigned alongside GA, receives exactly GA and RPCSC choices; it does not receive IT write authority.

## CI stabilization
- CR-04/CR-05 had earlier intermittent HTTP 429 responses because the isolated suite exceeded its 200-request/minute API limiter.
- The test now resets only the disposable database's API limiter bucket before Auditor document checks and before final owner-reference/ticket-link checks.
- No production rate-limit policy was weakened.

## Verification
- PR #265 merged: live create-options checks; branch CI #3417 passed.
- PR #267 merged: custom-role owner-scope checks and rate-limit test isolation.
- CI #3420 passed 119/119 workflow steps.
- PostgreSQL 17 CR-04/CR-05 passed 185/185 assertions.
- Main CI #3421 passed after merge.
- Issue #122 closed after source review and regression evidence.

## Data safety
No owner data, historical assets, asset numbers, movement history, contract relations, or location mappings were rewritten. This work does not assume a new ownership mapping for historical SC/PIBC assets; review remains per asset under issue #123.
