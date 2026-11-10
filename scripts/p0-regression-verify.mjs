/**
 * GABAH P0 REGRESSION TEST — Dynamic RBAC & Superadmin
 *
 * Isolated unit tests only. This script never contacts a running server,
 * PostgreSQL instance, or production account.
 *
 * Run: npm run test:p0-rbac
 */
import fs from 'node:fs';
import {
  testablePoliciesByUser,
  isRbacSuperadmin,
  hasRbacPermission,
  getEffectivePermissionKeys,
  getEffectiveRoleKeys,
  countRbacSuperadmins,
  isSuperadminActorForMode,
  wouldRemoveLastActiveSuperadmin,
} from '../server/rbac-policy.ts';
import { clearOrphanedTicketAssetLinks } from '../server/persistence-integrity.ts';

const clonePolicies = policies => policies.map(policy => ({
  ...policy,
  permissions: new Set(policy.permissions),
  scopes: policy.scopes.map(scope => ({ ...scope })),
}));
const originalPolicies = new Map(
  [...testablePoliciesByUser.entries()].map(([userId, policies]) => [userId, clonePolicies(policies)]),
);

const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

const fixtures = new Map([
  ['USR-01', [{
    roleKey: 'superadmin',
    roleName: 'Superadmin',
    isSuperadmin: true,
    permissions: new Set(['*']),
    scopes: [],
  }]],
  ['USR-02', [{
    roleKey: 'ga',
    roleName: 'GA',
    isSuperadmin: false,
    permissions: new Set(['tickets.write']),
    scopes: [],
  }]],
  ['USR-03', [{
    roleKey: 'it',
    roleName: 'IT',
    isSuperadmin: false,
    permissions: new Set(['tickets.read']),
    scopes: [],
  }]],
  ['USR-04', [
    {
      roleKey: 'ga_dispatcher',
      roleName: 'GA Dispatcher',
      isSuperadmin: false,
      permissions: new Set(['tickets.read', 'tickets.assign']),
      scopes: [],
    },
    {
      roleKey: 'me_technician',
      roleName: 'ME Technician',
      isSuperadmin: false,
      permissions: new Set(['tickets.update', 'maintenance.update']),
      scopes: [],
    },
  ]],
]);

const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, status: 'PASS' });
    console.log(`PASS  ${name}`);
  } catch (error) {
    results.push({ name, status: 'FAIL' });
    console.error(`FAIL  ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

try {
  test('legacy_ticket_with_missing_asset_keeps_ticket_and_clears_only_stale_link', () => {
    const legacyTicket = {
      id: 'TKT-LEGACY',
      related_asset_id: 'AST-001',
      related_asset_name: 'Server lama',
      related_asset_number: 'IT-LEGACY-001',
    };
    const validTicket = {
      id: 'TKT-VALID',
      related_asset_id: 'AST-HLT-001',
      related_asset_name: 'Laptop valid',
    };
    const detached = clearOrphanedTicketAssetLinks(
      [legacyTicket, validTicket],
      [{ id: 'AST-HLT-001' }],
    );

    if (detached.length !== 1 || detached[0].ticketId !== 'TKT-LEGACY' || detached[0].assetId !== 'AST-001') {
      throw new Error('Expected only the orphaned legacy asset link to be detached');
    }
    if (legacyTicket.related_asset_id !== undefined) {
      throw new Error('Orphaned related_asset_id was not cleared');
    }
    if (legacyTicket.related_asset_name !== 'Server lama' || legacyTicket.related_asset_number !== 'IT-LEGACY-001') {
      throw new Error('Legacy ticket asset description was not preserved');
    }
    if (validTicket.related_asset_id !== 'AST-HLT-001') {
      throw new Error('Valid ticket asset link was changed');
    }
  });

  testablePoliciesByUser.clear();
  for (const [userId, policies] of fixtures) testablePoliciesByUser.set(userId, policies);

  test('assigned_superadmin_is_recognized', () => {
    if (!isRbacSuperadmin('USR-01')) throw new Error('Assigned Superadmin was not recognized');
  });

  test('unassigned_profile_label_cannot_bypass_postgres_rbac', () => {
    if (isSuperadminActorForMode({ id: 'USR-99', role: 'Admin GABAH' }, true, false)) {
      throw new Error('Legacy profile label bypassed PostgreSQL role assignment');
    }
  });

  test('assigned_superadmin_is_authorized_in_postgres_mode', () => {
    if (!isSuperadminActorForMode({ id: 'USR-01', role: 'Karyawan' }, true, true)) {
      throw new Error('Assigned Superadmin was rejected in PostgreSQL mode');
    }
  });

  test('file_store_keeps_legacy_admin_compatibility', () => {
    if (!isSuperadminActorForMode({ id: 'USR-99', role: 'Admin GABAH' }, false, false)) {
      throw new Error('File-store Admin GABAH compatibility was lost');
    }
  });

  test('ordinary_staff_is_not_superadmin', () => {
    if (isRbacSuperadmin('USR-02')) throw new Error('GA staff unexpectedly became Superadmin');
  });

  test('superadmin_has_wildcard_permissions', () => {
    for (const key of ['tickets.create', 'tickets.update', 'system.authentication']) {
      if (!hasRbacPermission('USR-01', key)) throw new Error(`Missing ${key}`);
    }
  });

  test('ordinary_staff_defaults_to_deny', () => {
    if (!hasRbacPermission('USR-02', 'tickets.write')) throw new Error('Expected tickets.write grant');
    if (hasRbacPermission('USR-02', 'system.authentication')) throw new Error('Unexpected system permission');
    if (hasRbacPermission('USR-02', 'system.super_admin')) throw new Error('Unexpected Superadmin permission');
  });

  test('multi_role_permissions_are_the_union_of_both_roles', () => {
    const roleKeys = getEffectiveRoleKeys('USR-04');
    const permissionKeys = getEffectivePermissionKeys('USR-04');
    if (roleKeys.length !== 2) throw new Error(`Expected 2 roles, received ${roleKeys.length}`);
    for (const key of ['tickets.assign', 'tickets.update', 'maintenance.update']) {
      if (!permissionKeys.includes(key)) throw new Error(`Missing permission from role union: ${key}`);
    }
    if (permissionKeys.includes('system.authentication')) throw new Error('Multi-role user received protected permission');
  });

  test('last_superadmin_guard_counts_only_active_users_and_roles', () => {
    const currentQuery = serverSource.match(/const current = await client\.query\\('([^']+)'/);
    const remainingQuery = serverSource.match(/const remaining = await client\.query\\(\s*'([^']+)'/);
    if (!currentQuery || !remainingQuery) throw new Error('Superadmin assignment guard queries were not found');
    for (const [name, query] of [['current', currentQuery[1]], ['remaining', remainingQuery[1]]]) {
      if (!/JOIN users u ON u\.id = ur\.user_id/.test(query)) throw new Error(`${name} query does not join user activity state`);
      if (!/u\.is_active = TRUE/.test(query)) throw new Error(`${name} query counts inactive users`);
      if (!/r\.is_active = TRUE/.test(query)) throw new Error(`${name} query counts inactive Superadmin roles`);
    }
  });

  test('last_active_superadmin_cannot_be_removed', () => {
    if (!wouldRemoveLastActiveSuperadmin(true, false, 0)) {
      throw new Error('Removal of the last Superadmin was not blocked');
    }
  });

  test('superadmin_can_be_removed_when_another_active_superadmin_remains', () => {
    if (wouldRemoveLastActiveSuperadmin(true, false, 1)) {
      throw new Error('Removal was blocked despite another active Superadmin');
    }
  });

  test('superadmin_replacement_assignment_is_allowed', () => {
    if (wouldRemoveLastActiveSuperadmin(true, true, 0)) {
      throw new Error('Replacement Superadmin assignment was incorrectly blocked');
    }
  });

  test('non_superadmin_removal_does_not_trigger_last_admin_guard', () => {
    if (wouldRemoveLastActiveSuperadmin(false, false, 0)) {
      throw new Error('Ordinary user removal triggered Superadmin guard');
    }
  });

  test('active_superadmin_count_respects_active_user_filter', () => {
    if (countRbacSuperadmins(['USR-01']) !== 1) throw new Error('Expected one active Superadmin');
    if (countRbacSuperadmins(['USR-02', 'USR-03']) !== 0) throw new Error('Unexpected Superadmin count');
  });
} finally {
  testablePoliciesByUser.clear();
  for (const [userId, policies] of originalPolicies) {
    testablePoliciesByUser.set(userId, policies);
  }
}

const passed = results.filter(result => result.status === 'PASS').length;
const failed = results.filter(result => result.status === 'FAIL').length;
console.log(`\n=== SUMMARY: ${passed}/${results.length} PASS, ${failed} FAIL ===`);
if (failed > 0) process.exitCode = 1;
