import fs from 'node:fs';
import assert from 'node:assert/strict';
import { CORE_NAVIGATION_TABS, OPERATIONAL_NAVIGATION_PERMISSIONS, getDefaultNavTabForRole, isNavTabAllowedForRole, isSuperadminNavigationAllowed, isStaffNavigationPersona } from '../src/navigation/roleNavigation';

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
assert.equal(isStaffNavigationPersona('Karyawan', ['dashboard.read', 'loans.return']), true,
  'the baseline own-loan return capability must not change a Karyawan into an operational persona');
assert.equal(isStaffNavigationPersona('Karyawan', ['dashboard.read', 'loans.approve']), false,
  'loan approval remains an operational custodian capability');
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

assert.match(sidebar, /const isAuditor = !isSuperAdmin && currentUserRoleKeys\?\.includes\('auditor'\) === true/,
  'Auditor must be identified from the effective secondary role, not primary Karyawan profile');
assert.match(sidebar, /const isStaff = !isAuditor &&/,
  'Auditor must not be classified as an ordinary employee staff persona');
assert.match(sidebar, /isAuditor \? 'Audit & Pemantauan'/,
  'Auditor must receive an audit-specific navigation section');
assert.match(sidebar, /isAuditor \? 'Dashboard Auditor'/,
  'Auditor must receive an audit-specific dashboard label');
assert.match(sidebar, /pendingLoansCount > 0 && !isStaff && !isAuditor/,
  'Auditor must not receive operational pending-loan queue badges');
assert.match(sidebar, /openTicketsCount > 0 && !isStaff && !isAuditor/,
  'Auditor must not receive operational open-ticket queue badges');


assert.ok(OPERATIONAL_NAVIGATION_PERMISSIONS.includes('assets.lifecycle'),
  'asset lifecycle operators must use the operational persona');
assert.ok(OPERATIONAL_NAVIGATION_PERMISSIONS.includes('room_reservations.checkin'),
  'room check-in operators must use the operational persona');
assert.ok(OPERATIONAL_NAVIGATION_PERMISSIONS.includes('room_reservations.checkout'),
  'room check-out operators must use the operational persona');
assert.equal(OPERATIONAL_NAVIGATION_PERMISSIONS.includes('loans.return'), false,
  'employee self-service return must not make the user an operational persona');

const dashboard = fs.readFileSync('src/components/views/DashboardView.tsx', 'utf8');
assert.match(dashboard, /import \{ OPERATIONAL_NAVIGATION_PERMISSIONS \} from '\.\.\/\.\.\/navigation\/roleNavigation'/,
  'Dashboard must use the same capability set as Sidebar');
assert.match(dashboard, /OPERATIONAL_NAVIGATION_PERMISSIONS\.some\(/,
  'Dashboard persona must derive from the shared capability set');
assert.doesNotMatch(dashboard, /const operationalManagementPermissions\s*=\s*\[/,
  'Dashboard must not maintain a second drifting operational permission list');

assert.equal(isStaffNavigationPersona('Karyawan', ['dashboard.read', 'room_reservations.checkin']), false,
  'a check-in operator must not be presented as a staff-only persona');
assert.equal(isStaffNavigationPersona('Karyawan', ['dashboard.read', 'room_reservations.checkout']), false,
  'a check-out operator must not be presented as a staff-only persona');

console.log('Dynamic navigation policy: PASS (no fixed role catalogue; permissions and landing-page checks)');
