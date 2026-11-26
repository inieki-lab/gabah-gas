import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('server.ts', 'utf8');
const helperStart = source.indexOf('const requirePostgresRbacPermission');
const helperEnd = source.indexOf('const requireRbacPermission', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'PostgreSQL-only RBAC guard must be defined before legacy guard');
const strictGuard = source.slice(helperStart, helperEnd);
assert.match(strictGuard, /!isPostgresPersistenceActive\(\)/);
assert.match(strictGuard, /status\(503\)/);
assert.match(strictGuard, /RBAC_UNAVAILABLE/);
assert.match(strictGuard, /return requireRbacPermission\(req, res, permissionKey\)/);

const routes = [
  { path: "app.post('/api/vendors'", key: 'vendors.create' },
  { path: "app.patch('/api/vendors/:id'", key: 'vendors.update' },
  { path: "app.post('/api/knowledge'", key: 'knowledge.create' },
  { path: "app.patch('/api/knowledge/:id'", key: 'knowledge.update' },
];
for (const route of routes) {
  const start = source.indexOf(route.path);
  assert.ok(start >= 0, `route exists: ${route.path}`);
  const nextRoute = source.indexOf('\n  app.', start + route.path.length);
  const body = source.slice(start, nextRoute < 0 ? source.length : nextRoute);
  assert.match(body, new RegExp(`requirePostgresRbacPermission\\(req, res, ['"]${route.key}['"]\\)`),
    `${route.path} must require PostgreSQL-backed ${route.key}`);
  assert.doesNotMatch(body, /else if \(!isSuperadminActor\(actor\).*hasApplicationRole/,
    `${route.path} must not retain legacy role-name write fallback`);
}
const vendorCreate = source.slice(source.indexOf("app.post('/api/vendors'"), source.indexOf("app.patch('/api/vendors/:id'"));
const vendorUpdate = source.slice(source.indexOf("app.patch('/api/vendors/:id'"), source.indexOf('// =========================\n  // Knowledge Base'));
assert.doesNotMatch(vendorCreate, /hasApplicationRole\(actor, requestedOwner/);
assert.doesNotMatch(vendorUpdate, /hasApplicationRole\(actor, (existingOwner|requestedOwner)/);

console.log('PASS: Vendor and Knowledge Base writes fail closed without PostgreSQL-backed Dynamic RBAC (4 routes).');
