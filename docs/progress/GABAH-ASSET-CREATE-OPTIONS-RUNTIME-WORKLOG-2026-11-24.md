# GABAH Asset Create-Options Runtime Verification — 2026-11-24

## Scope
Issue #122 asks that asset-owner choices come from server-side effective permission + owner scope, rather than the primary role label or hard-coded SC/PIBC options.

## Existing implementation confirmed on main
- `GET /api/assets/create-options` requires `assets.create`.
- The server calculates owner domains with `canMutateAssetOwner(actor, owner, 'assets.create')`.
- The endpoint excludes legacy SC/PIBC owner codes, filters inactive owners/categories, and mirrors IT hardware/software/license + INV-F corporate ownership overrides.
- `CreateAssetModal` loads this endpoint and fails closed if choices cannot be loaded; it no longer infers write authority from primary role labels.
- Backend `createAsset()` remains authoritative and validates permission + owner scope again on POST.

## Added live PostgreSQL checks
- Superadmin receives active owner choices (including IT and GA) but no SC/PIBC/UNASSIGNED owner values.
- IT receives IT only.
- GA receives GA only; read-only IT workstation visibility does not become IT write authority.
- Karyawan, Auditor, RPC/SC, and PIBC accounts without `assets.create` receive HTTP 403.
- Returned categories must be active and belong to one of the returned owner domains.

## Verification
- CI pending on PR #265.
- No owner data, historical assets, asset numbers, or location mappings are rewritten.
- This test does not assume a new ownership mapping for SC/PIBC historical assets.
