import assert from 'node:assert/strict';
import fs from 'node:fs';

const service = fs.readFileSync('server/services.ts', 'utf8');
const modal = fs.readFileSync('src/components/modals/CreateLoanModal.tsx', 'utf8');
const roomView = fs.readFileSync('src/components/views/MeetingRoomsView.tsx', 'utf8');

assert.match(service, /datetime-local (YYYY-MM-DDTHH:mm)/, 'Backend documents and accepts datetime-local loan input');
assert.ok(service.includes("const dateTime = /^(\\d{4})-(\\d{2})-(\\d{2})T"), 'Backend validates datetime-local hour/minute');
assert.ok(service.includes("const dateOnly = /^(\\d{4})-(\\d{2})-(\\d{2})$"), 'Backend remains compatible with legacy date-only values');
assert.match(service, /start >= due/, 'Backend rejects non-increasing loan schedules');
assert.match(service, /Tabrakan Jadwal![\\s\\S]*?statusCode: 409/, 'Overlapping approved/borrowed asset schedules are HTTP 409 conflicts');
assert.match(service, /if \\(!asset\\.is_loanable\\)[\\s\\S]*?statusCode: 409/, 'Assets outside the loan pool are rejected as HTTP 409 conflicts');

assert.match(modal, /type="datetime-local"/, 'Loan form uses datetime-local controls');
assert.match(modal, /tomorrow\\.getFullYear\\(\\)/, 'Loan form default uses local calendar date rather than UTC date');
assert.match(roomView, /min-w-\\[1500px\\].*text-sm/, 'Meeting room reservation table has a wider readable layout');
assert.doesNotMatch(roomView, /font-bold text-slate-900 truncate" title=\\{r\\.title\\}/, 'Meeting agenda title is not forcibly truncated');
console.log('PASS | loan datetime-local contract and wider meeting reservation table');
