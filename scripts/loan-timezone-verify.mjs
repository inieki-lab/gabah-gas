import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseLoanDateTimestamp } from '../shared/loan-datetime.ts';

const existingStart = parseLoanDateTimestamp('2026-11-23T09:00');
const existingDue = parseLoanDateTimestamp('2026-11-23T10:00');
const overlappingStart = parseLoanDateTimestamp('2026-11-23T09:30');
const adjacentStart = parseLoanDateTimestamp('2026-11-23T10:00');

assert.equal(existingStart, Date.UTC(2026, 10, 23, 2, 0), '09:00 WIB must resolve to 02:00 UTC');
assert.equal(existingDue, Date.UTC(2026, 10, 23, 3, 0), '10:00 WIB must resolve to 03:00 UTC');
assert.ok(overlappingStart < existingDue && parseLoanDateTimestamp('2026-11-23T09:45') > existingStart, 'overlapping WIB schedule must overlap');
assert.ok(!(adjacentStart < existingDue && parseLoanDateTimestamp('2026-11-23T11:00') > existingStart), 'back-to-back WIB schedule must not overlap');
assert.equal(parseLoanDateTimestamp('2026-11-23'), Date.UTC(2026, 10, 22, 17, 0), 'legacy date-only means midnight WIB');
assert.ok(Number.isNaN(parseLoanDateTimestamp('2026-02-30T09:00')), 'invalid calendar dates must be rejected');
assert.ok(Number.isNaN(parseLoanDateTimestamp('2026-11-23T25:00')), 'invalid wall-clock times must be rejected');
assert.equal(parseLoanDateTimestamp('2026-11-23T02:00:00.000Z'), Date.UTC(2026, 10, 23, 2, 0), 'explicit UTC instants must remain absolute');

const server = fs.readFileSync('server/services.ts', 'utf8');
const client = fs.readFileSync('src/services/gabahService.ts', 'utf8');
assert.ok(server.includes("import { parseLoanDateTimestamp } from '../shared/loan-datetime'"), 'server must use shared timezone parser');
assert.ok(client.includes("import { parseLoanDateTimestamp } from '../../shared/loan-datetime'"), 'client must use shared timezone parser');
assert.ok(!server.includes('new Date(l.start_date).getTime()'), 'server collision checks must not parse naive dates as UTC');
assert.ok(!server.includes('new Date(loan.start_date).getTime()'), 'server approval collision check must use same timezone semantics');
assert.ok(!client.includes('new Date(loan.start_date).getTime()'), 'client conflict check must use same timezone semantics');

console.log('PASS | Loan schedules use Asia/Jakarta wall-clock semantics consistently');
console.log('PASS | WIB overlap and adjacent-boundary checks');
console.log('PASS | Legacy date-only and explicit ISO compatibility');
console.log('PASS | Invalid date/time rejection and shared client/server parser');
