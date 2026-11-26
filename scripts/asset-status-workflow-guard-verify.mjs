import fs from 'node:fs';
import assert from 'node:assert/strict';

const server = fs.readFileSync('server.ts', 'utf8');
const services = fs.readFileSync('server/services.ts', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const editModal = fs.readFileSync('src/components/modals/EditAssetModal.tsx', 'utf8');
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

const appHandlerStart = app.indexOf('const handleUpdateAsset = async');
const appHandlerEnd = app.indexOf('// 3. Request Loan', appHandlerStart);
assert.ok(appHandlerStart >= 0 && appHandlerEnd > appHandlerStart);
const appHandler = app.slice(appHandlerStart, appHandlerEnd);
assert.ok(!appHandler.includes('status: updatedAsset.status'), 'App must not send status through generic PATCH');
const modalSubmitStart = editModal.indexOf('const handleSubmit = async');
const modalSubmitEnd = editModal.indexOf('const targetAssignedUser', modalSubmitStart);
assert.ok(modalSubmitStart >= 0 && modalSubmitEnd > modalSubmitStart);
const modalSubmit = editModal.slice(modalSubmitStart, modalSubmitEnd);
assert.ok(!modalSubmit.includes('status: selectedUserId ?'), 'edit modal must not send status through generic update');
assert.ok(editModal.includes('Status tidak diubah melalui edit umum'), 'edit modal must explain the dedicated status workflow');
assert.ok(!editModal.includes('<option value="retired">'), 'generic edit must not expose retired status mutation');

console.log('PASS: API, bulk import, and asset edit UI preserve dedicated lifecycle/loan status workflows.');


// Physical relocation must not change the recorded site while a confirmed
// reservation or active custody loan is in progress. Enforce this in the
// domain service so direct API callers cannot bypass the rule.
const moveStart = services.indexOf('static moveAsset(');
const moveEnd = services.indexOf('static mutateLifecycle(', moveStart);
assert.ok(moveStart >= 0 && moveEnd > moveStart, 'moveAsset domain service must exist');
const moveService = services.slice(moveStart, moveEnd);
assert.match(moveService, /const activeLoan = \(db\.loans \|\| \[\]\)\.find/);
assert.match(moveService, /\['active', 'approved', 'borrowed', 'overdue'\]\.includes\(String\(loan\.status\)\.toLowerCase\(\)\)/);
assert.match(moveService, /statusCode: 409/);
assert.match(moveService, /relokasi fisik ditolak sampai proses pinjaman selesai/);

const movementIds = [...services.matchAll(/id: `MOV-\$\{([^}]+)\}`/g)].map(match => match[1]);
assert.equal(movementIds.length, 3, 'unassign, assign, and relocate must each create one movement ID');
assert.ok(movementIds.every(expression => expression === 'randomUUID()'), 'movement primary keys must use collision-resistant UUIDs, not millisecond timestamps');
assert.ok(services.includes("import { randomUUID } from 'node:crypto';"), 'movement UUID generator must use Node crypto');
assert.ok(!/id: `MOV-\$\{Date\.now\(\)\}`/.test(services), 'timestamp-only movement IDs must be removed');

const generatedIdPrefixes = ['LOG', 'NOTIF', 'AST', 'LOAN', 'TKT', 'rsv', 'MT'];
for (const prefix of generatedIdPrefixes) {
  assert.ok(services.includes('id: `' + prefix + '-${randomUUID()}`'), prefix + ' records must use UUID primary keys');
}
assert.ok(services.includes("id: `FAC-${payload.category || 'GA'}-${randomUUID()}`"), 'meeting facilities must use UUID primary keys');
assert.ok(!/id: `(?:LOG|NOTIF|AST|LOAN|TKT|rsv|MT)-\$\{Date\.now\(\)/.test(services), 'timestamp/random-short-suffix IDs must be removed from domain records');
