import fs from 'node:fs';
import assert from 'node:assert/strict';
import { isActiveLoanStatus, isPendingLoanStatus } from '../src/utils/dashboardLoanStatus.ts';

const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const dashboard = fs.readFileSync(new URL('../src/components/views/DashboardView.tsx', import.meta.url), 'utf8');

for (const status of ['pending', 'pending_approval']) {
  assert.equal(isPendingLoanStatus(status), true, `${status} must count as awaiting approval`);
}
for (const status of ['approved', 'borrowed', 'overdue', 'active']) {
  assert.equal(isActiveLoanStatus(status), true, `${status} must count as an active reservation/custody state`);
}
for (const status of ['rejected', 'returned', 'closed', 'cancelled', '']) {
  assert.equal(isPendingLoanStatus(status), false, `${status} must not count as pending`);
  assert.equal(isActiveLoanStatus(status), false, `${status} must not count as active`);
}

assert.match(app, /loans\.filter\(l => isPendingLoanStatus\(l\.status\)\)/,
  'sidebar pending-loan badge must use the same backend lifecycle classification');
assert.match(dashboard, /pendingLoans = dashboardLoans\.filter\(l => isPendingLoanStatus\(l\.status\)\)/);
assert.match(dashboard, /activeLoans = dashboardLoans\.filter\(l => isActiveLoanStatus\(l\.status\)\)/);
assert.doesNotMatch(dashboard, /loan\.status === 'pending'/,
  'dashboard loan status badges must not assume the legacy pending state');

console.log('PASS | pending_approval and legacy pending are counted as awaiting approval');
console.log('PASS | approved, borrowed, overdue, and legacy active are counted as active');
console.log('PASS | sidebar and dashboard share the backend lifecycle status classification');
console.log('PASS | rejected, returned, closed, and cancelled loans are excluded');
