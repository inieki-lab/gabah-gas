import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/components/views/DashboardView.tsx', import.meta.url), 'utf8');

const checks = [
  [
    'Division dashboard label follows owner domains in the scoped asset collection',
    /visibleOwnerDomains = Array\.from\(new Set\([\s\S]*dashboardAssets\.map\(asset => String\(asset\.owner_division/.test(source)
      && /visibleOwnerDomains\.join\(' \/ '\)/.test(source),
  ],
  [
    'Dashboard owner counts are computed dynamically instead of hard-coded IT/GA/SC/PIBC buckets',
    /const ownerAssetCounts = dashboardAssets\.reduce/.test(source)
      && /Object\.entries\(ownerAssetCounts\)/.test(source)
      && !/const itAssets = dashboardAssets\.filter|const gaAssets = dashboardAssets\.filter|const scAssets = dashboardAssets\.filter|const pibcAssets = dashboardAssets\.filter/.test(source),
  ],
  [
    'Legacy SC/PIBC owners and records without owner are explicitly identified',
    /legacy owner — review/.test(source) && /unclassifiedOwnerAssets/.test(source),
  ],
  [
    'Global dashboard summary uses the dynamic owner summary',
    /ownerAssetSummary \|\| 'Belum ada owner terklasifikasi'/.test(source),
  ],
];

let failed = 0;
for (const [name, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'} | ${name}`);
  if (!passed) failed += 1;
}
console.log(`TOTAL: ${checks.length} | PASS: ${checks.length - failed} | FAIL: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
