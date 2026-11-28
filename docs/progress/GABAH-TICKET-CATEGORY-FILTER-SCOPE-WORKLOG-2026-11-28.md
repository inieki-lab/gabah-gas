# GABAH Ticket Category Filter Scope Worklog

**Tanggal:** 28 November 2026  
**Repository:** `inieki-lab/gabah-gas`  
**Base:** `main`  
**Branch:** `fix/ticket-category-filters-by-effective-scope-2026-11-28`  
**Status:** IMPLEMENTED — exact-head CI pending; browser UAT pending.

## Temuan terkonfirmasi

- `TicketsView` already derives the authorized ticket list from the API-scoped data and recognizes IT, GA, ME, SC/PIBC legacy compatibility, and the ME queue permission.
- However, the generic operational category filter fallback always appended `IT`, `GA`, and `ME` regardless of the current user's assigned function.
- An IT-only operator could therefore see GA and ME filter choices even though the API returned only the user's IT-scoped tickets. Selecting those filters produced empty lists and made the ticket menu look inconsistent with the user's role.
- The `isIT` capability was already computed but not used in the category list.

## Perbaikan

- Build the category list from explicit effective function flags: IT, GA, ME queue, and legacy file-store SC/PIBC only.
- Merge those function categories with the categories present in the already-scoped API result.
- Preserve `ALL` as the unfiltered option.
- Remove the unconditional IT/GA/ME category exposure.
- Update the existing ME queue regression test to assert the shared dynamic category construction and to reject the old hard-coded fallback.

## File berubah

- `src/components/views/TicketsView.tsx`
- `scripts/pibc-me-ticket-queue-verify.mjs`
- Dokumen worklog ini.

## Validation

- Source inspection of role keys, effective permission metadata, API-scoped ticket list, and category filter construction: DONE.
- Existing `test:pibc-me-ticket-queue` expanded with category-scope regression.
- Local test, TypeScript/build, exact-head CI, and browser UAT: pending/not run.
- UAT wajib: IT-only account sees IT + authorized data categories; GA-only sees GA + authorized data categories; ME queue role sees ME + authorized data categories; Superadmin sees categories in global data; self-service Karyawan sees only own-ticket categories.

## Safety

- No backend ticket access policy, unit/location scope, role assignment, permission grant, or ticket data changed.
- Category filters are presentation only; backend/API remains authoritative.
- No merge to `main` without explicit owner approval.
