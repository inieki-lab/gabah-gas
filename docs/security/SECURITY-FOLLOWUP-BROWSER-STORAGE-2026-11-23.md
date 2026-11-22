# GABAH — Security Follow-up: Browser Storage Review (2026-11-23)

**Reviewed base:** `main` at `e9635788e27f9499b06ed3d814714b9f713290ee`  
**Scope:** repository search and source inspection of browser storage usage and authentication transport.  
**Type:** static source review; not a penetration test.

## Finding SEC-FU-06 — Additional localStorage key violates the documented storage boundary (LOW / policy compliance)

**Evidence**
- `PROJECT-RULES.md`, section 3.1, states that browser localStorage may contain only `gabah_auth_token`.
- `src/components/modals/AdministrationModal.tsx` reads and writes `gabah_system_settings` in localStorage.
- The stored object is described by the UI as administration-panel display parameters saved in the local browser.

**Impact**
- The observed value is a local UI preference, not an authentication credential or authoritative business record.
- It does not appear to grant server-side permissions by itself.
- Nevertheless, it contradicts the project's explicit storage contract and creates an undocumented second persistent browser key. This can complicate privacy review, browser-state cleanup, and future security assumptions.

**Recommended remediation**
1. Decide whether these display settings are still required.
2. If they are temporary presentation state, keep them in React component state and remove the persistent localStorage read/write.
3. If they must persist across devices or sessions, move them to an authenticated server-side user-preference endpoint with explicit authorization and validation.
4. Add a regression check that the only application localStorage key is `gabah_auth_token`.

**Do not silently move the value to sessionStorage or IndexedDB as a workaround**; first update the authoritative storage policy and document the intended lifetime and data classification.

**Acceptance**
- No application code reads/writes `gabah_system_settings` in localStorage.
- The Administration UI still behaves correctly after refresh according to the approved persistence decision.
- Automated source-level storage-policy test passes.

## Related observation — Bearer token exposure remains open

The same source review confirms the documented `gabah_auth_token` key is read by `src/services/gabahApi.ts` and sent as a Bearer token. This is an intentional current architecture, not a newly introduced issue. Its XSS impact and the required session-storage/CSRF architecture decision remain tracked under SEC-FU-02 in the main security posture review.

## Review limitations

Repository search is a discovery aid, not a complete proof of every browser storage access or runtime data flow. No live browser profile, user data, or production credential was accessed.
