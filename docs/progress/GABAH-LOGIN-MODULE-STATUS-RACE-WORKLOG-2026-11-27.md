# GABAH Worklog — Login Module Status Initialization Race

- Date: 2026-11-27
- Branch: `fix/login-module-status-init-race`
- Code commit: `b9a11c1dc582bafdc0323cf378014bb3726db262`
- Base: `fix/postgres-skip-readonly-state-snapshot`
- Status: code change pushed; build, automated tests, and browser UAT not yet run.

## Symptom
After successful login, the portal remained indefinitely on “Memuat status modul…”, even though `/api/auth/login` and `/api/modules` returned HTTP 200 and the module response contained 12 active modules.

## Root cause identified
The initial `initAuth()` session restoration request can remain in flight while the user completes an interactive login. If that older request then resolves with a session, it calls `clearRoleScopedData()`, which resets `activeModuleKeys` to `null`. It can set the same user ID already set by interactive login, so the module-loading effect (which depends on `currentUser?.id`) does not run again. This leaves the UI in the module-loading state.

## Change
- Added an auth-initialization generation guard in `src/App.tsx`.
- Interactive login increments the generation, invalidating any earlier in-flight `initAuth()` result.
- A stale initialization result can no longer clear role-scoped/module state, change the login view, or trigger its trailing refresh.

## Validation
- Static patch checks: PASS (generation guard and login invalidation are present).
- TypeScript/build: NOT RUN.
- Automated tests: NOT RUN.
- Browser UAT: NOT RUN; requires user to pull this branch, rebuild/restart the app, and verify dashboard loads after login.
- No database, Docker volume, or production data changes.

## Next
Run project build/tests, then user UAT on this branch. Do not merge to `main` until checks pass and the user explicitly approves.
