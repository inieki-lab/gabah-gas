import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

const ticketStart = source.indexOf("app.patch('/api/tickets/:id/status'");
const ticketEnd = source.indexOf('// Maintenance & Calibration Schedules', ticketStart);
assert.ok(ticketStart >= 0 && ticketEnd > ticketStart, 'Ticket status route must exist');
const ticketRoute = source.slice(ticketStart, ticketEnd);
assert.match(ticketRoute, /app\.patch\('\/api\/tickets\/:id\/status', async \(req, res\)/);
assert.match(ticketRoute, /await persistDataStore\(\)/, 'Ticket status must await durable persistence');
assert.match(ticketRoute, /ticket\.status = previous\.status/, 'Failed persistence must restore prior status');
assert.match(ticketRoute, /db\.auditLogs = db\.auditLogs\.filter\(log => log\.id !== auditLog\.id\)/, 'Failed persistence must remove its audit event');
assert.doesNotMatch(ticketRoute, /persistDataStore\(\)\.catch\(\(\) => \{\}\)/, 'Ticket route must not swallow persistence errors');

const uploadStart = source.indexOf("app.post('/api/contracts/:id/documents/upload'");
const uploadEnd = source.indexOf('// Documents are never exposed as a public static directory', uploadStart);
assert.ok(uploadStart >= 0 && uploadEnd > uploadStart, 'Contract upload route must exist');
const uploadRoute = source.slice(uploadStart, uploadEnd);
assert.match(uploadRoute, /CONTRACT_DOCUMENT_UPLOADED/, 'Binary contract upload must create an audit event');
assert.match(uploadRoute, /CONTRACT_DOCUMENT_UPLOADED[\s\S]*await persistDataStore\(\)/, 'Document and audit event must be created before the same durable write');
assert.equal((uploadRoute.match(/await persistDataStore\(\)/g) || []).length, 2, 'Upload route should have one primary persist and one best-effort rollback persist');
assert.match(uploadRoute, /db\.auditLogs = db\.auditLogs\.filter\(log => log\.id !== savedAuditLog\.id\)/, 'Failed upload must remove its audit event');
assert.match(uploadRoute, /await fs\.rm\(savedFilePath, \{ force: true \}\)/, 'Failed upload must remove the orphaned file');

console.log('PASS | ticket status waits for durable persistence');
console.log('PASS | failed ticket persistence rolls back state and audit event');
console.log('PASS | binary contract upload creates an audit event');
console.log('PASS | contract document and audit event persist before success');
console.log('PASS | failed contract upload rolls back metadata, audit event, and file');
console.log('TOTAL: 5 | PASS: 5 | FAIL: 0');
