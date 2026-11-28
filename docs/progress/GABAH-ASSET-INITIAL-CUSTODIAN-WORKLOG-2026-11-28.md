# GABAH Asset Initial Custodian Persistence Worklog

**Tanggal:** 2026-11-28  
**Repository:** `inieki-lab/gabah-gas`  
**Base branch:** `fix/forms-preserve-input-on-save-failure-2026-11-28` @ `2fddfd618384f9118cf14175b0aebbd94ce899a0`  
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
- `scripts/asset-scope-policy-verify.mjs`
- Dokumen worklog ini.

## Validasi

| Pemeriksaan | Status |
|---|---|
| Source inspection modal → App → API client → backend service | DONE |
| API payload supports `assigned_to_user_id` | DONE |
| Backend validates active user before asset number allocation | DONE |
| Regression assertions added | ADDED; not run locally |
| `npm run test:asset-scope-policy` | NOT RUN locally |
| TypeScript/build | NOT RUN |
| Exact-head GitHub Actions | PENDING |
| Browser UAT with IT/GA and no-directory user | NOT RUN |

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
