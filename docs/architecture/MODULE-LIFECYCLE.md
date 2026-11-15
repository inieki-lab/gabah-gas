# GABAH — Module Lifecycle & Access Control

**Status:** Architecture proposal / implementation baseline  
**Date:** 11 November 2026  
**Scope:** Native GABAH modules first; external WebApps require a separate integration assessment.

## 1. Objective

Provide controlled activation and deactivation of business modules without deleting records, changing employee identity, or conflating application availability with user authorization.

Example: the Meeting Room Reservation module can be globally deactivated during a policy change or maintenance window. Its historical reservations remain stored and auditable.

## 2. Three independent control layers

| Layer | Control | Example | Effect |
|---|---|---|---|
| 1. Module lifecycle | Global module status | Meeting Rooms = Inactive | Nobody can use the module; data is retained |
| 2. Role authorization | Permissions assigned to application roles | Role GA has room-reservation management permissions | Only users with the required role permission can access the allowed functions |
| 3. User assignment | Assign/revoke additional roles to a specific user | Add a capability role to one employee | Changes that user's effective permissions without changing their primary role/job title |

These layers must remain independent. Turning a module on does not grant access to everyone. Giving a user a role does not override a globally inactive module.

## 3. Enforcement rules

1. **Inactive module:** block module UI navigation and all module API operations, including direct API calls. Return a stable error code such as `MODULE_DISABLED`; do not rely on hiding the menu.
2. **Active module + missing permission:** deny the operation using existing Dynamic RBAC enforcement.
3. **Active module + required permission and scope:** allow only the operation and records authorized by the existing permission/scope policy.
4. **Super Admin:** may access Module Management to change lifecycle status. Super Admin must not silently bypass the inactive status for ordinary business operations; any emergency override must be a separate, explicit, audited mechanism.
5. **Deactivation:** never delete or rewrite business records, attachments, audit history, or foreign-key relationships.
6. **Reactivation:** restore access to retained records subject to current RBAC permissions and scopes.
7. **Unknown module key / missing lifecycle record:** fail closed for newly introduced modules. Existing modules must be explicitly seeded as Active by a reviewed migration so rollout does not unexpectedly hide current functionality.
8. Lifecycle changes must be transactional and written to the audit trail with actor, module key, previous status, new status, reason, and timestamp.

## 4. Native module registry

The initial registry should map existing navigation tabs and backend route groups to stable keys. Proposed keys:

- `dashboard`
- `my_assets`
- `meeting_rooms`
- `assets`
- `maintenance`
- `loans`
- `tickets`
- `licenses`
- `contracts`
- `vendors`
- `knowledge`
- `reports`

The registry is not a replacement for RBAC. It records lifecycle metadata (display name, description, status, sort order, system-managed flag) and provides a canonical mapping for enforcement.

The first implementation should seed every currently shipped native module as **Active**. The migration must be idempotent and must not change existing user-role assignments or permission grants.

## 5. User experience

Module Management should be a dedicated section in Administration, visible only to Super Admin.

For each module show:
- Module name and short business description
- Status: Active / Inactive
- Last changed time and actor
- A confirmation step when deactivating
- A mandatory reason for each status change

The screen should clearly distinguish:
- **Module status:** available globally or unavailable globally
- **Role access:** which application roles have permission
- **User assignment:** which users receive those roles

Do not create a separate per-user Active/Inactive switch in the first release. Per-user access should use the existing additional-role assignment mechanism, so access remains explainable and auditable. A future explicit exception model can be considered only if a real business case cannot be represented safely through roles.

When a currently open module becomes inactive, the frontend must navigate the user to an available page and show a clear notice. It must not leave the user on a blank or partially rendered screen.

## 6. API and data design

Proposed table: `gabah_modules`

- `module_key` — stable primary key
- `name`, `description`
- `is_active` — global lifecycle status
- `sort_order`
- `is_system` — prevents accidental deletion of core registry entries
- `updated_at`, `updated_by`

Proposed administrative API:
- `GET /api/admin/modules` — list registry and current status
- `PATCH /api/admin/modules/:moduleKey/status` — change status with `is_active` and mandatory `reason`

The write endpoint must require explicit Super Admin authorization, validate known module keys, and append an audit event. No public endpoint may create arbitrary module keys.

A shared backend guard (for example, `requireModuleEnabled(moduleKey)`) should be applied to every route belonging to a module. It must execute after authentication and before business handlers. The route inventory must be reviewed so that list, detail, create, update, delete, approval, export, search, and dashboard endpoints are all covered.

## 7. External WebApps

A legacy WebApp must not be assumed to be controllable merely because its link appears in GABAH.

Before adding an external application to the registry, assess:
- Authentication and SSO/session boundaries
- Whether GABAH owns or merely links to the application
- Whether all requests can be routed through a controlled gateway/API
- Whether direct URLs can bypass GABAH
- Data ownership, auditability, availability, and rollback

Until that assessment is complete, GABAH may hide/show a navigation link only; it must not claim to disable the external application itself. True deactivation requires enforcement at the application or gateway that owns the service.

## 8. Delivery sequence

1. Inventory native module route groups, frontend views, API calls, and existing permission keys.
2. Add an idempotent registry migration and seed all current native modules Active.
3. Add read-only registry API and Super Admin Module Management UI.
4. Add lifecycle enforcement to backend route groups, with automated coverage for direct API calls.
5. Add frontend navigation/current-page handling based on module status.
6. Test deactivation/reactivation, RBAC separation, audit records, historical data retention, and regression of every existing module.
7. Assess and integrate external WebApps individually.

## 9. Acceptance criteria

- Deactivating Meeting Rooms hides its menu and blocks its APIs for every user, including users who otherwise have room permissions.
- Existing reservations and their audit history remain intact.
- Reactivating Meeting Rooms restores access only to users who currently have the required permissions and scopes.
- A user without room permissions remains denied while the module is Active.
- Changing module status does not change primary roles, additional roles, or permission grants.
- Every status change records actor, old/new status, reason, and timestamp.
- Every currently shipped native module remains Active immediately after migration.
- A direct API request cannot bypass an inactive module.
- External WebApps are not represented as disabled unless the application or its gateway actually enforces the disabled state.
