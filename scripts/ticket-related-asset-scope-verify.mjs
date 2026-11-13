import fs from 'node:fs';

const serviceSource = fs.readFileSync(new URL('../server/services.ts', import.meta.url), 'utf8');
const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const start = serviceSource.indexOf('static createTicket(');
const end = serviceSource.indexOf('\n  /**', start + 1);
if (start < 0 || end < 0) throw new Error('createTicket domain method not found');
const method = serviceSource.slice(start, end);
const routeStart = serverSource.indexOf("app.post('/api/tickets'");
const routeEnd = serverSource.indexOf('// SECURITY (CR-06)', routeStart);
if (routeStart < 0 || routeEnd < 0) throw new Error('POST /api/tickets route not found');
const route = serverSource.slice(routeStart, routeEnd);
const checks = [
  ['Optional asset relationship is normalized before use', /relatedAssetId = String\(payload\.related_asset_id\)\.trim\(\)/.test(method)],
  ['Blank supplied asset IDs are rejected', /if \(!relatedAssetId\)[\s\S]*statusCode: 400/.test(method)],
  ['Unknown or inaccessible assets are rejected', /const ast = db\.assets\.find[\s\S]*if \(!ast \|\| !visibleAsset\)[\s\S]*statusCode: 404/.test(method)],
  ['Asset linkage uses canonical per-user scoped asset visibility', /this\.getScopedAssets\(actor\)\.some\(asset => String\(asset\.id\) === relatedAssetId\)/.test(method)],
  ['Stored asset ID is the validated canonical ID', /related_asset_id: relatedAssetId/.test(method)],
  ['Copied metadata comes from the validated asset record', /relatedAssetName = ast\.name;[\s\S]*relatedAssetNumber = ast\.asset_number/.test(method)],
  ['HTTP route preserves domain 404/400 validation status codes', /res\.status\(typeof err\?\.statusCode === 'number' \? err\.statusCode : 400\)/.test(route)],
];
let failed = 0;
for (const [name, pass] of checks) {
  console.log((pass ? 'PASS' : 'FAIL') + ' | ' + name);
  if (!pass) failed += 1;
}
console.log('TOTAL: ' + checks.length + ' | PASS: ' + (checks.length - failed) + ' | FAIL: ' + failed);
process.exit(failed === 0 ? 0 : 1);
