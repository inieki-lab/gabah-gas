# GABAH — RBAC & Access Control

**Status:** Authoritative working access model  
**Last Updated:** 2026-09-28

## 1. Final Login Roles

| Role | Scope | General Capability |
|---|---|---|
| Admin GABAH | Enterprise | Full administration and operational control |
| IT | IT | Manage IT-owned assets and IT-related operations |
| GA | GA + permitted read-only IT view | Manage GA assets and facilities |
| Supply Chain | SC | Manage SC assets and operations |
| PIBC | PIBC | Manage PIBC assets and operations |
| Karyawan | Personal | Own assets, loan requests, permitted tickets |
| Auditor | Enterprise read-only/audit | Read operational information and audit trail |

Management and Vendor are not application login roles.

## 2. Security Model

RBAC has two dimensions: role permission (what action) and data scope (which records). Both are enforced server-side.

## 3. High-Level Permission Matrix

| Capability | Admin | IT | GA | SC | PIBC | Karyawan | Auditor |
|---|---:|---:|---:|---:|---:|---:|---:|
| View enterprise assets | ✓ | — | limited | — | — | — | ✓ |
| Create assets | ✓ | IT | GA | SC | PIBC | — | — |
| Assign assets | ✓ | IT | GA | SC | PIBC | — | — |
| Request loan | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Approve/handover loans | ✓ | IT scope | GA scope | SC scope | PIBC scope | — | — |
| Create tickets | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Manage relevant tickets | ✓ | IT scope | GA scope | SC scope | PIBC scope | own scope | — |
| View audit logs | ✓ | IT scope | GA scope | SC scope | PIBC scope | — | ✓ |
| Manage users | ✓ | — | — | — | — | — | — |

## 4. Sensitive Data

Endpoint-level authorization controls sensitive fields such as user contact information. Record visibility does not automatically grant access to every field.

## 5. Server Enforcement

For every privileged mutation, determine the actor from the authenticated server session and validate role, division scope, target entity, ownership and workflow state. Never trust a client-supplied role, division or actor ID.

## 6. Role Changes

Adding/removing/materially changing a role requires updating this document, PRD.md, BUSINESS-RULES.md, server authorization code and UAT coverage.

## 7. UAT

For each role test both permitted actions and explicit denial of actions outside scope. Successful UI rendering is not evidence of correct authorization; API-level denial must also be tested.
