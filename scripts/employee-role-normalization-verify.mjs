import fs from 'node:fs';
import assert from 'node:assert/strict';

const persistence = fs.readFileSync('server/persistence.ts', 'utf8');
const dashboard = fs.readFileSync('src/components/views/DashboardView.tsx', 'utf8');
const header = fs.readFileSync('src/components/HeaderNavbar.tsx', 'utf8');
const dynamic = fs.readFileSync('scripts/dynamic-rbac-foundation-verify.mjs', 'utf8');

assert.match(persistence, /function collectLegacyEmployeeCapabilityAssignments/);
assert.match(persistence, /function normalizeLegacyEmployeeProfileRoles/);
assert.match(persistence, /await backfillNormalizedTables\(\);\s*const legacyCapabilities = collectLegacyEmployeeCapabilityAssignments\(\);\s*await ensureEmployeeCapabilityAssignments\(legacyCapabilities\);\s*normalizeLegacyEmployeeProfileRoles\(\);/);
assert.match(persistence, /INSERT INTO gabah_user_roles \(user_id, role_id, is_primary, assigned_by_user_id\) VALUES \(\$1, \$2, FALSE, NULL\)/);
assert.match(persistence, /IT: 'it'[\\s\\S]*GA: 'ga'[\\s\\S]*Auditor: 'auditor'[\\s\\S]*Humas: 'humas'[\\s\\S]*'Sekretaris Direksi': 'sekretaris_direksi'/);\nassert.match(persistence, /WHEN 'Admin GABAH' THEN 'superadmin' ELSE 'karyawan' END/);\nassert.match(persistence, /user\\.role = 'Karyawan'/);
assert.match(persistence, /user\.office_location_id = 'OFF-RPC'/);
assert.match(persistence, /user\.office_location_id = 'OFF-PIBC'/);
assert.match(dashboard, /hasEffectivePermission\('room_reservations\.documentation\.read', \['Humas'\]\)/);
assert.match(dashboard, /hasEffectivePermission\('room_reservations\.override_priority', \['Sekretaris Direksi'\]\)/);
assert.match(header, /currentUser\.role_keys\?\.includes\('humas'\)/);
assert.match(dashboard, /const isEmployee = !isAuditor && !hasOperationalManagementAccess/);
assert.match(dashboard, /roleDescriptions\[currentUser\.role\] \|\| roleDescriptions\.Karyawan/);
assert.match(dynamic, /Legacy function roles are assigned after normalized user rows exist/);
console.log('Employee role normalization: 13 checks passed');
