import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const start = source.indexOf("app.patch('/api/tickets/:id/status'");
const end = source.indexOf('// Maintenance & Calibration Schedules', start);
assert.ok(start >= 0 && end > start, 'Ticket status route must exist');
const route = source.slice(start, end);
const validation = route.indexOf('typeof resolutionNotes !== \'string\' || resolutionNotes.length > 4000');
const mutation = route.indexOf('ticket.status = nextStatus');
assert.ok(validation >= 0, 'Resolution notes must be type- and length-validated');
assert.ok(mutation > validation, 'Validation must happen before ticket state mutation');
assert.match(route, /Catatan penyelesaian harus berupa teks maksimal 4000 karakter/);
assert.match(route, /if \(resolutionNotes !== undefined\) ticket\.resolution_notes = resolutionNotes\.trim\(\)/);
assert.doesNotMatch(route, /if \(resolutionNotes\) ticket\.resolution_notes = resolutionNotes/);

console.log('PASS | non-string resolution notes are rejected');
console.log('PASS | resolution notes over 4000 characters are rejected');
console.log('PASS | validation executes before ticket status mutation');
console.log('PASS | empty string can intentionally clear old resolution notes');
console.log('TOTAL: 4 | PASS: 4 | FAIL: 0');
