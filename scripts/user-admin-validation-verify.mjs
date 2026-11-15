import fs from 'node:fs';

const source = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const checks = [
  ['PATCH rejects non-boolean is_active', /if \(is_active !== undefined && typeof is_active !== 'boolean'\)/.test(source)],
  ['PATCH no longer coerces is_active with Boolean()', !/targetUser\.is_active = Boolean\(is_active\)/.test(source)],
  ['PATCH validates email syntax', /Format email tidak valid/.test(source)],
  ['PATCH validates role against allowlist', /const validRoles = \['Admin GABAH'/.test(source)],
  ['PATCH validates password type and minimum length', /password\.trim\(\)\.length < 8/.test(source)],
  ['bulk import revokes sessions after primary-role change', /previousPrimaryRole !== existing\.role[\s\S]{0,220}revokeUserSessions\(existing\.id\)/.test(source)],
  ['single-user role/password/deactivation path revokes sessions', /if \(password \|\| privilegeChanged \|\| accountDeactivated\) \{\s*revokeUserSessions\(targetUser\.id\);/.test(source)],
];
let failed = false;
for (const [name, passed] of checks) {
  console.log((passed ? 'PASS' : 'FAIL') + ' ' + name);
  if (!passed) failed = true;
}
if (failed) process.exit(1);
