import fs from 'node:fs';
import assert from 'node:assert/strict';

const server = fs.readFileSync('server.ts', 'utf8');
const modal = fs.readFileSync('src/components/modals/AdministrationModal.tsx', 'utf8');
const service = fs.readFileSync('src/services/gabahService.ts', 'utf8');
const db = fs.readFileSync('server/db.ts', 'utf8');

const createStart = server.indexOf("app.post('/api/users'");
const bulkStart = server.indexOf("app.post('/api/users/bulk-import'");
const patchStart = server.indexOf("app.patch('/api/users/:id'");
const deleteStart = server.indexOf("app.delete('/api/users/:id'");
const create = server.slice(createStart, bulkStart);
const bulk = server.slice(bulkStart, patchStart);
const patch = server.slice(patchStart, deleteStart);

assert.match(db, /role: string;/, 'profile label accepts dynamic text');
assert.match(create, /profileLabel = .*String\(role\)/);
assert.doesNotMatch(create, /syncPrimaryRbacRole|primaryRoleKey/);
assert.match(create, /\['Supply Chain', 'PIBC'\]\.includes\(profileLabel\) \? 'Karyawan' : profileLabel/);
assert.match(create, /profileLabel === 'Supply Chain' \? 'OFF-RPC' : profileLabel === 'PIBC' \? 'OFF-PIBC'/);
assert.doesNotMatch(bulk, /syncPrimaryRbacRoles|inferredOfficeLocation/);
assert.doesNotMatch(bulk, /validRoles = \[/);
assert.match(bulk, /requestedOfficeLocation \|\| \(roleRaw === 'Supply Chain' \? 'OFF-RPC' : roleRaw === 'PIBC' \? 'OFF-PIBC'/);
assert.match(bulk, /\['Supply Chain', 'PIBC'\]\.includes\(requestedRole\) \? 'Karyawan' : requestedRole/);
assert.match(bulk, /roleRaw.length > 120/);
assert.match(patch, /role.trim\(\).length > 120/);
assert.doesNotMatch(patch, /syncPrimaryRbacRole|privilegeChanged/);
assert.match(patch, /\['Supply Chain', 'PIBC'\]\.includes\(requestedProfileLabel\)[\s\S]*?\? 'Karyawan' : requestedProfileLabel/);
assert.match(patch, /requestedProfileLabel === 'Supply Chain' \? 'OFF-RPC' : 'OFF-PIBC'/);
assert.match(server, /const assignmentIds = \[\.\.\.new Set\(\(roleIds as number\[\]\)\.map\(Number\)\)\]/);
assert.match(server, /primary_role_id: null/);
assert.match(modal, /Label Profil Pegawai \(bukan hak akses\)/);
assert.match(modal, /Label profil pegawai hanya metadata/);
assert.match(modal, /Pilih nol atau beberapa role dinamis sesuai tanggung jawab aktual/);
assert.match(modal, /roleAssignmentDraft/);
assert.doesNotMatch(modal, /PRIMARY_PROFILE_ROLES\.map/);
assert.match(service, /Employee profile labels are free-form/);
assert.match(modal, /office_location_id/);

console.log('Dynamic profile / RBAC separation: PASS');
