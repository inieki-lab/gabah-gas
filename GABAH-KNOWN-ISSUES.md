# GABAH — Known Issues & Change Log

## Known Issues (open, tracked)

| # | Area | Issue | Severity | Owner | Fix status |
|---|---|---|---|---|---|
| K01 | Deployment | `gabah_app` Docker container fails to start — `package.json` not found at `/app`. Image built from wrong context/CMD. | High | Hermes | To fix (see K01 plan) |
| K02 | Database | `schema_migrations` ledger not applied on this PostgreSQL instance (development file-store fallback masks CR-04) | High | Hermes | Run migration runner; enable production fail-fast |
| K03 | Notifications | Contract reminder / email / Telegram identity & delivery (CR-05) | Medium | Future | Confirm provider, implement idempotent delivery |
| K04 | UI/UX | Responsive & consistency review still pending | Medium | UI engineer | Redesign scope |
| K05 | Tests | No automated unit/integration / CI pipeline beyond `scripts/*.verify` | Low | DevOps | Add CI gates |
| K06 | Audit | `dist.bak.old/` (backup artifact) left untracked in repo; tidy before release | Low | Hermes | Remove or gitignore |
| K07 | Docs | `.env.example` still shows REDACTED placeholders for secrets | Low | Ops | Fill securely before prod sign-off |

> Status vs. 2026-11-10 takeover: **K01, K02 closed/managed** (migration runner + fail-fast verified;
> image rebuild pending). K03, K04, K05, K06, K07 remain open.

---

## Change Log

### 2026-11-10 (Hermes takeover)

- **hermes/audit-and-foundation** — audit & baseline; RBAC foundation secured (129/129).
- **Dynamic RBAC guard** — `requireRbacSuperadmin` enforces `isRbacSuperadmin(actor.id)`; `isSuperadminActor`
  keeps `Admin GABAH` bootstrap label; `/api/auth/me` exposes DB-authoritative `is_superadmin`.
- **Verified:**
  - `dynamic-rbac-foundation-verify.mjs` → **129/129**
  - `p0-security-verify.mjs` → **37/37**
  - `branch-migration-safety-verify.mjs` → **5/5**
  - `navigation-policy-verify.ts` → **PASS**
  - `tsc --noEmit` → **0 errors**
- Added GABAH agent skills (`gabah-dynamic-rbac`, `gabah-backend`, `gabah-helpdesk-workflow`,
  `gabah-testing-qa`, `gabah-security`) under `.hermes-skills/gabah/`.

> **Uncommitted local changes retained on branch:** `server.ts`, `server/rbac-policy.ts`
> (foundation fixes), `.hermes-skills/` (skills), `dist.bak.old/` (backup artifact).
> `package-lock.json` bump preserved (pre-existing).
> Do NOT merge to `main` without review + CI.
