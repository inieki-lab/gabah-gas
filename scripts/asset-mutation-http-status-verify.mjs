import fs from 'node:fs';
import assert from 'node:assert/strict';

const services = fs.readFileSync('server/services.ts', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');

for (const [method, permission] of [
  ['assignAsset', 'assets.assign'],
  ['moveAsset', 'assets.move'],
  ['mutateLifecycle', 'assets.lifecycle'],
]) {
  const start = services.indexOf(`static ${method}(`);
  const end = services.indexOf('\n  /**', start + 10);
  assert.ok(start >= 0 && end > start, `${method} must exist`);
  const body = services.slice(start, end);
  assert.ok(body.includes(`canMutateAssetOwner(actor, asset.owner_division, '${permission}')`));
  assert.ok(body.includes('statusCode: 403'), `${method} denial must be HTTP 403`);
}

const moveStart = server.indexOf("app.post('/api/assets/:id/move'");
const moveEnd = server.indexOf("app.post('/api/assets/:id/lifecycle'", moveStart);
const moveRoute = server.slice(moveStart, moveEnd);
assert.ok(moveRoute.includes("requireRbacPermission(req, res, 'assets.move')"));
assert.ok(moveRoute.includes("res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400)"));
const assignStart = server.indexOf("app.post('/api/assets/:id/assign'");
const assignEnd = server.indexOf("app.post('/api/assets/:id/move'", assignStart);
assert.ok(server.slice(assignStart, assignEnd).includes("res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400)"));

const lifecycleStart = server.indexOf("app.post('/api/assets/:id/lifecycle'");
const lifecycleEnd = server.indexOf('// Movements', lifecycleStart);
const lifecycleRoute = server.slice(lifecycleStart, lifecycleEnd);
assert.ok(lifecycleRoute.includes("requireRbacPermission(req, res, 'assets.lifecycle')"));
assert.ok(lifecycleRoute.includes("res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400)"));
console.log('PASS: Asset assign/move/lifecycle authorization denials preserve HTTP 403 and owner-scope enforcement.');
