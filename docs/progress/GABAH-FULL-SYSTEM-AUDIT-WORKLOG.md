# GABAH Full-System Audit Worklog

Status: In progress; not a release approval. Snapshot: 2026-11-23.

## Repository state and prior work

Local working tree was clean on main at 0355e1de52bc65ef46768e14cea65ace6755cb14; GitHub main was f39db6b8fd819d301f49815c7a33a04c80b2a6c0. Local commits 19dab19 and 0355e1d were not confirmed on remote main. Audit branch audit/full-system-hardening-2026-11-23 was created from remote main. No reset or merge. Existing history includes fixes for Administration hooks/#310 (#177), MacBook pool collision (#149), PIBC ME queue (#148), and direct IT routing (#147); those are not blindly redone.

Inventory covered React pages/modals, Express authentication/hardening, migrations, scripts, business rules, docs and deployment files. Regression checks exist for Administration entry, related asset linking, loan pool, direct IT routing, PIBC ME, RPC label, Dynamic RBAC and browser storage. Presence is not execution.

## Findings and disposition

| Risk | Finding | Status |
|---|---|---|
| High | Local and remote main are not at the same observed SHA; wholesale synchronization risks overwriting history. | Preserved both; audit branch based on remote main. Branch contains selected local session files. Full ancestry/diff review remains required. |
| High | Role/API/browser UAT not executed. | Open; NOT TESTED. |
| Medium | Existing local cookie migration had not reached remote main. | Carried session issuance/clearing, token extraction, same-origin API use, Origin check and static verifier to audit branch. |
| Medium | Named MacBook loan and ticket asset FK were not reproduced using isolated PostgreSQL. | NOT TESTED; no production data used. |
| Medium | Full module runtime, backup/restore, deployment and dependency review remain incomplete. | Open. |

No schema migration or business rule change. RPC labels, role/division/location distinction, IT/GA/ME scopes and configurable numbering remain unchanged.

## Changes/commits on remote audit branch

- dd5fdda — initial audit worklog.
- 47623be — full-system UAT matrix.
- 4e68dfe — HttpOnly cookie extraction in server auth.
- e9d1d5a — server cookie issue/clear handling.
- 5c2ca29 — cookie Origin checks and same-origin client requests.
- d9fbcc9 — UI/storage verifier and preview dev command carry-forward.
- Current PR #248 head observed: 064599846af76d119da68b41404f7d2a4a8b4e35.

## Verification evidence

| Check | Status | Evidence |
|---|---|---|
| Local Git status at start | PASS | Clean main at 0355e1d. |
| Remote branch creation | PASS | Based on GitHub main f39db6b. |
| TypeScript check | PASS | run_type_checks on local captured workspace: no type errors. |
| Production build | PASS | run_build on local captured workspace; frontend and bundled Express build completed. Large-chunk warning remains. |
| Regression scripts | NOT TESTED | Files inventoried, scripts not executed. |
| PostgreSQL/Docker/API/browser/role UAT | NOT TESTED | No runtime evidence collected. |
| GitHub CI | NOT TESTED | Draft PR opened; exact-head checks not verified. |

PASS for typecheck/build applies to the local captured snapshot, not a CI run on remote PR head.

## Branch and PR

Branch audit/full-system-hardening-2026-11-23; draft PR #248 targets main. No merge. Draft URL: https://github.com/inieki-lab/gabah-gas/pull/248. Review all files and ancestry because local commits were not confirmed on remote main.

## Remaining work

1. Reconcile full local/remote ancestry and review exact PR diff.
2. Run package regression scripts and isolated PostgreSQL/Docker checks, including FK and loan collision fixtures.
3. Run browser/API workflows for Superadmin, IT, GA, PIBC ME, RPC/SC, employee and Auditor.
4. Complete route-by-route module, migration, security, backup/restore and deployment audit.
5. Obtain exact-head GitHub CI and update this record; only close findings with evidence.
