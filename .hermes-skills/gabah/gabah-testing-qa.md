---
name: gabah-testing-qa
description: "GABAH verification & QA standard. Test-driven, integration, end-to-end, regression, security, accessibility, performance. Use when running or writing tests, QA on pull requests, or UAT preparation."
version: 1.0
category: software-development
created: "2026-11-10"
---

# GABAH Testing & QA Standard

## Definition of Done (DoD) — a feature is NOT DONE until ALL of these hold

1. UI is functional (no dead buttons).
2. API endpoint works (correct status + body for success AND expected error).
3. Input validation on both frontend and backend.
4. Backend authorization enforced (no UI-only hiding).
5. Data saved correctly and readable back.
6. Data scope respected (no cross-location/role leakage).
7. Permission checks present where required.
8. Audit trail recorded when required.
9. Relevant tests pass (unit + integration + E2E).
10. No regression to existing features.

## Test levels

| Level | Tool | What it covers |
|---|---|---|
| Unit | `tsc --noEmit` (static) | TypeScript strict compile; logic micro-tests |
| Integration | `scripts/*.mjs` verification | Endpoints + DB + RBAC live HTTP matrix |
| E2E | Playwright/backend smoke (`docker-runtime-smoke.sh`) | Full flow in runtime |
| Regression | `scripts/p0-security-verify.mjs` | 37/37 authorization + security assertions |

## Verification scripts (in `scripts/`)

| Script | Target | Pass criteria |
|---|---|---|
| `dynamic-rbac-foundation-verify.mjs` | RBAC foundation | **129/129** |
| `p0-security-verify.mjs` | Security/authorization | **37/37** |
| `branch-migration-safety-verify.mjs` | Migrations non-destructive | **5/5** |
| `navigation-policy-verify.ts` | Role navigation policy | **PASS** |
| `test_core_modules.ts` | TS compile check | **0 errors** |

## Running tests

- `npm run lint` → `tsc --noEmit` (TS strict, 0 errors)
- `npm run build` → `vite + esbuild` → `dist/server.cjs`
- `node scripts/dynamic-rbac-foundation-verify.mjs` → 129/129
- `node scripts/p0-security-verify.mjs` → 37/37 (spawns `dist/server.cjs`)

## Regression discipline

- Every fix gets a failing test first, then the fix (Red-Green-Refactor).
- No behavioral change without a regression test recorded in `scripts/`.
- PRs must include tests that would have failed before the fix.

## Accessibility & responsive

- WCAG 2.1 AA: contrast, focus order, alt text, form labels, keyboard navigation.
- Responsive: all standard breakpoints; no horizontal scroll on mobile.
- Screen-reader: semantic HTML, ARIA where needed, `aria-label` for icon-only buttons.

## Performance

- Vite code-splitting: no chunk > 500 kB after minification.
- Frontend bundle currently 899 kB → target code-split modules (tabs/views/modal).
- Query payloads: do not return full asset/tree JSON to the browser; use scoped projections.

## UAT readiness

- UAT plan per role (Admin GABAH, IT, GA, Supply Chain, PIBC, Karyawan, Auditor) per `docs/testing/UAT.md`.
- Record UAT results as evidence (screenshots/logs/scripts), not narrative.
- UAT closed only after every role's critical flows pass with real data.
