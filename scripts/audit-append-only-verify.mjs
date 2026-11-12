import fs from 'node:fs';
import assert from 'node:assert/strict';

const migration = fs.readFileSync(
  new URL('../server/migrations/046_audit_logs_append_only.sql', import.meta.url),
  'utf8',
);
const persistence = fs.readFileSync(
  new URL('../server/persistence.ts', import.meta.url),
  'utf8',
);

const checks = [
  ['audit mutation guard function is defined', /CREATE OR REPLACE FUNCTION reject_audit_log_mutation/i.test(migration)],
  ['row updates and deletes are blocked', /BEFORE UPDATE OR DELETE ON audit_logs/i.test(migration)],
  ['table truncation is blocked', /BEFORE TRUNCATE ON audit_logs/i.test(migration)],
  ['all prohibited mutations raise an exception', /RAISE EXCEPTION 'audit_logs is append-only/i.test(migration)],
  ['application persistence inserts audit rows without updating existing rows', /INSERT INTO audit_logs[\s\S]*ON CONFLICT \(id\) DO NOTHING/i.test(persistence)],
  ['migration runner discovers and orders numbered SQL migrations', /readdirSync\(migrationsDir\)[\s\S]*filter\(f => f\.endsWith\('\.sql'\)\)\.sort\(\)/i.test(persistence)],
];

let failed = 0;
for (const [name, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${name}`);
  if (!pass) failed++;
}
console.log(`TOTAL: ${checks.length} | PASS: ${checks.length - failed} | FAIL: ${failed}`);
assert.equal(failed, 0, 'Audit append-only migration contract failed.');
