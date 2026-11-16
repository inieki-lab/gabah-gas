import fs from 'node:fs';
const source = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const routeStart = source.indexOf("app.patch('/api/users/:id'");
const routeEnd = source.indexOf("app.delete('/api/users/:id'", routeStart);
if (routeStart < 0 || routeEnd < 0) throw new Error('User PATCH route not found');
const route = source.slice(routeStart, routeEnd);
const checks = [
  ['PATCH validates string types and length limits', /stringFields: Array<\[string, unknown, number\]>/.test(route)],
  ['PATCH validates email syntax', /Format email tidak valid/.test(route)],
  ['PATCH validates built-in primary role labels', /const validRoles = \['Admin GABAH'/.test(route)],
  ['PATCH rejects non-boolean is_active', /typeof is_active !== 'boolean'/.test(route)],
  ['PATCH validates password type and length', /password\.trim\(\)\.length < 8/.test(route)],
  ['PATCH checks duplicate email before mutating target user', route.indexOf('db.users.some') < route.indexOf('targetUser.name = normalizedName')],
  ['PATCH checks offboarding custody before mutating target user', route.indexOf('if (accountDeactivated)') < route.indexOf('targetUser.name = normalizedName')],
  ['PATCH does not Boolean-coerce is_active', !/targetUser\.is_active = Boolean\(is_active\)/.test(route)],
  ['bulk import revokes sessions after primary-role change', /previousPrimaryRole !== existing\.role[\s\S]{0,220}revokeUserSessions\(existing\.id\)/.test(source)],
  ['single-user password/deactivation path revokes sessions', /if \(passwordChanged \|\| privilegeChanged \|\| accountDeactivated\) \{\s*revokeUserSessions\(targetUser\.id\);/.test(route)],
];
let failed = false;
for (const [name, passed] of checks) {
  console.log((passed ? 'PASS' : 'FAIL') + ' ' + name);
  if (!passed) failed = true;
}
if (failed) process.exit(1);
