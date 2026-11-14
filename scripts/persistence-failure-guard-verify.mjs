import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');
const swallowed = server.match(/persistDataStore\(\)\.catch\(\(\)\s*=>\s*\{\s*\}\)/g) || [];
assert.equal(swallowed.length, 0, 'No mutation route may silently swallow authoritative persistence failures');

const guarded = server.match(/if \(!await persistMutationOrRespond\(res\)\) return;/g) || [];
assert.equal(guarded.length, 10, 'Every former silent-persistence route must stop before returning success when persistence fails');

assert.match(server, /const persistMutationOrRespond = async \(res: any\): Promise<boolean> => \{[\s\S]*await persistDataStore\(\)[\s\S]*res\.status\(503\)/,
  'Persistence helper must await the authoritative write and return HTTP 503 on failure');

const passwordRoute = server.slice(server.indexOf("app.post('/api/auth/change-password'"), server.indexOf("app.get('/api/auth/me'"));
assert.ok(passwordRoute.indexOf('persistMutationOrRespond(res)') < passwordRoute.indexOf('revokeUserSessions(user.id)'),
  'Password change must persist before revoking sessions');
assert.match(passwordRoute, /previousCredentials[\s\S]*user\.password_hash = previousCredentials\.password_hash/,
  'Password credentials must be restored if persistence fails');

console.log('Persistence failure response contract: PASS');
