import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/components/views/AssetsView.tsx', import.meta.url), 'utf8');

const checks = [
  [
    'Owner filter compares the persisted owner_division field',
    /String\(asset\.owner_division \|\| ''\)\.trim\(\)\.toUpperCase\(\) !== selectedDivision/.test(source),
  ],
  [
    'Owner filter never falls back to the asset-number prefix',
    !/asset\.owner_division \|\| \(asset\.asset_number \? asset\.asset_number\.split\('-'\)\[0\]/.test(source),
  ],
  [
    'Owner tabs are derived from owner values in the visible asset collection',
    /const ownerDomainOptions = useMemo\(\(\) => Array\.from\(new Set\([\s\S]*safeAssets[\s\S]*asset\.owner_division/.test(source)
      && /\.\.\.ownerDomainOptions\.map\(code =>/.test(source),
  ],
  [
    'Legacy SC/PIBC values are visibly marked for review, not treated as office locations',
    /\['SC', 'PIBC'\]\.includes\(code\)[\s\S]*legacy — review/.test(source)
      && /Owner aset:/.test(source),
  ],
  [
    'CSV export uses the same filtered owner/status/category/search result set as the visible table',
    /onClick=\{\(\) => exportAssetsToCsv\(filteredAssets\)\}/.test(source)
      && !/exportAssetsToCsv\(safeAssets\)/.test(source),
  ],
  [
    'Asset detail view receives the same filtered collection as the table',
    /assets=\{filteredAssets\}/.test(source),
  ],
  [
    'Owner filter is applied before rendering and is not inferred from physical location or asset-number prefix',
    /String\(asset\.owner_division \|\| ''\)\.trim\(\)\.toUpperCase\(\) !== selectedDivision/.test(source)
      && !/asset\.location.*selectedDivision/.test(source)
      && !/asset\.asset_number.*selectedDivision/.test(source),
  ],
];

let failed = 0;
for (const [name, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'} | ${name}`);
  if (!passed) failed += 1;
}
console.log(`TOTAL: ${checks.length} | PASS: ${checks.length - failed} | FAIL: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
