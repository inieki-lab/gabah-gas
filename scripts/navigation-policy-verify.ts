import assert from 'node:assert/strict';
import { ROLE_NAVIGATION, isNavTabAllowedForRole } from '../src/navigation/roleNavigation';

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
  Humas: ['my_assets', 'assets', 'maintenance', 'licenses', 'contracts', 'vendors', 'reports'],
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
assert.ok(isNavTabAllowedForRole('Supply Chain', 'assets'));
assert.ok(isNavTabAllowedForRole('PIBC', 'maintenance'));
assert.ok(isNavTabAllowedForRole('Karyawan', 'tickets'));
assert.ok(isNavTabAllowedForRole('Sekretaris Direksi', 'my_assets'));
assert.ok(isNavTabAllowedForRole('Sekretaris Direksi', 'tickets'));
assert.ok(isNavTabAllowedForRole('Humas', 'loans'));
assert.ok(isNavTabAllowedForRole('Humas', 'tickets'));
assert.ok(isNavTabAllowedForRole('Auditor', 'reports'));
assert.equal(isNavTabAllowedForRole(undefined, 'dashboard'), false);

console.log('Role navigation policy: PASS (9 roles, explicit allow/deny checks)');
