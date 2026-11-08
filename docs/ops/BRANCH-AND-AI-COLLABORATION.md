# Branch and AI Collaboration Policy

**Reviewed:** 8 November 2026  
**Repository:** inieki-lab/gabah-gas

## Canonical work path

- The only active stabilization branch is fix/role-based-navigation (PR #18).
- PR #18 is still Draft and targets main. It must remain unmerged until the full current-head CI, browser UAT, and release gates pass.
- Dependabot PRs are managed separately and must not be mixed with product work.
- Do not push new work to historical branches.

## Closed/superseded pull requests

The following PRs were closed after their relevant work was ported, replaced, or reviewed as stale:

| PR | Status | Disposition |
|---|---|---|
| #3 | Closed | Old ticket permission seed is superseded; current permission catalog and Auditor ticket-create deny migration are in PR #18. |
| #11 | Closed | Docker Compose fail-fast, DB health dependency, env cleanup and Compose CI validation were ported. Historical sandbox audit is not treated as current test evidence. |
| #12 | Closed | Superseded by docs/ops/PRODUCTION-READINESS-GATES.md and updated docs/testing/UAT.md. |
| #13 | Closed | Regression CI expansion is included in PR #18. |
| #14 | Closed | Fresh PostgreSQL migration corrections are included in PR #18 and exercised by PostgreSQL CI. |
| #15 | Closed | Fail-closed sidebar behavior is included in the current navigation policy. |
| #17 | Closed | Maintainer skill/AGENTS/guardrails, session restore behavior, user-role assignment API/UI and user-directory verification are incorporated or already present in PR #18. Multi-role persistence is verified by current PostgreSQL integration tests. |

Closing a PR does not delete its remote branch. Historical refs remain preserved until a repository maintainer performs a deliberate cleanup after reviewing unique commits. Do not use those branches for new work.

## Remaining historical branches

Branches such as chore/gabah-finalization-checklist, ci/expand-regression-gates, docs/record-stage-13f-merged, docs/uat-readiness-after-stage-13e, fix/contract-migration-fresh-db, fix/phase-1-user-role-audit, fix/rbac-sidebar-fail-closed, fix/session-restore-preview-login, stage-11-ticket-read-create-rbac, work/antigravity-sync, and work/stage-13* are historical/closed work paths. Their commits must not be merged wholesale. Port only a reviewed, missing fix with tests.

## New AI branch naming

While PR #18 is open, every AI agent creates a separate branch from fix/role-based-navigation:

- ai/codex/<work-item>
- ai/gemini/<work-item>
- ai/claude/<work-item>
- ai/<other-agent-name>/<work-item>

Examples:
- ai/codex/ticket-scope-audit
- ai/gemini/room-reservation-uat
- ai/claude/vendor-contract-review

Rules:
1. One agent, one branch. Never share an AI branch.
2. Open a PR targeting fix/role-based-navigation.
3. Include problem/evidence, changed files, migrations, tests, risks, and rollback.
4. No direct commits to main and no direct deploy from AI branches.
5. Do not create a second integration branch.
6. After PR #18 merges, new AI branches start from main and target main.

## Current repository snapshot

At the review point, only PR #18 and a separate Dependabot PR remained open. The canonical working branch was fix/role-based-navigation. Old remote branch refs were not deleted by this change; branch deletion requires repository-maintainer cleanup after verifying that no unique work remains.
