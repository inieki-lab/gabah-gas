import assert from 'node:assert/strict';
import { db, seedInitialData } from '../server/db.ts';

seedInitialData();
const assets = new Map(db.assets.map(asset => [asset.id, asset]));
const vendors = new Map(db.vendors.map(vendor => [vendor.id, vendor]));
let checks = 0;

for (const schedule of db.maintenances) {
  const asset = assets.get(schedule.asset_id);
  assert.ok(asset, `${schedule.id} must reference an existing asset`);
  checks++;
  assert.equal(schedule.asset_name, asset.name, `${schedule.id} asset name must match master`);
  checks++;
  assert.equal(schedule.asset_number, asset.asset_number, `${schedule.id} asset number must match master`);
  checks++;
  assert.equal(schedule.owner_division, asset.owner_division, `${schedule.id} owner must match asset master`);
  checks++;
  if (schedule.vendor_id) {
    const vendor = vendors.get(schedule.vendor_id);
    assert.ok(vendor, `${schedule.id} must reference an existing vendor`);
    checks++;
    assert.equal(schedule.vendor_name, vendor.name, `${schedule.id} vendor name must match master`);
    checks++;
  }
}
console.log(`PASS | ${checks} maintenance seed relationship checks`);
