import assert from 'node:assert/strict';
import fs from 'node:fs';

const services = fs.readFileSync('server/services.ts', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');

const methods = [
  'requestRoomReservation',
  'approveRoomReservation',
  'rejectRoomReservation',
  'checkinRoomReservation',
  'checkoutRoomReservation',
  'cancelRoomReservation',
  'updateMeetingRoom',
  'createMeetingType',
  'updateMeetingType',
  'deleteMeetingType',
  'createMeetingFacility',
  'updateMeetingFacility',
  'deleteMeetingFacility',
];

assert.match(
  services,
  /async function persistDomainMutation\(\): Promise<void>[\s\S]*statusCode: 503/,
  'Domain mutations must surface durable-write failures as HTTP 503',
);

for (const method of methods) {
  assert.ok(services.includes('static async ' + method + '('), method + ' must await persistence');
  assert.ok(server.includes('await GabahDomainService.' + method + '('), method + ' route must await the service');
}

const roomDomain = services.slice(services.indexOf('static async requestRoomReservation('));
assert.equal(
  (roomDomain.match(/persistDataStore\(\)\.catch\(/g) || []).length,
  0,
  'Room/facility mutation methods must not swallow persistence failures',
);

const routeNames = [
  "app.patch('/api/meeting-rooms/:id'",
  "app.post('/api/room-reservations'",
  "app.post('/api/room-reservations/:id/approve'",
  "app.post('/api/room-reservations/:id/reject'",
  "app.post('/api/room-reservations/:id/checkin'",
  "app.post('/api/room-reservations/:id/checkout'",
  "app.post('/api/room-reservations/:id/cancel'",
  "app.post('/api/meeting-types'",
  "app.patch('/api/meeting-types/:id'",
  "app.delete('/api/meeting-types/:id'",
  "app.post('/api/meeting-facilities'",
  "app.patch('/api/meeting-facilities/:id'",
  "app.delete('/api/meeting-facilities/:id'",
];
for (const route of routeNames) {
  const index = server.indexOf(route);
  assert.notEqual(index, -1, route + ' must exist');
  const block = server.slice(index, server.indexOf('\n  app.', index + 1) === -1 ? undefined : server.indexOf('\n  app.', index + 1));
  assert.match(block, /async \(req, res\) =>/);
  assert.match(block, /statusCode === 'number' \? err\.statusCode : 400/);
}

console.log('Room/facility durable-mutation contract: PASS');
