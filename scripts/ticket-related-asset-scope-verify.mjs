import fs from 'node:fs';
import assert from 'node:assert/strict';
import { db, seedInitialData } from '../server/db.ts';
import { GabahDomainService } from '../server/services.ts';

const serviceSource = fs.readFileSync(new URL('../server/services.ts', import.meta.url), 'utf8');
const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const ticketModalSource = fs.readFileSync(new URL('../src/components/modals/CreateTicketModal.tsx', import.meta.url), 'utf8');
const start = serviceSource.indexOf('static createTicket(');
const end = serviceSource.indexOf('\n  /**', start + 1);
assert.ok(start >= 0 && end > start, 'createTicket domain method must exist');
const method = serviceSource.slice(start, end);
const routeStart = serverSource.indexOf("app.post('/api/tickets'");
const routeEnd = serverSource.indexOf('// SECURITY (CR-06)', routeStart);
assert.ok(routeStart >= 0 && routeEnd > routeStart, 'POST /api/tickets route must exist');
const route = serverSource.slice(routeStart, routeEnd);
const checks = [
  ['Blank supplied asset IDs are rejected', /if \(!relatedAssetId\)[\s\S]*statusCode: 400/.test(method)],
  ['Unknown or inaccessible assets are rejected', /const asset = db\.assets\.find[\s\S]*if \(!asset \|\| !visibleAsset\)[\s\S]*statusCode: 404/.test(method)],
  ['Asset linkage uses canonical per-user scoped visibility', /this\.getScopedAssets\(actor\)\.some\(item => String\(item\.id\) === relatedAssetId\)/.test(method)],
  ['Stored asset ID is the validated canonical ID', /related_asset_id: relatedAssetId/.test(method)],
  ['Copied metadata comes from the validated asset record', /relatedAssetName = asset\.name;[\s\S]*relatedAssetNumber = asset\.asset_number/.test(method)],
  ['Blank supplied contract IDs are rejected', /if \(!linkedContractId\)[\s\S]*statusCode: 400/.test(method)],
  ['Unknown or out-of-scope contract links are rejected before ticket creation', /const linkedContract = db\.contracts\.find[\s\S]*!linkedContract \|\| !canSeeContract\(actor, linkedContract\)[\s\S]*statusCode: 404/.test(method)],
  ['Validated contract ID is stored on the ticket', /contract_id: linkedContractId/.test(method)],
  ['GA request button uses canonical TicketCategory value instead of legacy General', /setCategory\('GA'\)/.test(ticketModalSource) && !/setCategory\('General'\)/.test(ticketModalSource)],
  ['New ticket selector exposes IT, GA, and ME while retaining legacy categories only for history', ['IT', 'GA', 'ME'].every(category => ticketModalSource.includes(`setCategory('${category}')`)) && !ticketModalSource.includes("setCategory('SC')") && !ticketModalSource.includes("setCategory('PIBC')") && /TicketCategory/.test(ticketModalSource)],
  ['HTTP route preserves domain status codes', /res\.status\(typeof err\?\.statusCode === 'number' \? err\.statusCode : 400\)/.test(route)],
  ['Route no longer performs a second contract lookup', !/db\.contracts\.find/.test(route)],
];
for (const [name, pass] of checks) {
  console.log((pass ? 'PASS' : 'FAIL') + ' | ' + name);
  assert.ok(pass, name);
}

seedInitialData();
const admin = db.users.find(user => user.id === 'USR-01');
assert.ok(admin);
const initialCount = db.tickets.length;
assert.throws(() => GabahDomainService.createTicket({
  title: 'Fixture missing asset', description: 'Must not be created', category: 'IT', priority: 'low',
  related_asset_id: 'ASSET-NOT-FOUND',
}, admin), /Aset terkait tidak ditemukan atau tidak dapat diakses/);
assert.equal(db.tickets.length, initialCount, 'Unknown asset must not create a ticket');

assert.throws(() => GabahDomainService.createTicket({
  title: 'Fixture missing contract', description: 'Must not be created', category: 'IT', priority: 'low',
  contract_id: 'CTR-NOT-FOUND',
}, admin), /Kontrak terkait tidak ditemukan atau tidak dapat diakses/);
assert.equal(db.tickets.length, initialCount, 'Unknown contract must not create a ticket');

const visibleAsset = GabahDomainService.getScopedAssets(admin).find(asset => ['IT', 'GA'].includes(String(asset.owner_division || '').toUpperCase()));
assert.ok(visibleAsset, 'Admin fixture must have a visible IT or GA owner asset for a canonical ticket link');
const linkedCategory = String(visibleAsset.owner_division).toUpperCase();
const linked = GabahDomainService.createTicket({
  title: 'Fixture valid asset link', description: 'Valid link', category: linkedCategory, priority: 'low',
  related_asset_id: visibleAsset.id,
}, admin);
assert.equal(linked.related_asset_id, visibleAsset.id);
assert.equal(linked.related_asset_name, visibleAsset.name);
assert.equal(linked.related_asset_number, visibleAsset.asset_number);
console.log('PASS | fixture rejects missing links without creating orphan tickets');
console.log('PASS | fixture persists canonical asset ID and metadata');
const legacyOwnerAsset = db.assets.find(asset => ['SC', 'PIBC'].includes(String(asset.owner_division || '').toUpperCase()));
if (legacyOwnerAsset) {
  assert.throws(() => GabahDomainService.createTicket({
    title: 'Fixture legacy owner asset', description: 'Must be reviewed', category: 'ME', priority: 'low',
    related_asset_id: legacyOwnerAsset.id,
  }, admin), /owner legacy SC\/PIBC/);
}
assert.throws(() => GabahDomainService.createTicket({
  title: 'Fixture legacy category', description: 'Must not be created', category: 'SC', priority: 'low',
}, admin), /Kategori tiket/);
console.log('PASS | new ticket categories reject legacy SC/PIBC and linked legacy assets');
console.log('TOTAL: 10 source checks + 2 behavioral fixture groups | PASS');
