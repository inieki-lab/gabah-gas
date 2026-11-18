import assert from 'node:assert/strict';

// Force persistence into the configured-but-unavailable PostgreSQL mode before
// loading the domain service. This deterministically exercises fail-closed
// rollback without touching a real database or writing a JSON fallback file.
process.env.DATABASE_URL = 'postgresql://gabah_test_unavailable:invalid@127.0.0.1:1/gabah_test';
process.env.NODE_ENV = 'test';

const { db, seedInitialData } = await import('../server/db.ts');
const { GabahDomainService } = await import('../server/services.ts');

seedInitialData();
const admin = db.users.find(user => user.id === 'USR-01');
const inactiveUser = db.users.find(user => user.id === 'USR-04');
const activeUser = db.users.find(user => user.id === 'USR-03');
const asset = db.assets.find(item => item.id === 'AST-HLT-006');
assert.ok(admin && inactiveUser && activeUser && asset);

const snapshot = () => JSON.parse(JSON.stringify(asset));
const movementCount = () => db.movements.length;
const auditCount = () => db.auditLogs.length;
const expectUnavailable = error => error?.statusCode === 503;

inactiveUser.is_active = false;
await assert.rejects(
  () => GabahDomainService.assignAsset(asset.id, inactiveUser.id, 'fixture', admin),
  /User penerima tidak ditemukan atau akun sudah nonaktif/,
);
assert.equal(asset.assigned_to, null, 'Rejected assignment must not mutate asset custody');

const originalLocation = asset.location;
await assert.rejects(
  () => GabahDomainService.moveAsset(asset.id, '   ', 'fixture', admin),
  /Lokasi baru wajib diisi/,
);
assert.equal(asset.location, originalLocation, 'Invalid move must not mutate asset location');

const originalStatus = asset.status;
await assert.rejects(
  () => GabahDomainService.mutateLifecycle(asset.id, 'forged-action', 'fixture', admin),
  /Aksi lifecycle aset tidak valid/,
);
assert.equal(asset.status, originalStatus, 'Invalid lifecycle action must not mutate asset status');

inactiveUser.is_active = true;
const beforeAssignment = snapshot();
const movementsBeforeAssignment = movementCount();
const auditsBeforeAssignment = auditCount();
await assert.rejects(
  () => GabahDomainService.assignAsset(asset.id, activeUser.id, 'fixture persistence failure', admin),
  expectUnavailable,
  'Assignment must fail with HTTP 503 when PostgreSQL persistence is unavailable',
);
assert.deepEqual(asset, beforeAssignment, 'Failed assignment must restore every asset field, including optional custody');
assert.equal(movementCount(), movementsBeforeAssignment, 'Failed assignment must remove its movement row');
assert.equal(auditCount(), auditsBeforeAssignment, 'Failed assignment must remove its audit row');

const beforeMove = snapshot();
const movementsBeforeMove = movementCount();
const auditsBeforeMove = auditCount();
await assert.rejects(
  () => GabahDomainService.moveAsset(asset.id, 'CI Failure Injection Location', 'fixture persistence failure', admin),
  expectUnavailable,
  'Location movement must fail with HTTP 503 when PostgreSQL persistence is unavailable',
);
assert.deepEqual(asset, beforeMove, 'Failed movement must restore location and normalized location reference');
assert.equal(movementCount(), movementsBeforeMove, 'Failed movement must remove its movement row');
assert.equal(auditCount(), auditsBeforeMove, 'Failed movement must remove its audit row');

const beforeLifecycle = snapshot();
const auditsBeforeLifecycle = auditCount();
await assert.rejects(
  () => GabahDomainService.mutateLifecycle(asset.id, 'repair', 'fixture persistence failure', admin),
  expectUnavailable,
  'Lifecycle mutation must fail with HTTP 503 when PostgreSQL persistence is unavailable',
);
assert.deepEqual(asset, beforeLifecycle, 'Failed lifecycle mutation must restore status, condition, and timestamps');
assert.equal(auditCount(), auditsBeforeLifecycle, 'Failed lifecycle mutation must remove its audit row');

console.log('PASS | inactive target user rejected');
console.log('PASS | invalid move and lifecycle action rejected without mutation');
console.log('PASS | assignment persistence failure returns 503 and rolls back asset, movement, and audit');
console.log('PASS | movement persistence failure returns 503 and rolls back asset, movement, and audit');
console.log('PASS | lifecycle persistence failure returns 503 and rolls back asset and audit');
console.log('TOTAL: 5 | PASS: 5 | FAIL: 0');
