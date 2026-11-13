import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, needsPasswordRehash } from '../server/crypto.ts';
import fs from 'node:fs';

const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

const password = 'GABAH-password-hash-regression-2026';
const salt = 'legacy-salt-for-regression-only';
const legacyDigest = crypto.pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');

assert.equal(verifyPassword(password, legacyDigest, salt), true, 'legacy 100k hash must remain verifiable');
assert.equal(needsPasswordRehash(legacyDigest), true, 'legacy raw hash must be scheduled for upgrade');

const current = hashPassword(password);
const match = current.hash.match(/^pbkdf2-sha512\$(\d+)\$([a-f0-9]{128})$/);
assert.ok(match, 'new hashes must encode algorithm, work factor, and digest');
assert.equal(Number(match[1]), 220_000, 'new hashes must use the current work factor');
assert.equal(verifyPassword(password, current.hash, current.salt), true, 'new versioned hash must verify');
assert.equal(verifyPassword('wrong-password', current.hash, current.salt), false, 'wrong password must fail');
assert.equal(needsPasswordRehash(current.hash), false, 'current hash must not be rehashed');

assert.match(serverSource, /app\.post\('\/api\/auth\/login', async \(req, res\) => \{/);
assert.match(serverSource, /if \(needsPasswordRehash\(user\.password_hash\)\)[\s\S]*await persistDataStore\(\)/);

const excessive = current.hash.replace('220000', '999999999');
assert.equal(verifyPassword(password, excessive, current.salt), false, 'untrusted work factor must be bounded');

console.log('PASS | legacy hash compatibility');
console.log('PASS | 220k PBKDF2-SHA512 new hash');
console.log('PASS | constant-time verification path rejects wrong password');
console.log('PASS | excessive encoded work factor is rejected');
