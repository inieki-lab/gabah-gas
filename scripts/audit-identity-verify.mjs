import fs from 'node:fs';
import assert from 'node:assert/strict';

const db = fs.readFileSync(new URL('../server/db.ts', import.meta.url), 'utf8');
const services = fs.readFileSync(new URL('../server/services.ts', import.meta.url), 'utf8');
const persistence = fs.readFileSync(new URL('../server/persistence.ts', import.meta.url), 'utf8');

const checks = [
  ['audit model stores stable user_id', /export interface ServerAuditLog \{[\s\S]*user_id\?: string/.test(db)],
  ['recordAudit accepts and records actor ID', /recordAudit\([\s\S]*user: \{ id\?: string; name: string; role: string \}/.test(services) && /user_id: user\.id/.test(services)],
  ['PostgreSQL audit persistence never infers identity from display name', /const userId = log\.user_id \|\| null/.test(persistence) && !/db\.users\.find\(u => u\.name === log\.user_name\)/.test(persistence)],
  ['audit actor ID is a historical identifier, not a cascading user foreign key', /DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey/.test(fs.readFileSync(new URL('../server/migrations/046_audit_logs_append_only.sql', import.meta.url), 'utf8'))],
];

let failed = 0;
for (const [name, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${name}`);
  if (!pass) failed++;
}
console.log(`TOTAL: ${checks.length} | PASS: ${checks.length - failed} | FAIL: ${failed}`);
assert.equal(failed, 0, 'Audit actor identity contract failed.');
