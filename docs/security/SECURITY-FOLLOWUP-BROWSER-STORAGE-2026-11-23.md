# GABAH — Security Follow-up: Browser Storage Review (2026-11-23)

**Reviewed base:** `main` at `e9635788e27f9499b06ed3d814714b9f713290ee`  
**Scope:** repository search and source inspection of browser storage usage and authentication transport.  
**Type:** static source review; not a penetration test.

## Finding SEC-FU-06 — Three non-authentication localStorage keys violate the documented storage boundary (LOW–MEDIUM)

**Evidence**
- `PROJECT-RULES.md`, section 3.1, states that browser localStorage may contain only `gabah_auth_token`.
- `src/components/modals/AdministrationModal.tsx` reads/writes these additional keys:
  - `gabah_system_settings` — system-setting form values.
  - `gabah_org_divisions` — organization-division data.
  - `gabah_master_locations` — master-location data.
- The component's source contains local-only save handlers for organization divisions and master locations, including `setDivisions(...)` / `setLocations(...)` followed by `localStorage.setItem(...)`.
- The same component also loads live organization/master data from API methods such as `getDivisions()`, `getLocations()`, `getOfficeLocations()`, and `getAssetLocations()`. This means the UI contains both server-backed master-data paths and separate browser-local state paths that need a deliberate reconciliation.

**Impact**
- These keys contradict the project's explicit browser-storage contract.
- The settings key is presentation/configuration state, but its persistence is browser-local only.
- The divisions and locations keys are more concerning than ordinary preferences: a user may interpret a locally saved change as an authoritative organization/master-data change even though the observed handlers persist it only in that browser. This risks inconsistent displays and misleading administration workflows across users/devices.
- The three keys do not themselves establish server-side authority or permissions. Do not describe them as database changes without verifying a corresponding API mutation.

**Recommended remediation**
1. Remove browser persistence for `gabah_system_settings`; keep transient values in component state unless an approved server-side preference feature is implemented.
2. For divisions and locations, route every create/update/delete action through the authoritative server API and reload the canonical result. If an API-backed workflow already exists, remove the parallel local-only handlers and dead fallback state.
3. Add regression tests proving organization/location mutations survive a fresh browser session and are visible to another authorized account.
4. Add a source-level storage-policy test that permits only `gabah_auth_token` in application localStorage.
5. Do not silently move these keys to sessionStorage or IndexedDB as a workaround; update the data-lifetime policy first.

**Acceptance**
- No application code reads/writes `gabah_system_settings`, `gabah_org_divisions`, or `gabah_master_locations` in localStorage.
- Administration settings are clearly labelled as transient or saved through an authorized server endpoint.
- Organization/location changes are server-authoritative and visible across sessions/accounts.
- Automated source-level storage-policy test passes.

## Related observation — Bearer token exposure remains open

The source review confirms `gabah_auth_token` is read by `src/services/gabahApi.ts` and sent as a Bearer token. This is the current authentication architecture, not a newly introduced issue. Its XSS impact and the required session-storage/CSRF architecture decision remain tracked under SEC-FU-02 in the main security posture review.

## Review limitations

Repository search is a discovery aid, not a complete proof of every browser storage access or runtime data flow. The observations above are source-level evidence only; no live browser profile, user data, or production credential was accessed.
