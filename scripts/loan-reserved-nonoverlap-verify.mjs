import fs from 'node:fs';
import assert from 'node:assert/strict';

const services = fs.readFileSync('server/services.ts', 'utf8');
const migration = fs.readFileSync('server/migrations/107_loan_overdue_collision_guard.sql', 'utf8');

const requestStart = services.indexOf('static requestLoan(');
const approveStart = services.indexOf('static approveLoan(', requestStart);
const rejectStart = services.indexOf('static rejectLoan(', approveStart);
assert.ok(requestStart >= 0 && approveStart > requestStart && rejectStart > approveStart,
  'loan request and approval service methods must remain discoverable');
const request = services.slice(requestStart, approveStart);
const approve = services.slice(approveStart, rejectStart);

assert.match(request, /!\['available', 'reserved'\]\.includes\(String\(asset\.status\)\)/,
  'request may use an available asset or one reserved for a different future window');
assert.match(approve, /!\['available', 'reserved'\]\.includes\(String\(asset\.status\)\)/,
  'approval may use a reserved asset only after schedule and custody checks');
assert.match(request, /outstandingBorrowedLoan[\s\S]*?\['active', 'borrowed', 'overdue'\]/,
  'active physical custody must still block a new request regardless of stale inventory status');
assert.match(approve, /outstandingBorrowedLoan[\s\S]*?\['active', 'borrowed', 'overdue'\]/,
  'active physical custody must still block approval');
assert.match(request, /\['approved', 'borrowed', 'overdue', 'active'\]/,
  'request must reject an overlapping confirmed or active schedule');
assert.match(approve, /\['approved', 'borrowed', 'overdue', 'active'\]/,
  'approval must reject an overlapping confirmed or active schedule');
assert.match(approve, /asset\.status = 'reserved'/,
  'approval must continue marking the asset as reserved');
const returnStart = services.indexOf('static returnLoan(');
const ticketStart = services.indexOf('static createTicket(', returnStart);
assert.ok(returnStart >= 0 && ticketStart > returnStart, 'loan return method must remain discoverable');
const returnMethod = services.slice(returnStart, ticketStart);
assert.match(returnMethod, /hasAnotherApprovedReservation[\s\S]*?existing\.status === 'approved'/,
  'return must preserve reserved status when another approved future reservation exists');
assert.match(returnMethod, /hasAnotherApprovedReservation \? 'reserved' : 'available'/,
  'a healthy return must restore reserved status for a later approved reservation, otherwise available');
assert.match(migration, /PERFORM id FROM assets WHERE id = NEW\.asset_id FOR UPDATE/,
  'database must retain per-asset serialization');
assert.match(migration, /NEW\.start_date < due_date[\s\S]*?NEW\.due_date > start_date/,
  'database collision guard must remain date-range based');

console.log('PASS | non-overlapping future reservations may reuse an asset marked reserved');
console.log('PASS | active/borrowed/overdue custody remains an unconditional blocker');
console.log('PASS | overlapping approved schedules remain rejected by service and database');
console.log('PASS | per-asset database lock remains in place');
console.log('PASS | returning one loan preserves other approved reservations');
