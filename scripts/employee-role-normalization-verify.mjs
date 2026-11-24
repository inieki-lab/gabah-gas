import fs from 'node:fs';
import assert from 'node:assert/strict';

const persistence = fs.readFileSync('server/persistence.ts', 'utf8');
const dashboard = fs.readFileSync('src/components/views/DashboardView.tsx', 'utf8');
const header = fs.readFileSync('src/components/HeaderNavbar.tsx', 'utf8');
const dynamic = fs.readFileSync('scripts/dynamic-rbac-foundation-verify.mjs', 'utf8');
const migration = fs.readFileSync('server/migrations/048_dynamic_employee_profile_normalization.sql', 'utf8');

assert.ok(persistence.includes('function collectLegacyEmployeeCapabilityAssignments'));
assert.ok(persistence.includes('if (!Array.isArray(existingUser.role_keys) && Array.isArray(cu.role_keys))'));
assert.ok(persistence.includes('existingUser.role_keys = [...cu.role_keys]'));
assert.ok(persistence.includes('an explicit empty array remains an intentional revocation') || persistence.includes('explicit empty array remains an intentional revocation'));
assert.ok(persistence.includes('function normalizeLegacyEmployeeProfileRoles'));
assert.match(persistence, /await backfillNormalizedTables\(\);\s*const legacyCapabilities = collectLegacyEmployeeCapabilityAssignments\(\);\s*await ensureEmployeeCapabilityAssignments\(legacyCapabilities\);\s*normalizeLegacyEmployeeProfileRoles\(\);/);
assert.ok(persistence.includes('INSERT INTO gabah_user_roles (user_id, role_id, is_primary, assigned_by_user_id) VALUES ($1, $2, FALSE, NULL)'));
assert.ok(['IT: \'it\'', 'GA: \'ga\'', 'Auditor: \'auditor\'', 'Humas: \'humas\'', '\'Sekretaris Direksi\': \'sekretaris_direksi\''].every(value => persistence.includes(value)));
assert.ok(persistence.includes("WHEN 'Admin GABAH' THEN 'superadmin' ELSE 'karyawan' END"));
assert.ok(persistence.includes("user.role = 'Karyawan'"));
assert.ok(persistence.includes("user.office_location_id = 'OFF-RPC'"));
assert.ok(persistence.includes("user.office_location_id = 'OFF-PIBC'"));
assert.match(persistence, /INSERT INTO users \([\s\S]*job_level_code,unit_id,office_location_id/);
assert.match(persistence, /office_location_id=CASE WHEN \$16::boolean THEN EXCLUDED\.office_location_id ELSE users\.office_location_id END/);
assert.match(persistence, /unit_id=CASE WHEN \$15::boolean THEN EXCLUDED\.unit_id ELSE users\.unit_id END/);
assert.ok(migration.includes("SET role = 'Karyawan'"));
assert.ok(dashboard.includes("hasEffectivePermission('room_reservations.documentation.read', ['Humas'])"));
assert.ok(dashboard.includes("hasEffectivePermission('room_reservations.override_priority', ['Sekretaris Direksi'])"));
assert.ok(header.includes("currentUser.role_keys?.includes('humas')"));
assert.ok(dashboard.includes('const isEmployee = !isAuditor && !hasOperationalManagementAccess'));
assert.ok(dashboard.includes('const employeeDescription ='));
assert.ok(dashboard.includes('const roleDescription = isAuditor'));
assert.ok(!dashboard.includes('roleDescriptions'));
assert.ok(dynamic.includes('Legacy function roles are assigned after normalized user rows exist'));

console.log('Employee role normalization: all source contracts passed');
