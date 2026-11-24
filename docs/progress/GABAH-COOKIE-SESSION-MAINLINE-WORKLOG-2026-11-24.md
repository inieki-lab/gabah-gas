# GABAH HttpOnly Cookie Session Mainline Worklog

Date: 2026-11-24
Status: implementation branch; automated CI green on latest exact head; browser/proxy UAT pending; NOT release approval.

## Branch and ancestry

- Branch: `fix/http-only-session-cookie-mainline-2026-11-24`
- Base: current GitHub `main` at `3ea715723d96e2afbcc25bd3d1683affb46b87ad`.
- This branch is created from current main after the RBAC/secondary-role fixes and production rate-limit secret hardening. It does not reuse the stale ancestry of draft PR #248.
- No merge to main. No production data or schema migration changed.

## Implemented

- `server/auth.ts`: accept `gabah_session` cookie while retaining server-side session validation.
- `server.ts`: issue HttpOnly/SameSite=Strict cookie on login, password change, and role switch; omit session token from JSON; clear cookie on logout.
- `server/runtime-hardening.ts`: require exact same-origin Origin on cookie-authenticated mutation requests.
- `src/services/gabahApi.ts`: use same-origin credentials; remove localStorage/Bearer token client handling, including role-switch and 401 cleanup.
- `src/App.tsx`: restore session by calling server `/api/auth/me`, not by reading browser token.
- `src/components/modals/AdministrationModal.tsx`: password-reset request uses same-origin cookie credentials.
- Regression helpers migrated to cookie transport: asset import, bulk import, CR-04/CR-05, loan authorization, maintenance authorization, meeting-room stage 3, menu connectivity, organization model, P0/P1, RBAC scoping, T2B1-T2B3, and core module test helper.
- Documentation updated: PROJECT-RULES, architecture baseline, security posture review, and UAT session scenario.

## Verification evidence

| Check | Status | Notes |
|---|---|---|
| Branch created from current main | PASS | Based on `3ea7157`; preserves latest main history. |
| Static source scan | PASS | No `gabah_auth_token`, localStorage, getToken/setToken, Bearer headers, or JSON session-token return in the migrated application source files. |
| Regression helper migration scan | PASS | Cookie transport applied; intentional legacy Bearer compatibility assertion remains in P0 verification only. |
| Browser storage policy regression | PASS | Exact-head run 45277119804, step 11. |
| TypeScript lint/typecheck | PASS | Exact-head run 45277119804, step 14. |
| Production build and Docker runtime smoke | PASS | Exact-head run 45277119804, steps 47-50. |
| PostgreSQL 17 CR-04/CR-05 and P0 live HTTP | PASS | Exact-head run 45277119804, steps 51 and 55. |
| Full CI (implementation head) | PASS | Run #3358 / 45277119804; 117/117 job steps completed successfully on code head `5fa9d2f4f4f65b0fb0349f3a940fc90f2299069d`. |\n| Full CI (latest PR head) | PASS | Run #3359 / 45277549562; all 117 job steps completed successfully on latest head `9bea8cf710201fa9e6070e65c7131ac3b8c935a6` (worklog-only commit). |
| Browser UAT for all roles | NOT TESTED | Required before production approval. |
| Production HTTPS/reverse-proxy Origin behavior | NOT TESTED | Verify supported deployment topology before release. |

## Important limitations

- HttpOnly prevents JavaScript from reading the session token; it does not stop XSS from issuing same-origin requests.
- Cookie lifetime remains seven days; CI should verify Max-Age and unauthorized restore after browser cookie omission, not claim a seven-day time-advance test.
- Verify proxy protocol/host behavior in production. Do not weaken Origin validation merely to make a proxy test pass.
- `scripts/test-core-modules.ts` is migrated but is not currently a configured CI workflow step.
- Do not close SEC-FU-02 or mark production-ready until exact-head CI, browser UAT, and production HTTPS/proxy checks pass.

## Next actions

1. Automated CI is green on the latest exact PR head (run #3359); retain the evidence above.
2. Run all role-based browser UAT: Superadmin, IT, GA, ME, RPC/SC, employee, and Auditor.
3. Validate login, restore, logout, password change, role switch, Origin rejection, uploads/downloads, and session revocation in a real browser.
4. Validate production HTTPS and the supported reverse-proxy Origin behavior.
5. Only then request final review and consider merge.
