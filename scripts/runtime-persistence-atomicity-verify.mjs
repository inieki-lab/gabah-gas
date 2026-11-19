import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('server/persistence.ts', 'utf8');
const normalized = source.slice(source.indexOf('async function backfillNormalizedTables'), source.indexOf('function collectLegacyEmployeeCapabilityAssignments'));
const roleSync = source.slice(source.indexOf('async function backfillDynamicRbacUserRoles'), source.indexOf('export async function initializePersistence'));
const pgWrite = source.slice(source.indexOf('async function persistPostgresState'), source.indexOf('async function backfillDynamicRbacUserRoles'));
const persist = source.slice(source.indexOf('export function persistDataStore'), source.indexOf('export function getDbPool'));

assert.match(source, /let postgresFailureLatched = false/, 'Runtime PostgreSQL failures need a persistent in-process latch');
assert.match(source, /postgresFailureLatched = true;[\s\S]*isPostgresAvailable = false;/, 'A pool error after PostgreSQL activation must latch the authoritative store closed');
assert.match(normalized, /backfillNormalizedTables\(existingClient\?: PoolClient\)/, 'Normalized sync must accept the outer transaction client');
assert.match(normalized, /if \(!existingClient\) await client\.query\('BEGIN'\)/, 'Standalone normalized sync owns a transaction only without a caller client');
assert.match(normalized, /if \(!existingClient\) await client\.query\('COMMIT'\)/, 'Nested normalized sync must not commit the outer transaction');
assert.match(normalized, /if \(!existingClient\) client\.release\(\)/, 'Nested normalized sync must not release the outer transaction client');
assert.match(roleSync, /backfillDynamicRbacUserRoles\(existingClient\?: PoolClient\)/, 'Dynamic role mirror sync must accept the outer transaction client');
assert.match(roleSync, /const executor = existingClient \|\| pool/, 'Dynamic role mirror sync must use the shared transaction executor');
assert.match(pgWrite, /await client\.query\('BEGIN'\)[\s\S]*INSERT INTO gabah_state[\s\S]*backfillNormalizedTables\(client\)[\s\S]*backfillDynamicRbacUserRoles\(client\)[\s\S]*await client\.query\('COMMIT'\)/, 'Snapshot, normalized domain and dynamic role mirror must commit in one transaction');
assert.match(pgWrite, /await client\.query\('ROLLBACK'\)/, 'Any failure in the transaction must roll back the state snapshot');
assert.match(persist, /if \(postgresFailureLatched\)[\s\S]*Promise\.reject/, 'All writes after a runtime PostgreSQL failure must fail closed');
assert.match(persist, /if \(!isPostgresAvailable\)[\s\S]*saveStateToFile\(payload\)[\s\S]*return persistQueue/, 'File store is available only for the startup fallback state');
assert.match(persist, /const committedPayload = await persistPostgresState\(\)[\s\S]*saveStateToFile\(committedPayload\)/, 'Recovery snapshot must publish only after the authoritative transaction commits');
assert.ok(persist.indexOf('saveStateToFile(committedPayload)') > persist.indexOf('await persistPostgresState()'), 'Local snapshot publication must follow PostgreSQL commit');
assert.match(persist, /postgresFailureLatched = true;[\s\S]*isPostgresAvailable = false;[\s\S]*throw new Error/, 'A failed authoritative write must latch closed and reject the caller');

console.log('PASS: PostgreSQL runtime failure latch, shared transaction rollback, and post-commit snapshot ordering');
