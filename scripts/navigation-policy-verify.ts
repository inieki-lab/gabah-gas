import assert from 'node:assert/strict';
import { ROLE_NAVIGATION, getDefaultNavTabForRole, isNavTabAllowedForRole, isSuperadminNavigationAllowed } from '../src/navigation/roleNavigation';

const expectedRoles = [
  'Admin GABAH', 'IT', 'GA', 'Sekretaris Direksi', 'Humas',
  'Supply Chain', 'PIBC', 'Karyawan', 'Auditor',
];
assert.deepEqual(Object.keys(ROLE_NAVIGATION).sort(), [...expectedRoles].sort());

for (const role of expectedRoles) {
  assert.ok(ROLE_NAVIGATION[role as keyof typeof ROLE_NAVIGATION].includes('dashboard'), `${role} must have a dashboard`);
}

const mustNotSee: Record<string, string[]> = {
  'Sekretaris Direksi': ['assets', 'maintenance', 'licenses', 'contracts', 'vendors', 'reports'],
  Humas: ['assets', 'maintenance', 'licenses', 'contracts', 'vendors', 'reports'],
  Karyawan: ['assets', 'maintenance', 'licenses', 'contracts', 'vendors', 'reports'],
  Auditor: ['my_assets', 'meeting_rooms'],
};

for (const [role, tabs] of Object.entries(mustNotSee)) {
  for (const tab of tabs) {
    assert.equal(
      isNavTabAllowedForRole(role as keyof typeof ROLE_NAVIGATION, tab as any),
      false,
      `${role} must not see ${tab}`,
    );
  }
}

assert.ok(isNavTabAllowedForRole('IT', 'licenses'));
assert.ok(isNavTabAllowedForRole('GA', 'meeting_rooms'));
assert.ok(isNavTabAllowedForRole('Supply Chain', 'my_assets'));
assert.ok(isNavTabAllowedForRole('PIBC', 'my_assets'));
assert.equal(isNavTabAllowedForRole('Supply Chain', 'assets'), false);
assert.equal(isNavTabAllowedForRole('PIBC', 'maintenance'), false);
assert.ok(isNavTabAllowedForRole('Karyawan', 'tickets'));
assert.ok(isNavTabAllowedForRole('Sekretaris Direksi', 'my_assets'));
assert.ok(isNavTabAllowedForRole('Sekretaris Direksi', 'tickets'));
assert.ok(isNavTabAllowedForRole('Humas', 'loans'));
assert.ok(isNavTabAllowedForRole('Humas', 'tickets'));
assert.ok(isNavTabAllowedForRole('Auditor', 'reports'));
assert.equal(isNavTabAllowedForRole(undefined, 'dashboard'), false);

// PostgreSQL mode must derive navigation from effective permission keys,
// not from a fixed role name or branch/location label.
assert.ok(isNavTabAllowedForRole('Supply Chain', 'dashboard', ['dashboard.read']));
assert.ok(isNavTabAllowedForRole('Supply Chain', 'my_assets', ['assets.read']));
assert.equal(isNavTabAllowedForRole('Supply Chain', 'assets', ['assets.read']), false);
assert.equal(isNavTabAllowedForRole('PIBC', 'maintenance', ['dashboard.read', 'assets.read']), false);
assert.equal(isNavTabAllowedForRole('IT', 'assets', ['assets.update']), false);
assert.equal(isNavTabAllowedForRole('GA', 'assets', ['assets.create']), false);
assert.equal(isNavTabAllowedForRole('Auditor', 'assets', ['assets.read', 'assets.audit.read']), false);
assert.equal(isNavTabAllowedForRole('Custom Role' as any, 'assets', ['assets.catalog.read']), false);
assert.ok(isNavTabAllowedForRole('IT', 'assets', ['assets.catalog.read', 'assets.read']));
assert.ok(isNavTabAllowedForRole('GA', 'assets', ['assets.catalog.read', 'assets.read']));
assert.equal(isNavTabAllowedForRole('IT', 'meeting_rooms', ['room_reservations.create']), false);
assert.equal(isNavTabAllowedForRole('Humas', 'meeting_rooms', ['room_reservations.read']), false);
assert.ok(isNavTabAllowedForRole('Humas', 'meeting_rooms', ['meeting_rooms.read', 'room_reservations.read']));
assert.equal(isNavTabAllowedForRole('GA', 'licenses', ['dashboard.read', 'assets.update']), false);
assert.ok(isNavTabAllowedForRole('Custom Role' as any, 'reports', ['reports.read']));
assert.ok(isNavTabAllowedForRole('Custom Role' as any, 'dashboard', ['*']));

// A custom role without dashboard permission must land on its first readable module.
assert.equal(getDefaultNavTabForRole('Custom Role' as any, ['reports.read']), 'reports');
assert.equal(getDefaultNavTabForRole('Custom Role' as any, ['tickets.read', 'loans.read']), 'tickets');
assert.equal(getDefaultNavTabForRole('Custom Role' as any, ['*']), 'dashboard');
assert.equal(getDefaultNavTabForRole('Custom Role' as any, []), null, 'users with no readable module must not land on an unauthorized dashboard');

// Legacy display labels must not override PostgreSQL effective superadmin capabilities.
assert.equal(isSuperadminNavigationAllowed('Admin GABAH', false, ['dashboard.read']), false);
assert.ok(isSuperadminNavigationAllowed('Admin GABAH', true, ['dashboard.read']));
assert.ok(isSuperadminNavigationAllowed('Custom Role' as any, false, ['*']));
assert.ok(isSuperadminNavigationAllowed('Admin GABAH', false, undefined));


console.log('Role navigation policy: PASS (9 roles, explicit allow/deny checks)');
