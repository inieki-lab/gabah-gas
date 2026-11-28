import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/components/views/DashboardView.tsx', import.meta.url), 'utf8');
const header = fs.readFileSync(new URL('../src/components/HeaderNavbar.tsx', import.meta.url), 'utf8');

const checks = [
  ['Division dashboard label follows visible owner domains', source.includes('visibleOwnerDomains = Array.from(new Set(') && source.includes('visibleOwnerDomains.join(\' / \')')],
  ['Dashboard owner counts are dynamic, not fixed IT/GA/SC/PIBC buckets', source.includes('const ownerAssetCounts = dashboardAssets.reduce') && source.includes('Object.entries(ownerAssetCounts)') && !['const itAssets = dashboardAssets.filter', 'const gaAssets = dashboardAssets.filter', 'const scAssets = dashboardAssets.filter', 'const pibcAssets = dashboardAssets.filter'].some(value => source.includes(value))],
  ['Legacy SC/PIBC owners and unclassified records are identified', source.includes('legacy owner — review') && source.includes('unclassifiedOwnerAssets')],
  ['Global dashboard summary uses dynamic owner summary', source.includes("ownerAssetSummary || 'Belum ada owner terklasifikasi'")],
  ['Custom operational roles receive the operational dashboard persona', source.includes('OPERATIONAL_NAVIGATION_PERMISSIONS') && source.includes('hasOperationalManagementAccess = OPERATIONAL_NAVIGATION_PERMISSIONS.some') && source.includes('const isDivisionDashboard = !isGlobalDashboard && hasOperationalManagementAccess')],
  ['Custom non-operational job roles receive the self-service dashboard without legacy role-name coupling', source.includes('const isEmployee = !isAuditor && !hasOperationalManagementAccess') && source.includes('const employeeDescription =') && source.includes('const roleDescription = isAuditor') && !source.includes('roleDescriptions') && !source.includes('const isStaff = currentUser?.role')],
  ['Loan, ticket, and asset quick actions require separate effective permissions', source.includes("canCreateLoan = hasEffectivePermission('loans.create'") && source.includes("canCreateTicket = hasEffectivePermission('tickets.create'") && source.includes("canCreateAsset = hasEffectivePermission('assets.create'") && source.includes('{canCreateLoan && (') && source.includes('{canCreateTicket ? (') && source.includes('{canCreateAsset && (')],
  ['Auditor read-only notice is shown only to Auditor', source.includes(') : isAuditor ? (')],
  ['Dashboard Superadmin status uses stable metadata and limits legacy Admin GABAH fallback to file-store', source.includes('const hasPermissionMetadata = Array.isArray(currentUser.permission_keys)') && source.includes("!hasPermissionMetadata && currentUser.role === 'Admin GABAH'") && source.includes('const isGlobalDashboard = isSuperAdmin || isAuditor')],
  ['Humas and Sekdir dashboard indicators use effective reservation capabilities without overriding Superadmin persona', source.includes("hasEffectivePermission('room_reservations.documentation.read', ['Humas'])") && source.includes("hasEffectivePermission('room_reservations.override_priority', ['Sekretaris Direksi'])") && source.includes('const isHumas = !isSuperAdmin && hasEffectivePermission') && source.includes('const isSekdir = !isSuperAdmin && hasEffectivePermission')],
  ['Dashboard ticket heading does not infer IT queue access from primary role name', !source.includes("currentUser.role === 'IT' ? 'Antrean Helpdesk TI'")],
  ['Header reservation badges recognize secondary IT/GA/Humas capabilities in file-store mode', header.includes('roles.some(role => currentUser.role === role || GabahService.hasLegacyCapability(currentUser, role))')],
];

let failed = 0;
for (const [name, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'} | ${name}`);
  if (!passed) failed += 1;
}
console.log(`TOTAL: ${checks.length} | PASS: ${checks.length - failed} | FAIL: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
