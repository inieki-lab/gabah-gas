import fs from 'node:fs';
import assert from 'node:assert/strict';

const server = fs.readFileSync('server.ts', 'utf8');
const modal = fs.readFileSync('src/components/modals/AdministrationModal.tsx', 'utf8');
const service = fs.readFileSync('src/services/gabahService.ts', 'utf8');

function routeBody(route, nextRoutes = []) {
  const start = server.indexOf(route);
  assert.ok(start >= 0, `Route exists: ${route}`);
  const boundaries = nextRoutes
    .map((candidate) => server.indexOf(candidate, start + route.length))
    .filter((index) => index >= 0);
  const end = boundaries.length ? Math.min(...boundaries) : server.length;
  return server.slice(start, end);
}

const create = routeBody("app.post('/api/users'", [
  "app.get('/api/users'",
  "app.post('/api/users/bulk-import'",
  "app.patch('/api/users/:id'",
  "app.delete('/api/users/:id'",
]);
const bulk = routeBody("app.post('/api/users/bulk-import'", [
  "app.patch('/api/users/:id'",
  "app.delete('/api/users/:id'",
]);
const patch = routeBody("app.patch('/api/users/:id'", [
  "app.delete('/api/users/:id'",
]);

const applicationRoleStart = server.indexOf('const hasApplicationRole');
const applicationRoleEnd = server.indexOf('// Permission guard for migrated endpoints', applicationRoleStart);
assert.ok(applicationRoleStart >= 0 && applicationRoleEnd > applicationRoleStart, 'Application role resolver exists');
const applicationRole = server.slice(applicationRoleStart, applicationRoleEnd);
assert.match(applicationRole, /if \(isPostgresPersistenceActive\(\)\)\s*\{\s*return getEffectiveRoleKeys\(String\(actor\.id\)\)\.includes\(roleKey\);/);
assert.match(applicationRole, /return actor\.role === legacyLabels\[roleKey\];/);
assert.ok(applicationRole.indexOf('if (isPostgresPersistenceActive())') < applicationRole.indexOf('return actor.role === legacyLabels[roleKey]'), 'PostgreSQL assignment check precedes legacy development fallback');

// Primary profile roles are deliberately narrower than functional capabilities.
assert.match(create, /validPrimaryRoles = \['Admin GABAH', 'IT', 'GA', 'Karyawan', 'Auditor'\]/);
assert.match(patch, /validRoles = \['Admin GABAH', 'Superadmin', 'IT', 'GA', 'Auditor', 'Karyawan'\]/);
assert.doesNotMatch(create, /validPrimaryRoles[^;]*Supply Chain/s);
assert.doesNotMatch(create, /validPrimaryRoles[^;]*PIBC/s);
assert.doesNotMatch(patch, /validRoles[^;]*Supply Chain/s);
assert.doesNotMatch(patch, /validRoles[^;]*PIBC/s);

// Legacy location labels are import-only aliases, never stored as primary roles.
assert.match(bulk, /validRoles = \['Admin GABAH', 'IT', 'GA', 'Karyawan', 'Auditor', 'Supply Chain', 'PIBC'\]/);
assert.match(bulk, /\['Humas', 'Sekretaris Direksi'\]/);
assert.match(bulk, /roleRaw === 'Supply Chain' \? 'OFF-RPC' : roleRaw === 'PIBC' \? 'OFF-PIBC'/);
assert.match(bulk, /requestedRole === 'Supply Chain' \|\| requestedRole === 'PIBC' \? 'Karyawan'/);
assert.match(bulk, /lokasi kantor; unit organisasi tetap independen/);

// User administration UI and CSV template expose separate employee attributes.
assert.match(modal, /PRIMARY_PROFILE_ROLES\.map/);
assert.match(modal, /'Supply Chain', 'PIBC'/);
assert.match(modal, /job_level_code/);
assert.match(modal, /unit_id/);
assert.match(modal, /office_location_id/);
assert.match(service, /'Kode Jabatan', 'ID Unit', 'ID Lokasi Kantor'/);

console.log('Canonical primary-role policy: 18 checks passed');
