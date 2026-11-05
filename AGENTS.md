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
