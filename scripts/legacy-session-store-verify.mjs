import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const auth = read('server/auth.ts');
const persistence = read('server/persistence.ts');
const db = read('server/db.ts');
const legacySchema = read('server/migrations/002_gabah_auth_hardening.sql');

// Remove comments before checking executable persistence code. The legacy
// table name may remain in explanatory comments and historical migrations.
const stripComments = source => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/^\s*--.*$/gm, '');

const runtimePersistence = stripComments(persistence);
const sqlSessionTableAccess = /\b(?:SELECT[\s\S]{0,180}?FROM|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+["'`]?user_sessions\b/i;

const checks = [
  ['Session creation registers tokens only in the in-memory db.sessions registry',
    /db\.sessions\.push\(session\)/.test(auth)],
  ['Session lookup resolves tokens from db.sessions, not a durable table',
    /db\.sessions\.findIndex\(s => s\.token === token\)/.test(auth)],
  ['Session logout removes the in-memory registry entry',
    /destroySession\(token: string\): boolean[\s\S]*db\.sessions\.splice\(index, 1\)/.test(auth)],
  ['Persistence payload explicitly serializes an empty sessions collection',
    /sessions: \[\] as typeof db\.sessions/.test(persistence)],
  ['Hydration discards persisted session state and starts with an empty registry',
    /db\.sessions = \[\]/.test(persistence) && /if \(state\.sessions\) delete state\.sessions/.test(persistence)],
  ['Executable persistence code has no SQL read/write dependency on legacy user_sessions',
    !sqlSessionTableAccess.test(runtimePersistence)],
  ['Database model keeps sessions as an in-memory array',
    /sessions: \[\] as ServerSession\[\]/.test(db)],
  ['Migration 002 remains the historical creator of the legacy table; this guard does not drop it',
    /CREATE TABLE IF NOT EXISTS user_sessions/i.test(legacySchema) && !/DROP TABLE\s+user_sessions/i.test(legacySchema)],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}`);
  if (!ok) failed++;
}
console.log(`TOTAL: ${checks.length} | PASS: ${checks.length - failed} | FAIL: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
