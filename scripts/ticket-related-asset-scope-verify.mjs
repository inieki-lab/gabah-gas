import fs from 'node:fs';
import assert from 'node:assert/strict';
import { db, seedInitialData } from '../server/db.ts';
import { GabahDomainService } from '../server/services.ts';

const serviceSource = fs.readFileSync(new URL('../server/services.ts', import.meta.url), 'utf8');
const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const start = serviceSource.indexOf('static createTicket(');
const end = serviceSource.indexOf('\n  /**', start + 1);
assert.ok(start >= 0 && end > start, 'createTicket domain method must exist');
const method = serviceSource.slice(start, end);

assert.match(method, /Array\.from\(normalizedTitle\)\.length > 255/, 'Ticket title is bounded to the PostgreSQL VARCHAR(255) column');
assert.match(method, /Array\.from\(normalizedDescription\)\.length > 20000/, 'Ticket description has an explicit operational size limit');
assert.match(method, /title: normalizedTitle,[\s\S]*description: normalizedDescription/, 'Only validated normalized ticket text is persisted');

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



const validTicket = { description: 'Valid description', category: 'IT', priority: 'low' };
assert.throws(() => GabahDomainService.createTicket({ ...validTicket, title: 'x'.repeat(256) }, admin), /maksimal 255 karakter/);
assert.equal(db.tickets.length, initialCount, 'Overlong title must be rejected before ticket mutation');
assert.throws(() => GabahDomainService.createTicket({ ...validTicket, title: 'Valid title', description: 'x'.repeat(20001) }, admin), /maksimal 20.000 karakter/);
assert.equal(db.tickets.length, initialCount, 'Oversized description must be rejected before ticket mutation');
assert.throws(() => GabahDomainService.createTicket({ ...validTicket, title: 'Invalid\\u0000title' }, admin), /maksimal 255 karakter/);
assert.equal(db.tickets.length, initialCount, 'PostgreSQL-incompatible null bytes must be rejected before ticket mutation');
const unicodeBoundaryTicket = GabahDomainService.createTicket({ ...validTicket, title: '😀'.repeat(255) }, admin);
assert.equal(Array.from(unicodeBoundaryTicket.title).length, 255, '255 Unicode code points must fit PostgreSQL VARCHAR(255)');

const visibleAsset = GabahDomainService.getScopedAssets(admin)[0];
assert.ok(visibleAsset, 'Admin fixture must have at least one visible asset');
const linked = GabahDomainService.createTicket({
  title: 'Fixture valid asset link', description: 'Valid link', category: 'IT', priority: 'low',
  related_asset_id: visibleAsset.id,
}, admin);
assert.equal(linked.related_asset_id, visibleAsset.id);
assert.equal(linked.related_asset_name, visibleAsset.name);
assert.equal(linked.related_asset_number, visibleAsset.asset_number);
console.log('PASS | fixture rejects missing links without creating orphan tickets');
console.log('PASS | fixture persists canonical asset ID and metadata');
console.log('TOTAL: 10 source checks + 4 behavioral fixture groups | PASS');
