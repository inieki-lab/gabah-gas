# CSP Report-Only Rollout — 2026-11-23

## Status

GABAH now emits `Content-Security-Policy-Report-Only` on API, HTML, and static asset responses. The policy is deliberately non-enforcing: it provides a browser-visible compatibility baseline without blocking current workflows.

## Initial policy

- `default-src 'self'`
- `script-src 'self'` — no `unsafe-inline` or `unsafe-eval` allowance for scripts.
- `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com` — inline style attributes are temporarily allowed because React components use dynamic inline styling; Google Fonts stylesheet remains external.
- `font-src 'self' https://fonts.gstatic.com data:`
- `img-src 'self' data: blob: https:` — external HTTPS images remain allowed during inventory.
- `connect-src 'self' https: wss:` — external HTTPS/WSS integrations remain observable before narrowing.
- `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, `form-action 'self'`.
- Media, worker, and manifest directives are explicitly scoped.

## Rollout controls

1. Keep report-only mode during browser UAT for Superadmin, IT, GA, Karyawan, Humas, Sekretaris Direksi, and Auditor.
2. Review browser CSP violation messages while exercising uploads/downloads, QR/print, room reservations, dashboard, and any external integration.
3. Narrow broad HTTPS image/connect allowances to exact origins after the integration inventory is complete.
4. Remove inline style allowance only after dynamic style usage is eliminated or safely nonce/hash-based.
5. Do not enable enforcing CSP until the violation review and role-based UAT pass.

This rollout does not configure HSTS or claim that TLS is active. HSTS remains gated on a verified HTTPS edge and trusted-proxy configuration. Report-only violations are currently visible in browser tooling; a server-side CSP report collector is not yet enabled.
