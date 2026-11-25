# GABAH — Owner-Approved Project Context

**Status:** APPROVED project constraints supplied by the product owner; not a statement that implementation is complete.  
**Reviewed:** 23 November 2026  
**Purpose:** Stable business context shared by ChatGPT, Dyad, Codex, Gemini, and human contributors.

This document records decisions and constraints explicitly supplied by the project owner. It outranks historical audit narratives and inferred assumptions. If a newer explicit owner decision changes one of these items, update this file and the related business rules/ADR in the same change.

## 1. Product direction

- GABAH is the existing General Asset & Business Administration Hub application. The task is to rescue, stabilize, correct, and complete this application—not replace it with a new product or rewrite it from scratch.
- The application must support real business workflows, backend authorization, persistence, auditability, and role-appropriate dashboards. Visual redesign alone is not completion.
- Work should proceed in evidence-based stages: identity/role assignment → menu and navigation → role landing/dashboard → create/edit/approve/view workflows → backend permission and data scope → tests by persona.
- Do not claim production-ready until the applicable CI, integration, browser UAT, security, backup/restore, deployment, and owner sign-off gates are evidenced.

## 2. Organization, role, and location

- Nama operasional saat ini adalah **RPC**; “Supply Chain” adalah nama lama dan `SC` hanya kode legacy pada data/alias historis. Jangan gunakan Supply Chain/SC sebagai role atau divisi baru.
- **RPC (legacy code SC) and PIBC are locations/operational contexts, not application roles and not automatic divisions or asset-owner domains.**
- Active office/operational locations recorded for the current model: HO, PIBC, RPC, Pangsub, and Kantor Perawatan. Subang is closed/inactive; preserve historical references.
- A person at any location may hold a job level such as Kadiv, Kadep, Kasi, or Staf. Location does not determine job level or permission.
- Keep these dimensions separate: employee identity, application role/capability, permission, data scope, job level, organizational unit, office location, asset owner domain, physical asset location, and custodian/PIC.
- Profil utama aplikasi hanya `Admin GABAH` (administrator sistem) dan `Karyawan` (seluruh pegawai). IT, GA, Auditor, Sekretariat Direksi, Humas, ME Admin, dan fungsi kerja lain adalah role/capability tambahan yang dibuat serta ditetapkan melalui Dynamic RBAC; tidak boleh dijadikan union role primer yang di-hardcode.
- RPC dan PIBC tidak boleh muncul sebagai role aplikasi. Akun lama dinormalisasi menjadi profil Karyawan, dengan role fungsi yang sah tetap dipertahankan sebagai assignment terpisah; assignment legacy SC/PIBC dinonaktifkan karena keduanya hanya lokasi/unit.
- Role dan capability harus fleksibel dan dapat dikelola. Jangan hard-code katalog role fungsi atau menganggap jabatan/lokasi memberi permission.

## 3. Asset ownership and access

- IT is responsible for IT computing assets (including PCs and laptops) across all locations; the physical location of an IT asset does not transfer ownership to another function.
- GA manages GA-owned assets. GA may be granted configured **read-only** visibility to IT laptops and PCs; that does not grant GA create, edit, assign, move, lifecycle, or approval rights over IT assets.
- Superadmin has full administrative access.
- Existing asset records with ambiguous or legacy owner values must be preserved and reviewed. Do not bulk reclassify ownership from location, category, old prefix, or custodian without an approved mapping and rollback plan.
- Asset numbering policy is not final until the company confirms its corporate standard. Keep the numbering engine configurable for Superadmin; do not present historical prefixes or implementation examples as the official company standard.

## 4. Service routing and special capabilities

- IT tickets should route directly to the designated IT Support person for the current workflow; do not add an IT Admin intermediary without an owner-approved decision.
- PIBC maintenance includes ME (Mechanical/Electrical/Perawatan). An Admin ME routing/triage identity may be used for maintenance-ticket routing; it is not a general application role unless explicitly approved.
- Sekretariat Direksi and Humas are ordinary employee identities with additional, narrowly scoped capabilities. For example, a meeting-room request for photography/documentation should notify the relevant Humas staff.
- GA asset administration must be separated from GA supervisory/reporting responsibilities. Kasi GA is not automatically an asset data-entry/operator identity.
- GA may have separate operational functions such as asset staff and an Admin GA marker for cakes/contracts; assignment must reflect approved duties, not inferred job title alone.

## 5. Module lifecycle

- Module availability and permissions should be configurable by role/user and operational need. A module may be enabled for some users and inactive for others.
- IT ticketing is a core, generally available service. GA and ME workflows may be enabled where the relevant team/location needs them.
- Future room booking, vehicle loans, and integrations with existing web applications should coexist without forcing a destructive replacement of existing workflows.

## 6. Future roadmap (not current implementation commitments)

- A Windows/Linux endpoint agent for automated asset inventory collection may be considered after the core GABAH application is stable.
- The agent is a later phase. Do not divert core application stabilization into an endpoint-agent rebuild before the owner approves that phase.

## 7. Non-negotiable data and delivery safeguards

- Preserve existing users, assets, workflows, and historical data unless a reviewed migration is explicitly approved.
- No destructive database reset, mass reclassification, bulk role reassignment, or production data mutation without inventory, approval, export/backup, and tested rollback.
- A passing typecheck/build is not equivalent to workflow UAT or production readiness.
- Every AI handoff must report the exact branch and commit, files changed, decisions followed, tests/CI actually run, and unresolved issues. Never invent successful tests or claim a PR is merged when it is not.

## 8. Reconciliation rule

This file captures owner-approved intent. Actual code behavior must be recorded separately as IMPLEMENTED/PARTIAL/NOT VERIFIED and linked to source files and tests. If code differs from this context, document the gap; do not silently rewrite the business rule to match a bug or legacy implementation.
