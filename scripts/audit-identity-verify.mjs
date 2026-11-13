import fs from 'node:fs';
import assert from 'node:assert/strict';

const db = fs.readFileSync(new URL('../server/db.ts', import.meta.url), 'utf8');
const services = fs.readFileSync(new URL('../server/services.ts', import.meta.url), 'utf8');
const persistence = fs.readFileSync(new URL('../server/persistence.ts', import.meta.url), 'utf8');
const runtime = fs.readFileSync(new URL('../server/runtime-hardening.ts', import.meta.url), 'utf8');
const requestContext = fs.readFileSync(new URL('../server/requestContext.ts', import.meta.url), 'utf8');

const checks = [
  ['audit model stores stable user_id', /export interface ServerAuditLog \{[\s\S]*user_id\?: string/.test(db)],
  ['recordAudit accepts and records actor ID', /recordAudit\([\s\S]*user: \{ id\?: string; name: string; role: string \}/.test(services) && /user_id: auditActor\.id/.test(services)],
  ['PostgreSQL audit persistence never infers identity from display name', /const userId = log\.user_id \|\| null/.test(persistence) && !/db\.users\.find\(u => u\.name === log\.user_name\)/.test(persistence)],
  ['audit actor ID is a historical identifier, not a cascading user foreign key', /DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey/.test(fs.readFileSync(new URL('../server/migrations/046_audit_logs_append_only.sql', import.meta.url), 'utf8'))],
  ['role-switch sessions retain the original Superadmin principal in request context', /session\?\.original_admin_id/.test(runtime) && /originalAdminId\?: string/.test(requestContext)],
  ['actions performed as another persona are attributed to the original admin and record the active persona', /const auditActor = impersonator \|\| user/.test(services) && /Admin asli:[\s\S]*persona aktif:/.test(services)],
];

let failed = 0;
for (const [name, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${name}`);
  if (!pass) failed++;
}
console.log(`TOTAL: ${checks.length} | PASS: ${checks.length - failed} | FAIL: ${failed}`);
assert.equal(failed, 0, 'Audit actor identity contract failed.');
