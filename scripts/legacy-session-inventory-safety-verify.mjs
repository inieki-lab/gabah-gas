import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('./legacy-session-inventory.mjs', import.meta.url), 'utf8');

assert.match(source, /GABAH_APP_MODE/);
assert.match(source, /\['test', 'uat'\]\.includes\(appMode\)/);
assert.match(source, /READ_ONLY_REHEARSAL_ONLY/);
assert.match(source, /GABAH_LEGACY_SESSION_AUDIT_DATABASE/);
assert.match(source, /BEGIN READ ONLY/);
assert.match(source, /current_database\(\)/);
assert.match(source, /transaction_read_only/);
assert.match(source, /ROLLBACK/);
assert.match(source, /tokenValuesRead: false/);
assert.match(source, /mutationPerformed: false/);

// Inventory may return aggregates only. It must not select token, IP, user-agent,
// or session identifiers, and it must contain no mutation statements.
assert.doesNotMatch(source, /SELECT[^;]*(?:\btoken\b|ip_address|user_agent|session_id)/is);
assert.doesNotMatch(source, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|DROP|ALTER)\s+(?:INTO\s+|FROM\s+|TABLE\s+)?(?:public\.)?user_sessions\b/i);

console.log('PASS | legacy session inventory requires isolated UAT/test and exact DB confirmation');
console.log('PASS | inventory runs read-only and reports aggregate metadata only');
console.log('PASS | token, IP, user-agent, and session identifiers are never selected');
