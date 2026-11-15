# Primary profile roles and office-location mapping

## Canonical primary profile roles

The primary profile role identifies the employee's broad application identity:

- Admin GABAH
- IT
- GA
- Karyawan
- Auditor

Humas and Sekretariat Direksi are function capabilities assigned through Dynamic RBAC, not primary profile roles. This lets an employee remain Karyawan while receiving narrowly scoped Humas or Secretariat permissions.

## Office locations are not roles

Legacy import values are accepted only as migration aliases:

| Legacy value | Stored primary role | Office location |
|---|---|---|
| Supply Chain | Karyawan | OFF-RPC |
| PIBC | Karyawan | OFF-PIBC |

The import does not infer an organizational unit from a location. Unit, job level, division, and office location remain separate attributes and must be supplied from their own masters when applicable.

## Import rules

- Unknown primary roles are rejected; they are not silently converted to Karyawan.
- Humas and Sekretaris Direksi rows are rejected as primary roles and must be imported as Karyawan, then receive the corresponding Dynamic RBAC capability.
- Legacy Supply Chain and PIBC aliases are mapped to Karyawan with the matching office location.
- Job level, unit, and office location IDs are validated against active master records.
