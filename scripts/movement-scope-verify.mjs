import fs from 'node:fs';

const source = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const start = source.indexOf("app.get('/api/movements'");
const end = source.indexOf("// Loans", start);
if (start < 0 || end < 0) throw new Error('GET /api/movements route not found');
const route = source.slice(start, end);
const checks = [
  ['Movement history uses the canonical dynamic asset-scope resolver', /GabahDomainService\.getScopedAssets\(actor\)/.test(route)],
  ['Employee movement scope keeps assigned assets and independently granted dynamic scopes', /isEmployeeBaseline[\s\S]*scopedAssets\.filter\(asset =>[\s\S]*asset\.assigned_to\?\.id === actor\.id \|\| assetVisibleUnderDynamicScopes\(actor, asset\)/.test(route)],
  ['Unassigned loan-pool catalogue visibility is excluded from employee movement history', /const movementAssets = isEmployeeBaseline[\s\S]*\? scopedAssets\.filter\([\s\S]*asset\.assigned_to\?\.id === actor\.id \|\| assetVisibleUnderDynamicScopes\(actor, asset\)[\s\S]*: scopedAssets/.test(route)],
  ['Single-asset movement lookup checks visibility before returning history', /if \(assetId\)[\s\S]*!visibleAssetIds\.has\(String\(assetId\)\)/.test(route)],
  ['Collection movement lookup filters by visible asset IDs', /db\.movements\.filter\(m => visibleAssetIds\.has\(m\.asset_id\)\)/.test(route)],
];
let failed = 0;
for (const [name, pass] of checks) {
  console.log((pass ? 'PASS' : 'FAIL') + ' | ' + name);
  if (!pass) failed += 1;
}
console.log('TOTAL: ' + checks.length + ' | PASS: ' + (checks.length - failed) + ' | FAIL: ' + failed);
process.exit(failed === 0 ? 0 : 1);
