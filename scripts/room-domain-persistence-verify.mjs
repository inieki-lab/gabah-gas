import assert from 'node:assert/strict';
import fs from 'node:fs';

const services = fs.readFileSync('server/services.ts', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');
const methods = [
  'requestRoomReservation', 'approveRoomReservation', 'rejectRoomReservation',
  'checkinRoomReservation', 'checkoutRoomReservation', 'cancelRoomReservation',
  'updateMeetingRoom', 'createMeetingType', 'updateMeetingType', 'deleteMeetingType',
  'createMeetingFacility', 'updateMeetingFacility', 'deleteMeetingFacility',
];

for (const method of methods) {
  const start = services.indexOf('static async ' + method + '(');
  assert.ok(start >= 0, method + ' must be asynchronous');
  const next = services.indexOf('\n  static ', start + 1);
  const body = services.slice(start, next < 0 ? services.length : next);
  assert.match(body, /await persistDomainMutation\(\)/, method + ' must await durable persistence');
  assert.doesNotMatch(body, /persistDataStore\(\)\.catch\(/, method + ' must not swallow persistence failures');
  assert.ok(server.includes('await GabahDomainService.' + method + '('), method + ' HTTP route must await its service');
}

const routeLines = server.split('\n').filter(line =>
  /^  app\.(?:patch|post|delete)\(/.test(line)
  && /\/api\/(?:meeting-rooms|room-reservations|meeting-types|meeting-facilities)/.test(line)
);
assert.equal(routeLines.length, 13, 'All 13 room/facility mutation routes must be present');
assert.ok(routeLines.every(line => line.includes('async (req, res) =>')),
  'Every room/facility mutation route must use an async handler');

console.log('Room/facility durable persistence contract: PASS (13 services, 13 routes)');
