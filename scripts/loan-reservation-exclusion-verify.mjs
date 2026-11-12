import fs from 'node:fs';
import assert from 'node:assert/strict';

const migration = fs.readFileSync(
  new URL('../server/migrations/045_loan_reservations_exclusion_constraint.sql', import.meta.url),
  'utf8',
);
const persistence = fs.readFileSync(
  new URL('../server/persistence.ts', import.meta.url),
  'utf8',
);

const checks = [
  ['migration 045 adds an atomic PostgreSQL EXCLUDE constraint', /EXCLUDE USING gist/i.test(migration)],
  ['asset identity and timestamp range are the collision keys', /asset_id WITH =/i.test(migration) && /tstzrange\([\s\S]*start_date[\s\S]*due_date[\s\S]*WITH &&/i.test(migration)],
  ['borrowed and overdue loans reserve through infinity until return', /CASE WHEN status IN \('borrowed', 'overdue'\)[\s\S]*THEN 'infinity'::timestamptz/i.test(migration)],
  ['only approved, borrowed, and overdue loans reserve the asset', /status IN \('approved', 'borrowed', 'overdue'\)/i.test(migration)],
  ['legacy conflicts are preflighted without rewriting loans', /overlapping active asset loans exist/i.test(migration) && !/DELETE FROM loans|UPDATE loans/i.test(migration)],
  ['constraint creation is idempotent', /IF NOT EXISTS \([\s\S]*pg_constraint[\s\S]*loans_no_double_booking/i.test(migration)],
  ['race-prone trigger is removed after the exclusion constraint is installed', /DROP TRIGGER IF EXISTS trg_check_loan_schedule_collision/i.test(migration) && /DROP FUNCTION IF EXISTS check_loan_schedule_collision/i.test(migration)],
  ['migration runner discovers and orders numbered SQL migrations', /readdirSync\(migrationsDir\)[\s\S]*filter\(f => f\.endsWith\('\.sql'\)\)\.sort\(\)/i.test(persistence)],
];

let failed = 0;
for (const [name, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${name}`);
  if (!pass) failed++;
}
console.log(`TOTAL: ${checks.length} | PASS: ${checks.length - failed} | FAIL: ${failed}`);
assert.equal(failed, 0, 'Loan reservation exclusion migration contract failed.');
