import assert from 'node:assert/strict';
import fs from 'node:fs';

const services = fs.readFileSync('server/services.ts', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');
const start = services.indexOf('static moveAsset(');
const end = services.indexOf('\n  static ', start + 1);
const service = services.slice(start, end < 0 ? services.length : end);
assert.match(service, /persistAudit = true/);
assert.ok(service.includes("recordAudit('ASSET_MOVED'") && service.includes('asset.id, persistAudit)'), 'move audit must be deferred into the route commit');
const routeStart = server.indexOf("app.post('/api/assets/:id/move'");
const routeEnd = server.indexOf('\n  app.', routeStart + 10);
const route = server.slice(routeStart, routeEnd < 0 ? server.length : routeEnd);
assert.match(route, /async \(req, res\)/);
assert.ok(route.includes('GabahDomainService.moveAsset(req.params.id, newLocation, reason, actor, false)'));
assert.ok(route.includes('structuredClone(asset)') && route.includes('JSON.stringify(asset) === JSON.stringify(assetAfter)'));
assert.ok(route.includes('createdMovementIds') && route.includes('createdAuditIds'));
assert.ok(route.includes('persistBeforeSuccess(req, res)') && route.includes('Object.assign(asset, assetBefore)'));
console.log('PASS: physical asset movement restores asset, movement history, and audit on failed persistence');
