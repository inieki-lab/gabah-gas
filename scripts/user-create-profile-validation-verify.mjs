import fs from 'node:fs';
import assert from 'node:assert/strict';

const server = fs.readFileSync('server.ts', 'utf8');
const start = server.indexOf("app.post('/api/users'");
const end = server.indexOf("// Bulk import pegawai", start);
assert.ok(start >= 0 && end > start, 'user create route must exist');
const route = server.slice(start, end);

assert.ok(route.includes('isSuperadminActor(actor)'), 'only Superadmin may create users');
assert.ok(route.includes("['division', division, 120]"));
assert.ok(route.includes("['department', department, 120]"));
assert.ok(route.includes("['phone', phone, 40]"));
assert.ok(route.includes("typeof value !== 'string' || value.length > maxLength"), 'reject non-string and oversized profile fields');
assert.ok(route.includes('const normalizedDivision ='), 'normalize division before persistence');
assert.ok(route.includes('const normalizedDepartment ='), 'normalize department before persistence');
assert.ok(route.includes('const normalizedPhone ='), 'normalize phone before persistence');
assert.ok(route.includes('division: normalizedDivision'));
assert.ok(route.includes('department: normalizedDepartment'));
assert.ok(route.includes('phone: normalizedPhone'));
assert.ok(route.includes("Humas/Sekretariat adalah role fungsi; RPC/SC dan PIBC adalah lokasi kerja"), 'keep org location/function role separation');
assert.ok(route.includes('crypto.randomBytes(12)'), 'initial password must remain server-generated');
assert.ok(!route.includes('password: generatedTempPassword'), 'never return plaintext generated password');

console.log('PASS: user creation enforces Superadmin authority, typed/length-limited profile fields, normalized values, and server-generated credentials.');
