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
const services = fs.readFileSync(
  new URL('../server/services.ts', import.meta.url),
  'utf8',
);

const checks = [
  ['migration 044 adds an atomic PostgreSQL EXCLUDE constraint', /EXCLUDE USING gist/i.test(migration)],
  ['asset identity and finite timestamp range are the collision keys', /asset_id WITH =/i.test(migration) && /tstzrange\(start_date, due_date, '\[\)'\)\) WITH &&/i.test(migration)],
  ['only approved and borrowed schedules use the EXCLUDE constraint', /WHERE \(status IN \('approved', 'borrowed'\)\)/i.test(migration)],
  ['overdue status is recorded without deleting or rewriting future reservations', /NEW\.status <> 'overdue'/i.test(migration) && /operators can then[\s\S]*resolve that booking/i.test(migration)],
  ['overdue checks serialize on the parent asset row', /PERFORM 1 FROM assets WHERE id = NEW\.asset_id FOR UPDATE/i.test(migration)],
  ['new requests are blocked by overdue or past-due borrowed loans', /status = 'overdue'[\s\S]*OR \(status = 'borrowed' AND due_date < NOW\(\)\)/i.test(migration)],
  ['database trigger enforces loanable status, condition, and no active assignment before request/approval', /asset_is_loanable[\s\S]*NOT IN \('active', 'available'\)[\s\S]*IN \('poor', 'broken', 'damaged'\)[\s\S]*FROM asset_assignments[\s\S]*returned_date IS NULL/i.test(migration)],
  ['service loan eligibility is default-deny for unknown lifecycle states and assigned assets', /LOAN_ELIGIBLE_ASSET_STATUSES = new Set\(\['active', 'available'\]\)/.test(services) && /!asset\.assigned_to\?\.id/.test(services) && /'broken', 'damaged', 'poor'/.test(services)],
  ['legacy approved/borrowed conflicts are preflighted without rewriting loans', /pasangan pinjaman aset approved\/borrowed yang bertabrakan/i.test(migration) && !/DELETE FROM loans|UPDATE loans/i.test(migration)],
  ['constraint creation is idempotent', /IF NOT EXISTS \([\s\S]*pg_constraint[\s\S]*loans_no_confirmed_asset_overlap/i.test(migration)],
  ['only one overdue physical loan is allowed per asset', /CREATE UNIQUE INDEX IF NOT EXISTS loans_one_overdue_per_asset[\s\S]*WHERE status = 'overdue'/i.test(migration)],
  ['the race-prone trigger is retained with serialized checks', /CREATE TRIGGER trg_check_loan_schedule_collision/i.test(migration)],
  ['migration runner discovers and orders numbered SQL migrations', /readdirSync\(migrationsDir\)[\s\S]*filter\(f => f\.endsWith\('\.sql'\)\)\.sort\(\)/i.test(persistence)],
];

let failed = 0;
for (const [name, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${name}`);
  if (!pass) failed++;
}
console.log(`TOTAL: ${checks.length} | PASS: ${checks.length - failed} | FAIL: ${failed}`);
assert.equal(failed, 0, 'Loan reservation exclusion migration contract failed.');
