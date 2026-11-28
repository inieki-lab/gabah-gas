import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');
const modal = fs.readFileSync('src/components/modals/AdministrationModal.tsx', 'utf8');
const api = fs.readFileSync('src/services/gabahApi.ts', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');

const permissionsStart = server.indexOf("app.put('/api/admin/rbac/roles/:id/permissions'");
const scopesStart = server.indexOf("app.put('/api/admin/rbac/roles/:id/scopes'", permissionsStart);
const usersStart = server.indexOf("app.put('/api/admin/rbac/users/:id/roles'", scopesStart);
assert.ok(permissionsStart >= 0 && scopesStart > permissionsStart && usersStart > scopesStart,
  'role permission, scope, and user assignment routes must exist in order');

const permissionRoute = server.slice(permissionsStart, scopesStart);
const scopeRoute = server.slice(scopesStart, usersStart);

assert.ok(permissionRoute.includes('const affected = permissionsChanged')
  && permissionRoute.includes(': { rows: [] };'),
  'unchanged role permissions must not invalidate any user session');
assert.match(permissionRoute, /if \(permissionsChanged\) \{[\s\S]*DELETE FROM gabah_role_permissions/,
  'role permissions should only be rewritten when the effective set changes');
assert.ok(scopeRoute.includes('const affected = scopesChanged')
  && scopeRoute.includes(': { rows: [] };'),
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

assert.match(api, /err\.status = res\.status/,
  'API client must retain HTTP status so the app can distinguish revoked sessions');
assert.match(app, /const handleSessionExpired = \(\) => \{[\s\S]*setCurrentUser\(null\)[\s\S]*setViewMode\('login'\)[\s\S]*setIsLoading\(false\)/,
  'a revoked session must clear the current user and return the app to login');
assert.match(app, /const recoverDataRequestFailure = \(error: any\) => \{\s*if \(error\?\.status === 401\) throw error;/,
  'best-effort data refresh must not swallow session-expired responses');
assert.match(app, /err\?\.status === 401 && generation === dataRefreshGeneration\.current/,
  'refreshData must handle 401 only for the current authenticated generation');
assert.match(app, /catch \(error: any\) \{\s*if \(error\?\.status === 401\) \{\s*handleSessionExpired\(\)/,
  'module status refresh must also end a revoked session instead of leaving stale menus visible');

const authStart = app.indexOf('async function initAuth()');
const authEnd = app.indexOf('initAuth();', authStart);
const authInitialization = app.slice(authStart, authEnd);
assert.match(authInitialization, /if \(me\) \{[\s\S]*void refreshData\(\);[\s\S]*\} else setViewMode\('login'\)/,
  'initial bulk data refresh must start only after a valid session is confirmed');
assert.doesNotMatch(authInitialization, /finally\s*\{[\s\S]*refreshData/,
  'anonymous visitors must not trigger authenticated collection requests');
assert.match(modal, /Cakupan data role tersimpan\.[\s\S]{0,160}pegawai terdampak harus login ulang/,
  'role scope UI must tell affected users to log in again');
assert.match(server, /revokeUserSessions\(userId\);[\s\S]{0,100}await refreshRbacPolicy\(\)/,
  'sessions must be revoked before the refreshed policy is used for subsequent requests');

console.log('RBAC role-change session refresh: PASS (permission and scope changes invalidate affected sessions).');
