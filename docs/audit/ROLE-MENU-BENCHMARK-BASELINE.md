# GABAH Role & Menu Benchmark Baseline

Status: working audit baseline; not a declaration that every role or workflow has passed UAT.

## Purpose

Use established ITAM, ITSM, ERP, and BI products as reference models while preserving Food Station's approved organization, ownership, location, and approval rules. Benchmarking is a design input, not permission to copy features or grant broader access.

## Reference products and what to learn

| Reference | Domain strength | GABAH areas to compare |
|---|---|---|
| GLPI | IT asset management and IT service management | Asset lifecycle, helpdesk queues, contracts, vendors, reservations, maintenance, knowledge base, audit |
| Snipe-IT | IT asset register | Check-in/out, custody history, location, status, audit, QR/barcode, asset imports |
| Odoo | ERP workflows | Purchasing, vendor relationship, inventory, maintenance, approval chains, cost and contract traceability |
| ServiceNow | Enterprise ITSM and governance | Service catalog, role/ACL model, assignment, SLA, workflow, auditability |
| Jira Service Management | Service request and work queues | Requester experience, queues, assignment, approvals, status communication, service ownership |
| Power BI | Business intelligence | Executive KPI, trend, drill-down, clear metric definitions, export governance |

Official reference starting points:
- GLPI: https://www.glpi-project.org/en/features/
- Snipe-IT: https://snipeitapp.com/product
- Odoo: https://www.odoo.com/app
- ServiceNow: https://www.servicenow.com/products/itsm.html
- Jira Service Management: https://www.atlassian.com/software/jira/service-management
- Power BI: https://www.microsoft.com/en-us/power-platform/products/power-bi

## Role benchmark matrix

| GABAH persona | Main reference | Expected workspace | Must not be inferred from |
|---|---|---|---|
| Superadmin | ServiceNow, Odoo | System configuration, role/permission/scope, module lifecycle, organization master data, security/audit overview | Display name or job title |
| IT | GLPI, ServiceNow | IT asset catalogue, tickets/queues, assignment, maintenance, licenses, device lifecycle, SLA | Office location |
| GA | GLPI, Odoo | GA assets, vendor/contract relationship, maintenance, movement, custody and service requests | A broad ability to edit IT assets |
| GA asset operator | Snipe-IT, GLPI | Authorized asset registration, custody, movement and supporting documents | A managerial title alone |
| Employee / Karyawan | GLPI, Jira Service Management | Personal assets, own requests, loan status, ticket status, knowledge/help | Global asset administration |
| Auditor | GLPI, ServiceNow | Read-only evidence, asset/contract/vendor records within explicitly assigned audit scope, audit trail, anomaly reports | Automatic company-wide scope |
| Humas | Jira Service Management | Documentation requests, assigned agenda/room work, task status and notifications | General room administration |
| Sekretaris Direksi | Jira Service Management | Executive room/facility requests, priority workflow and request tracking | General asset ownership |
| ME / maintenance dispatcher | GLPI | Facility ticket queue, assignment, maintenance history and completion evidence | PIBC location as a role |
| Custom role | ServiceNow, Odoo | Any explicitly configured combination of readable modules, actions and data scopes | A legacy primary-role label |

## Organization and authorization invariants

1. Role is a permission package. Job title, department/unit, and office location are separate attributes.
2. A user may hold multiple roles. Effective permissions and scopes must be computed consistently by frontend and backend.
3. Office locations (including HO, PIBC, RPC/SC, Pangsub and the maintenance office) are not application roles or asset-owner divisions.
4. IT asset authority follows the IT ownership policy across locations. GA's optional read access to IT PCs/laptops must not imply update, movement, lifecycle, import, or deletion rights.
5. Auditor is read-only. Read-only must cover direct API calls, exports, attachment/document downloads, bulk endpoints, and linked records—not merely hidden buttons.
6. Auditor data visibility must follow an explicit audit scope. Do not silently turn a scoped auditor into a global observer. Any company-wide audit scope must be a deliberate, reviewable assignment.
7. Menu visibility is not authorization. Every endpoint and record lookup must enforce permission and scope server-side.
8. A disabled module must not be reachable through a direct URL/API. Its data must be retained unless a separately approved retention/deletion policy says otherwise.

## Acceptance checklist for every role

For each role and representative test user, record evidence for all of the following:

- Sidebar and submenu are relevant; no unrelated operational modules appear.
- Landing page and KPI cards reflect the user's actual work.
- List, search, detail, filter, pagination and empty/error states work.
- Create, edit, delete, approve/reject, assign, export and upload/download actions match explicit permission.
- Data scope is enforced for list, direct ID, linked entity, dashboard aggregate, search result, notification and export.
- Direct API attempts are denied when permission or scope is missing.
- Audit log records security-sensitive and business-critical changes.
- Multiple-role combinations behave predictably, including the Auditor read-only deny-write rule.
- User lifecycle (inactive user, inactive role, removed assignment, expired session) is tested.
- Browser UAT is performed against PostgreSQL, not only mock/file-store data.

## Current Auditor-specific release gate

The Auditor navigation baseline is five groups: Dashboard, Aset, Vendor, Contract Management, and Laporan & Audit. Auditor is read-only.

Before this role can be called complete, reconcile and test the scope policy across:
- asset list/detail/history and related movements;
- vendor list/detail;
- contract list/detail, linked assets/vendors, milestones and document download;
- audit logs and reconciliation;
- reports, exports, dashboard aggregates, global search and notifications.

Important policy consistency check: if Auditor is assigned a limited audit scope, vendor/contract reads and audit-log access must not bypass that scope. If company-wide audit access is intended, represent it as an explicit scope assignment and test that assignment. Do not infer the policy from the role name alone.

## Audit result vocabulary

- NOT STARTED: no code or behavior review yet.
- STATIC REVIEW: source and route guards inspected; no runtime proof.
- AUTOMATED PASS: relevant tests pass on the exact commit.
- UAT PASS: browser/API workflow tested with a real PostgreSQL-backed test account.
- BLOCKED: policy decision, test account, or environment is missing.
- FAILED: reproducible defect or authorization bypass exists.

A role is complete only when the required automated checks and UAT evidence are recorded. A green CI run for an earlier commit does not validate later changes.
