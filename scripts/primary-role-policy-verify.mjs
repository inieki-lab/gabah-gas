import fs from 'node:fs';
import assert from 'node:assert/strict';

const server = fs.readFileSync('server.ts', 'utf8');
const modal = fs.readFileSync('src/components/modals/AdministrationModal.tsx', 'utf8');
const service = fs.readFileSync('src/services/gabahService.ts', 'utf8');
const navigation = fs.readFileSync('src/navigation/roleNavigation.ts', 'utf8');
const header = fs.readFileSync('src/components/HeaderNavbar.tsx', 'utf8');
const persistence = fs.readFileSync('server/persistence.ts', 'utf8');
const migration = fs.readFileSync('server/migrations/048_dynamic_employee_profile_normalization.sql', 'utf8');

function routeBody(route, nextRoutes = []) {
  const start = server.indexOf(route);
  assert.ok(start >= 0, 'Route exists: ' + route);
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
assert.ok(applicationRole.includes('return getEffectiveRoleKeys(String(actor.id)).includes(roleKey);'));
assert.ok(applicationRole.includes('return actor.role === legacyLabels[roleKey]'));
assert.ok(applicationRole.includes('actor.role_keys?.includes(roleKey) === true'));
assert.ok(applicationRole.includes("me: ['admin_tiket_me']"));
assert.ok(applicationRole.includes('(secondaryRoleAliases[roleKey] || []).some(alias => actor.role_keys?.includes(alias) === true)'));

assert.ok(create.includes("const validPrimaryRoles = ['Admin GABAH', 'Karyawan'];"));
assert.ok(patch.includes("const validRoles = ['Admin GABAH', 'Superadmin', 'Karyawan'];"));
assert.ok(bulk.includes("const validRoles = ['Admin GABAH', 'Superadmin', 'Karyawan', 'PIBC', 'Supply Chain', 'SC'];"));
assert.ok(bulk.includes('Role primer "${roleRaw}" adalah role tambahan, bukan profil utama. Gunakan role profil utama yang valid.'));
assert.ok(bulk.includes("const role = ['Admin GABAH', 'Superadmin'].includes(requestedRole) ? 'Admin GABAH' : 'Karyawan';"));
assert.ok(bulk.includes('Tetapkan role fungsi melalui Administrasi > Role & Hak Akses setelah impor'));
assert.ok(bulk.includes("const inferredOfficeLocation = ['Supply Chain', 'SC'].includes(roleRaw) ? 'OFF-RPC' : roleRaw === 'PIBC' ? 'OFF-PIBC' : '';"));

const roleCatalogue = modal.slice(modal.indexOf('export const SYSTEM_ROLES'), modal.indexOf('// T2B-3'));
assert.ok(roleCatalogue.includes("value: 'Admin GABAH'") && roleCatalogue.includes("value: 'Karyawan'"));
assert.doesNotMatch(roleCatalogue, /value: '(IT|GA|Auditor|Humas|Sekretaris Direksi|Supply Chain|PIBC)'/);
assert.ok(modal.includes('export const PRIMARY_PROFILE_ROLES = SYSTEM_ROLES;'));
assert.ok(modal.includes('const DEFAULT_PERMISSIONS: RolePermissionRow[] = [];'));
assert.ok(modal.includes('Matriks role statis telah dihentikan'));
const defaultDivisionStart = modal.indexOf('const DEFAULT_DIVISIONS: OrgDivision[] = [');
const defaultDivisionEnd = modal.indexOf('];', defaultDivisionStart);
assert.ok(defaultDivisionStart >= 0 && defaultDivisionEnd > defaultDivisionStart, 'fallback division master exists');
const defaultDivisions = modal.slice(defaultDivisionStart, defaultDivisionEnd);
assert.doesNotMatch(defaultDivisions, /code: '(SC|PIBC)'|Supply Chain|Pasar Induk Beras Cipinang/,
  'RPC/SC and PIBC must not be seeded as organization divisions');
const legacyPermissionFieldsStart = modal.indexOf('const PERMISSION_TEMPLATE_FIELDS:');
const legacyPermissionFieldsEnd = modal.indexOf('};', legacyPermissionFieldsStart);
assert.ok(legacyPermissionFieldsStart >= 0 && legacyPermissionFieldsEnd > legacyPermissionFieldsStart);
const legacyPermissionFields = modal.slice(legacyPermissionFieldsStart, legacyPermissionFieldsEnd);
assert.doesNotMatch(legacyPermissionFields, /Divisi SC|Divisi PIBC|Truk\/SC|Approve Pasar|View SC/,
  'retired static permission matrix must not reintroduce location-based authorization options');

const createFormStart = modal.indexOf('{/* Add User Form Modal */}');
const createFormEnd = modal.indexOf('{/* Edit User Modal */}', createFormStart);
assert.ok(createFormStart >= 0 && createFormEnd > createFormStart, 'User creation form boundaries exist');
const createForm = modal.slice(createFormStart, createFormEnd);
assert.ok(createForm.includes('Profil dasar akun'));
assert.ok(createForm.includes('Hak akses pekerjaan tidak ditentukan dari jabatan, divisi, atau lokasi'));
assert.ok(!createForm.includes('PRIMARY_PROFILE_ROLES.map'));
assert.ok(modal.includes('await refreshUserAssignments();'));
assert.ok(modal.includes('setRoleAssignmentDraft([]);'));
assert.ok(modal.includes('setRoleAssignmentTarget(created)'));
assert.ok(modal.includes('const checked = isPrimary || roleAssignmentDraft.includes(roleId)'));
assert.ok(modal.includes('PRIMARY_PROFILE_ROLES.map'));
assert.ok(modal.includes('job_level_code'));
assert.ok(modal.includes('unit_id'));
assert.ok(modal.includes('office_location_id'));
assert.ok(service.includes("'Kode Jabatan', 'ID Unit', 'ID Lokasi Kantor'"));

assert.doesNotMatch(navigation, /ROLE_NAVIGATION|nine-role|9 roles/i);
assert.doesNotMatch(header, /9 Peran|Role Simulation|Switch Role & Persona|onSwitchRoleSimulation/);
assert.doesNotMatch(server, /const validPrimaryRoles = \['Admin GABAH', 'IT', 'GA'/);

assert.ok(migration.includes("SET role = 'Karyawan'"));
assert.ok(migration.includes("role_key IN ('supply_chain', 'pibc')"));
assert.ok(migration.includes("WHEN u.role = 'Admin GABAH' THEN 'superadmin'"));
assert.ok(persistence.includes("WHEN 'Admin GABAH' THEN 'superadmin' ELSE 'karyawan' END"));

console.log('Canonical employee profile policy: two primary profiles and Dynamic RBAC capabilities passed');
