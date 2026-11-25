import assert from 'node:assert/strict';
import { isActiveLoanStatus, isPendingLoanStatus } from '../src/utils/dashboardLoanStatus.ts';

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

console.log('PASS | pending_approval and legacy pending are counted as awaiting approval');
console.log('PASS | approved, borrowed, overdue, and legacy active are counted as active');
console.log('PASS | rejected, returned, closed, and cancelled loans are excluded');
