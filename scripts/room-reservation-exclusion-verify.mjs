import fs from 'node:fs';
import assert from 'node:assert/strict';

const migration = fs.readFileSync(
  new URL('../server/migrations/044_room_reservations_exclusion_constraint.sql', import.meta.url),
  'utf8',
);
const persistence = fs.readFileSync(
  new URL('../server/persistence.ts', import.meta.url),
  'utf8',
);

const checks = [
  ['migration 044 adds a PostgreSQL EXCLUDE constraint', /EXCLUDE USING gist/i.test(migration)],
  ['constraint compares room identity and overlapping half-open time ranges', /room_id WITH =/i.test(migration) && /tstzrange\(start_datetime, end_datetime, '\[\)'\) WITH &&/i.test(migration)],
  ['only active reservation states participate in collision prevention', /status IN \('pending', 'approved', 'in_use', 'checked_in'\)/i.test(migration)],
  ['legacy conflicts are detected without deleting or rewriting reservations', /overlapping active room reservations exist/i.test(migration) && !/DELETE FROM room_reservations|UPDATE room_reservations/i.test(migration)],
  ['constraint creation is idempotent', /IF NOT EXISTS \([\s\S]*pg_constraint[\s\S]*room_reservations_no_double_booking/i.test(migration)],
  ['old non-enforcing GiST index is removed after constraint creation', /DROP INDEX IF EXISTS idx_room_reservations_no_double_booking/i.test(migration)],
  ['migration runner discovers and orders numbered SQL migrations', /readdirSync\(migrationsDir\)[\s\S]*filter\(f => f\.endsWith\('\.sql'\)\)\.sort\(\)/i.test(persistence)],
];

let failed = 0;
for (const [name, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${name}`);
  if (!pass) failed++;
}
console.log(`TOTAL: ${checks.length} | PASS: ${checks.length - failed} | FAIL: ${failed}`);
assert.equal(failed, 0, 'Room reservation exclusion migration contract failed.');
