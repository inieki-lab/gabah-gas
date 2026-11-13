import assert from 'node:assert/strict';
import { db, seedInitialData } from '../server/db.ts';
import { GabahDomainService } from '../server/services.ts';

// In-memory fixtures only. No production DB, credentials, or user-supplied input.
seedInitialData();
const admin = db.users.find(user => user.id === 'USR-01');
const inactiveUser = db.users.find(user => user.id === 'USR-04');
const activeUser = db.users.find(user => user.id === 'USR-03');
const asset = db.assets.find(item => item.id === 'AST-HLT-002');
assert.ok(admin && inactiveUser && activeUser && asset);

inactiveUser.is_active = false;
assert.throws(
  () => GabahDomainService.assignAsset(asset.id, inactiveUser.id, 'fixture', admin),
  /User penerima tidak ditemukan atau akun sudah nonaktif/,
);
assert.equal(asset.assigned_to, null, 'Rejected assignment must not mutate asset custody');

const originalLocation = asset.location;
assert.throws(
  () => GabahDomainService.moveAsset(asset.id, '   ', 'fixture', admin),
  /Lokasi baru wajib diisi/,
);
assert.equal(asset.location, originalLocation, 'Invalid move must not mutate asset location');

const originalStatus = asset.status;
assert.throws(
  () => GabahDomainService.mutateLifecycle(asset.id, 'forged-action', 'fixture', admin),
  /Aksi lifecycle aset tidak valid/,
);
assert.equal(asset.status, originalStatus, 'Invalid lifecycle action must not mutate asset status');

inactiveUser.is_active = true;
const assigned = GabahDomainService.assignAsset(asset.id, activeUser.id, 'fixture valid', admin);
assert.equal(assigned.assigned_to.id, activeUser.id);
assert.equal(assigned.status, 'assigned');

console.log('PASS | inactive target user rejected');
console.log('PASS | denied assignment leaves asset custody unchanged');
console.log('PASS | active target user can still receive asset');
console.log('PASS | invalid asset move leaves location unchanged');
console.log('PASS | invalid lifecycle action leaves asset status unchanged');
console.log('TOTAL: 5 | PASS: 5 | FAIL: 0');
