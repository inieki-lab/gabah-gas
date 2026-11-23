# Repository instructions for AI coding agents

## Required reading (mandatory, every session)

1. `docs/GABAH-DOCUMENTATION-CONTROL.md` — source-of-truth hierarchy and AI handoff.
2. `docs/PROJECT-CONTEXT.md` — owner-approved product and organization constraints.
3. `docs/IMPLEMENTATION-TRUTH-REGISTER.md` — source-observed behavior, partial migrations, and known gaps (not test evidence).
4. `.agents/skills/gabah-maintainer/SKILL.md` — repository workflow.
5. `docs/AI-CHANGE-GUARDRAILS.md` — safety and change boundaries.
6. `docs/product/BUSINESS-RULES.md` and `docs/architecture/RBAC.md` for business and access changes.
7. The relevant current implementation, migrations, tests, and latest worklog.

If documents conflict, follow the authority order in Documentation Control. Historical reports and stale branch instructions are not current policy.

## Non-negotiable boundaries

- Never commit directly to `main`.
- Do not bulk-change production users, roles, permissions, asset owners, locations, or operational records without a verified inventory, approved mapping, export/rollback plan, and explicit authorization.
- Menu visibility is not backend authorization. Verify server-side authorization and data scope.
- Do not invent role assignments, business rules, UI behavior, or test results.
- Preserve the existing application and data. No rebuild/rewrite or destructive migration without explicit approval.
- Keep Supply Chain/RPC and PIBC as location/operational context, not automatic application roles or asset-owner domains.
- Keep office location, organizational unit, job level, asset physical location, asset owner domain, and custodian as separate dimensions.
- Report exact branch, commit SHA, changed files, tests actually run, CI state, and remaining unknowns.

## Branch and pull-request workflow

- Use a dedicated, uniquely named work branch; never share another agent's branch.
- Create work from the current intended base branch and verify that base before editing. Do not assume an old integration branch or PR number remains canonical.
- Open/update a PR against the repository's intended integration target. Do not merge or deploy unless the repository owner explicitly authorizes it.
- Before porting commits from another branch, compare histories and review each unique change; never merge a stale/diverged branch wholesale.
- Preserve unrelated user work and avoid force-push unless explicitly authorized and protected by an expected-SHA lease.
