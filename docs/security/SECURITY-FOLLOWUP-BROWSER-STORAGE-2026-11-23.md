# GABAH — Security Follow-up: Browser Storage Review (2026-11-23)

**Reviewed base:** mainline before PR #256  
**Scope:** browser storage, session transport, and Administration UI persistence.  
**Type:** static source review plus automated source/integration regression coverage; not a penetration test.

## SEC-FU-06 — Non-authentication localStorage keys

**Original finding:** Administration UI previously persisted six local UI/master keys: `gabah_system_settings`, `gabah_org_divisions`, `gabah_master_locations`, `gabah_numbering_config`, `gabah_role_permissions`, and `gabah_notification_rules`.

**Current remediation status (PR #256; CI pending):**
- Administration UI no longer reads/writes browser localStorage.
- API client and application shell no longer read/write localStorage.
- The canonical server-backed API remains the source of truth for organization/location masters, Dynamic RBAC, numbering, and notification settings.
- `scripts/browser-storage-policy-verify.mjs` now asserts no localStorage access in the API client/application shell, cookie-backed authentication, Origin validation, and no session token in JSON.

## SEC-FU-02 — Session token exposure to JavaScript

**Original finding:** browser sessions used `gabah_auth_token` in localStorage and sent it as a Bearer token, exposing the live credential to JavaScript executing in the application origin.

**Current remediation submitted in PR #256 (CI pending):**
- Browser authentication now uses same-origin `gabah_session` cookies.
- Cookie attributes: `HttpOnly`, `SameSite=Strict`, `Path=/`, and `Secure` in production.
- Login, password rotation, and switch-role issue/rotate the cookie and do not return session tokens in JSON.
- Logout revokes the session and clears the cookie.
- Unsafe cookie-authenticated requests require a matching `Origin`; missing or cross-origin origins are rejected.
- Legacy Bearer authentication remains temporarily available for trusted non-browser clients only; the browser client no longer reads or stores Bearer credentials.

## Required validation and remaining limitations

- Exact-head and post-merge CI must pass, including CR-04/CR-05, P0 security, and browser-storage policy checks.
- Perform browser UAT through the actual hostname and reverse proxy. Verify Secure cookie delivery, refresh restoration, logout, and Origin comparison with the production TLS termination topology.
- CSP remains report-only pending violation inventory and role-based browser UAT.
- TLS termination, HSTS, backup/restore, staging rollback, and business-owner sign-off remain separate production gates.

**Do not infer production readiness from this source review or CI alone.**
