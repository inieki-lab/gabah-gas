# Branch and AI Collaboration Policy

**Reviewed:** 23 November 2026  
**Repository:** `inieki-lab/gabah-gas`  
**Status:** Current workflow policy. PR numbers, branch names, and historical snapshots below are not permanent integration instructions.

## Canonical collaboration rules

1. Each agent works on a unique branch; never share or overwrite another agent's branch.
2. Start from the explicitly agreed current base branch. Verify its name and HEAD SHA before editing.
3. Open a pull request against the intended integration branch and include evidence, changed files, migration impact, tests, risks, and rollback.
4. Never commit directly to `main`.
5. Do not merge or deploy without explicit repository-owner approval.
6. Do not merge stale branches wholesale. Compare histories and port only individually reviewed changes that are still needed.
7. Dependabot changes remain separate from product changes unless there is a documented dependency-security reason to coordinate them.
8. A closed PR does not mean its remote branch is safe to delete. Review unique commits and references before cleanup.

## Branch naming

Use a unique, descriptive branch name, for example:

- `ai/codex/ticket-scope-audit`
- `ai/gemini/room-reservation-uat`
- `docs/ai-handoff-source-of-truth-2026-11-23`
- `fix/session-cookie-integration-tests`

The prefix may reflect the work type or agent. The critical rule is branch isolation and an explicit base/target, not a hard-coded agent list.

## Pull request evidence

Every PR must state:

- Problem statement and source evidence.
- Exact base branch/SHA and head branch/SHA.
- Files and behavior changed.
- Business-rule and data-impact assessment.
- Migrations and rollback plan, or explicitly "none".
- Commands and tests actually run, with pass/fail output.
- CI result for the exact head SHA; "no checks" is not a pass.
- Browser UAT and production-readiness gaps.
- Documentation synchronized and unresolved decisions.

## Historical snapshot — do not use as current branch instructions

The following details belonged to a previous stabilization period and are retained only for traceability: PR #3, #11–#17, branch `fix/role-based-navigation`, the closed/superseded PR dispositions, and the list of historical branches recorded in earlier revisions. Their status must be re-fetched from GitHub before any operational decision. They do not define today's canonical integration branch.

## Current work snapshot

The documentation alignment work is tracked in PR #249 on branch `docs/ai-handoff-source-of-truth-2026-11-23`. A separate security/authentication workstream exists in PR #248 on branch `audit/full-system-hardening-2026-11-23`. Both were observed as open drafts during the 23 November 2026 review; re-check GitHub before relying on this snapshot. Neither PR being open means it is approved to merge.
