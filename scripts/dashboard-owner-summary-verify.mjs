import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/components/views/DashboardView.tsx', import.meta.url), 'utf8');

const checks = [
  ['Division dashboard label follows visible owner domains', source.includes('visibleOwnerDomains = Array.from(new Set(') && source.includes('visibleOwnerDomains.join(\' / \')')],
  ['Dashboard owner counts are dynamic, not fixed IT/GA/SC/PIBC buckets', source.includes('const ownerAssetCounts = dashboardAssets.reduce') && source.includes('Object.entries(ownerAssetCounts)') && !['const itAssets = dashboardAssets.filter', 'const gaAssets = dashboardAssets.filter', 'const scAssets = dashboardAssets.filter', 'const pibcAssets = dashboardAssets.filter'].some(value => source.includes(value))],
  ['Legacy SC/PIBC owners and unclassified records are identified', source.includes('legacy owner — review') && source.includes('unclassifiedOwnerAssets')],
  ['Global dashboard summary uses dynamic owner summary', source.includes("ownerAssetSummary || 'Belum ada owner terklasifikasi'")],
  ['Custom operational roles receive the operational dashboard persona', source.includes('operationalManagementPermissions = [') && source.includes('hasOperationalManagementAccess = operationalManagementPermissions.some') && source.includes('isEmployee = !isAuditor && isStaff && !hasOperationalManagementAccess')],
  ['Loan, ticket, and asset quick actions require separate effective permissions', source.includes("canCreateLoan = hasEffectivePermission('loans.create'") && source.includes("canCreateTicket = hasEffectivePermission('tickets.create'") && source.includes("canCreateAsset = hasEffectivePermission('assets.create'") && source.includes('{canCreateLoan && (') && source.includes('{canCreateTicket ? (') && source.includes('{canCreateAsset && (')],
  ['Auditor read-only notice is shown only to Auditor', source.includes(') : isAuditor ? (')],
];

let failed = 0;
for (const [name, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'} | ${name}`);
  if (!passed) failed += 1;
}
console.log(`TOTAL: ${checks.length} | PASS: ${checks.length - failed} | FAIL: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
