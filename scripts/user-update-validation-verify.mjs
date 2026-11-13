import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

const results = [];
const record = (name, expected, actual, pass) => results.push({ name, expected, actual, pass: Boolean(pass) });
async function req(base, method, route, { token, body } = {}) {
  const r = await fetch(`${base}${route}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = {}; try { json = await r.json(); } catch {}
  return { status: r.status, json };
}
async function main() {
  const serverPath = path.resolve('dist/server.cjs');
  if (!fs.existsSync(serverPath)) throw new Error('dist/server.cjs not found');
  const stateFile = path.resolve('server/data/gabah_state.json');
  const backup = fs.existsSync(stateFile) ? fs.readFileSync(stateFile, 'utf8') : null;
  if (backup !== null) fs.rmSync(stateFile);
  const port = 39000 + Math.floor(Math.random() * 2000);
  const base = `http://127.0.0.1:${port}`;
  const adminPassword = crypto.randomBytes(16).toString('base64url');
  const child = spawn(process.execPath, [serverPath], {
    env: { ...process.env, PORT: String(port), NODE_ENV: 'development', GABAH_INITIAL_ADMIN_PASSWORD: adminPassword, GABAH_INITIAL_USER_PASSWORD: crypto.randomBytes(16).toString('base64url'), GABAH_TEST_PASSWORD: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', x => logs += x.toString());
  child.stderr.on('data', x => logs += x.toString());
  const cleanup = () => {
    try { child.kill('SIGKILL'); } catch {}
    if (backup !== null) fs.writeFileSync(stateFile, backup);
    else if (fs.existsSync(stateFile)) fs.rmSync(stateFile);
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(130); });
  try {
    let healthy = false;
    for (let i = 0; i < 60; i++) {
      try { if ((await fetch(`${base}/api/health`)).ok) { healthy = true; break; } } catch {}
      await new Promise(r => setTimeout(r, 300));
    }
    if (!healthy) throw new Error('Server did not become healthy: ' + logs.slice(-1200));
    const login = await req(base, 'POST', '/api/auth/login', { body: { email: 'admin@foodstation.co.id', password: adminPassword } });
    const token = login.json?.data?.token || login.json?.token;
    record('Admin login', 'token', token ? 'token issued' : `HTTP ${login.status}`, Boolean(token));
    if (!token) throw new Error('Admin login failed');
    const email = `profile-validation-${Date.now()}@example.test`;
    const created = await req(base, 'POST', '/api/users', { token, body: { name: 'Profile Validation Fixture', email, role: 'Karyawan', division: 'Umum', department: 'QA' } });
    const id = created.json?.data?.id;
    record('Create disposable user', '201 + ID', `HTTP ${created.status} + ${Boolean(id)}`, created.status === 201 && Boolean(id));
    if (!id) throw new Error('Fixture user creation failed');
    const getUser = async () => ((await req(base, 'GET', '/api/users', { token })).json?.data || []).find(u => u.id === id);
    const original = await getUser();
    const duplicate = await req(base, 'PATCH', `/api/users/${id}`, { token, body: { name: 'Must Not Persist', email: 'admin@foodstation.co.id' } });
    const afterDuplicate = await getUser();
    record('Duplicate email does not partially mutate name', '400 + original name', `HTTP ${duplicate.status} + ${afterDuplicate?.name}`, duplicate.status === 400 && afterDuplicate?.name === original?.name);
    const bool = await req(base, 'PATCH', `/api/users/${id}`, { token, body: { is_active: 'false' } });
    const afterBool = await getUser();
    record('String is_active rejected', '400 + active true', `HTTP ${bool.status} + ${afterBool?.is_active}`, bool.status === 400 && afterBool?.is_active === true);
    const role = await req(base, 'PATCH', `/api/users/${id}`, { token, body: { role: 'Super Admin Root' } });
    const afterRole = await getUser();
    record('Unknown primary role rejected', '400 + Karyawan', `HTTP ${role.status} + ${afterRole?.role}`, role.status === 400 && afterRole?.role === 'Karyawan');
    const malformed = await req(base, 'PATCH', `/api/users/${id}`, { token, body: { email: 'not-an-email' } });
    const afterMalformed = await getUser();
    record('Malformed email rejected', '400 + original email', `HTTP ${malformed.status} + ${afterMalformed?.email}`, malformed.status === 400 && afterMalformed?.email === email);
    const shortPass = await req(base, 'PATCH', `/api/users/${id}`, { token, body: { password: '123' } });
    record('Short password rejected', '400', `HTTP ${shortPass.status}`, shortPass.status === 400);
    const valid = await req(base, 'PATCH', `/api/users/${id}`, { token, body: { name: 'Updated QA Fixture', department: 'QA Validation' } });
    const afterValid = await getUser();
    record('Valid profile update accepted', '200 + saved fields', `HTTP ${valid.status} + ${afterValid?.name} / ${afterValid?.department}`, valid.status === 200 && afterValid?.name === 'Updated QA Fixture' && afterValid?.department === 'QA Validation');
    const failed = results.filter(x => !x.pass);
    console.log('=== USER PROFILE UPDATE VALIDATION ===');
    for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'} | ${x.name} | expected: ${x.expected} | actual: ${x.actual}`);
    console.log(`TOTAL: ${results.length} | PASS: ${results.length - failed.length} | FAIL: ${failed.length}`);
    process.exit(failed.length ? 1 : 0);
  } catch (e) {
    console.error('Verification error:', e.message);
    console.error('Server log tail:', logs.slice(-1200));
    process.exit(1);
  }
}
main();
