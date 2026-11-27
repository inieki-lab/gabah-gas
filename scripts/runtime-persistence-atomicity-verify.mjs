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
assert.match(persist, /await persistPostgresState\(\)/, 'Authoritative PostgreSQL transaction must complete before persistence reports success');
assert.match(persist, /avoid a second local write[\\s\\S]*read-only/, 'Production persistence must not require a writable application filesystem');
const postgresWritePath = persist.slice(persist.indexOf('const write ='));
assert.doesNotMatch(postgresWritePath, /saveStateToFile\\(/, 'A successful PostgreSQL write must not publish a secondary local snapshot');
assert.match(persist, /postgresFailureLatched = true;[\s\S]*isPostgresAvailable = false;[\s\S]*throw Object\.assign\(/, 'A failed authoritative write must latch closed, reject the caller, and expose HTTP 503');

console.log('PASS: PostgreSQL runtime failure latch, shared transaction rollback, and post-commit snapshot ordering');


// API routes that previously swallowed persistence failures must await the
// authoritative write and return a failure response before reporting success.
const server = fs.readFileSync('server.ts', 'utf8');
assert.match(server, /const persistBeforeSuccess = async \(req: express\.Request, res: express\.Response\)/);
assert.match(server, /code: 'PERSISTENCE_UNAVAILABLE'/);
assert.doesNotMatch(server, /persistDataStore\(\)\.catch\(\(\) => \{\}\)/);
assert.match(server, /\(req as any\).__gabahPersisted = true/);
assert.ok((server.match(/persistBeforeSuccess\(req, res\)/g) || []).length >= 17, 'All route-local mutation writes must await authoritative persistence (minimum 17 guarded writes)');


// Every successful mutating API response must be sent only after persistence.
// The send gate covers mutation routes without route-local persistDataStore calls.
assert.match(server, /const originalSend = res\.send\.bind\(res\)/);
assert.match(server, /!req\.path\.toLowerCase\(\)\.startsWith\('\/api\/'\)/, 'Persistence response gate must match Express case-insensitive API routes');
assert.match(server, /void persistDataStore\(\)\.then\(\(\) =>/);
assert.match(server, /originalSend\(body\)/);
assert.match(server, /PERSISTENCE_UNAVAILABLE/);
assert.doesNotMatch(server, /res\.on\('finish',[\s\S]*persistDataStore/);


// Persistence failures carry statusCode=503; route catch blocks must preserve it
// instead of flattening database outages into client validation errors.
const catchBlocks = [...server.matchAll(/catch \(err: any\) \{([\s\S]{0,500}?)res\.status\(([^)]+)\)/g)];
assert.ok(catchBlocks.some(match => /err\?\.statusCode/.test(match[2])), 'Route catches must preserve persistence HTTP status codes');

assert.doesNotMatch(server, /: \((?:400|500)\)\)\)\.json/, 'Persistence status mapping must remain valid TypeScript');

assert.doesNotMatch(server, /await persistDataStore\(\);(?!\s*\(req as any\).__gabahPersisted = true;)/, 'A route that explicitly awaited persistence must mark the response as already committed');

assert.match(server, /if \(\(req as any\).__gabahPersisting\) return res/, 'Duplicate sends must not bypass the persistence gate while the first write is pending');


// Runtime PostgreSQL failure must quarantine all API reads/writes instead of
// exposing in-memory mutations that may not exist in the committed DB snapshot.
const hardening = fs.readFileSync('server/runtime-hardening.ts', 'utf8');
assert.match(source, /export function isPostgresFailureLatched\(\): boolean/);
assert.match(hardening, /import \{ isPostgresPersistenceActive, isPostgresFailureLatched \} from '\.\/persistence'/);
assert.match(hardening, /if \(isPostgresFailureLatched\(\) && normalizedPath !== '\/api\/health'\)[\s\S]*status\(503\)[\s\S]*PERSISTENCE_DEGRADED/);
assert.match(server, /const persistenceDegraded = isPostgresFailureLatched\(\)[\s\S]*status: persistenceDegraded \? 'degraded' : 'ok'[\s\S]*ready: !persistenceDegraded[\s\S]*postgresql-unavailable-restart-required/);
assert.match(hardening, /Only health remains available/);
console.log('PASS: Runtime PostgreSQL failure quarantines API and reports degraded health');
