# GABAH — Security Posture Review (2026-11-22)

**Repository:** `inieki-lab/gabah-gas`  
**Reviewed branch:** `main`  
**Reviewed commit:** `e9635788e27f9499b06ed3d814714b9f713290ee`  
**Latest exact-main CI:** run [45038378777](https://github.com/inieki-lab/gabah-gas/actions/runs/45038378777) — SUCCESS  
**Scope:** source-level review of Express security middleware, authentication transport, HTTP headers, Docker runtime, and deployment topology.

> This is a source review, not a penetration test or production-environment certification. CI success proves the checks in that workflow passed; it does not prove TLS, browser behavior, proxy configuration, backup recovery, or production secrets are correct.

## 1. Verified controls already present

| Area | Evidence in current source | Assessment |
|---|---|---|
| Authentication | `server/auth.ts`, `server/crypto.ts`; PBKDF2 password hashing, server-validated Bearer sessions, revocation/version controls | Implemented; browser token storage remains a residual risk below |
| Login/API throttling | `server/auth.ts`; PostgreSQL-shared API and login buckets, HMAC-derived keys, bounded file-store fallback, fail-closed after authoritative PostgreSQL failure | Implemented and covered by latest CI |
| Client IP identity | `server/requestContext.ts`; transport peer is used; spoofable forwarded headers are not trusted without an explicitly configured proxy chain | Correct for the current no-trusted-proxy assumption |
| Authorization | `server/runtime-hardening.ts`; session validation, identity-spoof rejection, Auditor write denial, route/domain checks | Strong defense-in-depth pattern; persona UAT still required |
| Browser headers | `server.ts`; `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Permitted-Cross-Domain-Policies: none`, restrictive `Permissions-Policy`; API responses are no-store | Useful baseline |
| Container hardening | `docker-compose.yml`; app filesystem read-only, /tmp noexec/nosuid, all Linux capabilities dropped, no-new-privileges, PID limit, separate non-superuser DB app account | Good baseline; validate on the actual host |
| Upload resource control | `server/upload-security.ts`; bounded concurrent upload slots with release on finish/close/abort | Protects in-flight upload concurrency; inspect file parser limits and persistent-volume operations separately |
| Persistence failure | `server.ts` and `server/persistence.ts`; state-changing success is gated on durable persistence; PostgreSQL failure latch quarantines API | Important integrity control |

## 2. Security follow-ups — ordered by priority

### SEC-FU-01 — Content Security Policy is not yet deployed (HIGH)

**Evidence (updated 2026-11-23):** PR #243 adds `Content-Security-Policy-Report-Only` with same-origin scripts and explicit temporary style/font/image/connect allowances. It is non-enforcing and currently reports through browser tooling only; no server-side report collector is enabled. Full enforcement remains deferred until role-based browser UAT and violation review pass.

**Why it matters:** CSP is a browser-side containment layer for script injection and related XSS impact. This remains important after the browser session moved to an HttpOnly cookie: XSS can still issue same-origin actions even when it cannot read the session token.

**Compatibility inventory observed in source:**
- `index.html` loads the application entrypoint as an external module script at `/src/main.tsx`.
- `index.html` loads Google Fonts from `fonts.googleapis.com` and `fonts.gstatic.com`.
- React components use dynamic `style={{...}}` attributes for widths, positioning, and print layout. A strict `style-src` policy that blocks style attributes can break visible UI.
- No `dangerouslySetInnerHTML` match was returned by the repository code search used in this review; this is not a proof that all injection sinks are absent.

**Recommended next implementation sequence:**
1. Inventory all script, style, font, image, worker, blob/data, and external integration sources from the production build.
2. Add a report-only policy with a controlled reporting destination and collect violations during browser UAT.
3. Remove avoidable inline style/script usage or use nonce/hash-based allowances where practical; do not solve this by adding broad `unsafe-eval`.
4. Enforce CSP only after the report-only results show the policy is compatible with all supported workflows.

**Acceptance:** no unexplained CSP violations during full role-based browser UAT; production CSP is enforced and documented. Do not ship a guessed policy.

### SEC-FU-02 — Browser-readable session token exposure (REMEDIATION IMPLEMENTED; verification pending)

**Evidence before remediation:** the prior implementation stored `gabah_auth_token` in localStorage and sent it as a Bearer token. The mainline follow-up branch replaces that transport with the HttpOnly `gabah_session` cookie.

**Current implementation on this branch:** login, password-change, and role-switch responses issue the cookie and omit the session token from JSON; logout clears it. Browser API calls use same-origin credentials, and cookie-authenticated mutations require an exact Origin match. The cookie is SameSite=Strict and Secure in production.

**Residual risks and verification:** HttpOnly prevents JavaScript from reading the session token but does not prevent XSS from issuing same-origin actions. CSP, output encoding, dependency hygiene, and browser UAT remain necessary. Cookie expiry, reverse-proxy Origin behavior, logout/revocation, and CSRF rejection must pass exact-head CI and browser UAT before this finding can be closed.

**Acceptance:** exact-head CI passes cookie/session and negative Origin tests; verify production HTTPS behind the supported proxy and complete role-based browser UAT.

### SEC-FU-03 — TLS and HSTS are deployment gates, not provided by the Compose topology (HIGH)

**Evidence:** `docker-compose.yml` publishes the app as `${GABAH_WEB_PORT:-80}:3000`; the repository Compose stack does not define a TLS-terminating reverse proxy or certificate lifecycle. The current Express baseline does not set HSTS.

**Why it matters:** Bearer tokens and business data must not traverse an untrusted network in cleartext. HSTS must only be emitted when HTTPS is genuinely in use and the domain is ready for it.

**Recommended action:** terminate TLS at the approved organizational reverse proxy/load balancer, restrict direct access to the app port to that proxy/network, configure the proxy trust chain explicitly (do not blindly trust arbitrary X-Forwarded-* headers), and add HSTS at the TLS edge after HTTPS validation.

**Acceptance:** external HTTP redirects to HTTPS; valid certificate and renewal tested; direct app port is not publicly reachable; secure proxy headers and client-IP behavior are verified end-to-end.

### SEC-FU-04 — Make request-body limits explicit and regression-tested (MEDIUM)

**Evidence:** `server.ts` currently registers `express.json()` without an explicit `limit` option. Express has a default JSON body limit, but relying on an implicit framework default makes the operational security boundary less visible and easier to change accidentally.

**Recommended action:** set an explicit documented JSON limit appropriate to the largest legitimate API payload, retain separate stricter multipart limits for uploads, and test oversized JSON/multipart requests return 413 without excessive memory use or partial writes.

**Acceptance:** explicit limit in source, oversized-request regression, and successful tests for legitimate bulk-import payloads.

### SEC-FU-05 — Production secret and proxy configuration validation (MEDIUM)

**Implementation submitted on branch `security/production-rate-limit-secret-mainline` (CI pending):**
- Production startup rejects a missing or shorter-than-32-byte `GABAH_RATE_LIMIT_SECRET`.
- The secret is rejected if it has leading/trailing whitespace or reuses `PGPASSWORD` / `DATABASE_URL`.
- `NODE_ENV=production` remains authoritative even if `GABAH_APP_MODE` is accidentally set to `uat`; UAT fallback is available only outside production Node mode.
- Production HMAC rate-limit identifiers no longer fall back to database credentials; development/UAT retains the local compatibility fallback.
- CI includes direct policy assertions and isolated secrets in Docker/PostgreSQL runtime smoke.

This change does not configure TLS, a reverse proxy, or trusted proxy hops; those remain separate deployment requirements.

**Acceptance:** startup validation rejects missing/weak production secrets; all app replicas share the same secret; spoofed forwarded-header tests pass through the real proxy topology.

## 3. Production gate remains NO-GO

The latest exact-main CI run is green, including typecheck, production build, Docker runtime smoke, PostgreSQL 17 integration, P0 security assertions, and the registered regression suites. The following remain external or browser/runtime proof obligations:

- Browser UAT for each role/capability and office location.
- TLS/reverse-proxy deployment and secure-header verification on the actual hostname.
- CSP report-only rollout followed by enforced policy.
- Decision and test coverage for bearer-token storage / CSRF architecture.
- PostgreSQL plus uploads-volume backup and demonstrated restore.
- Existing-data migration rehearsal, staging deployment/rollback, monitoring/alerting, and business-owner sign-off.

**Do not mark GABAH production-ready solely because CI is green.**

## 4. Review limitations

- This review used repository source and CI metadata at the recorded main SHA; no live production host, browser session, external proxy, DNS, certificate, or secret store was accessed.
- Repository code search is useful for discovery but is not a complete static-analysis or penetration-testing substitute.
- No production secrets, user records, tokens, or private data were inspected or reproduced.
