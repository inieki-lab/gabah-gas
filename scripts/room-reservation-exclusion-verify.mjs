import fs from 'node:fs';
import assert from 'node:assert/strict';

const migration = fs.readFileSync(
  new URL('../server/migrations/044_concurrent_booking_exclusion_constraints.sql', import.meta.url),
  'utf8',
);
const persistence = fs.readFileSync(
  new URL('../server/persistence.ts', import.meta.url),
  'utf8',
);

const checks = [
  ['migration 044 adds PostgreSQL EXCLUDE constraints for rooms and loans',
    migration.includes('EXCLUDE USING gist')
      && migration.includes('room_reservations_no_time_overlap')
      && migration.includes('loans_no_confirmed_asset_overlap')],
  ['room collision constraint compares room identity and half-open time ranges',
    migration.includes('room_id WITH =')
      && migration.includes("(tstzrange(start_datetime, end_datetime, '[)')) WITH &&")],
  ['pending_approval and legacy active room states participate in collision prevention',
    migration.includes("status IN ('pending_approval', 'pending', 'approved', 'in_use', 'checked_in')")],
  ['loan collision constraint covers approved, borrowed, and overdue states',
    migration.includes("status IN ('approved', 'borrowed', 'overdue')")
      && migration.includes("tstzrange(start_date, 'infinity'::timestamptz, '[)')")],
  ['legacy room and loan conflicts are detected before constraints are added',
    migration.includes('pasangan reservasi ruangan aktif yang bertabrakan')
      && migration.includes('pasangan pinjaman aset aktif yang bertabrakan')],
  ['migration never silently deletes or rewrites existing reservations or loans',
    !/DELETE FROM (room_reservations|loans)|UPDATE (room_reservations|loans)/i.test(migration)],
  ['room and loan constraint creation is idempotent',
    (migration.match(/FROM pg_constraint/g) || []).length >= 2
      && migration.includes('room_reservations_no_time_overlap')
      && migration.includes('loans_no_confirmed_asset_overlap')],
  ['old non-enforcing room GiST index is removed after constraint creation',
    migration.includes('DROP INDEX IF EXISTS idx_room_reservations_no_double_booking')],
  ['migration runner discovers and orders numbered SQL migrations',
    /readdirSync\(migrationsDir\)[\s\S]*filter\(f => f\.endsWith\('\.sql'\)\)\.sort\(\)/i.test(persistence)],
];

let failed = 0;
for (const [name, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${name}`);
  if (!pass) failed++;
}
console.log(`TOTAL: ${checks.length} | PASS: ${checks.length - failed} | FAIL: ${failed}`);
assert.equal(failed, 0, 'Concurrent booking exclusion migration contract failed.');
