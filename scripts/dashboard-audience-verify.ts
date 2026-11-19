import assert from 'node:assert/strict';
import { isEmployeeFacingDashboardRole } from '../src/dashboard/dashboardAudience';

for (const role of ['Karyawan', 'Supply Chain', 'PIBC', 'Humas', 'Sekretaris Direksi']) {
  assert.equal(isEmployeeFacingDashboardRole(role), true, role + ' should receive the employee-facing dashboard');
}
for (const role of ['IT', 'GA', 'Auditor', 'Admin GABAH', 'Unknown']) {
  assert.equal(isEmployeeFacingDashboardRole(role), false, role + ' should not be classified as employee-facing');
}
assert.equal(isEmployeeFacingDashboardRole('Unknown', ['humas']), true);
assert.equal(isEmployeeFacingDashboardRole('Unknown', ['sekretaris_direksi']), true);
console.log('Dashboard audience classification: PASS');
