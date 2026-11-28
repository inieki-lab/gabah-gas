import assert from 'node:assert/strict';
import fs from 'node:fs';

const services = fs.readFileSync('server/services.ts', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');
const serviceStart = services.indexOf('static async createAsset(');
const serviceEnd = services.indexOf('\n  static ', serviceStart + 1);
const service = services.slice(serviceStart, serviceEnd < 0 ? services.length : serviceEnd);
assert.match(service, /persistAudit = true/);
assert.match(service, /recordAudit\('ASSET_CREATED'[\s\S]*newAsset\.id, persistAudit\)/);
const routeStart = server.indexOf("app.post('/api/assets'");
const routeEnd = server.indexOf('\n  app.', routeStart + 10);
const route = server.slice(routeStart, routeEnd < 0 ? server.length : routeEnd);
assert.match(route, /async \(req, res\)/);
assert.ok(route.includes('createAsset(req.body, actor, false)'));
assert.ok(route.includes('persistBeforeSuccess(req, res)'));
assert.ok(route.includes('db.assets.splice(0, db.assets.length, ...db.assets.filter(item => item.id !== newAsset.id))'));
assert.ok(route.includes('createdAuditIds') && route.includes('db.auditLogs.splice'));
assert.doesNotMatch(route, /await persistDataStore\(\)/);
console.log('PASS: asset creation rolls back the created asset and audit if durable persistence fails');

const assignGuard = service.indexOf("assignedToId && !canMutateAssetOwner(actor, resolvedOwnerDivision, 'assets.assign')");
const assignedUserLookup = service.indexOf('const assignedUser = assignedToId');
assert.ok(assignGuard >= 0, 'initial asset assignment must require assets.assign');
assert.ok(assignedUserLookup > assignGuard, 'assignment permission must be checked before revealing target-user existence');
assert.match(service, /assignedToId && !canMutateAssetOwner\\(actor, resolvedOwnerDivision, 'assets\\.assign'\\)[\\s\\S]*statusCode: 403/);
console.log('PASS: initial asset assignment requires assets.assign before resolving the target user.');
