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
- PR #248 opened at 064599846af76d119da68b41404f7d2a4a8b4e35; subsequent documentation/package commits updated the branch. Latest recorded branch commit: 900b809992a7d8cd9ddcc96b4d372151b3e79f98. Exact-head CI run 45112670340 was in progress at the last check.

## Verification evidence

| Check | Status | Evidence |
|---|---|---|
| Local Git status at start | PASS | Clean main at 0355e1d. |
| Remote branch creation | PASS | Based on GitHub main f39db6b. |
| TypeScript check | PASS | run_type_checks on local captured workspace: no type errors. |
| Production build | PASS | run_build on local captured workspace; frontend and bundled Express build completed. Large-chunk warning remains. |
| Regression scripts | NOT TESTED | Files inventoried, scripts not executed. |
| PostgreSQL/Docker/API/browser/role UAT | NOT TESTED | No runtime evidence collected. |
| GitHub CI | NOT TESTED | Exact-head run 45112670340 was in progress at last check; no completion result verified. |

PASS for typecheck/build applies to the local captured snapshot, not a CI run on remote PR head.

## Branch and PR

Branch audit/full-system-hardening-2026-11-23; draft PR #248 targets main. No merge. Draft URL: https://github.com/inieki-lab/gabah-gas/pull/248. Review all files and ancestry because local commits were not confirmed on remote main.

## Remaining work

1. Reconcile full local/remote ancestry and review exact PR diff.
2. Run package regression scripts and isolated PostgreSQL/Docker checks, including FK and loan collision fixtures.
3. Run browser/API workflows for Superadmin, IT, GA, PIBC ME, RPC/SC, employee and Auditor.
4. Complete route-by-route module, migration, security, backup/restore and deployment audit.
5. Poll exact-head GitHub CI and update this record; only close findings with evidence.

## Follow-up verification (2026-11-23)

- package.json already includes @dyad-sh/react-vite-component-tagger@^0.9.0. The PR lockfile omitted it from root devDependencies and package entry. Synchronized package-lock.json; commit fd03d2105534f7c735c0e9fd1a3bcb0095197789. No dependency removed.
- Clean dependency reinstall: PASS using the workspace clean reinstall operation. Literal npm ci CLI invocation: NOT TESTED.
- TypeScript check: PASS on current captured workspace, no errors. Production build: PASS on isolated snapshot; 1,034 kB JS chunk warning.
- PR branch CI after lockfile update: FAIL, run 45113180356 (verify, completed 04:41:05Z). Detailed job output was unavailable; root cause beyond the observed lock mismatch is NOT TESTED. Do not mark CI green.
- Auth source inspection: no active Bearer, Authorization, x-auth-token, gabah_auth_token, or getToken usage in browser source. API, password reset, and document upload/download requests use same-origin credentials. Server extractToken still accepts legacy Bearer and x-auth-token compatibility transports; runtime endpoint proof and retirement remain open.
- Cookie/session/Origin, password reset, upload authorization, and endpoint matrix have not received runtime integration tests. Module/security backlog remains open.

- Latest exact-head CI after evidence docs commit: FAIL, run 45113547899 (verify, completed 04:44:53Z). Logs could not be retrieved with available interface; root cause remains unknown.


## Follow-up: HttpOnly cookie integration coverage (2026-11-23)

- Migrated the PostgreSQL 17 CR-04/CR-05 live HTTP helper to retain `Set-Cookie` and send the `gabah_session` cookie on subsequent requests. The test does not use or expect a JSON token. Login assertions cover HTTP 200, cookie presence, `HttpOnly`, `SameSite`, seven-day `Max-Age`, and `/api/auth/me` identity/session restore for Admin, IT, GA, Karyawan, and Auditor.
- Added logout/revocation, same-origin `Origin`, invalid and missing `Origin`, anonymous restore, unknown cookie, and the expired-browser-cookie behavior (browser no longer sends cookie; `/api/auth/me` returns 401). The runtime suite does not wait seven days or manipulate the server clock; absolute server expiry is not independently time-advanced in this run.
- Migrated identified HTTP browser-flow regression helpers/login parsing in `asset-import-verify.mjs`, `bulk-import-verify.mjs`, `loan-authz-verify.mjs`, `maintenance-authz-verify.mjs`, `meeting-room-stage3-verify.mjs`, `menu-connectivity-verify.mjs`, `org-model-verify.mjs`, `p0-security-verify.mjs`, `p1-features-verify.mjs`, `rbac-scoping-verify.mjs`, and `t2b1`–`t2b3` to cookie transport. No security assertions were removed. The P0 suite retains one explicit Bearer-compatibility check because server auth intentionally still accepts Bearer credentials; it is not used for browser-flow requests.
- All cookie-authenticated mutation helpers send the same-origin `Origin`; CR-04/CR-05 includes negative invalid/missing-Origin cases. Cookie values are redacted from output.
- Exact-head CI run **45118658142** (`verify`, started 05:34:51Z and completed 05:36:14Z) is **FAIL**. Detailed GitHub job logs were not available through the connected interface, so the failing step/root cause is **UNKNOWN / BLOCKED**. Earlier runs 45116828949 and 45117681777 also failed; the latest run includes the helper change that adds Origin. Do not mark the suite green or individual CI checks PASS without logs.
- The test matrix is now present in CI, but runtime outcomes by persona/scenario cannot be certified from the available summary-only check status. Manual browser UAT remains NOT TESTED. No merge was performed.


## Follow-up: remaining cookie-test migration and latest CI (2026-11-23)

- A branch-head scan found two missed login-response token reads in `maintenance-authz-verify.mjs` and `rbac-scoping-verify.mjs`; both now retain the `gabah_session` pair from `Set-Cookie` and send it as `Cookie`. Login assertions reject JSON token fields. The separate `test-core-modules.ts` live HTTP suite was also migrated to cookies for all personas, logout, and session restore.
- Scanned all 108 `scripts/` source files on the audit branch for stale Bearer header use and JSON token extraction. The only remaining Bearer request is the intentional P0 compatibility assertion against server auth; browser-style requests use cookies.
- Latest exact-head CI run **45121785796** (`verify`, started 06:05:13Z, completed 06:06:46Z) is **FAIL** after the missed parser fixes. The connected GitHub interface exposes only the check summary, not the failing step/log output; root cause and per-test outcomes remain **UNKNOWN / BLOCKED**. This does not establish that the cookie tests passed.
- No security assertions were removed. The branch and draft PR #248 remain open; no merge. Next action requires the failure step output from run 45121785796 so the actual failing cause can be fixed and CI rerun.
