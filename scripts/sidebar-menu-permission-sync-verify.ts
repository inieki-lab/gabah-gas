import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  getMissingSidebarMenuPermissions,
  getSidebarMenuPermissionChange,
  isSidebarMenuPermissionEnabled,
} from '../src/navigation/sidebarMenuPermissions';

const catalog = new Set([
  'dashboard.read', 'licenses.read', 'assets.read', 'reports.read', 'loans.read',
  'tickets.read', 'knowledge.read', 'maintenances.read', 'assets.audit.read',
]);
const licenses = {
  tab: 'licenses',
  required: ['licenses.read', 'assets.read'],
  revoke: ['licenses.read'],
};
const reports = {
  tab: 'reports',
  required: ['reports.read'],
  anyOf: ['assets.read', 'loans.read', 'tickets.read', 'maintenances.read'],
  revoke: ['reports.read'],
};
const assets = {
  tab: 'assets',
  required: ['assets.read'],
  alternative: ['assets.catalog.read', 'assets.audit.read'],
  revoke: ['assets.catalog.read', 'assets.audit.read'],
};

// Licenses needs its own grant and asset data access; the admin toggle must
// add both, but disabling Licenses must preserve the shared assets.read grant.
assert.equal(isSidebarMenuPermissionEnabled(licenses, ['licenses.read']), false);
const enableLicenses = getSidebarMenuPermissionChange(licenses, true, catalog, []);
assert.deepEqual(enableLicenses.missing, []);
assert.deepEqual(enableLicenses.add, ['licenses.read', 'assets.read']);
const disableLicenses = getSidebarMenuPermissionChange(licenses, false, catalog, ['licenses.read', 'assets.read']);
assert.deepEqual(disableLicenses.remove, ['licenses.read']);
assert.equal(isSidebarMenuPermissionEnabled(licenses, ['assets.read']), false);

// Reports needs at least one readable source collection. Enabling it adds one
// available source grant if the role has none; disabling it removes only the
// reports grant and preserves the shared source permission.
assert.equal(isSidebarMenuPermissionEnabled(reports, ['reports.read']), false);
const enableReports = getSidebarMenuPermissionChange(reports, true, catalog, ['reports.read']);
assert.deepEqual(enableReports.add, ['assets.read']);
assert.equal(isSidebarMenuPermissionEnabled(reports, ['reports.read', 'assets.read']), true);
const disableReports = getSidebarMenuPermissionChange(reports, false, catalog, ['reports.read', 'assets.read']);
assert.deepEqual(disableReports.remove, ['reports.read']);

// Assets requires assets.read plus one catalogue/audit grant. Removing its
// menu must not remove assets.read, which is also used by My Assets.
const enableAssets = getSidebarMenuPermissionChange(assets, true, catalog, ['assets.read']);
assert.deepEqual(enableAssets.add, ['assets.audit.read']);
const disableAssets = getSidebarMenuPermissionChange(assets, false, catalog, ['assets.read', 'assets.audit.read']);
assert.deepEqual(disableAssets.remove, ['assets.catalog.read', 'assets.audit.read']);
assert.equal(isSidebarMenuPermissionEnabled(assets, ['assets.read']), false);

// A missing dependency in the permission catalogue must fail with a clear
// explanation rather than showing an enabled toggle that cannot expose a menu.
const reportsWithoutSources = getMissingSidebarMenuPermissions(
  reports,
  new Set(['reports.read']),
);
assert.equal(reportsWithoutSources.length, 1);
assert.match(reportsWithoutSources[0], /assets\.read.*loans\.read/);

const modal = fs.readFileSync('src/components/modals/AdministrationModal.tsx', 'utf8');
assert.match(modal, /tab: 'licenses'[\s\S]{0,180}required: \['licenses\.read', 'assets\.read'\]/);
assert.match(modal, /tab: 'reports'[\s\S]{0,220}anyOf: \['assets\.read', 'loans\.read', 'tickets\.read', 'maintenances\.read'\]/);
assert.match(modal, /getSidebarMenuPermissionChange\(item, enabled, activePermissionKeys, rbacSelectedPermissionKeys\)/);
assert.match(modal, /current\.filter\(key => !change\.remove\.includes\(key\)\)/);

console.log('Sidebar menu permission dependencies: PASS (composite grants and shared permissions are preserved).');


// The five baseline tabs are not exempt from backend permission checks.
// Custom roles must be able to turn them on/off through the same role editor.
const dashboard = { tab: 'dashboard', required: ['dashboard.read'] };
const enableDashboard = getSidebarMenuPermissionChange(dashboard, true, catalog, []);
assert.deepEqual(enableDashboard.add, ['dashboard.read']);
assert.equal(isSidebarMenuPermissionEnabled(dashboard, []), false);
assert.equal(isSidebarMenuPermissionEnabled(dashboard, ['dashboard.read']), true);
const disableDashboard = getSidebarMenuPermissionChange(dashboard, false, catalog, ['dashboard.read']);
assert.deepEqual(disableDashboard.remove, ['dashboard.read']);

const myAssets = { tab: 'my_assets', required: ['assets.read'] };
assert.deepEqual(getSidebarMenuPermissionChange(myAssets, true, catalog, []).add, ['assets.read']);
assert.deepEqual(getSidebarMenuPermissionChange(myAssets, false, catalog, ['assets.read']).remove, ['assets.read']);

const loans = { tab: 'loans', required: ['loans.read'] };
assert.deepEqual(getSidebarMenuPermissionChange(loans, true, catalog, []).add, ['loans.read']);

const tickets = { tab: 'tickets', required: ['tickets.read'] };
assert.deepEqual(getSidebarMenuPermissionChange(tickets, true, catalog, []).add, ['tickets.read']);

const knowledge = { tab: 'knowledge', required: ['knowledge.read'] };
assert.deepEqual(getSidebarMenuPermissionChange(knowledge, true, catalog, []).add, ['knowledge.read']);
assert.doesNotMatch(modal, /coreSidebarTabs/,
  'the role editor must not label baseline tabs always-on while backend navigation still checks their grants');
assert.match(modal, /disabled=\{rbacSaving \|\| missing\.length > 0\}/,
  'baseline menu toggles must remain editable when their permission catalogue entries exist');
