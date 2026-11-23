# Production Dependency Audit Gate — 2026-11-23

## CI policy

The CI pipeline runs:

```sh
npm audit --omit=dev --audit-level=high
```

This blocks a merge when a production dependency has a High or Critical advisory. Development/build dependencies are excluded from this gate and remain a separate review item; this is intentional so the production runtime gate has a clear scope.

## Remediation policy

1. Prefer a patched compatible release and update both `package.json` and `package-lock.json`.
2. Review breaking changes and run the full test/build/Docker smoke suite after dependency changes.
3. Do not use `npm audit fix --force` without reviewing the resulting major-version changes.
4. Do not add blanket audit suppressions. Any unavoidable exception requires a documented package, advisory, affected path, compensating control, owner, and expiry/review date.

## Scope limitation

A green production-only audit does not certify the developer toolchain or transitive build dependencies. A separate dev/build dependency review is still required before production release.
