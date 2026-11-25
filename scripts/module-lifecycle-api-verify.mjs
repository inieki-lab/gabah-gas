import fs from 'node:fs';
import assert from 'node:assert/strict';

const server = fs.readFileSync('server.ts', 'utf8');
const migration = fs.readFileSync('server/migrations/042_module_lifecycle_registry.sql', 'utf8');
const checks = [
  ['Module status is cached briefly', /MODULE_STATUS_CACHE_MS = 5000/.test(server)],
  ['Module status is read from the registry', /SELECT is_active FROM gabah_modules WHERE module_key = \$1/.test(server)],
  ['Module management routes are excluded from their own guard', /matchesApiPrefix\(path, '\/api\/modules'\)\) return null/.test(server)],
  ['Auth, health, and administration endpoints bypass module gating', /isModuleManagedPath = \(req: express\.Request\)/.test(server) && /!isModuleManagedPath\(req\)/.test(server)],
  ['Disabled modules block before business route handlers', /app\.use\(async \(req, res, next\)/.test(server) && /code: 'MODULE_DISABLED'/.test(server)],
  ['Registry failures fail closed', /code: 'MODULE_STATUS_UNAVAILABLE'/.test(server)],
  ['Authenticated users can read global module availability for navigation', /app\.get\('\/api\/modules'[\s\S]*?getActor\(req\)[\s\S]*?SELECT module_key, name, description, is_active/.test(server)],
  ['Only Superadmin can update module status', /app\.patch\('\/api\/modules\/:moduleKey'[\s\S]*!isSuperadminActor\(actor\)/.test(server)],
  ['Only Superadmin can read module audit', /app\.get\('\/api\/modules\/:moduleKey\/audit'[\s\S]*!isSuperadminActor\(actor\)/.test(server)],
  ['Status is a strict boolean', /typeof is_active !== 'boolean'/.test(server)],
  ['Change reason is bounded', /reason\.trim\(\)\.length < 5 \|\| reason\.trim\(\)\.length > 500/.test(server)],
  ['Status and audit are written in one transaction', /withRbacTransaction\(async client =>[\s\S]*INSERT INTO gabah_module_status_audit/.test(server)],
  ['Audit table is append-only in PostgreSQL', /CREATE TRIGGER gabah_module_status_audit_no_row_mutation[\s\S]*CREATE TRIGGER gabah_module_status_audit_no_truncate/.test(migration)],
  ['Meeting type and facility master APIs are lifecycle-managed', server.includes("matchesApiPrefix(path, '/api/meeting-types')") && server.includes("matchesApiPrefix(path, '/api/meeting-facilities')") && server.includes("'/api/meeting-types', '/api/meeting-facilities'")],
  ['Asset reads select the correct module by RBAC capability', /assets\.catalog\.read[\s\S]*return canReadCatalogue \? 'assets' : 'my_assets'/.test(server)],
];
let failed = 0;
for (const [name, pass] of checks) {
  console.log((pass ? 'PASS' : 'FAIL') + ' | ' + name);
  if (!pass) failed++;
}
console.log('TOTAL: ' + checks.length + ' | PASS: ' + (checks.length - failed) + ' | FAIL: ' + failed);
process.exit(failed ? 1 : 0);
