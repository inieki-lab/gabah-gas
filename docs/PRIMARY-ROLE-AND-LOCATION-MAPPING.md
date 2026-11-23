# Legacy Import Mapping — Roles and Office Locations

**Status:** HISTORICAL migration guidance only; not a canonical role catalogue or authority to reassign live users.  
**Reviewed:** 23 November 2026

## Current organization model

- Application roles/capabilities are flexible and administered through Dynamic RBAC; this file does not define a closed list of primary roles.
- Office location, organizational unit, job level, application role, permission, data scope, asset owner, physical asset location, and custodian are separate attributes.
- RPC/SC and PIBC are operational locations/contexts, not application roles and not automatic asset-owner domains.
- A user at RPC, PIBC, HO, Pangsub, or Kantor Perawatan may hold a job level such as Kadiv, Kadep, Kasi, or Staf and may receive role capabilities according to assigned duties and approved permissions.

## Legacy import aliases

The following aliases may appear in old seed data or imports. They must not be used to infer a live user's current role, division, job level, or permission.

| Legacy value | Interpretation for migration review | Required validation |
|---|---|---|
| Supply Chain / SC | Legacy label associated with RPC operational context | Confirm current employee unit and duties from approved HR/master data |
| PIBC | Legacy operational context/location | Confirm current employee unit and duties from approved HR/master data |

Do not automatically convert existing users or production data based only on these labels. Any import mapping requires an approved employee inventory, explicit mapping, dry-run report, backup/export, and rollback plan.

## Import rules

- Resolve user identity and active status from the approved employee source.
- Validate office location, organizational unit, and job level against their own masters; do not derive one from another.
- Assign application roles and permissions from the approved duty/authorization mapping, not from a legacy location string.
- Unknown or inactive values must be reported for review; never silently grant a default role or broad scope.
- Preserve legacy source values in migration/audit metadata where required for traceability.
- Never use this document to authorize bulk role changes or data migration without explicit owner approval.
