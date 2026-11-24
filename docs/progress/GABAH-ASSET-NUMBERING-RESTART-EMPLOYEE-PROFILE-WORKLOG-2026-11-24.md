# GABAH Asset Numbering Restart & Employee Profile Verification — 2026-11-24

## Scope
Close two verification gaps in the implementation truth register after the PostgreSQL atomic numbering and Dynamic RBAC changes were merged.

## Tests added
1. **Asset numbering restart continuation**
   - The CR-04/CR-05 PostgreSQL integration creates assets concurrently on two app instances.
   - It then restarts the primary app against the same PostgreSQL database.
   - The restarted app creates another HLT asset and the test asserts the durable sequence increases by exactly one from the stored counter, and the issued suffix matches the database value.
2. **Migration 048 employee profile normalization**
   - Verify IT, GA, and Auditor users have primary profile Karyawan plus their corresponding secondary role.
   - Verify Superadmin maps to primary Admin GABAH.
   - Verify SC/RPC and PIBC users remain primary Karyawan at OFF-RPC/OFF-PIBC and do not receive location-as-role assignments.
   - Verify no legacy job/location labels remain as primary user profiles.
   - Verify Supply Chain/PIBC role templates are inactive and have no remaining user assignments.

## Verification
- PR #260: https://github.com/inieki-lab/gabah-gas/pull/260
- CI pending.
- No numbering format or historical asset numbers are changed; the company-approved format remains a separate decision.
