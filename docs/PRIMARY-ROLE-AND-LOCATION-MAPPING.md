# Legacy Import Mapping — Primary Profiles and Office Locations

**Status:** Current compatibility rule for migration `048_dynamic_employee_profile_normalization.sql`; not an HR source-of-truth or authority to infer job/unit/permission.  
**Reviewed:** 23 November 2026

## Current organization model

- The only primary account profiles are `Admin GABAH` and `Karyawan`.
- IT, GA, Auditor, Humas, Sekretariat Direksi, ME Admin, and other work functions are additional Dynamic RBAC role/capability assignments.
- Office location, organizational unit, job level, primary profile, additional role, permission, data scope, asset owner, physical asset location, and custodian are separate attributes.
- RPC (legacy code SC) and PIBC are operational locations/contexts, not application roles and not automatic asset-owner domains.
- A user at RPC, PIBC, HO, Pangsub, or Kantor Perawatan may hold a job level such as Kadiv, Kadep, Kasi, or Staf and may receive role capabilities according to assigned duties and approved permissions.

## Legacy database normalization aliases

Migration `048_dynamic_employee_profile_normalization.sql` normalizes existing database records that still contain these legacy values. This migration compatibility table is not the allowlist for new bulk CSV imports. These values are not valid primary profiles and must not be used to infer job level, organizational unit, owner domain, or permission.

| Legacy value | Primary profile after normalization | Location mapping | What is not inferred |
|---|---|---|---|
| Legacy alias Supply Chain / SC | Karyawan | RPC (`OFF-RPC`), only if no location is already set | Legacy login/import alias only; not a current role, division, or owner domain |
| PIBC | Karyawan | PIBC (`OFF-PIBC`), only if no location is already set | Unit, job level, division/owner, role capability, permission, data scope |
| IT | Karyawan | Preserve existing location | IT capability is retained/assigned separately through Dynamic RBAC |
| GA | Karyawan | Preserve existing location | GA capability is retained/assigned separately through Dynamic RBAC |
| Auditor | Karyawan | Preserve existing location | Auditor read-only capability is retained/assigned separately through Dynamic RBAC |
| Humas | Karyawan | Preserve existing location | Humas capability is retained/assigned separately through Dynamic RBAC |
| Sekretaris Direksi | Karyawan | Preserve existing location | Secretariat capability is retained/assigned separately through Dynamic RBAC |

Migration 048 performs this narrowly scoped profile normalization and preserves existing unit/job/division data. It does not derive permissions or owner scope from a location. For production records, any additional correction to HR attributes must use approved HR/master data, an export/dry-run, backup, and a reviewed rollback plan.

## Import rules

- Resolve user identity and active status from the approved employee source.
- Validate office location, organizational unit, and job level against their own masters; do not derive one from another.
- New user creation accepts only the primary profiles `Admin GABAH` and `Karyawan`.
- Bulk CSV import accepts only `Admin GABAH`, `Superadmin` (legacy alias), `Karyawan`, and the legacy location aliases `Supply Chain`/`SC`/`PIBC`; location aliases normalize to Karyawan and the matching office location.
- Functional labels such as IT, GA, Auditor, Humas, and Sekretaris Direksi are rejected as primary-role CSV values. Existing database records are normalized by migration 048; new users receive work-function capabilities separately through Dynamic RBAC after import.
- Unknown or inactive values must be reported for review; never silently grant a default role or broad scope.
- Preserve legacy source values in migration/audit metadata where required for traceability.
- Never use a location string as permission, role, or asset-owner authority.
