# GABAH — Documentation Alignment Worklog

**Date opened:** 23 November 2026  
**Branch:** `docs/ai-handoff-source-of-truth-2026-11-23`  
**Purpose:** Establish a durable, shared documentation and AI handoff contract.  
**Status:** In progress — governance corrections committed; full source-to-document reconciliation remains open.

## 1. Why this work exists

The repository contains product, business, architecture, API, database, RBAC, asset, design, testing and historical audit documents. Several documents used absolute labels such as “100% sesuai source code aktual” despite being dated snapshots. README also claimed all documentation was precisely synchronized. Those statements could mislead a new AI or contributor and cause it to implement against stale assumptions.

## 2. Changes made in this batch

- Added `docs/GABAH-DOCUMENTATION-CONTROL.md` as the shared entry point for AI/human contributors.
- Defined authority order, mandatory reading sequence, document responsibilities, evidence labels, workflow traceability, security/data safety constraints and handoff format.
- Updated README to stop claiming that every document is already precisely synchronized.
- Updated PROJECT-RULES to require all AI agents to read the handoff guide and avoid unsupported completion claims.
- Reclassified BUSINESS-RULES as a rule/decision register whose implementation status must be verified separately.
- Reclassified ARCHITECTURE, DATABASE-DESIGN and API-DESIGN as baselines requiring reconciliation against current source/migrations/tests.
- Clarified that DECISIONS is a dated ADR history and old decisions may be superseded.
- Clarified that asset numbering examples are not final corporate policy pending confirmation of the company's official standard; recast SC/PIBC asset categories as legacy records, not active owner divisions.
- Aligned PRD asset-numbering language with the pending corporate-standard decision and removed examples that implied SC/PIBC are automatic contract owners.

## 3. Important limitations

This batch is a governance correction, not a full audit of every Markdown file or every application workflow. No claim is made that all docs are now fully synchronized. In particular, detailed source-to-document verification is still required for:
- every API endpoint and auth transport;
- current database schema, migration history and existing-database upgrade behavior;
- every role/permission/data-scope combination;
- each module's actual UI → API → domain → persistence → notification/audit workflow;
- all status transitions, approvals, handovers, renewals and exception paths;
- current runtime/deployment instructions and security controls;
- old audit findings and PR references versus current main.

## 4. Verification record

- Documentation content was updated on this branch through GitHub commits.
- No application source code, schema migration, production data or runtime behavior was changed in this batch.
- Typecheck, build, PostgreSQL integration, Docker runtime and browser UAT were **NOT RUN** because this batch changes documentation only.
- Markdown link and terminology validation remains to be run in CI or a local checkout.
- This worklog is not a release approval.

## 5. Next required steps

1. Inventory every tracked `.md` file and classify it as current spec, decision register, procedure, worklog, historical audit or obsolete.
2. Reconcile PRD/requirements and business rules with owner-approved decisions; flag unresolved items instead of guessing.
3. Reconcile architecture/API/RBAC/database docs against current `main` source, migrations and tests.
4. Reconcile module workflows end-to-end and add role-based UAT evidence.
5. Correct stale README stack/runtime claims and broken documentation links only after checking actual files/configuration.
6. Add a lightweight CI guard for internal Markdown links and stale absolute claims where practical.
7. Keep this worklog and the UAT matrix updated in subsequent PRs.

## 6. Handoff instruction

The next AI must read `docs/GABAH-DOCUMENTATION-CONTROL.md`, this worklog, current branch/PR status, then continue the inventory and source reconciliation. Do not repeat the initial governance changes or claim the full audit is complete.


## Pass 2 — Full Markdown inventory and stale-source correction (23 November 2026)

### Repository inventory
- Enumerated the complete main Git tree at base SHA f39db6b8fd819d301f49815c7a33a04c80b2a6c0.
- Found **41 Markdown files** across agent instructions, root audit reports, PRD/rules, architecture/API/DB/RBAC, asset numbering, audits, design, operations runbooks, security reviews, test/UAT docs, progress logs, and changelog.
- Inventory is a snapshot of that base SHA; future additions must be included in later reviews.

### Additional files corrected in this pass
- AGENTS.md: removed stale hard-coded PR #18 integration branch; added mandatory project-context and documentation-control reading; clarified no merge/deploy without owner approval.
- docs/ops/BRANCH-AND-AI-COLLABORATION.md: replaced obsolete PR #18 branch policy with branch-isolation, exact-base, evidence, and explicit-approval rules. Old PR/branch references are historical only.
- docs/PROJECT-CONTEXT.md (new): consolidated owner-approved product, role/location, asset ownership, GA read-only workstation visibility, ticket routing, ME, module lifecycle, future endpoint-agent roadmap, and data-safety constraints.
- docs/GABAH-DOCUMENTATION-CONTROL.md: made owner-approved context part of the authority hierarchy and mandatory reading.
- docs/PRIMARY-ROLE-AND-LOCATION-MAPPING.md: changed fixed role list into legacy import guidance; no automatic role inference from RPC/PIBC location labels.
- docs/architecture/RBAC.md: removed RPC/SC as illustrative automatic owner domain; clarified location is not owner/role/scope.
- docs/product/REQUIREMENTS.md: corrected auth transport wording to state actual main baseline (Bearer) and that unmerged HttpOnly-cookie work is not current behavior; corrected dynamic asset owner and configurable numbering requirements; corrected loan approval and ticket-routing language.
- docs/product/BUSINESS-RULES.md: narrowed GA read-only visibility to explicitly granted Laptop/PC owner-IT records; no implied read access to all IT assets or software.
- README.md: added owner-approved context and corrected stale descriptions of RBAC and API documents.
- GABAH-CURRENT-STATE-AUDIT.md: preserved the original 3 October report, but clearly labeled it historical rather than current authoritative state.
- AUDIT_NOTES.md, GABAH-ARCHITECTURE-BASELINE.md, GABAH-AUDIT-REPORT.md, GABAH-P0-FINALIZATION-REPORT.md, GABAH-P0-SECURITY-HARDENING-REPORT.md, and GABAH-P0-VERIFICATION-REPORT.md: added historical-evidence warnings without deleting original content.

### Findings still open — do not infer closure
1. docs/architecture/API-DESIGN.md contains endpoint/auth/role descriptions needing complete route-by-route comparison against current server.ts, middleware, API client, and integration tests. Header warning is not completed reconciliation.
2. docs/architecture/DATABASE-DESIGN.md needs migration-by-migration schema comparison, including migration ledger and legacy upgrade behavior.
3. docs/architecture/ARCHITECTURE.md, PRD.md, docs/product/BUSINESS-RULES.md, and remaining RBAC sections still need workflow-level traceability to actual UI/API/domain/persistence/tests.
4. docs/ops/PRODUCTION-READINESS-GATES.md, security reviews, audit reports, UAT docs, and progress logs contain dated CI/branch/test claims. Revalidate against exact commit and workflow run; old PASS is not current PASS.
5. Review all remaining 41 Markdown files for dead links, duplicate/contradictory rules, hard-coded role assumptions, secrets/credential remnants, stale branch references, and inaccurate stack/deployment claims.
6. PR #248 cookie-auth work is separate and unmerged. Keep current main Bearer behavior distinct from that proposed branch until its CI integration failure is corrected and the change is merged.

### Verification and limitations
- This pass used GitHub source inspection and documentation edits only.
- No application source code, SQL migration, runtime behavior, or production data was changed.
- No TypeScript check, build, Docker/PostgreSQL test, browser UAT, security penetration test, or Markdown-link CI was run for these documentation edits.
- This is documentation correction in progress, not proof of application readiness and not a claim that all 41 files are fully reconciled.


## Pass 3 — UAT, API, database, and release-doc corrections (23 November 2026)

- UAT persona matrix now tests flexible Dynamic RBAC capabilities instead of presenting the nine legacy seed identities as the permanent role catalogue. Added explicit coverage for GA read-only Laptop/PC IT, ME/Perawatan, Humas and Secretariat capabilities, and custom roles.
- Removed an obsolete UAT scenario that implied RPC/SC could be an automatically approved asset owner. Legacy SC/PIBC-owned assets are review-only pending per-record classification.
- Marked historic PASS totals in UAT as evidence tied to their original commit/run, not current HEAD.
- Master Test Strategy now labels the existing seed accounts as test fixtures, not an official HR roster or role catalogue.
- API Design now explicitly records switch-role as authenticated and Admin-only, not public in development; its endpoint table remains a baseline pending full route-by-route reconciliation.
- Database Design now labels SC/PIBC and old role examples as legacy schema values, not current organizational or Dynamic RBAC policy.
- Production Readiness Gates and Office VM Runbook no longer prescribe PR #18/old branch as the current integration/deployment path. Release instructions require owner-approved release branch, exact-SHA CI, UAT, backup/restore, rollback, TLS, and monitoring evidence.
- RBAC data-scope audit is explicitly labeled a dated snapshot.
- UAT checklist now distinguishes a Karyawan at RPC from an application role and requires additional persona coverage.

### Validation status after pass 3
- Documentation/source inspection only; no application code, migration, runtime, or production data changed.
- PR #249 exact head before this pass was 320d65c07f1908eecd29a7e0c38fce558c183083; fetch the current head again before review.
- A bulk Markdown link-validation attempt was not completed because the repository connector call limit was reached. Do not claim links are clean.
- CI status checks/workflow runs were absent for the previously checked exact head; no CI PASS is claimed.
- Full API route reconciliation, migration-by-migration schema reconciliation, full Markdown link validation, browser UAT, and production readiness remain open.


## Pass 4 — Source inventories for API and database docs (23 November 2026)

- Compared route registrations in main server.ts at SHA f39db6b8fd819d301f49815c7a33a04c80b2a6c0 against the API Design endpoint tables. Static extraction found 130 explicit registered route/method combinations; 66 were already represented in the tables and 64 additional route combinations were absent. Added the 64 paths as a source inventory appendix, explicitly stating that route presence is not proof of authorization or UAT.
- Compared the main Git tree migration directory at the same SHA and found 47 SQL migration files (through 103_system_settings_company_profile.sql). Added the file inventory to Database Design and explicitly distinguished file presence from successful fresh install, legacy upgrade, idempotence, rollback, or restore testing.
- Updated RBAC account section to label named seed identities as legacy test fixtures, not official HR roster or canonical role catalogue.

### Remaining technical documentation reconciliation
- API route authorization/validation/request-response details still require handler-by-handler review and test mapping; route inventory alone is not sufficient.
- Database schema still requires actual table/column/constraint/index/trigger comparison after applying all 47 migrations to fresh and representative legacy databases.
- Markdown relative-link validation was not completed. CI checks/workflow runs were absent on the previously checked documentation PR head; fetch latest PR head before final review.


## Pass 5 — Implementation facts and role-model contradictions (23 November 2026)

### Source findings recorded in `docs/IMPLEMENTATION-TRUTH-REGISTER.md`
- Bearer session auth is the current main baseline; only health and login are public in `gabahSecurityMiddleware`.
- PostgreSQL Dynamic RBAC loads assigned role/permission/scope policy into a process cache; source inspection is not cache-refresh integration evidence.
- Auditor is dynamically resolved in PostgreSQL mode and receives a global non-GET deny gate with narrow notification/logout exceptions.
- GA's optional IT visibility is restricted in `getScopedAssets()` to owner IT + HLT/HPC via `assets.read.it_workstations`.
- `createAsset()` explicitly rejects SC, PIBC, and UNASSIGNED as new owners, requires an active owner master and `assets.create` plus matching owner scope. Legacy taxonomy entries remain for historical compatibility.
- Loan operations require the operation-specific permission and matching owner scope in PostgreSQL mode.
- Asset numbering is still allocated by an in-memory Map; the existing SQL sequence table is not used by `generateAssetNumber()` for atomic allocation.
- Partial migration remains: `ServerUser.role` is a nine-label legacy TypeScript union, and employee baseline asset visibility still checks legacy employee role labels even when PostgreSQL is active.

### Documentation corrections
- Added `docs/IMPLEMENTATION-TRUTH-REGISTER.md` and made it mandatory reading in the AI documentation-control guide and README.
- Corrected API and Database Design status/date claims; API now states current Bearer baseline and distinguishes route inventory from handler/UAT evidence.
- Corrected Database Design's asset sequence description so table existence is not misrepresented as atomic generator use.
- Corrected asset-numbering references to the actual in-memory generator and clarified legacy SC/PIBC categories are not permission for new-owner creation.
- Corrected RBAC primary profile model: Sekretariat Direksi and Humas are additional capabilities, not primary employee roles; Supply Chain/SC and PIBC legacy labels are not new application roles.
- Corrected PRD personas and primary-role language to align Sekretariat Direksi/Humas with additional capabilities.
- Added historical-evidence warning to Production Readiness Gates; old CI counts and PASS claims remain tied to their original SHAs/runs.

### Open code/documentation gaps
1. Employee baseline visibility still derives from legacy `ServerUser.role` labels in PostgreSQL mode. Replace only after an approved capability/policy design and migration/UAT.
2. Verify bulk import and all internal/alternate asset creation paths enforce the SC/PIBC/UNASSIGNED new-owner guard consistently.
3. Test GA HLT/HPC read-only visibility against list, detail-by-ID, search, export, dashboard, and direct mutation APIs.
4. Dynamic RBAC cache refresh and multi-process behavior require PostgreSQL integration tests.
5. Asset numbering requires PostgreSQL-backed atomic allocation before multi-instance safety can be claimed.
6. Existing docs still contain old fixture email/name and historical schema examples; they are not an HR roster. Further cleanup is needed across all Markdown files.

### Evidence boundary
- Source inspection baseline: main SHA `f39db6b8fd819d301f49815c7a33a04c80b2a6c0`.
- No app code, migrations, or data were changed in this pass.
- No tests were executed; all findings are source-inspection only, not TESTED/PASS.


## Pass 6 — CI evidence and further business-rule alignment (23 November 2026)

- Marked ADR-009 (the old nine-login-role decision) SUPERSEDED. ADR-010 now refers to a valid Sekretariat Direksi capability/permission, not a separate primary role.
- Updated PRD: employee profile/primary role is distinct from Sekretariat Direksi and Humas capabilities; asset assign/move requirements require operation permission + owner scope; final disposal requires Superadmin authority; ticket routing describes direct IT Support assignment and the ME PIBC queue.
- Updated Business Rules: Sekretariat VIP reservation is triggered by a capability/permission, not a primary role. Removed stale line-number-only implementation references where practical.
- Updated Architecture and ADR review dates so a 2026-09 snapshot is not mistaken for a fresh review.

### CI evidence (important exact-head boundary)
- GitHub Actions CI run **#3187**, run ID `45120214155`, job `verify` / job ID `137512020298`, completed **success** for PR head `8e6b9dfa99eded295882af36df9c53338f5747f1` (merge checkout `2ac6053225957b656598ac53c58b42fa9b80ed22`).
- The run executed `npm ci`, production dependency audit, production dependency/browser storage policy checks, lint, build, Docker image build, PostgreSQL 17 service-backed integration, P0 security verification, RBAC and data-scope suites, asset/loan/ticket/room/contract/maintenance regression suites, and Docker/HTTP smoke checks. The log includes passing 142/142 Dynamic RBAC checks, 96/96 asset scope checks, 132/132 primary asset mutation checks, 55/55 user/asset-related checks, and multiple PostgreSQL behavioral totals (including T2B-1 19/19, T2B-2 22/22, T2B-3 30/30, maintenance authz 33/33). No test failure was reported in the successful job.
- **Do not attribute run #3187 to later commits.** Additional documentation commits were pushed after head `8e6b9d`; the current head has its own CI run #3193. At worklog update time, #3193 was still in progress. Wait for and inspect its exact-head result before claiming current PR CI is green.
- CI success validates the code tree included in that run, not the prose accuracy of every Markdown document, browser UAT with business users, production backup/restore, staging deploy, or sign-off.


## Pass 7 — Correct remaining stale ADR and persistence claims (23 November 2026)

- ADR-007 no longer claims that the asset number generator is atomic. It is marked PARTIAL/POLICY PENDING: technical default format is implemented, corporate standard awaits confirmation, and the counter is in-memory/non-atomic across app processes.
- ADR-008 no longer claims automatic production fallback to JSON. It is marked PARTIAL/ENVIRONMENT-SCOPED: file-store fallback is limited to non-production startup convenience; production fails fast when configured PostgreSQL is unavailable, and runtime PostgreSQL failure after authority is latched closed until recovery/restart.
- PROJECT-RULES now states the same production-vs-development persistence boundary.
- The PRD contract examples already distinguish owner functions from RPC/SC/PIBC locations; this pass rechecked that language and kept it as review-required owner mapping.

### Current exact-head CI boundary
- CI #3187 passed on older head `8e6b9dfa99eded295882af36df9c53338f5747f1`; it is not evidence for later commits.
- Current head after this pass must be re-fetched. Its exact-head CI run is expected to be separate; no PASS claim until that run completes.


## Pass 8 — Remaining AI guidance and legacy audit documents (23 November 2026)

- Re-inventoried the current branch tree: **45 Markdown files** (the base-main inventory was 41 before four new documentation files were added).
- `docs/AI-CHANGE-GUARDRAILS.md`: removed the obsolete PR #18 / `fix/role-based-navigation` hard-coded branch workflow. It now requires the shared project-context and implementation-truth documents and defers branch target to current `AGENTS.md` / collaboration policy.
- `.agents/skills/gabah-maintainer/SKILL.md`: corrected the audit folder path (`docs/audits/`), made the shared context/truth register mandatory reading, and rewrote role examples so RPC/SC and PIBC are employee location/unit contexts, while Sekretariat Direksi and Humas are capabilities, not primary roles.
- `docs/GABAH-FIXES-AND-RECOMMENDATIONS.md`: preserved as a dated 29 September historical audit and warned that old findings (including the former absence of loan rejection) and nine-role assumptions are not current.
- `docs/progress/dynamic-rbac-progress.md`: labeled as a chronological log; its old PR/CI status and owner-code assumptions must not override current project context. A historical PR #167 statement that treated SC as a division owner is explicitly superseded by the current RPC/SC location model and new-asset guard.
- Rechecked the current docs for stale PR #18 references. The active AI guardrails and maintainer skill no longer direct contributors to that obsolete integration branch.

### Remaining documentation work
- 45-file inventory now includes new shared context, documentation control, and implementation truth register. Not all 45 files have been individually reconciled in this pass; historical audit/log documents intentionally retain old facts with explicit historical warnings.
- Full Markdown link validation remains NOT RUN. Several documents contain external links and historical file references that need a dedicated link checker.
- Current exact-head CI is still required after the latest commits; no status from an older head may be reused.


## Pass 4 — Reconcile current authentication, persistence, and numbering claims (25 November 2026)

### Verified source facts
- Browser API client uses `credentials: 'same-origin'`; login sets HttpOnly `gabah_session` (SameSite=Strict, Secure in production, 7-day max age).
- Server authentication accepts the browser cookie and also Bearer tokens for non-browser clients; `x-auth-token` remains a compatibility header. Cookie-based mutations require same-origin Origin validation.
- Active sessions live in process memory only. The legacy `user_sessions` table was created by migration 002 but is not read/written by the current runtime. Session data is excluded from JSON snapshots and the PostgreSQL `gabah_state` payload.
- PostgreSQL is authoritative. After a successful commit, the exact committed payload is written to `gabah_state.json` as a recovery snapshot. It is not an automatic failover store after a PostgreSQL runtime failure.
- PostgreSQL asset-number issuance uses `reserveAssetNumberSequence()` with a transaction and atomic UPSERT. The in-memory counter is only the development file-store path. Corporate numbering format remains pending company approval; browser preview must not fabricate a next number.

### Corrections made on this pass
- Updated README, PROJECT-RULES, API Design, Architecture, Database Design, Requirements, Asset Numbering, UAT, Documentation Control, and Implementation Truth Register to match the source-observed contracts.
- Corrected stale Bearer-only/browser-token-storage statements and the unused `user_sessions` table description.
- Corrected stale claims that asset numbering still uses an in-memory Map in PostgreSQL mode.
- Corrected UAT scenario numbering and refreshed implementation evidence after PR #285, #287, and #290.
- PR #285 merged: two primary profiles and Dynamic RBAC documentation alignment.
- PR #287 merged: SC/PIBC removed from Administration fallback division choices and static legacy permission matrix options; exact-head CI #45564612013 passed 119/119.
- PR #290 merged: removed fabricated client-side asset number preview and unapproved “official format” claims; exact-head CI #45565766684 passed 119/119.

### Remaining implementation gaps — do not call the audit complete
- Issue #289: read-only enforcement is still hard-coded to the `auditor` role key; make it a generic configurable policy/capability for custom roles.
- Issue #291: legacy SC/PIBC codes remain in the shared owner/division master as active-looking compatibility records and are still returned by `GET /api/master/divisions`; retire them for new owner/contract choices without deleting historical references.
- Issue #293: inventory and safely retire any stale rows/table from legacy `user_sessions`; current runtime ignores the table, but existing database contents have not been audited.
- Full endpoint-by-endpoint RBAC audit, UAT per custom role/scope, legacy database upgrade rehearsal, and production browser/proxy validation remain open.
