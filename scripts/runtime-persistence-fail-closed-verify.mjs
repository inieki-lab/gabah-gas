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
const firstPgWrite = initialize.indexOf('await persistPostgresState()');
const postgresSnapshot = initialize.indexOf('saveStateToFile(createPayload())', firstPgWrite);
assert.ok(firstPgWrite >= 0, 'Startup must persist authoritative PostgreSQL state');
assert.ok(postgresSnapshot > firstPgWrite,
  'PostgreSQL startup snapshot must not be published before authoritative persistence succeeds');

const normalizedSync = persistence.slice(
  persistence.indexOf('async function backfillNormalizedTables('),
  persistence.indexOf('export async function initializePersistence()'),
);
assert.match(normalizedSync, /existingClient\?: PoolClient/,
  'Normalized-table synchronization must accept the caller transaction');
assert.match(normalizedSync, /const ownsTransaction = !existingClient/,
  'Standalone normalized backfills must retain their own transaction lifecycle');
assert.match(normalizedSync, /await backfillNormalizedTables\(client\)/,
  'State persistence must run normalized synchronization on the same transaction client');
const postgresWrite = normalizedSync.slice(normalizedSync.indexOf('async function persistPostgresState()'));
assert.match(postgresWrite, /BEGIN[\s\S]*gabah_state[\s\S]*backfillNormalizedTables\(client\)[\s\S]*COMMIT/,
  'gabah_state and normalized tables must commit in one PostgreSQL transaction');
assert.match(postgresWrite, /catch \(error\)[\s\S]*ROLLBACK/,
  'A normalized-table failure must roll back the gabah_state update too');

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
