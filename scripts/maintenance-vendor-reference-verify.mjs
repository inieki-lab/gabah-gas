import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('server.ts', 'utf8');
const createStart = source.indexOf("app.post('/api/maintenances'");
const updateStart = source.indexOf("app.patch('/api/maintenances/:id'");
const vendorStart = source.indexOf("// Vendor Directory (server-authoritative)");
assert.ok(createStart >= 0 && updateStart > createStart && vendorStart > updateStart);
const create = source.slice(createStart, updateStart);
const update = source.slice(updateStart, vendorStart);
assert.match(create, /db\.vendors\.find\(v => v\.id === requestedVendorId\)/);
assert.match(create, /ID dan nama vendor tidak cocok/);
assert.match(create, /vendor_id: linkedVendor\?\.id/);
assert.match(create, /vendor_name: linkedVendor\?\.name/);
assert.match(update, /const hasVendorInput = req\.body\.vendor_id !== undefined \|\| req\.body\.vendor_name !== undefined/);
assert.match(update, /schedule\.vendor_id = linkedVendor\.id/);
assert.match(update, /schedule\.vendor_name = linkedVendor\.name/);
assert.doesNotMatch(update, /'vendor_id', 'vendor_name'/);
console.log('Maintenance vendor reference integrity: 8 checks passed');
