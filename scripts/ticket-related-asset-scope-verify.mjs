import fs from 'node:fs';

const source = fs.readFileSync(new URL('../server/services.ts', import.meta.url), 'utf8');
const start = source.indexOf('static createTicket(');
const end = source.indexOf('\n  /**', start + 1);
if (start < 0 || end < 0) throw new Error('createTicket domain method not found');
const method = source.slice(start, end);
const checks = [
  ['Optional asset relationship is normalized before use', /relatedAssetId = String\(payload\.related_asset_id\)\.trim\(\)/.test(method)],
  ['Blank supplied asset IDs are rejected', /if \(!relatedAssetId\)[\s\S]*statusCode: 400/.test(method)],
  ['Unknown asset IDs are rejected instead of creating dangling references', /const ast = db\.assets\.find[\s\S]*if \(!ast \|\| !visibleAsset\)[\s\S]*statusCode: 404/.test(method)],
  ['Asset linkage uses the canonical per-user scoped asset resolver', /this\.getScopedAssets\(actor\)\.some\(asset => String\(asset\.id\) === relatedAssetId\)/.test(method)],
  ['Stored asset ID is the validated canonical ID', /related_asset_id: relatedAssetId/.test(method)],
  ['Copied asset metadata comes only from the validated asset record', /relatedAssetName = ast\.name;[\s\S]*relatedAssetNumber = ast\.asset_number/.test(method)],
];
let failed = 0;
for (const [name, pass] of checks) {
  console.log((pass ? 'PASS' : 'FAIL') + ' | ' + name);
  if (!pass) failed += 1;
}
console.log('TOTAL: ' + checks.length + ' | PASS: ' + (checks.length - failed) + ' | FAIL: ' + failed);
process.exit(failed === 0 ? 0 : 1);
