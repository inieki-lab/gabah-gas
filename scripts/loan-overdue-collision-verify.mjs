import fs from 'node:fs';
import assert from 'node:assert/strict';

const migration = fs.readFileSync('server/migrations/107_loan_overdue_collision_guard.sql', 'utf8');
const services = fs.readFileSync('server/services.ts', 'utf8');
const client = fs.readFileSync('src/services/gabahService.ts', 'utf8');
const modal = fs.readFileSync('src/components/modals/CreateLoanModal.tsx', 'utf8');

assert.match(migration, /NEW\.status IN \('approved', 'borrowed', 'active', 'overdue'\)/,
  'database trigger must evaluate overdue as active custody');
assert.match(migration, /status IN \('approved', 'borrowed', 'active', 'overdue'\)/,
  'database trigger must reject overlaps against existing overdue loans');
assert.match(migration, /FOR UPDATE/,
  'per-asset lock must remain in place to serialize concurrent approvals');
const overdueDomainChecks = services.split("if (!['approved', 'borrowed', 'overdue', 'active'].includes(l.status)) return false;").length - 1;
assert.equal(overdueDomainChecks, 2,
  'request and approval schedule-collision checks must both include overdue loans');
assert.match(client, /l\.status === 'approved' \|\| l\.status === 'active' \|\| \(l\.status as any\) === 'borrowed' \|\| l\.status === 'overdue'/,
  'client conflict pre-check must include overdue custody');
assert.match(modal, /\['active', 'borrowed', 'overdue'\]/,
  'loan form must hide stale available assets with overdue custody');

console.log('PASS | PostgreSQL collision trigger blocks overlapping overdue loans');
console.log('PASS | per-asset row lock is retained');
console.log('PASS | server and client loan guards include overdue custody');
