import fs from 'node:fs';

const source = fs.readFileSync(new URL('../server/db.ts', import.meta.url), 'utf8');
function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error('Seed section not found: ' + startMarker);
  return source.slice(start, end);
}
function records(block, prefix) {
  const result = [];
  const pattern = new RegExp("\\{\\s*id: '([^']+)'([\\s\\S]*?)\\n\\s*\\},", 'g');
  for (const match of block.matchAll(pattern)) {
    if (!prefix || match[1].startsWith(prefix)) result.push({ id: match[1], body: match[2] });
  }
  return result;
}
function field(body, name) {
  const match = body.match(new RegExp('(?:^|\\n)\\s*' + name + ": '([^']*)'"));
  return match?.[1];
}

const assetRows = records(section('db.assets = [', 'db.maintenances = ['), 'AST-');
const maintenanceRows = records(section('db.maintenances = [', 'db.vendors = ['), 'mnt-');
const vendorRows = records(section('db.vendors = [', 'db.knowledgeArticles = ['), 'VND-');
const assets = new Map(assetRows.map(row => [row.id, row]));
const vendors = new Map(vendorRows.map(row => [row.id, row]));
const checks = [];

for (const schedule of maintenanceRows) {
  const assetId = field(schedule.body, 'asset_id');
  const asset = assets.get(assetId);
  checks.push([schedule.id + ' references an existing asset', Boolean(asset)]);
  if (asset) {
    checks.push([schedule.id + ' asset name matches the asset master', field(schedule.body, 'asset_name') === field(asset.body, 'name')]);
    checks.push([schedule.id + ' asset number matches the asset master', field(schedule.body, 'asset_number') === field(asset.body, 'asset_number')]);
  }
  const vendorId = field(schedule.body, 'vendor_id');
  if (vendorId) {
    const vendor = vendors.get(vendorId);
    checks.push([schedule.id + ' references an existing vendor', Boolean(vendor)]);
    if (vendor) checks.push([schedule.id + ' vendor name matches the vendor master', field(schedule.body, 'vendor_name') === field(vendor.body, 'name')]);
  }
}

let failed = 0;
for (const [name, pass] of checks) {
  console.log((pass ? 'PASS' : 'FAIL') + ' | ' + name);
  if (!pass) failed++;
}
console.log('TOTAL: ' + checks.length + ' | PASS: ' + (checks.length - failed) + ' | FAIL: ' + failed);
process.exit(failed ? 1 : 0);
