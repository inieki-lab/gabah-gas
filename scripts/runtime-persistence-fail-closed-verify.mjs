import assert from 'node:assert/strict';
import fs from 'node:fs';

const persistence = fs.readFileSync('server/persistence.ts', 'utf8');
const poolListener = persistence.slice(
  persistence.indexOf("pool.on('error'"),
  persistence.indexOf("const DATA_DIR"),
);
assert.doesNotMatch(poolListener, /isPostgresAvailable\s*=\s*false/,
  'An idle pool error must not silently switch configured PostgreSQL to file storage');

const initialize = persistence.slice(
  persistence.indexOf('export async function initializePersistence()'),
  persistence.indexOf('export function persistDataStore()'),
);
const firstSnapshot = initialize.indexOf('saveStateToFile(createPayload())');
const firstPgWrite = initialize.indexOf('await persistPostgresState()');
assert.ok(firstPgWrite >= 0, 'Startup must persist authoritative PostgreSQL state');
assert.ok(firstSnapshot < 0 || firstSnapshot > firstPgWrite,
  'Startup snapshot must not be published before PostgreSQL succeeds');

const persist = persistence.slice(
  persistence.indexOf('export function persistDataStore()'),
  persistence.indexOf('export function getDbPool()'),
);
assert.match(persist, /if \(dbConfig\.isConfigured\)[\s\S]*Promise\.reject/,
  'Configured-but-unavailable PostgreSQL must reject instead of using file storage');
assert.match(persist, /const write = persistQueue\.then\(async \(\) => \{[\s\S]*const payload = createPayload\(\);[\s\S]*await persistPostgresState\(\);[\s\S]*saveStateToFile\(payload\);/,
  'Recovery snapshot must be captured inside the serialized write and published only after PostgreSQL succeeds');
assert.match(persist, /saveStateToFile\(createPayload\(\)\)/,
  'Standalone file-store mode must still persist the current state immediately');
assert.doesNotMatch(persist, /const payload = createPayload\(\);\s*\/\/ File storage/,
  'PostgreSQL mode must not capture a stale snapshot before entering the write queue');
assert.doesNotMatch(persist, /isPostgresAvailable\s*=\s*false/,
  'A transient write failure must not downgrade the process to file-store mode');
const catchBlock = persist.slice(persist.indexOf('} catch (error: any)'));
assert.doesNotMatch(catchBlock, /saveStateToFile\(|isPostgresAvailable\s*=/,
  'Failed PostgreSQL writes must neither publish a snapshot nor change persistence mode');

console.log('Runtime PostgreSQL fail-closed contract: PASS');
