import fs from 'node:fs';
import assert from 'node:assert/strict';

const service = fs.readFileSync('server/services.ts', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');

function sliceBetween(source, start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, 'missing source boundaries: ' + start);
  return source.slice(a, b);
}

assert.match(service, /private static async persistMutationWithRollback/);
assert.doesNotMatch(service, /persistDataStore\(\)\.catch/);
assert.doesNotMatch(service, /static recordAudit[\s\S]*?persistDataStore/);

const serviceCases = [
  ['asset create', 'static async createAsset(', '/**\n   * Asset Assignment Mutation'],
  ['asset assign', 'static async assignAsset(', '/**\n   * Asset Location Movement Mutation'],
  ['asset move', 'static async moveAsset(', '/**\n   * Asset Lifecycle Mutation'],
  ['asset lifecycle', 'static async mutateLifecycle(', '/**\n   * Loan Request'],
  ['room request', 'static async requestRoomReservation(', 'static async approveRoomReservation('],
  ['room approve', 'static async approveRoomReservation(', 'static async rejectRoomReservation('],
  ['room reject', 'static async rejectRoomReservation(', 'static async checkinRoomReservation('],
  ['room checkin', 'static async checkinRoomReservation(', 'static async checkoutRoomReservation('],
  ['room checkout', 'static async checkoutRoomReservation(', 'static async cancelRoomReservation('],
  ['room cancel', 'static async cancelRoomReservation(', 'static async updateMeetingRoom('],
  ['room update', 'static async updateMeetingRoom(', '// Meeting Types CRUD'],
  ['meeting type create', 'static async createMeetingType(', 'static async updateMeetingType('],
  ['meeting type update', 'static async updateMeetingType(', 'static async deleteMeetingType('],
  ['meeting type delete', 'static async deleteMeetingType(', '// Meeting Facilities CRUD'],
  ['facility create', 'static async createMeetingFacility(', 'static async updateMeetingFacility('],
  ['facility update', 'static async updateMeetingFacility(', 'static async deleteMeetingFacility('],
  ['facility delete', 'static async deleteMeetingFacility(', '\n}'],
];
for (const [name, start, end] of serviceCases) {
  const body = sliceBetween(service, start, end);
  assert.match(body, /await this\.persistMutationWithRollback\(/, name + ' must await durable persistence');
}

const routeCases = [
  ["app.post('/api/assets/:id/assign', async", "app.post('/api/assets/:id/move'", 'GabahDomainService.assignAsset'],
  ["app.post('/api/assets/:id/move', async", "app.post('/api/assets/:id/lifecycle'", 'GabahDomainService.moveAsset'],
  ["app.post('/api/assets/:id/lifecycle', async", '// Movements', 'GabahDomainService.mutateLifecycle'],
  ["app.patch('/api/meeting-rooms/:id', async", "app.get('/api/room-reservations'", 'GabahDomainService.updateMeetingRoom'],
  ["app.post('/api/room-reservations', async", "app.post('/api/room-reservations/:id/approve'", 'GabahDomainService.requestRoomReservation'],
  ["app.post('/api/room-reservations/:id/approve', async", "app.post('/api/room-reservations/:id/reject'", 'GabahDomainService.approveRoomReservation'],
  ["app.post('/api/room-reservations/:id/reject', async", "app.post('/api/room-reservations/:id/checkin'", 'GabahDomainService.rejectRoomReservation'],
  ["app.post('/api/room-reservations/:id/checkin', async", "app.post('/api/room-reservations/:id/checkout'", 'GabahDomainService.checkinRoomReservation'],
  ["app.post('/api/room-reservations/:id/checkout', async", "app.post('/api/room-reservations/:id/cancel'", 'GabahDomainService.checkoutRoomReservation'],
  ["app.post('/api/room-reservations/:id/cancel', async", '// Meeting Types CRUD API', 'GabahDomainService.cancelRoomReservation'],
  ["app.post('/api/meeting-types', async", "app.patch('/api/meeting-types/:id'", 'GabahDomainService.createMeetingType'],
  ["app.patch('/api/meeting-types/:id', async", "app.delete('/api/meeting-types/:id'", 'GabahDomainService.updateMeetingType'],
  ["app.delete('/api/meeting-types/:id', async", '// Meeting Facilities CRUD API', 'GabahDomainService.deleteMeetingType'],
  ["app.post('/api/meeting-facilities', async", "app.patch('/api/meeting-facilities/:id'", 'GabahDomainService.createMeetingFacility'],
  ["app.patch('/api/meeting-facilities/:id', async", "app.delete('/api/meeting-facilities/:id'", 'GabahDomainService.updateMeetingFacility'],
  ["app.delete('/api/meeting-facilities/:id', async", '// VITE MIDDLEWARE', 'GabahDomainService.deleteMeetingFacility'],
];
for (const [start, end, call] of routeCases) {
  const body = sliceBetween(server, start, end);
  assert.ok(body.includes('await ' + call + '('), call + ' route must await service persistence');
}

console.log('Asset, room reservation, meeting room/type/facility persistence checks: 36/36 passed');
