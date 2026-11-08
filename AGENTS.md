# Repository instructions for AI coding agents

## Required project skill

Before performing any task in this repository, read:

1. `.agents/skills/gabah-maintainer/SKILL.md`
2. `docs/AI-CHANGE-GUARDRAILS.md`
3. The relevant audit or architecture documents under `docs/`

The skill defines the required workflow for inspecting, changing, testing, and reporting GABAH work. Treat it as mandatory project guidance.

## Non-negotiable boundaries

- Do not commit directly to `main`.
- Do not bulk-change production users, roles, permissions, or operational records without a verified inventory, approved mapping, export/rollback plan, and explicit authorization.
- Do not treat menu visibility as backend authorization.
- Do not invent role assignments, business rules, UI behavior, or test results.
- Preserve existing workflows; make focused changes supported by evidence.
- Report what was actually tested and what remains unverified.


## Branch naming and integration

- Canonical integration branch for the current stabilization effort: `fix/role-based-navigation` (PR #18).
- Other AI agents must use a unique branch name: `ai/<agent-name>/<work-item>` (for example, `ai/codex/ticket-scope-audit`, `ai/gemini/room-reservation-uat`). Do not push to another agent's branch.
- Until PR #18 is merged, create AI branches from `fix/role-based-navigation`; after merge, create them from `main`.
- Every AI branch must open a PR targeting the canonical integration branch, include a concise change record, and pass the required CI gates. No direct pushes to `main`.
- Do not merge or cherry-pick a whole stale/diverged branch. Review and port only verified commits/files. Close superseded PRs after their unique changes are safely preserved.
