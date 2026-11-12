import fs from 'node:fs';

const source = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const helperStart = source.indexOf('const normalizePrimaryProfileRole =');
const helperEnd = source.indexOf('const rbacFailure =', helperStart);
const helpers = helperStart >= 0 && helperEnd > helperStart ? source.slice(helperStart, helperEnd) : '';
const createStart = source.indexOf("app.post('/api/users'");
const importStart = source.indexOf("app.post('/api/users/bulk-import'");
const patchStart = source.indexOf("app.patch('/api/users/:id'");
const deleteStart = source.indexOf("app.delete('/api/users/:id'");
const createRoute = source.slice(createStart, importStart);
const importRoute = source.slice(importStart, patchStart);
const patchRoute = source.slice(patchStart, deleteStart);

const checks = [
  ['Humas, Sekretaris Direksi, Supply Chain, and PIBC normalize to Karyawan primary profile', /\['Humas', 'Sekretaris Direksi', 'Supply Chain', 'PIBC'\]\.includes\(normalized\)\) return 'Karyawan'/.test(helpers)],
  ['Humas and Sekretariat resolve to secondary capability role keys', /label === 'Humas'\) return 'humas'/.test(helpers) && /label === 'Sekretaris Direksi'\) return 'sekretaris_direksi'/.test(helpers)],
  ['Secondary capabilities are stored as non-primary RBAC assignments', /INSERT INTO gabah_user_roles \(user_id, role_id, is_primary, assigned_by_user_id\)[\s\S]*FALSE, NULL/.test(helpers)],
  ['Create-user API validates profile role and syncs secondary capability', createRoute.includes('isKnownProfileRole(requestedRole)') && createRoute.includes('secondaryCapabilityRoleKey(requestedRole)')],
  ['Edit-user API validates profile role and syncs secondary capability', patchRoute.includes('isKnownProfileRole(requestedRole)') && patchRoute.includes('secondaryCapabilityRoleKey(requestedRole)')],
  ['Bulk import normalizes role and preserves Humas/Sekretariat as capability', importRoute.includes('normalizePrimaryProfileRole(requestedRole)') && importRoute.includes('secondaryRoleByUserId.set') && importRoute.includes('capabilityRoleKey: secondaryRoleByUserId.get(user.id)')],
  ['Bulk import keeps employee capability label for file-store compatibility', importRoute.includes('roleLabels[requestedRole] || roleLabels[role]')],
  ['User create and bulk import use collision-resistant generated IDs', /const generateUserId = \(\): string => `USR-\$\{crypto\.randomUUID\(\)\.toUpperCase\(\)\}`/.test(source) && (createRoute.includes('id: generateUserId()') || source.slice(source.indexOf("app.post('/api/users'"), source.indexOf("app.post('/api/users/bulk-import'")).includes('id: generateUserId()')) && importRoute.includes('id: generateUserId()') && !source.includes('USR-${Date.now().toString().slice(-6)}'))],
];

let failed = 0;
for (const [name, pass] of checks) {
  console.log((pass ? 'PASS' : 'FAIL') + ' | ' + name);
  if (!pass) failed += 1;
}
console.log('TOTAL: ' + checks.length + ' | PASS: ' + (checks.length - failed) + ' | FAIL: ' + failed);
process.exit(failed === 0 ? 0 : 1);
