# GABAH AUDIT SUMMARY
## HERMES-AUDIT-SUMMARY.md

**Date:** 2026-11-17
**Branch audited:** `test/gabah-uat-2026-11-17`
**Commit SHA:** `b3c2489`
**Repository:** `https://github.com/inieki-lab/gabah-gas`
**Report:** `docs/audits/HERMES-INDEPENDENT-AUDIT.md`

---

## Branch and Commit

| Item | Value |
|---|---|
| Branch | `test/gabah-uat-2026-11-17` |
| Local ≡ `origin/audit/dynamic-rbac-full-sync` | 0 commits differ |
| Commits ahead of `main` | 459 |
| Commit SHA | `b3c2489` |
| Build (lint/build) | PASS (0 errors; dist + server.cjs produced) |

---

## Report Files

1. **`docs/audits/HERMES-INDEPENDENT-AUDIT.md`** — Comprehensive audit report (29 KB):
   - 1. Repository/branch/commit/environment
   - 2. Executive summary
   - 3. Architecture and module map
   - 4. Checklist matrix (11 phases)
   - 5. 10 findings (FINDING-1 through FINDING-10) with severity, status, file:line, endpoint, description, impact, recommendation, regression test
   - 6. Prior findings status (CR-01 through CR-06, SEC-01 through SEC-10): 5 fixed, 4 partially fixed, 3 observational
   - 7. Test automation and verification (10 tests run; npm audit 0 vulnerabilities)
   - 8. Untested items (blocked by missing PostgreSQL, admin credentials, browser)
   - 9. False positives / no-longer-applicable findings
   - 10. Prioritised recommendations (P0/P1/P2/P3)
   - 11. Release blockers
   - 12. Readiness conclusion: NOT READY (2 P1 blockers)
   - 13. Assumption log and limitations

2. **`docs/audits/HERMES-AUDIT-SUMMARY.md`** — This file.

---

## Top 10 Findings

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | Ticket status PATCH lacks object-level authorization | HIGH | VERIFIED |
| 2 | Document upload is not audited | MEDIUM | VERIFIED |
| 3 | Dashboard data leakage (unfiltered, division-wide) | MEDIUM | STATIC REVIEW ONLY |
| 4 | Frontend permission namespace mismatch (sidebar gating dead) | MEDIUM | STATIC REVIEW ONLY |
| 5 | Asset numbering race condition (missing sequence row) | MEDIUM | VERIFIED |
| 6 | Lockout disabled in non-production | MEDIUM | VERIFIED |
| 7 | In-memory numbering engine not authoritative | MEDIUM | VERIFIED |
| 8 | Static rate limiting (200 req/min) | LOW-MEDIUM | VERIFIED |
| 9 | Missing security headers (CSP, X-Frame-Options, HSTS, etc.) | LOW-MEDIUM | VERIFIED |
| 10 | Seed data cross-reference inconsistency (mnt-003 asset-010) | LOW | VERIFIED |

---

## Test Pass/Fail

| Test | Result |
|---|---|
| `npm run lint` (TypeScript check) | ✅ PASS (0 errors) |
| `npm run build` (production build) | ✅ PASS |
| Menu connectivity (23 tests) | ✅ 23/23 PASS |
| Loan authz (59 tests) | ✅ 59/59 PASS |
| Meeting room stage3 (38 tests) | ✅ 38/38 PASS |
| Employee role normalization | ✅ PASS |
| Trusted client IP (7 tests) | ✅ 7/7 PASS |
| Category master boolean (7 tests) | ✅ 7 PASS |
| `npm audit --omit=dev` | ✅ 0 vulnerabilities |
| `p0-security-verify.mjs` | ❌ BLOCKED (no admin credential) |

**Test automation blocker:** `p0-security-verify.mjs` cannot run (requires `GABAH_INITIAL_ADMIN_PASSWORD` or a dev credential file; none present in this sandbox). This is an environment activation failure, not a code defect.

---

## Blockers

1. **P1:** Ticket status PATCH object-level authorization — any caller with `tickets.update` can rewrite any ticket's status. Verify with E2E (permitted-role actor with no ownership attempts to PATCH another's ticket; must return 403).
2. **P1:** Asset numbering race condition — concurrent transactions can throw `gagal dikunci`. Verify with concurrent-load test on fresh PostgreSQL.
3. **Test automation:** `p0-security-verify.mjs` blocked (missing admin credentials) — environment activation needed.
4. **Untested:** Live PostgreSQL, trigger firing, sequence locking, browser E2E (no PostgreSQL CLI, no browser, no credentials in this sandbox).

---

## Priorities (P0/P1/P2/P3)

| Priority | Findings | Effort |
|---|---|---|
| **P0** | None | — |
| **P1** | FINDING-1 (ticket status authz), FINDING-2 (doc upload audit) | Small |
| **P2** | FINDING-3 (dashboard leakage), FINDING-4 (frontend permission mismatch), FINDING-5 (numbering race) | Medium |
| **P3** | FINDING-6 (lockout), FINDING-7 (numbering engine), FINDING-8 (rate limit), FINDING-9 (headers), FINDING-10 (seed ref) | Small–Medium |

---

## Release Blockers

1. Ticket status PATCH object-level authorization (P1)
2. Asset numbering race condition (P1)

---

## Questions for Business Owner

1. **Ticket status authorization** — Should object-level scoping (reporter/assignee/division owner) be enforced on `PATCH /api/tickets/:id/status`? (Currently only `tickets.update` module permission is checked.)
2. **Document audit** — Should contract document upload be recorded in the audit log (PSAK-16 compliance)?
3. **Dashboard scoping** — Should division dashboards show only their own assets/loans/tickets, or all-division data? (Currently all-division data is shown to division staff.)
4. **Frontend permission keys** — Should the API return the canonical tab-permission keys (dashboard.read, assets.read, assets.catalog.read, assets.audit.read, meeting_rooms.read, loans.read, etc.) used by `roleNavigation.ts`, or should `roleNavigation.ts` check the actual `room_reservations.*` keys?
5. **Numbering engine** — Should the in-memory `AssetNumberingEngine` be removed, or is its formatting required for company-reported numbers?

---

## Estimated Next Steps to Production

1. Fix P1 items (ticket status authz, doc upload audit).
2. Address P2/P3 items (dashboard scoping, frontend permission keys, numbering race).
3. Re-run local verification (lint, build, menu connectivity 23/23, loan authz 59/59, meeting room 38/38, static tests).
4. Run E2E tests (browser) + full P0 security test (with admin credentials).
5. Database migration test fresh + upgrade; backup/restore; deployment rehearsal.
6. Move to **PRE-UAT → UAT CANDIDATE → PRODUCTION CANDIDATE**.

---

*This summary is derived from `docs/audits/HERMES-INDEPENDENT-AUDIT.md`. All findings are based on source-code evidence (file:line), dependency audit, and local-safe verification. No files were modified, no migrations were run, and no production data was accessed.*
