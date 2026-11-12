import fs from 'node:fs';
import assert from 'node:assert/strict';

const db = fs.readFileSync(new URL('../server/db.ts', import.meta.url), 'utf8');
const services = fs.readFileSync(new URL('../server/services.ts', import.meta.url), 'utf8');
const persistence = fs.readFileSync(new URL('../server/persistence.ts', import.meta.url), 'utf8');

const checks = [
  ['audit model stores stable user_id', /export interface ServerAuditLog \{[\s\S]*user_id\?: string/.test(db)],
  ['recordAudit accepts and records actor ID', /recordAudit\([\s\S]*user: \{ id\?: string; name: string; role: string \}/.test(services) && /user_id: user\.id/.test(services)],
  ['PostgreSQL audit persistence prefers stable user_id', /const userId = log\.user_id \|\| db\.users\.find\(u => u\.name === log\.user_name\)\?\.id/.test(persistence)],
  ['legacy name fallback cannot override explicit actor ID', /log\.user_id \|\| db\.users\.find/.test(persistence)],
];

let failed = 0;
for (const [name, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${name}`);
  if (!pass) failed++;
}
console.log(`TOTAL: ${checks.length} | PASS: ${checks.length - failed} | FAIL: ${failed}`);
assert.equal(failed, 0, 'Audit actor identity contract failed.');
