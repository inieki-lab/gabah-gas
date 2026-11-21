import fs from 'node:fs';
import assert from 'node:assert/strict';

const server = fs.readFileSync('server.ts', 'utf8');
const patchStart = server.indexOf("app.patch('/api/assets/:id'");
const patchEnd = server.indexOf("app.post('/api/assets/:id/assign'", patchStart);
assert.ok(patchStart >= 0 && patchEnd > patchStart, 'asset PATCH route must exist');
const patch = server.slice(patchStart, patchEnd);
assert.ok(patch.includes("req.body.status !== undefined && String(req.body.status) !== asset.status"));
assert.ok(patch.includes("res.status(409)"), 'generic PATCH status changes must conflict');
assert.ok(patch.includes('Gunakan menu Lifecycle atau alur peminjaman/pengembalian'));
assert.ok(!patch.includes("'is_loanable', 'status', 'corporate_asset_number'"), 'status must not be in generic PATCH allowlist');

const bulkStart = server.indexOf("app.post('/api/assets/bulk-import'");
const bulkEnd = server.indexOf("app.get('/api/assets/:id'", bulkStart);
assert.ok(bulkStart >= 0 && bulkEnd > bulkStart, 'bulk-import route must exist');
const bulk = server.slice(bulkStart, bulkEnd);
assert.ok(bulk.includes('requestedStatus !== undefined && requestedStatus !== existing.status'));
assert.ok(bulk.includes('tidak dapat mengubah status melalui impor massal'));
assert.ok(!bulk.includes("'notes', 'is_loanable', 'status', 'corporate_asset_number'"), 'bulk update allowlist must exclude status');

const lifecycleStart = server.indexOf("app.post('/api/assets/:id/lifecycle'");
assert.ok(lifecycleStart >= 0 && server.slice(lifecycleStart, lifecycleStart + 400).includes("'assets.lifecycle'"));

console.log('PASS: generic asset PATCH and bulk import cannot bypass lifecycle/loan status workflows.');
