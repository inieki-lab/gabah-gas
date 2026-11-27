import fs from 'node:fs';
import assert from 'node:assert/strict';
import { CORE_NAVIGATION_TABS, getDefaultNavTabForRole, isNavTabAllowedForRole, isSuperadminNavigationAllowed, isStaffNavigationPersona } from '../src/navigation/roleNavigation';

// The application has no fixed role-to-menu matrix. Any Dynamic RBAC role
// receives exactly the pages authorized by its effective permission keys.
const customRoles = ['IT', 'GA', 'Auditor', 'Humas', 'Sekretariat Direksi', 'ME Admin', 'RPC Operator', 'PIBC Staff', 'Custom Role'];
for (const role of customRoles) {
  assert.ok(isNavTabAllowedForRole(role, 'dashboard', ['dashboard.read']), `${role} receives dashboard only when granted`);
  assert.equal(isNavTabAllowedForRole(role, 'dashboard', []), false, `${role} cannot bypass an empty permission set`);
  assert.equal(isNavTabAllowedForRole(role, 'assets', ['assets.update']), false, `${role} cannot see assets from mutation-only permission`);
}
assert.equal(isNavTabAllowedForRole(undefined, 'dashboard'), false);
assert.ok(isNavTabAllowedForRole('Karyawan', 'dashboard'));
assert.ok(isNavTabAllowedForRole('Karyawan', 'my_assets'));
assert.equal(isNavTabAllowedForRole('Karyawan', 'assets'), false);
assert.ok(isNavTabAllowedForRole('Admin GABAH', 'reports'));
assert.ok(isNavTabAllowedForRole('Admin GABAH', 'assets'));
assert.equal(isNavTabAllowedForRole('Karyawan', 'assets', ['assets.update']), false);
assert.equal(isNavTabAllowedForRole('Custom Role', 'licenses', ['licenses.read']), false,
  'license workspace must not appear when its underlying asset collection is not readable');
assert.equal(isNavTabAllowedForRole('Custom Role', 'licenses', ['assets.read']), false,
  'license workspace requires its own module permission as well as asset data access');
assert.equal(isNavTabAllowedForRole('Custom Role', 'licenses', ['licenses.read', 'assets.read']), true,
  'license workspace appears only when both license capability and backing asset data are readable');
assert.equal(isNavTabAllowedForRole('Custom Role', 'reports', ['reports.read']), false,
  'reports workspace must not appear without permission to read any underlying report data');
assert.equal(isNavTabAllowedForRole('Custom Role', 'reports', ['reports.read', 'tickets.read']), true,
  'reports workspace may show a partial report when at least one source collection is readable');
assert.equal(isNavTabAllowedForRole('Custom Role', 'reports', ['tickets.read']), false,
  'source data permission alone does not grant the reports workspace');

// A page is visible only when its read contract is satisfied.
assert.ok(isNavTabAllowedForRole('Any Dynamic Role', 'meeting_rooms', ['meeting_rooms.read', 'room_reservations.read']));
assert.equal(isNavTabAllowedForRole('Any Dynamic Role', 'meeting_rooms', ['room_reservations.read']), false);
assert.ok(isNavTabAllowedForRole('Any Dynamic Role', 'assets', ['assets.read', 'assets.catalog.read']));
assert.equal(isNavTabAllowedForRole('Any Dynamic Role', 'assets', ['assets.read']), false);
assert.equal(isNavTabAllowedForRole('Any Dynamic Role', 'assets', ['assets.catalog.read']), false);

// Landing page selection follows effective permissions and active module state.
assert.equal(getDefaultNavTabForRole('Custom Role', ['reports.read', 'assets.read']), 'my_assets',
  'default landing prefers the earlier employee workspace when reports and asset data are both readable');
assert.equal(getDefaultNavTabForRole('Custom Role', ['tickets.read', 'loans.read']), 'tickets');
assert.equal(getDefaultNavTabForRole('Custom Role', ['*']), 'dashboard');
assert.equal(getDefaultNavTabForRole('Custom Role', []), null);
assert.equal(getDefaultNavTabForRole('Custom Role', ['dashboard.read', 'tickets.read'], ['tickets']), 'tickets');
assert.equal(getDefaultNavTabForRole('Custom Role', ['dashboard.read', 'tickets.read'], ['dashboard']), 'dashboard');
assert.equal(getDefaultNavTabForRole('Custom Role', ['dashboard.read', 'tickets.read'], []), null);
assert.equal(getDefaultNavTabForRole('Karyawan', undefined, ['tickets']), 'tickets');

assert.deepEqual([...CORE_NAVIGATION_TABS], ['dashboard', 'my_assets', 'loans', 'tickets', 'knowledge']);
for (const tab of CORE_NAVIGATION_TABS) {
  assert.equal(isNavTabAllowedForRole('Karyawan', tab, []), false, `Karyawan must not bypass empty PostgreSQL grants for ${tab}`);
}
assert.equal(isSuperadminNavigationAllowed('Admin GABAH', false, ['dashboard.read']), false);
assert.ok(isSuperadminNavigationAllowed('Admin GABAH', true, ['dashboard.read']));
assert.ok(isSuperadminNavigationAllowed('Custom Role', false, ['*']));
assert.ok(isSuperadminNavigationAllowed('Admin GABAH', false, undefined));


assert.equal(isStaffNavigationPersona('Karyawan', ['dashboard.read', 'tickets.create']), true,
  'ordinary employees and request-only users keep the staff persona');
assert.equal(isStaffNavigationPersona('Karyawan', ['dashboard.read', 'tickets.read', 'tickets.update']), false,
  'IT/GA/ME operators with operational ticket permissions are not classified as staff-only');
assert.equal(isStaffNavigationPersona('Karyawan', ['dashboard.read', 'assets.create']), false,
  'asset operators with a canonical Karyawan profile retain operational labels and badges');
assert.equal(isStaffNavigationPersona('Karyawan', ['dashboard.read', 'room_reservations.documentation.read']), true,
  'Humas documentation-only capability remains a staff persona');
assert.equal(isStaffNavigationPersona('Karyawan', ['*']), false,
  'Superadmin wildcard permissions are never classified as staff-only');
for (const legacyLabel of ['Humas', 'Sekretaris Direksi', 'Supply Chain', 'PIBC', 'IT', 'GA', 'Auditor']) {
  assert.equal(isStaffNavigationPersona(legacyLabel as any, ['dashboard.read']), false,
    `${legacyLabel} is not a primary employee profile`);
}
assert.equal(isStaffNavigationPersona('Karyawan', ['dashboard.read', 'room_reservations.override_priority']), true,
  'a Karyawan with a special non-operational capability remains an employee persona');

const sidebar = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');
assert.match(sidebar, /const isHumas = !isSuperAdmin && hasPermission/,
  'Superadmin wildcard must not make the sidebar identify Superadmin as Humas');
assert.match(sidebar, /const isSekdir = !isSuperAdmin && hasPermission/,
  'Superadmin wildcard must not make the sidebar identify Superadmin as Sekdir');

console.log('Dynamic navigation policy: PASS (no fixed role catalogue; permissions and landing-page checks)');


const app = fs.readFileSync('src/App.tsx', 'utf8');
const expectedRenderedTabs = [
  'dashboard', 'my_assets', 'meeting_rooms', 'assets', 'maintenance', 'loans',
  'tickets', 'licenses', 'contracts', 'vendors', 'knowledge', 'reports',
];
for (const tab of expectedRenderedTabs) {
  assert.ok(sidebar.includes("id: '" + tab + "'"), 'Sidebar must expose the ' + tab + ' navigation item');
  assert.ok(app.includes("activeTab === '" + tab + "'"), 'App must render a page for the ' + tab + ' navigation item');
}
assert.ok(sidebar.includes('onClick={() => onTabChange(item.id)}'),
  'clicking a visible sidebar item must invoke the navigation callback');
assert.ok(app.includes('const navigateToTab = (tab: NavTab) => {'),
  'App must provide a single navigation gate');
assert.ok(app.includes('!isNavTabAllowedForRole(currentUser.role, tab, currentUser.permission_keys) || !isModuleAvailable(tab)'),
  'navigation must enforce both effective permissions and global module lifecycle');
assert.ok(app.includes('setCurrentTab(tab)'),
  'an authorized, active module selection must update the rendered tab');
console.log('Menu-to-view contract: PASS (all 12 sidebar tabs have an App render branch and a guarded click path).');
