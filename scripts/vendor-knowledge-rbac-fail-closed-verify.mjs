import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('server.ts', 'utf8');
const persistence = fs.readFileSync('server/persistence.ts', 'utf8');
const helperStart = source.indexOf('const requireDynamicRbacPermission');
const helperEnd = source.indexOf('const requireRbacPermission', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'Dynamic RBAC compatibility guard must be defined before the base permission guard');
const guard = source.slice(helperStart, helperEnd);
assert.match(guard, /if \(!isPostgresPersistenceActive\(\)\) return true/);
assert.match(guard, /return requireRbacPermission\(req, res, permissionKey\)/);
assert.match(persistence, /if \(process\.env\.NODE_ENV === 'production'\)[\s\S]{0,260}Refusing to fall back to the file store/,
  'production startup must fail instead of silently switching to file-store');

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
  assert.match(body, new RegExp(`requireDynamicRbacPermission\\(req, res, ['"]${route.key}['"]\\)`));
  assert.match(body, /!isPostgresPersistenceActive\(\)[\s\S]{0,180}!isSuperadminActor\(actor\)[\s\S]{0,150}hasApplicationRole\(actor, 'it'\)[\s\S]{0,150}hasApplicationRole\(actor, 'ga'\)/,
    `${route.path} must retain only the bounded IT/GA/Superadmin file-store development allowlist`);
}
const vendorCreate = source.slice(source.indexOf("app.post('/api/vendors'"), source.indexOf("app.patch('/api/vendors/:id'"));
const vendorUpdate = source.slice(source.indexOf("app.patch('/api/vendors/:id'"), source.indexOf('// =========================\n  // Knowledge Base'));
assert.match(vendorCreate, /hasRbacScope\(String\(actor\.id\), 'division', requestedOwner, 'vendors'\)/);
assert.match(vendorUpdate, /hasRbacScope\(String\(actor\.id\), 'division', existingOwner, 'vendors'\)/);
assert.match(vendorUpdate, /hasRbacScope\(String\(actor\.id\), 'division', requestedOwner, 'vendors'\)/);
assert.match(vendorCreate, /hasApplicationRole\(actor, requestedOwner\.toLowerCase\(\)/);
assert.match(vendorUpdate, /hasApplicationRole\(actor, existingOwner\.toLowerCase\(\)/);
assert.match(vendorUpdate, /hasApplicationRole\(actor, requestedOwner\.toLowerCase\(\)/);

console.log('PASS: Vendor and Knowledge Base writes use Dynamic RBAC in PostgreSQL and bounded legacy controls only in development file-store mode.');
