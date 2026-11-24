import fs from 'node:fs';
import assert from 'node:assert/strict';

const admin = fs.readFileSync('src/components/modals/AdministrationModal.tsx', 'utf8');
const api = fs.readFileSync('src/services/gabahApi.ts', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');
const auth = fs.readFileSync('server/auth.ts', 'utf8');
const hardening = fs.readFileSync('server/runtime-hardening.ts', 'utf8');

const forbiddenAdminStorageKeys = [
  'gabah_system_settings', 'gabah_org_divisions', 'gabah_master_locations',
  'gabah_numbering_config', 'gabah_role_permissions', 'gabah_notification_rules',
];
for (const key of forbiddenAdminStorageKeys) {
  assert.equal(admin.includes(key), false, `Administration must not persist or hydrate ${key} from browser storage`);
}
assert.equal(/(?:window\.)?localStorage\.(?:getItem|setItem|removeItem)/.test(admin), false,
  'Administration must not use localStorage');
assert.equal(/localStorage\./.test(api + app), false, 'Authentication credentials must not be stored in localStorage');
assert.match(api, /credentials: 'same-origin'/, 'API requests must send same-origin cookies');
assert.match(server, /res\.cookie\('gabah_session',[\s\S]*httpOnly: true[\s\S]*sameSite: 'strict'/,
  'Session cookie must be HttpOnly and SameSite strict');
assert.match(server, /clearCookie\('gabah_session'/, 'Logout must clear the session cookie');
assert.match(auth, /startsWith\('gabah_session='\)/, 'Authentication must accept the session cookie');
assert.match(hardening, /Permintaan lintas origin ditolak/, 'Cookie-authenticated mutations must validate request origin');
assert.doesNotMatch(server, /token:\s*session\.token/, 'Session tokens must not be returned in JSON responses');

assert.match(admin, /await gabahApi\.createLocation\(/, 'Location creation must be persisted through the server API');
assert.match(admin, /await gabahApi\.createDivision\(/, 'Division creation must be persisted through the server API');
assert.match(admin, /await gabahApi\.updateDivision\(/, 'Division updates must be persisted through the server API');
assert.match(admin, /await gabahApi\.deleteDivision\(/, 'Division deletion must be persisted through the server API');
assert.match(admin, /pratinjau legacy; izin aktif tetap mengikuti Dynamic RBAC di server/i,
  'Legacy permission matrix must not claim to update active RBAC policy');
assert.match(admin, /hanya diperbarui untuk pratinjau sesi ini/i,
  'Legacy numbering preview must not claim to save an active numbering rule');

console.log('Browser storage policy verified: session credentials use HttpOnly same-site cookies with origin checks.');
