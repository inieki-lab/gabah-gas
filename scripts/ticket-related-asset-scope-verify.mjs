import fs from 'node:fs';
import assert from 'node:assert/strict';
import { db, seedInitialData } from '../server/db.ts';
import { GabahDomainService } from '../server/services.ts';

const serviceSource = fs.readFileSync(new URL('../server/services.ts', import.meta.url), 'utf8');
const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const start = serviceSource.indexOf('static createTicket(');
const end = serviceSource.indexOf('\n  /**', start + 1);
if (start < 0 || end < 0) throw new Error('createTicket domain method not found');
const method = serviceSource.slice(start, end);
const routeStart = serverSource.indexOf("app.post('/api/tickets'");
const routeEnd = serverSource.indexOf('// SECURITY (CR-06)', routeStart);
if (routeStart < 0 || routeEnd < 0) throw new Error('POST /api/tickets route not found');
const route = serverSource.slice(routeStart, routeEnd);
const checks = [
  ['Optional asset relationship is normalized before use', /relatedAssetId = String\(payload\.related_asset_id\)\.trim\(\)/.test(method)],
  ['Blank supplied asset IDs are rejected', /if \(!relatedAssetId\)[\s\S]*statusCode: 400/.test(method)],
  ['Unknown or inaccessible assets are rejected', /const ast = db\.assets\.find[\s\S]*if \(!ast \|\| !visibleAsset\)[\s\S]*statusCode: 404/.test(method)],
  ['Asset linkage uses canonical per-user scoped asset visibility', /this\.getScopedAssets\(actor\)\.some\(asset => String\(asset\.id\) === relatedAssetId\)/.test(method)],
  ['Stored asset ID is the validated canonical ID', /related_asset_id: relatedAssetId/.test(method)],
  ['Copied metadata comes from the validated asset record', /relatedAssetName = ast\.name;[\s\S]*relatedAssetNumber = ast\.asset_number/.test(method)],
  ['Supplied contract IDs are normalized and blank values rejected', /linkedContractId = String\(payload\.contract_id\)\.trim\(\)[\s\S]*if \(!linkedContractId\)[\s\S]*statusCode: 400/.test(method)],
  ['Unknown or out-of-scope contract links are rejected before ticket creation', /const linkedContract = db\.contracts\.find[\s\S]*!linkedContract \|\| !canSeeContract\(actor, linkedContract\)[\s\S]*statusCode: 404/.test(method)],
  ['Validated contract ID is persisted on the ticket', /contract_id: linkedContractId/.test(method)],
  ['HTTP route preserves domain 404/400 validation status codes', /res\.status\(typeof err\?\.statusCode === 'number' \? err\.statusCode : 400\)/.test(route)],
];
let failed = 0;
for (const [name, pass] of checks) {
  console.log((pass ? 'PASS' : 'FAIL') + ' | ' + name);
  if (!pass) failed += 1;
}
if (failed) process.exit(1);

// Behavioral fixture tests: invalid links must not create an orphan ticket.
seedInitialData();
const admin = db.users.find(user => user.id === 'USR-01');
const gaUser = db.users.find(user => user.id === 'USR-02');
assert.ok(admin && gaUser);
const initialTicketCount = db.tickets.length;
assert.throws(
  () => GabahDomainService.createTicket({
    title: 'Fixture invalid contract',
    description: 'Must not be created',
    category: 'IT',
    priority: 'medium',
    contract_id: 'CTR-NOT-FOUND',
  }, admin),
  /Kontrak terkait tidak ditemukan atau tidak dapat diakses/,
);
assert.equal(db.tickets.length, initialTicketCount, 'Invalid contract must not create a ticket');

assert.throws(
  () => GabahDomainService.createTicket({
    title: 'Fixture cross-division contract',
    description: 'Must not be created',
    category: 'GA',
    priority: 'low',
    contract_id: 'CTR-SEED-001',
  }, gaUser),
  /Kontrak terkait tidak ditemukan atau tidak dapat diakses/,
);
assert.equal(db.tickets.length, initialTicketCount, 'Out-of-scope contract must not create a ticket');

const linkedTicket = GabahDomainService.createTicket({
  title: 'Fixture valid contract',
  description: 'Valid link',
  category: 'IT',
  priority: 'low',
  contract_id: 'CTR-SEED-001',
}, admin);
assert.equal(linkedTicket.contract_id, 'CTR-SEED-001');
console.log('PASS | dummy fixture rejects missing and cross-division contract links without creating tickets');
console.log('PASS | dummy fixture persists a valid contract link');
console.log('TOTAL: ' + checks.length + ' source checks + 2 behavioral fixture checks | PASS | FAIL: 0');
