# GABAH — Native API Route Inventory for Module Lifecycle

**Status:** Discovery baseline; route coverage must be revalidated when server routes change  
**Branch:** `feat/module-lifecycle-foundation`  
**Reviewed against:** `server.ts` on `fix/user-menu-location-rbac-audit`, 11 November 2026

This inventory is a prerequisite for lifecycle enforcement. It prevents an implementation that hides a menu while leaving direct API access available.

## 1. Module route groups

| Module key | API route prefixes / endpoints | Notes |
|---|---|---|
| `dashboard` | `GET /api/dashboard/stats`, `GET /api/dashboard/attention` | Dashboard aggregates must not leak data when a contributing business module is inactive; dependencies need explicit policy. |
| `assets` | `/api/assets`, `/api/movements`, `/api/reconciliation` | Includes catalog, detail, import, assignment, movement, lifecycle, and reconciliation operations. |
| `loans` | `/api/loans` | Includes create, approve, reject, handover, and return. |
| `tickets` | `/api/tickets` | Includes create, assignees, assignment, and status changes. |
| `maintenance` | `/api/maintenances` | Includes list, create, and update. |
| `vendors` | `/api/vendors` | Includes list, create, and update. |
| `knowledge` | `/api/knowledge` | Includes list, create, update, vote, and view. |
| `contracts` | `/api/contracts` | Includes detail, documents, milestones, renewal decisions, reminders, scheduler status, and notification logs. |
| `meeting_rooms` | `/api/meeting-rooms`, `/api/room-reservations`, `/api/meeting-types`, `/api/meeting-facilities` | All reservation and meeting configuration routes must be blocked when this module is inactive. |
| `licenses` | No dedicated `/api/licenses` route found in this scan | UI/data ownership must be traced. Do not invent a route guard; determine whether license data is served as an asset subresource and define its module boundary before enforcement. |
| `my_assets` | No dedicated `/api/my-assets` route found in this scan | Likely a user-scoped view over asset APIs. Treat it as a navigation capability/view, not a separate backend domain, unless further tracing proves otherwise. |
| `reports` | No dedicated `/api/reports` route found in this scan | Current reporting may consume dashboard and domain APIs. Its dependency and authorization boundaries require frontend/API-client tracing. |

## 2. Cross-cutting platform routes

These must not be disabled merely because a business module is inactive.

| Platform concern | Routes | Lifecycle policy |
|---|---|---|
| Authentication/session | `/api/auth/*` | Always available while the platform is operating. |
| User administration | `/api/users*` | Platform administration; protected by Super Admin authorization. |
| Dynamic RBAC administration | `/api/admin/rbac/*` | Always available to authorized Super Admin so access can be repaired. |
| Master data / taxonomy | `/api/master/*`, `/api/taxonomy/*` | Shared platform dependencies. Do not automatically couple them to one business module. |
| Notifications | `/api/notifications*` | Cross-cutting service; per-module notification creation may need to respect module lifecycle. |
| Audit | `/api/audit-logs` | Must remain available for governance and incident review, subject to read permission. |
| Numbering | `/api/numbering/*` | Shared service; enforce lifecycle at the calling business operation rather than disabling the shared service globally. |
| Health | `/api/health` | Operational endpoint; remains available. |
| Catch-all | `GET *` | Not a business module endpoint. |

## 3. Important dependency decisions

1. **Dashboard:** disabling a module must not make dashboard aggregates reveal records from a disabled domain. Either omit that domain's widgets/data or define a documented safe aggregate policy.
2. **My Assets:** if this view is a scoped query over `/api/assets`, it must remain independently permission-scoped. Disabling the full Assets module should not silently break My Assets unless product ownership explicitly defines them as one module.
3. **Licenses:** trace whether license management is a separate domain or a subtype of asset data. A lifecycle key must correspond to a real enforcement boundary, not only a menu label.
4. **Reports:** trace every data source and enforce the lifecycle state of the underlying domain. A reports menu flag alone is insufficient.
5. **Meeting Rooms:** room configuration, reservation workflow, meeting types, and facilities are one lifecycle boundary in the initial release.
6. **Contracts:** reminder scheduler and document download routes are part of the Contracts lifecycle and must be guarded, not just the primary list/detail routes.

## 4. Implementation guardrails

- Apply a module guard to every route in a module group, including detail-by-ID, downloads, uploads, exports, background-trigger endpoints, and workflow actions.
- Authentication and Super Admin Module Management routes remain reachable when a business module is inactive.
- Do not infer a module key solely from URL string matching at runtime. Use explicit route-level guard declarations or a reviewed route-to-module map.
- A request to an inactive module should return a consistent machine-readable error and must not invoke the domain service.
- Add automated tests that call the API directly for both active and inactive states.
- The inventory is incomplete until the frontend API client, view components, background jobs, and any external WebApps are traced alongside this server route list.
