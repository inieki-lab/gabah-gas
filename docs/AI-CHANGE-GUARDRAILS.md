# GABAH AI Change Guardrails

Status: Required for AI-assisted changes
Reference: https://github.com/miqdadbadjuber/anti-slop (MIT; used as a source of review principles, not installed as an unconditional project dependency)

## Purpose

Prevent generic AI-generated UI, speculative refactors, duplicated sources of truth, and changes that look complete but do not work. GABAH is an existing operational application. Improve it incrementally; do not redesign or rebuild it by default.

## Non-negotiable workflow

1. **Inspect before editing.** Read the actual route, component, API client, schema/migration, and tests involved. Trace callers and dependencies. Do not infer behavior from filenames or screenshots alone.
2. **State the problem and evidence.** Record the affected user/role, route, component/API, observed defect, and expected behavior. If evidence is insufficient, investigate instead of inventing a fix.
3. **Small, scoped changes.** One coherent issue per change. No drive-by formatting, broad renames, speculative cleanup, framework changes, or unrelated UI restyling.
4. **Preserve existing behavior.** Identify adjacent workflows and regression risks before editing. Do not remove or replace a feature until its usage and dependencies are traced.
5. **One source of truth.** For identity, roles, permissions, navigation, and business records, document which backend contract is authoritative. Do not create parallel localStorage or frontend-only authorization.
6. **Server-side authorization.** Hiding a menu or button is not access control. Verify every relevant API read/write, ownership rule, division/unit/location scope, and approval transition on the server.
7. **No fabricated product behavior.** No dead buttons, placeholder links presented as working, invented metrics, fake users, assumed role assignments, or silent success messages.
8. **No production data mutation by inference.** Never bulk-change users, role assignments, permissions, or operational records without a verified inventory, approved mapping, export/rollback plan, and explicit approval.
9. **Respect GABAH's existing visual identity.** Do not impose generic SaaS patterns, decorative gradients/glows, uniform card grids, gratuitous badges, or unnecessary animation. Reuse established components and tokens where they serve the task. Change visual design only to solve a demonstrated usability problem or when explicitly requested.
10. **Design for the actual operator.** Navigation, landing pages, forms, and actions must reflect the user's role and work. Do not expose every module to every role. Do not assume that a job title alone proves authorization.
11. **Accessible and responsive by evidence.** Check labels, keyboard/focus, contrast, loading/empty/error/success states, narrow screens, overflow, and usable touch targets for changed UI.
12. **No claim without a test.** Distinguish static inspection, automated test, build, runtime test, and manual role-based walkthrough. Report exactly what ran and what did not.

## Required change record

For each issue, record:

- User problem and reproducible evidence
- Current behavior and expected behavior
- Roles and permission keys affected
- Files/routes/schema touched, and why
- Risks and adjacent workflows checked
- Tests run with actual results
- Remaining gaps and rollback approach

## Required verification for role/menu/form work

- Test as each relevant role, not only Superadmin.
- Check direct URL navigation and API calls, not only sidebar visibility.
- Check list, detail, create, edit, delete, submit, approve/reject, and export separately where applicable.
- Check own-record and division/unit/location boundaries.
- Confirm unauthorized requests fail closed on the server.
- Confirm the frontend displays only actions the user can actually perform.

## Definition of done

A change is not complete merely because code was committed or a screenshot looks correct. It is complete only when the intended behavior is demonstrated, relevant regression checks pass, authorization is enforced server-side, and unverified items are clearly listed.

## Anti-slop review

Before shipping UI/copy/code changes, review the relevant Anti Slop principles: purposeful composition, product-specific language, functional controls, accessible states, responsive layout, no fabricated content, and a concise PASS/FAIL delivery report backed by concrete evidence. Do not apply visual rules mechanically when they conflict with GABAH's real operational needs.


## Branch ownership and AI collaboration

- Use `fix/role-based-navigation` as the single integration branch while PR #18 is open.
- Name other agent branches `ai/<agent-name>/<work-item>`; examples: `ai/codex/ticket-scope-audit`, `ai/gemini/room-reservation-uat`.
- Branch from the integration branch while PR #18 is open; branch from `main` after it merges.
- Each AI agent works only on its own branch and submits a PR to the integration branch. Never work in parallel on the same branch.
- Do not delete a branch until its unique commits are reviewed, preserved, and its PR is closed/merged. A closed PR does not itself delete its branch.
