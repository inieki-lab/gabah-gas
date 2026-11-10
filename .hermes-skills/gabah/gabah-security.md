---
name: gabah-security
description: "GABAH security standards. Authentication, authorization, sessions, input validation, IDOR prevention, audit logging, secrets, dependency supply chain. Use when hardening endpoints, reviewing PRs for security, or preparing audit evidence."
version: 1.0
category: software-development
created: "2026-11-10"
---

# GABAH Security Standard

## Auth & sessions

- **Password hashing:** PBKDF2 (server-side, `server/crypto.ts`). Never plaintext/MD5.
- **Token:** opaque random session token (`/api/auth/login` → `gabah_auth_token` in localStorage only).
- **Rotation:** logout, password change, and role switch revoke the old token (`server/auth.ts`).
- **Rate limiting:** failed-login lockout; `recordFailedLogin`/`clearFailedLogins` on auth routes.
- **Dev-only:** `GABAH_TEST_PASSWORD`, `GABAH_TEST_PASSWORD` dev-only; ignored in production.
- Production must **never** fall back to file-store when Postgres is configured but down — fail fast (see `server/persistence.ts`).

## Authorization (backend is authoritative)

- `isRbacSuperadmin(userId)` reads the **active database role assignment** — never role labels alone.
- `hasRbacPermission(userId, permissionKey)` — effective permission from PostgreSQL (superadmin = wildcard `['*']`).
- `requireRbacPermission(permissionKey)` and `requireRbacSuperadmin()` are route middleware.
- Resource-level guards: `getScopedAssets(actor)`, item-level `hasRbacScope`/division ownership.
- Menu visibility is UX-only; **backend enforcement is mandatory** for every action.

## Input & data-plane guards

- Validate + sanitize on every input (`express-validator`/manual). No arbitrary client JSON trusted.
- Mutating endpoints reject unknown/protected fields; use explicit allowlists.
- Immutable fields (e.g., `asset_number`, `owner_division` ownership, ticket `status` transitions) rejected.
- `multipart/form-data`: validate MIME + file signature (multer) + size; separate upload volume from DB volume.

## Identity & secrets

- Never commit secrets. `.env` is gitignored; template at `.env.example`.
- Do not print secrets/credentials/tokens. P0 scripts print labels only.
- `server/data/initial_credentials_dev.txt` is gitignored; production has no dev-file fallback.
- Dependency supply-chain: `security` CI scans `node_modules`, venv, plugins (endpoints). Run `npm audit` regularly.

## Audit & privacy

- `recordAudit(action, module, description, actor)` with `ip_address` (per-request context).
- Audit trail: login, role/permission changes, ticket lifecycle, asset/loan/contract moves, notifications.
- Auditor role is **read-only** and must never receive write permissions (`tickets.create`, etc.).

## INSECURE patterns → reject (for PR review)

- `isSuperadmin` derived only from role label / client payload.
- `requireRbacPermission` bypassed by frontend-only hiding.
- `auth.switch_role` usable by non-superadmin.
- Raw SQL string concatenation (SQL injection) — always parameterized.
- File writes from user-controlled names without path validation (path traversal).
- Replaying `etag`/pivot conflicts without locking; duplicate assignment not guarded.

## P0 verification (evidence)

Run `node scripts/p0-security-verify.mjs` → **37/37 PASS** (recorded as P0 security evidence).
Run `node scripts/security-review.mjs` (when present) before every PR.
