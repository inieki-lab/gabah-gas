import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime = fs.readFileSync('server/runtime-hardening.ts', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const ci = fs.readFileSync('.github/workflows/ci.yml', 'utf8');

// Runtime middleware must not override explicit dynamic permissions with a
// hard-coded Superadmin/Auditor role-name check for these two read endpoints.
assert.doesNotMatch(runtime, /normalizedPath === '\/api\/audit-logs' && !isGlobalObserver\(actor\)/);
assert.doesNotMatch(runtime, /normalizedPath === '\/api\/reconciliation' && !isGlobalObserver\(actor\)/);

// The route handlers remain the authorization source of truth. Reconciliation
// further limits non-global readers to their visible asset scope.
assert.match(server, /app\.get\('\/api\/audit-logs',[\s\S]{0,180}requireRbacPermission\(req, res, 'audit\.read'\)/);
assert.match(server, /app\.get\('\/api\/reconciliation',[\s\S]{0,180}requireRbacPermission\(req, res, 'reconciliation\.read'\)/);
assert.match(server, /const visibleAssets = isSuperadminActor\(actor\) \|\| isAuditorActor\(actor\)[\s\S]{0,100}\? db\.assets[\s\S]{0,100}: GabahDomainService\.getScopedAssets\(actor\)/);

// Global observer behavior remains in place for the attention center, where it
// is a deliberate data-visibility policy rather than a route permission bypass.
assert.match(runtime, /if \(isGlobalObserver\(actor\)\) return items/);
assert.equal(packageJson.scripts['test:observer-route-rbac'], 'node scripts/observer-route-rbac-verify.mjs');
assert.match(ci, /npm run test:observer-route-rbac/);

console.log('Dynamic audit and reconciliation observer route RBAC checks passed.');
