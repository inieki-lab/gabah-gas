# GABAH — Security Follow-up: Browser Storage Review (2026-11-23)

**Reviewed base:** `main` at `e9635788e27f9499b06ed3d814714b9f713290ee`  
**Scope:** source inspection of browser storage usage and Administration UI persistence.  
**Type:** static source review; not a penetration test.

## Finding SEC-FU-06 — Six non-authentication localStorage keys violate the documented storage boundary (LOW–MEDIUM)

**Evidence**
- `PROJECT-RULES.md`, section 3.1, states browser localStorage may contain only `gabah_auth_token`.
- Static inspection of `src/components/modals/AdministrationModal.tsx` finds six additional keys:
  - `gabah_system_settings`: system-setting form values.
  - `gabah_org_divisions`: organization division cache/state.
  - `gabah_master_locations`: facility location cache/state.
  - `gabah_numbering_config`: legacy numbering-format simulator state.
  - `gabah_role_permissions`: legacy role-permission matrix state.
  - `gabah_notification_rules`: notification-rule toggle state.
- The same component has Dynamic RBAC state explicitly described as persisted through authenticated APIs/PostgreSQL, and has API-backed organization/location methods. It also retains separate localStorage-backed legacy state and handlers.
- The notification toggle writes its changed state only to localStorage in the observed handler. The legacy permission matrix handler updates component state and localStorage; the actual Dynamic RBAC workflow is a separate server-backed path.
- Numbering configuration UI persists a simulated format locally, while the canonical asset-numbering rules are managed through the server-backed numbering administration flow.

**Impact**
- All six keys contradict the explicit localStorage contract.
- Not all six have the same risk:
  - `gabah_system_settings`, `gabah_numbering_config`, and `gabah_notification_rules` appear to be local UI/simulation state; browser-local persistence can mislead administrators into thinking the change is global.
  - `gabah_role_permissions` is particularly sensitive from a UX/security-governance perspective: it is a legacy presentation matrix and must never be interpreted as effective server authorization. The server-backed Dynamic RBAC path is authoritative.
  - `gabah_org_divisions` and `gabah_master_locations` are written after corresponding API calls in the observed handlers, so they appear to be redundant browser caches rather than the authoritative mutation. Their initialization and refresh behavior still need reconciliation to prevent stale local data overriding server data.
- These keys do not themselves grant backend permissions. Do not infer an authorization bypass from localStorage values alone.

**Recommended remediation**
1. Remove localStorage persistence for UI-only/simulator values; keep them in React state or label them explicitly as browser-local previews.
2. Remove the legacy role-permission editor/cache from the active UI or make it read-only and clearly subordinate to Dynamic RBAC. Never present it as effective access control.
3. For organization and location data, use the API response as the sole canonical state; remove redundant localStorage caches and reload from the server after mutations.
4. For notification rules, determine whether the feature is truly wired to the scheduler/backend. If not, label it as a local prototype or remove the toggle; do not present it as a company-wide setting.
5. Add a regression test that application localStorage contains only `gabah_auth_token`, plus UI/API tests proving server-backed changes survive refresh and are visible across accounts.
6. Do not silently move these values to sessionStorage or IndexedDB as a workaround; update the data-lifetime policy first.

**Acceptance**
- No application code reads/writes the six non-authentication keys listed above.
- Effective role permissions, numbering rules, organization/location masters, and scheduler rules are read from server-authoritative endpoints.
- Any retained local-only preview is clearly labelled as local and cannot be mistaken for a global configuration.
- Automated source-level storage-policy test and relevant API/UI regression tests pass.

## Related observation — Bearer token exposure remains open

The source review confirms `gabah_auth_token` is read by `src/services/gabahApi.ts` and sent as a Bearer token. This is the current authentication architecture, not a newly introduced issue. Its XSS impact and the required session-storage/CSRF architecture decision remain tracked under SEC-FU-02 in the main security posture review.

## Review limitations

Repository source inspection is not a complete dynamic test. The review did not inspect live browser profiles, production data, or production credentials. Search results and static source paths are evidence for follow-up, not proof of exploitability.
