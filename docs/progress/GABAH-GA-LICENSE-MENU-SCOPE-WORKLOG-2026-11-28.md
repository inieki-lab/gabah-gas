# GABAH GA License Menu Permission Scope Worklog

**Tanggal:** 28 November 2026  
**Repository:** `inieki-lab/gabah-gas`  
**Base:** `main`  
**Branch:** `fix/ga-license-menu-permission-scope-2026-11-28`  
**Status:** IMPLEMENTED — exact-head CI pending; browser UAT pending.

## Temuan terkonfirmasi

- Migration 023 grants `licenses.read` to `superadmin`, `it`, `ga`, and `auditor`.
- Sidebar displays Software & SaaS when the effective permission set contains both `licenses.read` and `assets.read`.
- GA also receives `assets.read`, so the default GA role currently satisfies the Software & SaaS menu's permission contract.
- The approved operating scope for GA is read-only access to IT workstation hardware only (HLT/HPC categories); it does not include IT software/license records.
- Backend asset scope already limits GA's IT exception to owner IT + HLT/HPC workstation categories, so the extra license menu can be visible while returning no relevant software/license records. This is a menu-permission mismatch.

## Perbaikan

- Add additive migration `050_remove_ga_licenses_read_permission.sql`.
- Remove only `licenses.read` from the default `ga` role.
- Preserve `licenses.read` for IT, Superadmin, and Auditor.
- Custom roles may still receive `licenses.read` explicitly through Superadmin RBAC configuration.
- Preserve GA's explicit `assets.read.it_workstations` scope and HLT/HPC read-only filter.
- Add regression script, npm command, and CI step.

## File berubah

- `server/migrations/050_remove_ga_licenses_read_permission.sql`
- `scripts/ga-license-menu-scope-verify.mjs`
- `package.json`
- `.github/workflows/ci.yml`
- Dokumen worklog ini.

## Validation

- Source inspection of migration 023, GA/IT workstation scope migration 021, service-level HLT/HPC filter, and Sidebar license permission contract: DONE.
- Regression assertions added for GA grant removal and preservation of the IT workstation read-only scope.
- Local npm test, migration execution, PostgreSQL integration, exact-head CI, and browser UAT: pending/not run.
- UAT wajib: GA sees IT workstation hardware read-only but not Software & SaaS; IT and Auditor retain their intended license menu; Superadmin retains all access; custom GA role only sees licenses if explicitly granted.

## Safety

- The migration removes one default role grant only; it does not edit user assignments or custom role permissions.
- Existing user sessions may retain a stale permission snapshot until PR #362's role-policy/session refresh behavior is integrated; affected users should re-login after role policy changes.
- No asset records, license records, owner divisions, or business data changed.
- No merge to `main` without explicit owner approval.


## Exact-head CI result

- CI #4026 (run ID 46130905998) completed SUCCESS, 121/121 workflow steps, on exact PR head 66eeee0cf43d047dcc78cf4e33aa993e8930c17c.
- This validates the new GA license-menu regression and the workflow's PostgreSQL migration/integration, TypeScript/build, and Docker/runtime checks.
- Browser UAT remains pending.


## Latest worklog-head CI

- CI #4029 (run ID 46131158521) completed SUCCESS, 121/121 steps, on latest worklog head 3f57ee3e2896efac212c8e81b817790f0afb9bbf.
