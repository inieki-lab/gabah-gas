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

const bulkStart = server.indexOf("app.post('/api/users/bulk-import'");
const bulkEnd = server.indexOf("app.patch('/api/users/:id'", bulkStart);
assert.ok(bulkStart >= 0 && bulkEnd > bulkStart, 'user bulk-import route must exist');
const bulk = server.slice(bulkStart, bulkEnd);
for (const [field, limit] of [['name', 160], ['email', 254], ['division', 120], ['department', 120], ['phone', 40]]) {
  assert.ok(bulk.includes(`${field}.length > ${limit}`), `bulk import must bound ${field} to ${limit} characters`);
}

console.log('PASS: user creation and bulk import enforce profile field bounds, normalized values, and server-generated credentials.');
