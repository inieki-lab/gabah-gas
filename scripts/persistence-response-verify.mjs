import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const start = source.indexOf('Commit every successful state-changing API response BEFORE sending it.');
const end = source.indexOf('// Helper to extract authenticated user', start);
const middleware = start >= 0 && end > start ? source.slice(start, end) : '';

const checks = [
  ['state-changing API responses pass through the persistence gate', /res\.send =/.test(middleware)],
  ['database persistence resolves before the original response is sent', /persistDataStore\(\)[\s\S]*\.then\(\(\) => send\(body\)\)/.test(middleware)],
  ['failed persistence converts the response to HTTP 500', /\.catch\([\s\S]*res\.statusCode = 500/.test(middleware)],
  ['failed persistence returns an explicit non-success response', /Perubahan gagal disimpan ke database/.test(middleware)],
  ['the unsafe post-response finish hook is absent', !/res\.on\('finish'/.test(middleware)],
  ['PostgreSQL state blob and normalized relations share one transaction', /async function persistPostgresState\(\)[\s\S]*client\.query\('BEGIN'\)[\s\S]*INSERT INTO gabah_state[\s\S]*backfillNormalizedTables\(client\)[\s\S]*backfillDynamicRbacUserRoles\(client\)[\s\S]*client\.query\('COMMIT'\)/.test(source)],
  ['persistence transaction rolls back all database writes on failure', /async function persistPostgresState\(\)[\s\S]*catch \(error\)[\s\S]*client\.query\('ROLLBACK'\)/.test(source)],
  ['normalized table backfill reuses the caller transaction when provided', /async function backfillNormalizedTables\(sharedClient\?: PoolClient\)[\s\S]*const ownsClient = !sharedClient[\s\S]*if \(ownsClient\) await client\.query\('BEGIN'\)[\s\S]*if \(ownsClient\) await client\.query\('COMMIT'\)/.test(source)],
  ['dynamic role backfill uses the same transaction client when provided', /async function backfillDynamicRbacUserRoles\(sharedClient\?: PoolClient\)[\s\S]*sharedClient \? sharedClient\.query/.test(source)],
  ['JSON mirror is written only after PostgreSQL commit succeeds', /await persistPostgresState\(\);\s*saveStateToFile\(createPayload\(\)\)/.test(source)],
  ['file-store fallback remains available only when PostgreSQL is inactive', /if \(!isPostgresAvailable\) \{\s*saveStateToFile\(payload\);\s*return persistQueue;/m.test(source)],
];

let failed = 0;
for (const [name, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${name}`);
  if (!pass) failed++;
}
console.log(`TOTAL: ${checks.length} | PASS: ${checks.length - failed} | FAIL: ${failed}`);
assert.equal(failed, 0, 'API persistence response contract failed.');
