import fs from 'node:fs';
import assert from 'node:assert/strict';

const persistence = fs.readFileSync('server/persistence.ts', 'utf8');
const dashboard = fs.readFileSync('src/components/views/DashboardView.tsx', 'utf8');
const dynamic = fs.readFileSync('scripts/dynamic-rbac-foundation-verify.mjs', 'utf8');

assert.match(persistence, /function collectLegacyEmployeeCapabilityAssignments/);
assert.match(persistence, /function normalizeLegacyEmployeeProfileRoles/);
assert.match(persistence, /await backfillNormalizedTables\(\);\s*const legacyCapabilities = collectLegacyEmployeeCapabilityAssignments\(\);\s*await ensureEmployeeCapabilityAssignments\(legacyCapabilities\);\s*normalizeLegacyEmployeeProfileRoles\(\);/);
assert.match(persistence, /INSERT INTO gabah_user_roles \(user_id, role_id, is_primary, assigned_by_user_id\) VALUES \(\$1, \$2, FALSE, NULL\)/);
assert.match(persistence, /WHEN 'Sekretaris Direksi' THEN 'karyawan' WHEN 'Humas' THEN 'karyawan'/);
assert.match(persistence, /user\.office_location_id = 'OFF-RPC'/);
assert.match(persistence, /user\.office_location_id = 'OFF-PIBC'/);
assert.match(dashboard, /currentRoleKeys\.includes\('humas'\)/);
assert.match(dashboard, /currentRoleKeys\.includes\('sekretaris_direksi'\)/);
assert.match(dashboard, /const isStaff = currentUser\?\.role === 'Karyawan' \|\| isHumas \|\| isSekdir/);
assert.match(dynamic, /Legacy function roles are assigned after normalized user rows exist/);
console.log('Employee role normalization: 11 checks passed');
