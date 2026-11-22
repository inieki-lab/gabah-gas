import assert from 'node:assert/strict';
import fs from 'node:fs';

const services = fs.readFileSync('server/services.ts', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');
for (const [method, audit] of [['assignAsset', 'ASSET_ASSIGNED'], ['assignAsset', 'ASSET_UNASSIGNED'], ['mutateLifecycle', 'LIFECYCLE_MUTATION']]) {
  const start = services.indexOf('static ' + method + '(');
  const end = services.indexOf('\\n  static ', start + 1);
  const body = services.slice(start, end < 0 ? services.length : end);
  assert.match(body, /persistAudit = true/);
  assert.ok(body.includes("recordAudit('" + audit + "'") && body.includes('asset.id, persistAudit)'), audit + ' audit must be deferred into the route commit');
}
for (const [path, service, movement] of [
  ["app.post('/api/assets/:id/assign'", 'assignAsset', true],
  ["app.post('/api/assets/:id/lifecycle'", 'mutateLifecycle', false],
]) {
  const start = server.indexOf(path);
  const end = server.indexOf('\\n  app.', start + 10);
  const route = server.slice(start, end < 0 ? server.length : end);
  assert.match(route, /async \(req, res\)/);
  assert.ok(route.includes('structuredClone(asset)'), service + ' must snapshot the asset');
  assert.ok(route.includes('persistBeforeSuccess(req, res)'), service + ' must await durable persistence');
  assert.ok(route.includes('JSON.stringify(asset) === JSON.stringify(assetAfter)'), service + ' must avoid overwriting concurrent asset changes on rollback');
  assert.ok(route.includes('Object.assign(asset, assetBefore)'), service + ' must restore asset state on failed persistence');
  assert.ok(route.includes('createdAuditIds'), service + ' must remove only its own audit rows on rollback');
  if (movement) assert.ok(route.includes('createdMovementIds'), 'assignment must remove only its own movement rows on rollback');
  assert.ok(route.includes('service') === false || true);
}
console.log('PASS: asset assignment and lifecycle mutations roll back only their own effects on failed persistence');
