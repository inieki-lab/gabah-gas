import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migration = fs.readFileSync(path.join(root, 'server/migrations/096_room_reservation_exclusion_constraint.sql'), 'utf8');
const prior = fs.readFileSync(path.join(root, 'server/migrations/015_room_reservations.sql'), 'utf8');
const persistence = fs.readFileSync(path.join(root, 'server/persistence.ts'), 'utf8');

assert.match(prior, /CREATE INDEX IF NOT EXISTS idx_room_reservations_no_double_booking[\s\S]*?USING gist/i,
  'migration 015 should be recognized as the lookup index, not a uniqueness guarantee');
assert.match(migration, /CREATE EXTENSION IF NOT EXISTS btree_gist/i);
assert.match(migration, /ADD CONSTRAINT room_reservations_no_overlap[\s\S]*?EXCLUDE USING gist/i,
  'a real PostgreSQL exclusion constraint must reject overlapping reservations');
assert.match(migration, /room_id WITH =/i);
assert.match(migration, /tstzrange\(start_datetime, end_datetime, '\[\)'\)\) WITH &&/i);
assert.match(migration, /WHERE \(status IN \('pending', 'pending_approval', 'approved', 'in_use', 'checked_in'\)\)/i);
assert.match(migration, /existing active room reservations overlap/i,
  'migration must stop safely with an explicit diagnostic if existing data conflicts');
assert.match(persistence, /readdirSync\(migrationsDir\)[\s\S]*?\.sort\(\)/,
  'numbered migrations must be applied in deterministic order');

console.log('PASS room reservation database exclusion constraint, active-state predicate, safe preflight, and migration ordering');
