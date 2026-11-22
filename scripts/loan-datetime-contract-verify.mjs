import assert from 'node:assert/strict';
import fs from 'node:fs';

const service = fs.readFileSync('server/services.ts', 'utf8');
const modal = fs.readFileSync('src/components/modals/CreateLoanModal.tsx', 'utf8');
const dateParser = fs.readFileSync('shared/loan-datetime.ts', 'utf8');
const roomView = fs.readFileSync('src/components/views/MeetingRoomsView.tsx', 'utf8');

assert.match(service, /parseLoanDateTimestamp/, 'Backend uses the shared loan datetime parser');
assert.match(service, /return \{ text, timestamp: parseLoanDateTimestamp\(text\) \}/, 'Backend delegates schedule parsing to the shared helper');
assert.match(dateParser, /const dateTime = \/\^\\\\d\{4\}/, 'Shared parser validates datetime-local hour/minute');
assert.match(dateParser, /const dateOnly = \/\^\\\\d\{4\}/, 'Shared parser preserves legacy date-only values');
assert.match(service, /existingStart = parseLoanDateTimestamp\(l\.start_date\)/, 'Request collision check uses the shared timezone parser');
assert.match(service, /start = parseLoanDateTimestamp\(loan\.start_date\)/, 'Approval collision check uses the shared timezone parser');
assert.match(service, /start >= due/, 'Backend rejects non-increasing loan schedules');
assert.match(service, /Tabrakan Jadwal![\s\S]*?statusCode: 409/, 'Overlapping approved/borrowed asset schedules are HTTP 409 conflicts');
assert.match(service, /Tidak dapat disetujui: Tabrakan jadwal[\s\S]*?statusCode: 409/, 'Approval-time overlapping schedules are also HTTP 409 conflicts');
assert.match(service, /if \(!asset\.is_loanable\)[\s\S]*?statusCode: 409/, 'Assets outside the loan pool are rejected as HTTP 409 conflicts');

assert.match(modal, /type="datetime-local"/, 'Loan form uses datetime-local controls');
assert.match(modal, /tomorrow\.getFullYear\(\)/, 'Loan form default uses local calendar date rather than UTC date');
assert.match(roomView, /min-w-\[1500px\].*text-sm/, 'Meeting room reservation table has a wider readable layout');
assert.doesNotMatch(roomView, /font-bold text-slate-900 truncate" title=\{r\.title\}/, 'Meeting agenda title is not forcibly truncated');
console.log('PASS | loan datetime-local contract and wider meeting reservation table');
