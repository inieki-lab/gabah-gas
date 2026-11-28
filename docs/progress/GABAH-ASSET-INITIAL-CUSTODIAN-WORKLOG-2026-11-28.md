# GABAH Asset Initial Custodian Persistence Worklog

**Tanggal:** 2026-11-28  
**Repository:** `inieki-lab/gabah-gas`  
**Original base:** `fix/forms-preserve-input-on-save-failure-2026-11-28` @ `2fddfd618384f9118cf14175b0aebbd94ce899a0`  
**Current PR base head:** `be4613630f033998345c8a0fadf71866bc537d94` (worklog-only commit on top of code head `efdf124f4d63fd81abea81667e0b93062551248e`)  
**Working branch:** `fix/asset-initial-custodian-selection-stack-2026-11-28`  
**Status:** IMPLEMENTATION COMMITTED — exact-head CI pending; browser UAT not run.  
**Dependency:** stacked on PR #359; merge PR #359 first, then retarget this PR to `main`.

## Temuan yang dibuktikan

- `CreateAssetModal` previously accepted a free-text custodian name and fabricated an object with an ID like `CUST-1234`.
- `App.handleCreateAsset` did not forward this value to `gabahApi.createAsset`, so the field was silently discarded.
- The API client already supports `assigned_to_user_id`.
- `AssetDomainService.createAsset` already validates that the referenced user exists and is active before allocating the asset number, then persists a real `assigned_to` relation.
- `GET /api/users` requires `users.read`; the approved operational IT/GA accounts have this read capability for assignment and helpdesk routing. Users without an accessible directory can still create an unassigned pool asset.

## Perbaikan

- Replace free-text custodian entry with a dropdown of active users.
- Filter inactive accounts and sort active users by name.
- Empty selection means Pool / Fasilitas Umum; if no directory is available, the form clearly explains that the asset will be created without initial assignment.
- Send the selected user's real ID as `assigned_to_user_id` through App to the existing API client.
- Remove fabricated `CUST-...` IDs and local-only `assigned_to` objects.
- Keep backend validation authoritative; if the selected account becomes inactive before save, server rejection is surfaced to the form.
- Add regression assertions to the CI-registered asset scope policy verifier.

## File yang diubah

- `src/components/modals/CreateAssetModal.tsx`
- `src/App.tsx`
- `server/services.ts`
- `scripts/asset-scope-policy-verify.mjs`
- `scripts/asset-create-atomicity-verify.mjs`
- Dokumen worklog ini.



## Backend authorization finding — assets.assign

The first review of the create service showed that `POST /api/assets` requires `assets.create`, but the service accepted `assigned_to_user_id` without separately requiring `assets.assign`. The existing standalone assignment endpoint already requires `assets.assign`; allowing the same mutation during create would bypass that permission boundary.

Additional fix:
- `createAsset()` now requires both `assets.create` and owner-scoped `assets.assign` when `assigned_to_user_id` is supplied.
- The `assets.assign` check runs before looking up the target user, so an actor without assignment authority cannot probe whether a user ID is active.
- The UI only shows the initial-custodian selector when effective `assets.assign` is present. PostgreSQL Dynamic RBAC remains authoritative; IT/GA legacy fallback is used only when permission metadata is absent in file-store mode.
- Users who can create assets but cannot assign them can still create an unassigned Pool / Fasilitas Umum asset.
- Added CI source regressions for the service guard, HTTP 403 contract, permission-gated UI, and active-user relation.

This is a security correction, not just a UI change. Existing permission catalog/migration already defines `assets.assign`; no migration is added.

## Validasi

| Pemeriksaan | Status |
|---|---|
| Source inspection modal → App → API client → backend service | DONE |
| API payload supports `assigned_to_user_id` | DONE |
| Backend validates active user before asset number allocation | DONE |
| Regression assertions added | ADDED; not run locally |
| `npm run test:asset-scope-policy` | NOT RUN locally; permission-gate assertions added |
| `npm run test:asset-create-atomicity` | NOT RUN locally; assignment guard/403 ordering assertions added |
| TypeScript/build | NOT RUN |
| Exact-head GitHub Actions | PASS — #3980 (`46115322315`) 120/120 steps on head `7b6cc5cdb736cdb85f797959df4373b9de20be2f`; includes corrected stacked base `efdf124...` |
| Browser UAT with IT/GA and no-directory user | NOT RUN |



## CI feedback and stacked-base update

- Initial CI #3950 (`46113901258`) failed at step 81, `PIBC ME ticket queue and unit-scope regression`, because the base PR's old ticket-form source matcher did not yet include the new `isSubmitting` submit lock.
- PR #359 corrected that matcher in commit `9d16fbc057264b97bb8f841e757a888637ba99e9`; its latest worklog/base commit is `484188c93cf575b8dc7e7f79ca01e882be04decf`.
- The base branch advanced. GitHub compare of current base vs this head reports only the four intended asset-custodian files in the PR diff; no PR #359 files are included as duplicate changes.
- A new exact-head CI run must be triggered after updating this branch/worklog; status PENDING.



## Updated CI feedback from stacked base

- CI #3960 (`46114473603`) failed at the inherited `test:effective-permission-ui` step because the base branch still contained a false-positive maintenance source matcher.
- PR #359 corrected the assertion in `fd80ab1c4800f17eaf76c5660c44c851f4519750` and recorded it in base worklog commit `5c2fcca38ee66306ff0e834d87151fe5be74af53`.
- The stacked PR base has now advanced to that commit. The next exact-head CI run must verify the updated base plus asset assignment permission changes.



## CI feedback — permission-gated payload matcher

- CI #3963 (`46114571674`) reached the asset scope policy suite and failed one source assertion.
- The implementation correctly changed the payload from unconditional `assigned_to_user_id` to `canAssignInitialCustodian ? assignedToUserId : undefined`, but the earlier test still expected the unconditional form.
- Updated the regression matcher to assert the permission-gated payload expression.
- Fix commit: `a684420da7b248926d0cad36fc23b9fff3035912`.
- All other 111 asset-scope assertions passed, including the new UI permission gate, App forwarding, and backend `assets.assign` service check. Exact-head rerun pending.



## Base branch advanced after form-action additions

- PR #359 now also contains loan-request error surfacing and ticket-resolution error recovery; latest code head is `efdf124f4d63fd81abea81667e0b93062551248e`, followed by worklog-only head `be4613630f033998345c8a0fadf71866bc537d94`.
- These changes touch App and UI form paths but do not overlap the asset assignment service/selector changes in this PR.
- Re-run the stacked CI against the latest base so the merged application is verified as a whole.



## CI result and latest stacked base

- Exact-head CI #3969 (`46114897713`) completed SUCCESS on code head `a1d0f4f5bc9801e042e4eb5cf43537285c08c4f1`; 120/120 workflow steps passed, including asset-scope policy, asset-create atomicity, PostgreSQL integration, production build, Docker runtime smoke, and HTTP security checks.
- After that run, PR #359 advanced to `671fa0e74ae23d4357c49a8d62baa4d6dcdbbf5f` with additional ticket-resolution and loan-request error recovery.
- The new base changes are in separate UI paths from asset assignment, but rerun CI against the current stacked base before calling the PR ready.



## CI feedback — previous base was missing ticket handler scope fix

- CI #3977 (`46115210970`) failed TypeScript with `handleResolveTicket` not found in `TicketsView`.
- This run used the prior stacked base before PR #359's handler-scope correction.
- PR #359 now contains the correction in commit `30a0300d2d1e78b7c22282fea8b1f3908a385c76`; current base head is `efdf124f4d63fd81abea81667e0b93062551248e`.
- Trigger a new exact-head CI against the corrected base; do not treat #3977 as a failure in the asset-custodian code.



## Final integrated exact-head CI result

- CI #3980 (`46115322315`) completed **SUCCESS** on exact head `7b6cc5cdb736cdb85f797959df4373b9de20be2f`.
- All 120/120 workflow steps passed, including TypeScript, asset-scope policy, asset-create atomicity, PostgreSQL 17 integration, production build, Docker runtime smoke, and HTTP security checks.
- The run included the corrected stacked base from PR #359 at `efdf124f4d63fd81abea81667e0b93062551248e`.
- Browser UAT remains NOT RUN; verify initial custodian selection and server 403 behavior using real role test accounts before merge.

## Batasan dan risiko

- No database schema or migration change is required; this uses the existing relational assignment contract.
- No role, permission, user, asset, or operational data was modified.
- Initial assignment remains optional. An empty selection creates a pool asset.
- This PR is stacked on PR #359 to avoid conflicting changes to the same asset-create form. Do not retarget it to `main` until PR #359 is merged.
- Do not merge either PR without explicit owner approval.

## Next

1. Wait for exact-head CI and resolve failures on this branch.
2. Browser-test with an IT/GA user that can read the employee directory; verify a selected active user appears as the assigned custodian after save.
3. Browser-test with no user-directory permission; verify pool creation remains possible and no fake custodian is written.
4. After PR #359 is approved/merged, retarget this PR to `main` and rerun CI.
