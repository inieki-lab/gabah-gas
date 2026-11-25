import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(path, 'utf8');
const server = read('server.ts');
const services = read('server/services.ts');
const contracts = read('server/contracts.ts');
const migration = read('server/migrations/106_retire_legacy_owner_domains.sql');
const assetsUi = read('src/components/views/AssetsView.tsx');
const contractsUi = read('src/components/views/ContractsView.tsx');

const route = (method, path) => {
  const marker = `app.${method}('${path}'`;
  const start = server.indexOf(marker);
  assert.notEqual(start, -1, `route exists: ${method.toUpperCase()} ${path}`);
  const next = server.indexOf("\n  app.", start + marker.length);
  return server.slice(start, next === -1 ? server.length : next);
};

const checks = [
  ['asset catalogue requires assets.read and server-side scoped collection',
    /requireRbacPermission\(req, res, 'assets\.read'\)/.test(route('get', '/api/assets'))
      && /GabahDomainService\.getScopedAssets\(actor\)/.test(route('get', '/api/assets'))],
  ['asset direct-ID lookup applies the identical scoped collection and fails closed',
    /requireRbacPermission\(req, res, 'assets\.read'\)/.test(route('get', '/api/assets/:id'))
      && /getScopedAssets\(actor\)\.find\(a => a\.id === req\.params\.id\)/.test(route('get', '/api/assets/:id'))
      && /404/.test(route('get', '/api/assets/:id'))],
  ['asset mutation checks read-only deny-write and explicit owner permission/scope',
    /requireRbacPermission\(req, res, 'assets\.update'\)/.test(route('patch', '/api/assets/:id'))
      && /isReadOnlyActor\(actor\)/.test(route('patch', '/api/assets/:id'))
      && /canMutateAssetOwner\(actor, asset\.owner_division, 'assets\.update'\)/.test(route('patch', '/api/assets/:id'))],
  ['PostgreSQL asset visibility unions dynamic scopes and the narrow IT workstation read-only exception',
    /filterAssetsByDynamicScopes\(db\.assets, user\)/.test(services)
      && /hasRbacPermission\(String\(user\.id\), 'assets\.read\.it_workstations'\)/.test(services)
      && /owner_division \|\| ''\)\.toUpperCase\(\) === 'IT' && isItWorkstation/.test(services)
      && /visibleIds = new Set\(\[\.\.\.personalAssets, \.\.\.dynamicAssets, \.\.\.readOnlyItWorkstations\]/.test(services)],
  ['GA workstation read-only exception excludes IT servers and infrastructure in file-store fallback',
    /hasGaCapability/.test(services)
      && /owner_division \|\| ''\)\.toUpperCase\(\) === 'IT'[\s\S]*?\['HLT', 'HPC'\]/.test(services)],
  ['dashboard stats use scoped assets and separate module-specific loans/tickets owner scopes',
    /requireRbacPermission\(req, res, 'dashboard\.read'\)/.test(route('get', '/api/dashboard/stats'))
      && /getScopedAssets\(actor\)/.test(route('get', '/api/dashboard/stats'))
      && /hasRbacScope\(String\(actor\.id\), 'division', owner, module\)/.test(route('get', '/api/dashboard/stats'))
      && /visibleLoans/.test(route('get', '/api/dashboard/stats'))
      && /visibleTickets/.test(route('get', '/api/dashboard/stats'))],
  ['dashboard attention filters asset, loan, ticket, and unit references before returning cards',
    /getScopedAssets\(actor\)/.test(route('get', '/api/dashboard/attention'))
      && /visibleAssetIds: new Set\(visibleAssets\.map\(asset => asset\.id\)\)/.test(route('get', '/api/dashboard/attention'))
      && /filterDashboardAttentionItems\(items/.test(route('get', '/api/dashboard/attention'))
      && /canReadTicketUnit/.test(route('get', '/api/dashboard/attention'))],
  ['contract list API requires contracts.read and delegates to server-side listContracts',
    /requireRbacPermission\(req, res, 'contracts\.read'\)/.test(route('get', '/api/contracts'))
      && /ContractDomainService\.listContracts\(actor\)/.test(route('get', '/api/contracts'))],
  ['contract direct-ID API requires contracts.read and delegates to guarded getContract',
    /requireRbacPermission\(req, res, 'contracts\.read'\)/.test(route('get', '/api/contracts/:id'))
      && /ContractDomainService\.getContract\(actor, req\.params\.id\)/.test(route('get', '/api/contracts/:id'))],
  ['contract list and direct-ID service share canSeeContract; PostgreSQL requires permission plus explicit owner scope',
    /listContracts\(user: ServerUser\): ServerContract\[\] \{\s*return db\.contracts\.filter\(c => canSeeContract\(user, c\)\)/.test(contracts)
      && /getContract\(user: ServerUser, contractId: string\)[\s\S]*?if \(!canSeeContract\(user, contract\)\)/.test(contracts)
      && /hasRbacPermission\(String\(user\.id\), 'contracts\.read'\)[\s\S]*?hasRbacScope\(String\(user\.id\), 'division', owner, 'contracts'\)/.test(contracts)],
  ['contract PIC visibility is record-specific and does not grant owner-domain visibility',
    /if \(contract\.pic_user_id === user\.id\) return true;/.test(contracts)
      && /if \(!owner\) return false;/.test(contracts)],
  ['retired SC/PIBC owner migration preserves historical rows and never deletes assets/contracts',
    /UPDATE divisions[\s\S]*?UPPER\(BTRIM\(code\)\) IN \('SC', 'PIBC'\)/i.test(migration)
      && /UPDATE asset_categories[\s\S]*?UPPER\(BTRIM\(owner\.code\)\) IN \('SC', 'PIBC'\)/i.test(migration)
      && !/\bDELETE\s+FROM\s+(divisions|asset_categories|assets|contracts)\b/i.test(migration)],
  ['asset and contract owner filter controls derive from server-returned records, not role labels or asset-number prefixes',
    /\.map\(asset => String\(asset\.owner_division/.test(assetsUi)
      && !/asset_number.*(?:startsWith|substring|slice)/.test(assetsUi)
      && /contract\.owner_division/.test(contractsUi)],
];

let failed = 0;
for (const [name, passed] of checks) {
  console.log((passed ? 'PASS' : 'FAIL') + ' | ' + name);
  if (!passed) failed += 1;
}
console.log(`TOTAL: ${checks.length} | PASS: ${checks.length - failed} | FAIL: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
