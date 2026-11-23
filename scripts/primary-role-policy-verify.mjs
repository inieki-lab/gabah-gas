import fs from 'node:fs';
import assert from 'node:assert/strict';

const server = fs.readFileSync('server.ts', 'utf8');
const modal = fs.readFileSync('src/components/modals/AdministrationModal.tsx', 'utf8');
const service = fs.readFileSync('src/services/gabahService.ts', 'utf8');
const navigation = fs.readFileSync('src/navigation/roleNavigation.ts', 'utf8');
const header = fs.readFileSync('src/components/HeaderNavbar.tsx', 'utf8');

function routeBody(route, nextRoutes = []) {
  const start = server.indexOf(route);
  assert.ok(start >= 0, `Route exists: ${route}`);
  const boundaries = nextRoutes.map(candidate => server.indexOf(candidate, start + route.length)).filter(index => index >= 0);
  return server.slice(start, boundaries.length ? Math.min(...boundaries) : server.length);
}

const create = routeBody("app.post('/api/users'", ["app.get('/api/users'", "app.post('/api/users/bulk-import'", "app.patch('/api/users/:id'", "app.delete('/api/users/:id'"]);
const bulk = routeBody("app.post('/api/users/bulk-import'", ["app.patch('/api/users/:id'", "app.delete('/api/users/:id'"]);
const patch = routeBody("app.patch('/api/users/:id'", ["app.delete('/api/users/:id'"]);

const applicationRoleStart = server.indexOf('const hasApplicationRole');
const applicationRoleEnd = server.indexOf('// Permission guard for migrated endpoints', applicationRoleStart);
assert.ok(applicationRoleStart >= 0 && applicationRoleEnd > applicationRoleStart, 'Dynamic RBAC role resolver exists');
const applicationRole = server.slice(applicationRoleStart, applicationRoleEnd);
assert.match(applicationRole, /if \(isPostgresPersistenceActive\(\)\)\s*\{\s*return getEffectiveRoleKeys\(String\(actor\.id\)\)\.includes\(roleKey\);/);
assert.match(applicationRole, /return actor\.role === legacyLabels\[roleKey\];/);

assert.match(create, /validPrimaryRoles = \['Admin GABAH', 'Karyawan'\]/);
assert.match(patch, /validRoles = \['Admin GABAH', 'Superadmin', 'Karyawan'\]/);
assert.match(bulk, /validRoles = \['Admin GABAH', 'Superadmin', 'Karyawan', 'IT', 'GA', 'Auditor', 'Humas', 'Sekretaris Direksi', 'Supply Chain', 'SC', 'PIBC'\]/);
assert.match(bulk, /const role = \['Admin GABAH', 'Superadmin'\]\.includes\(requestedRole\) \? 'Admin GABAH' : 'Karyawan'/);
assert.match(bulk, /Tetapkan role fungsi melalui Administrasi > Role & Hak Akses setelah impor/);
assert.match(bulk, /const inferredOfficeLocation = \['Supply Chain', 'SC'\]\.includes\(roleRaw\) \? 'OFF-RPC' : roleRaw === 'PIBC' \? 'OFF-PIBC'/);

const roleCatalogue = modal.slice(modal.indexOf('export const SYSTEM_ROLES'), modal.indexOf('// T2B-3'));
assert.match(roleCatalogue, /value: 'Admin GABAH'[\s\S]*value: 'Karyawan'/);
assert.doesNotMatch(roleCatalogue, /value: '(IT|GA|Auditor|Humas|Sekretaris Direksi|Supply Chain|PIBC)'/);
assert.match(modal, /export const PRIMARY_PROFILE_ROLES = SYSTEM_ROLES/);
assert.match(modal, /const DEFAULT_PERMISSIONS: RolePermissionRow\[\] = \[\]/);
assert.match(modal, /Matriks role statis telah dihentikan/);

const createFormStart = modal.indexOf('{/* Add User Form Modal */}');
const createFormEnd = modal.indexOf('{/* Edit User Modal */}', createFormStart);
assert.ok(createFormStart >= 0 && createFormEnd > createFormStart, 'User creation form boundaries exist');
const createForm = modal.slice(createFormStart, createFormEnd);
assert.match(createForm, /Profil dasar akun/);
assert.match(createForm, /Hak akses pekerjaan tidak ditentukan dari jabatan, divisi, atau lokasi/);
assert.doesNotMatch(createForm, /PRIMARY_PROFILE_ROLES\.map/);
assert.match(modal, /await refreshUserAssignments\(\);\s*setRoleAssignmentDraft\(\[\]\);\s*setRoleAssignmentTarget\(created\)/);
assert.match(modal, /const checked = isPrimary \|\| roleAssignmentDraft\.includes\(roleId\)/);
assert.match(modal, /PRIMARY_PROFILE_ROLES\.map/);
assert.match(modal, /job_level_code/);
assert.match(modal, /unit_id/);
assert.match(modal, /office_location_id/);
assert.match(service, /'Kode Jabatan', 'ID Unit', 'ID Lokasi Kantor'/);

assert.doesNotMatch(navigation, /ROLE_NAVIGATION|nine-role|9 roles/i);
assert.doesNotMatch(header, /9 Peran|Role Simulation|Switch Role & Persona|onSwitchRoleSimulation/);
assert.doesNotMatch(server, /const validPrimaryRoles = \['Admin GABAH', 'IT', 'GA'/);

const normalizationMigration = fs.readFileSync('server/migrations/048_dynamic_employee_profile_normalization.sql', 'utf8');
assert.match(normalizationMigration, /role = 'Karyawan'/);
assert.match(normalizationMigration, /role_key IN \('supply_chain', 'pibc'\)/);
assert.match(normalizationMigration, /role_key = CASE[\s\S]*'superadmin'[\s\S]*'karyawan'/);

console.log('Canonical employee profile policy: two primary profiles and Dynamic RBAC capabilities passed');
