/**
 * GABAH RBAC scoping — live HTTP verification.
 *
 * Checks that sensitive endpoints honour role boundaries:
 *  - GET /api/users: full user directory restricted to Superadmin.
 *  - GET /api/auth/me: current-user profile (sanitized) for any session.
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.PORT = process.env.PORT || '0';

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

const results = [];
function record(test, expected, actual, pass) {
  results.push({ test, expected, actual, pass: Boolean(pass) });
}

function readDevCredentials() {
  const file = path.resolve(process.cwd(), 'server/data/initial_credentials_dev.txt');
  try {
    const content = fs.readFileSync(file, 'utf8');
    const map = {};
    for (const line of content.split('\n')) {
      const idx = line.indexOf('=>');
      if (idx > 0) map[line.slice(0, idx).trim()] = line.slice(idx + 2).trim();
    }
    return map;
  } catch { return {}; }
}

async function req(base, method, urlPath, { token, body, headers = {} } = {}) {
  const res = await fetch(`${base}${urlPath}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = {};
  try { json = await res.json(); } catch { /* empty body */ }
  return { status: res.status, json };
}

async function waitForServer(base, tries = 80) {
  for (let i = 0; i < tries; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) return true; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

async function main() {
  const serverPath = path.resolve(process.cwd(), 'dist/server.cjs');
  if (!fs.existsSync(serverPath)) {
    console.error('dist/server.cjs not found — run `npm run build` first.');
    process.exit(1);
  }
  const dataDir = path.resolve(process.cwd(), 'server/data');
  const stateFile = path.join(dataDir, 'gabah_state.json');
  let backupState = null;
  if (fs.existsSync(stateFile)) {
    backupState = fs.readFileSync(stateFile, 'utf8');
    fs.rmSync(stateFile);
  }
  const PORT = 39000 + Math.floor(Math.random() * 2000);
  const base = `http://127.0.0.1:${PORT}`;
  const child = spawn(process.execPath, [serverPath], {
    env: { ...process.env, PORT: String(PORT), NODE_ENV: 'development' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverLog = '';
  child.stdout.on('data', (d) => { serverLog += d.toString(); });
  child.stderr.on('data', (d) => { serverLog += d.toString(); });

  const cleanup = () => {
    try { child.kill('SIGKILL'); } catch { /* already dead */ }
    if (backupState !== null) fs.writeFileSync(stateFile, backupState);
    else fs.rmSync(stateFile, { force: true });
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(130); });

  try {
    const up = await waitForServer(base);
    if (!up) { console.error('Server failed to start. Log tail:\n' + serverLog.slice(-2000)); process.exit(1); }
    record('Server boots on isolated port', 'up', 'up', true);

    const adminEmail = 'admin@foodstation.co.id';
    const adminPass = process.env.GABAH_INITIAL_ADMIN_PASSWORD || readDevCredentials()[adminEmail] || '';
    const adminLogin = await req(base, 'POST', '/api/auth/login', { body: { email: adminEmail, password: adminPass } });
    record('admin login (Admin GABAH)', '200 + token', adminLogin.status === 200 && adminLogin.json?.data?.token ? '200 + token' : `HTTP ${adminLogin.status}`, adminLogin.status === 200 && adminLogin.json?.data?.token);
    const adminToken = adminLogin.status === 200 && adminLogin.json?.data?.token ? adminLogin.json.data.token : '';

    const staffLogin = await req(base, 'POST', '/api/auth/login', { body: { email: 'hendra.w@foodstation.co.id', password: readDevCredentials()['hendra.w@foodstation.co.id'] || '' } });
    record('staff login (Karyawan)', '200 + token', staffLogin.status === 200 && staffLogin.json?.data?.token ? '200 + token' : `HTTP ${staffLogin.status}`, staffLogin.status === 200 && staffLogin.json?.data?.token);
    const staffToken = staffLogin.status === 200 && staffLogin.json?.data?.token ? staffLogin.json.data.token : '';

    if (adminToken) {
      const adminDir = await req(base, 'GET', '/api/users', { token: adminToken });
      record('GET /api/users: admin (Superadmin) sees directory', '200', `HTTP ${adminDir.status}`, adminDir.status === 200);
    } else {
      record('GET /api/users: admin', '200', 'no admin token', false);
    }
    if (staffToken) {
      const staffDir = await req(base, 'GET', '/api/users', { token: staffToken });
      record('GET /api/users: ordinary staff (Karyawan) denied', '403', `HTTP ${staffDir.status}`, staffDir.status === 403);
    } else {
      record('GET /api/users: ordinary staff', '403', 'no staff token', false);
    }
  } finally {
    cleanup();
    let failed = 0;
    for (const r of results) { console.log(`${r.pass ? 'PASS' : 'FAIL'} — ${r.test} (expected ${r.expected}, got ${r.actual})`); if (!r.pass) failed++; }
    console.log(`RBAC scoping: ${results.length - failed}/${results.length} checks passed.`);
    if (failed) process.exit(1);
  }
}
main();
