# GABAH Worklog — Administration Category Owner Options

- Date: 2026-11-27
- Branch: `fix/admin-category-owner-options`
- Base: `fix/admin-master-fetch-cancellation`
- Parent stack: PR #339 → #346 → #347 → #348 → #349 → this change
- Status: implementation and regression committed; CI/browser UAT pending.

## Finding
The Add Category form still exposed `SC` and `PIBC` as owner divisions, even though the agreed data model treats RPC/SC and PIBC as physical locations, not asset owner domains. The backend category master regression already rejects new SC/PIBC owners, so the UI offered choices that would fail server validation. The form also defaulted every new category to IT without requiring the administrator to choose an owner.

## Change
- Remove SC and PIBC from new category owner choices.
- Add an explicit empty “Pilih owner domain” option.
- Require owner selection before submitting the category.
- Reset the form to no selected owner after creation.
- Add source regression and register it in npm + CI.
- Historical SC/PIBC owner data is not modified; only new category creation UI is constrained.

## Validation
- Source, form validation, npm script, and CI registration committed.
- Regression execution, TypeScript/build, exact-head CI, and browser UAT pending.
- No database, historical asset, or category records changed.
- UAT: verify IT/GA choices only and ensure a blank owner selection is blocked before POST.

## Next
Run exact-head CI and category create UAT. Keep this stacked PR Draft until parent dependencies and all release gates are satisfied.
