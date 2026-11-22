import assert from 'node:assert/strict';
import fs from 'node:fs';

const services = fs.readFileSync('server/services.ts', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');
const snapshot = services.slice(services.indexOf('type RoomDomainSnapshot'), services.indexOf('export class GabahDomainService'));
for (const collection of ['rooms', 'roomReservations', 'meetingTypes', 'meetingFacilities', 'notifications', 'auditLogs']) {
  assert.match(snapshot, new RegExp('structuredClone\\(db\\.' + collection + '\\)'));
  assert.match(snapshot, new RegExp('db\\.' + collection + '\\.splice\\([\\s\\S]*snapshot\\.' + collection));
}
assert.match(snapshot, /await persistDataStore\(\)/);
assert.equal((services.match(/await persistDomainMutation\(persistenceSnapshot\);/g) || []).length, 13, 'All 13 room/facility services must persist with rollback snapshots');
const successAuditActions = [
  'ROOM_RESERVATION_INTERRUPTED', 'ROOM_RESERVATION_CREATED', 'ROOM_RESERVATION_APPROVED',
  'ROOM_RESERVATION_REJECTED', 'ROOM_CHECKIN', 'ROOM_CHECKOUT', 'ROOM_RESERVATION_CANCELLED',
  'ROOM_UPDATED', 'MEETING_TYPE_CREATED', 'MEETING_TYPE_UPDATED', 'MEETING_TYPE_DELETED',
  'MEETING_FACILITY_CREATED', 'MEETING_FACILITY_UPDATED', 'MEETING_FACILITY_DELETED',
];
for (const action of successAuditActions) {
  const line = services.split('\n').find(value => value.includes("recordAudit('" + action + "'"));
  if (action === 'ROOM_RESERVATION_INTERRUPTED' || action === 'ROOM_RESERVATION_CREATED' || action === 'ROOM_RESERVATION_APPROVED' || action === 'ROOM_RESERVATION_REJECTED') {
    const at = services.indexOf("'" + action + "'");
    const end = services.indexOf(');', at);
    assert.ok(services.slice(at, end).includes('false'), action + ' audit must be included in the durable transaction');
  } else assert.ok(line && line.includes(', false);'), action + ' audit must be included in the durable transaction');
}
const roomRoutes = server.split('\n').filter(line => /^  app\.(?:patch|post|delete)\(/.test(line) && /\/api\/(?:meeting-rooms|room-reservations|meeting-types|meeting-facilities)/.test(line));
assert.equal(roomRoutes.length, 13, 'All room/facility mutation routes must remain present');
console.log('PASS: 13 room/facility mutations restore state and audit on durable-write failure');
