# GABAH — Generic Read-only RBAC Evidence Worklog

**Date:** 26 November 2026  
**Repository:** `inieki-lab/gabah-gas`  
**Branch:** `fix/generic-readonly-policy-2026-11-26`  
**Implementation PR:** #301 (already merged)  
**Implementation HEAD:** `adc706edcb038b41a35bbfb2ea429f0293777169`  
**CI:** run #3534 / `45625865976` — SUCCESS  
**Status:** DOCUMENTATION SYNCHRONIZATION — browser UAT remains open.

## Evidence

- `security.read_only` is a generic Dynamic RBAC marker; it is not tied to a custom role name.
- Any assigned role carrying the marker enforces deny-write precedence even if another assigned role grants create/update or Superadmin.
- Read-only permission filtering is allowlist-based; new/non-read permissions are not implicitly granted.
- `isAuditorActor()` remains separate from generic read-only. This preserves Auditor's approved global-observer visibility without granting that visibility to arbitrary custom read-only roles.
- Runtime middleware blocks mutation methods for generic read-only actors, with narrowly documented logout/notification-read exceptions.
- CR-04/CR-05 integration creates a custom non-Auditor role with both read and write permissions plus `security.read_only`, confirms effective permission filtering, verifies GET paths, and expects POST asset creation to return 403.

## Remaining acceptance

1. Browser UAT with a custom read-only role and an Auditor account.
2. Verify list, detail, dashboard, direct-ID, and module scope parity for custom read-only roles.
3. Verify mixed role assignments including Superadmin remain deny-write and do not gain global observer visibility.
4. Keep issue #289 open until the remaining visibility/UAT checks pass.

No runtime source changes are made in this documentation synchronization branch.
