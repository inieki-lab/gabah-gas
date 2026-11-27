import fs from 'node:fs';
import assert from 'node:assert/strict';

const ui = fs.readFileSync(new URL('../src/components/modals/AdministrationModal.tsx', import.meta.url), 'utf8');
const server = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const saveStart = ui.indexOf('const saveRoleAssignment = async () => {');
const saveEnd = ui.indexOf('\n  };', saveStart);
assert.ok(saveStart >= 0 && saveEnd > saveStart, 'role assignment save handler must exist');
const save = ui.slice(saveStart, saveEnd);
assert.match(save, /gabahApi\.setRbacUserRoles/);
assert.match(save, /Sesi pengguna dicabut demi keamanan; minta pengguna login kembali agar hak akses baru aktif/,
  'success feedback must tell the administrator that the target must reauthenticate');
assert.match(server, /revokeUserSessions\(userId\);\s*await refreshRbacPolicy\(\)/,
  'server must revoke the target sessions and refresh effective RBAC policy after role-set changes');

console.log('PASS | successful role assignment explicitly tells admin that target must log in again');
console.log('PASS | UI notice matches server-side session revocation and policy refresh');
