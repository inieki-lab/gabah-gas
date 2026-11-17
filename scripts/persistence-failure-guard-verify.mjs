import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');
assert.equal(
  (server.match(/persistDataStore\(\)\.catch\(\(\)\s*=>\s*\{\s*\}\)/g) || []).length,
  0,
  'No API mutation may silently swallow persistence errors',
);
assert.match(
  server,
  /const persistMutationOrRespond = async[\s\S]*await persistDataStore\(\)[\s\S]*res\.status\(503\)/,
  'Mutations must await persistence and fail closed',
);
assert.match(server, /void persistDataStore\(\)\.catch\(/, 'Background persistence must handle rejected writes');

const passwordRoute = server.slice(
  server.indexOf("app.post('/api/auth/change-password'"),
  server.indexOf("app.get('/api/auth/me'"),
);
assert.ok(
  passwordRoute.indexOf('persistMutationOrRespond(res)') < passwordRoute.indexOf('revokeUserSessions(user.id)'),
  'Password sessions rotate only after persistence succeeds',
);
assert.match(passwordRoute, /previousCredentials[\s\S]*user\.password_hash = previousCredentials\.password_hash/);

const services = fs.readFileSync('server/services.ts', 'utf8');
assert.match(services, /async function persistDomainMutation[\s\S]*statusCode: 503/);
const methods = [
  'requestRoomReservation', 'approveRoomReservation', 'rejectRoomReservation',
  'checkinRoomReservation', 'checkoutRoomReservation', 'cancelRoomReservation',
  'updateMeetingRoom', 'createMeetingType', 'updateMeetingType', 'deleteMeetingType',
  'createMeetingFacility', 'updateMeetingFacility', 'deleteMeetingFacility',
];
for (const method of methods) {
  assert.ok(services.includes('static async ' + method + '('), method + ' must be async');
  assert.ok(server.includes('await GabahDomainService.' + method + '('), method + ' API route must await service');
}
assert.equal(
  (services.match(/persistDataStore\(\)\.catch\(err => console\.warn/g) || []).length,
  1,
  'Only the non-authoritative audit helper may remain best-effort',
);
console.log('Persistence failure response contract: PASS');
