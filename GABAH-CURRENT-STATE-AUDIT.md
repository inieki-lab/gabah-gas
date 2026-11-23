# GABAH — Historical Current-State Audit (3 October 2026)

> **Status: HISTORICAL / NOT CURRENT SOURCE OF TRUTH.** This report is preserved as a dated snapshot of the repository at the time it was written. It must not be used as proof of the current role model, authentication design, module implementation, test coverage, or production readiness. Several statements below are known to have been superseded by later code and decisions.
>
> For current project rules and the authority hierarchy, read `docs/GABAH-DOCUMENTATION-CONTROL.md`, `docs/product/BUSINESS-RULES.md`, and the current source code, migrations, tests, CI runs, and worklogs. Re-run every verification before reusing a historical PASS claim.

## Snapshot metadata

- Repository then identified as `inieki-lab/GABAH`; current repository is `inieki-lab/gabah-gas`.
- Original update date: 3 October 2026.
- Original commands/results and implementation descriptions below are historical evidence only.
- Known superseded/unsafe assumptions include a fixed nine-role model, Supply Chain and PIBC as login roles/divisions, and a claim that browser localStorage was limited to the authentication token. Current design separates application role/capability, organizational unit, office location, physical asset location, owner domain, and custodian.

## Historical report retained

The remainder of this file is retained verbatim for audit traceability. Do not treat its "verified", "final", "authoritative", PASS, or production-readiness wording as current status. Current verification must identify the exact commit SHA and test run.
