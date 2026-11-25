#!/usr/bin/env node

/**
 * Retired legacy utility.
 *
 * This script previously overwrote the gabah_state user collection and
 * deactivated every account outside a hard-coded six-user fixture. Its role
 * values also predated the current Dynamic RBAC model (where users have only
 * the primary profiles Karyawan/Admin GABAH and functional roles/scopes are
 * assigned separately).
 *
 * Do not restore database writes here. A replacement UAT fixture provisioner
 * must be explicitly environment-gated, transactionally scoped, idempotent,
 * preserve unrelated accounts, assign current Dynamic RBAC role/scope records,
 * and have PostgreSQL integration tests before it is enabled.
 */

console.error(
  '[GABAH] Refusing to run: scripts/reset-temporary-users.mjs is retired. ' +
  'It used to overwrite canonical users and deactivate every other account. ' +
  'Use the approved Dynamic RBAC UAT provisioning workflow instead.',
);
process.exitCode = 1;
