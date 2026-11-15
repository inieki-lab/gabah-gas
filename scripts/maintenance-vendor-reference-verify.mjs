import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('server.ts', 'utf8');
const createStart = source.indexOf("app.post('/api/maintenances'");
const updateStart = source.indexOf("app.patch('/api/maintenances/:id'");
const vendorStart = source.indexOf("// Vendor Directory (server-authoritative)");
assert.ok(createStart >= 0 && updateStart > createStart && vendorStart > updateStart);
const helperStart = source.indexOf('const resolveMaintenanceVendor =');
const create = source.slice(createStart, updateStart);
const update = source.slice(updateStart, vendorStart);
assert.ok(helperStart >= 0 && helperStart < createStart, 'resolver must be defined before maintenance routes');

const createScope = create.indexOf("canMutateAssetOwner(actor, asset.owner_division, 'maintenances.create')");
const createResolve = create.indexOf('resolveMaintenanceVendor(req.body?.vendor_id, req.body?.vendor_name)');
assert.ok(createScope >= 0 && createResolve > createScope, 'create authorization must precede vendor lookup');
assert.match(create, /vendor_id: vendorResolution\.vendor\?\.id/);
assert.match(create, /vendor_name: vendorResolution\.vendor\?\.name/);

const updateScope = update.indexOf("canMutateAssetOwner(actor, schedule.owner_division, 'maintenances.update')");
const updateResolve = update.indexOf('resolveMaintenanceVendor(req.body?.vendor_id, req.body?.vendor_name)');
assert.ok(updateScope >= 0 && updateResolve > updateScope, 'update authorization must precede vendor lookup');
assert.match(update, /'estimated_cost', 'actual_cost', 'notes', 'checklist'/);
assert.doesNotMatch(update, /'vendor_id', 'vendor_name'/);
assert.match(update, /schedule\.vendor_id = vendorResolution\.vendor\?\.id/);
assert.match(update, /schedule\.vendor_name = vendorResolution\.vendor\?\.name/);
assert.match(source, /if \(!vendor \|\| \(requestedVendorName/);
assert.match(source, /typeof value === 'string'/);
console.log('Maintenance vendor reference integrity: 11 checks passed');
