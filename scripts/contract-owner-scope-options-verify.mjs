import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const service = read('server/contracts.ts');
const server = read('server.ts');
const client = read('src/services/gabahApi.ts');
const modal = read('src/components/modals/CreateContractModal.tsx');

const checks = [
  ['Create-options service rejects actors without contracts.create', /listCreatableOwnerDomains\(actor: ServerUser\)[\s\S]{0,180}if \(!canCreateContract\(actor\)\) return \[\]/.test(service)],
  ['Superadmin may select every active owner domain', /listCreatableOwnerDomains[\s\S]{0,700}if \(isSuperadminActor\(actor\)\) return true/.test(service)],
  ['Non-admin choices are resolved from effective PostgreSQL contracts division scopes', /hasRbacScope\(String\(actor\.id\), 'division', code, 'contracts'\)/.test(service)],
  ['Legacy file-store fallback remains fail-closed to the actor primary division', /hasLegacyContractDivisionScope\(actor, code\)/.test(service)],
  ['Inactive and location-only legacy owner codes are excluded', /division\.is_active === false[\s\S]{0,240}\['SC', 'SUPPLY CHAIN', 'PIBC', 'RPC'\]/.test(service)],
  ['Create-options endpoint requires contracts.create before returning owner choices', /app\.get\('\/api\/contracts\/create-options'[\s\S]{0,260}requireRbacPermission\(req, res, 'contracts\.create'\)[\s\S]{0,220}listCreatableOwnerDomains\(actor\)/.test(server)],
  ['Client API uses the authorized create-options endpoint', /getContractCreateOwnerOptions[\s\S]{0,260}\/api\/contracts\/create-options/.test(client)],
  ['Create form no longer derives owner options from currentUser.division or the global division master', /getContractCreateOwnerOptions\(\)/.test(modal) && !/gabahApi\.getDivisions\(\)/.test(modal) && !/currentUser\.division/.test(modal)],
  ['Multiple authorized owner choices are selectable; single choice is preselected only when unambiguous', /const selectedOwner = options\.length === 1 \? options\[0\]\.code : ''/.test(modal)],
  ['Direct create API still independently validates owner scope', /const ownerScopeAllowed = ownerExists[\s\S]{0,260}hasRbacScope\(String\(actor\.id\), 'division', ownerDivision, 'contracts'\)/.test(service)],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name}`);
  if (!ok) failed++;
}
console.log(`TOTAL: ${checks.length} | PASS: ${checks.length - failed} | FAIL: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
