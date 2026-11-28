import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');
const modal = fs.readFileSync('src/components/modals/AdministrationModal.tsx', 'utf8');

const permissionsStart = server.indexOf("app.put('/api/admin/rbac/roles/:id/permissions'");
const scopesStart = server.indexOf("app.put('/api/admin/rbac/roles/:id/scopes'", permissionsStart);
const usersStart = server.indexOf("app.put('/api/admin/rbac/users/:id/roles'", scopesStart);
assert.ok(permissionsStart >= 0 && scopesStart > permissionsStart && usersStart > scopesStart,
  'role permission, scope, and user assignment routes must exist in order');

const permissionRoute = server.slice(permissionsStart, scopesStart);
const scopeRoute = server.slice(scopesStart, usersStart);

assert.match(permissionRoute, /permissionsChanged[\s\S]*?const affected = permissionsChanged\s*\? await client\.query\('SELECT DISTINCT user_id FROM gabah_user_roles WHERE role_id = \\$1'[\s\S]*?: \{ rows: \[\] \}/,
  'unchanged role permissions must not invalidate any user session');
assert.match(permissionRoute, /if \(permissionsChanged\) \{[\s\S]*DELETE FROM gabah_role_permissions/,
  'role permissions should only be rewritten when the effective set changes');
assert.match(scopeRoute, /scopesChanged[\s\S]*?const affected = scopesChanged\s*\? await client\.query\('SELECT DISTINCT user_id FROM gabah_user_roles WHERE role_id = \\$1'[\s\S]*?: \{ rows: \[\] \}/,
  'unchanged role scopes must not invalidate any user session');
assert.match(scopeRoute, /if \(scopesChanged\) \{[\s\S]*DELETE FROM gabah_role_division_scopes/,
  'role scopes should only be rewritten when the effective set changes');

for (const [label, route] of [['role permission change', permissionRoute], ['role scope change', scopeRoute]]) {
  assert.match(route, /SELECT DISTINCT user_id FROM gabah_user_roles WHERE role_id = \$1/,
    label + ' must identify every user assigned to the changed role');
  assert.match(route, /revokeUserSessions\(userId\)/,
    label + ' must invalidate affected user sessions');
  assert.match(route, /userId !== String\(actor\.id\)/,
    label + ' should not revoke the acting Superadmin session unnecessarily');
  assert.match(route, /affected_user_count: affectedUserIds\.length/,
    label + ' must report how many users need to re-authenticate');
}

assert.match(modal, /Permission role tersimpan\.[\s\S]{0,160}pegawai terdampak harus login ulang/,
  'role permission UI must tell affected users to log in again');
assert.match(modal, /Cakupan data role tersimpan\.[\s\S]{0,160}pegawai terdampak harus login ulang/,
  'role scope UI must tell affected users to log in again');
assert.match(server, /revokeUserSessions\(userId\);[\s\S]{0,100}await refreshRbacPolicy\(\)/,
  'sessions must be revoked before the refreshed policy is used for subsequent requests');

console.log('RBAC role-change session refresh: PASS (permission and scope changes invalidate affected sessions).');
