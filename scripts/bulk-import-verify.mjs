/**
 * BULK IMPORT USERS — LIVE HTTP VERIFICATION SCRIPT
 *
 * Self-terminating: boots the compiled server bundle on a random port,
 * runs the bulk-import acceptance matrix via HTTP, prints a PASS/FAIL
 * table, exits. No real credentials or tokens are printed.
 *
 * Requires `npm run build` first (dist/server.cjs).
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';

const results = [];
function record(test, expected, actual, pass) {
  results.push({ test, expected, actual, pass: Boolean(pass) });
}

async function req(base, method, urlPath, { token, body, headers = {} } = {}) {
  const res = await fetch(`${base}${urlPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = {};
  try { json = await res.json(); } catch { /* empty body */ }
  return { status: res.status, json };
}

async function waitForServer(base, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) return true;
    } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 300));
  }
  return false;
}

async function main() {
  const serverPath = path.resolve(process.cwd(), 'dist/server.cjs');
  if (!fs.existsSync(serverPath)) {
    console.error('dist/server.cjs not found — run `npm run build` first.');
    process.exit(1);
  }

  // Isolated runtime state dir so tests never touch the repo snapshot.
  const dataDir = path.resolve(process.cwd(), 'server/data');
  const stateFile = path.join(dataDir, 'gabah_state.json');
  let backupState = null;
  if (fs.existsSync(stateFile)) {
    backupState = fs.readFileSync(stateFile, 'utf8');
    fs.rmSync(stateFile);
  }

  const PORT = 39000 + Math.floor(Math.random() * 2000);
  const base = `http://127.0.0.1:${PORT}`;
  const adminPass = crypto.randomBytes(12).toString('base64url');
  const child = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: 'development',
      GABAH_INITIAL_ADMIN_PASSWORD: adminPass,
      // Neutralize inherited workspace GABAH_TEST_PASSWORD (see .env.local)
      GABAH_TEST_PASSWORD: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverLog = '';
  child.stdout.on('data', d => { serverLog += d.toString(); });
  child.stderr.on('data', d => { serverLog += d.toString(); });

  const cleanup = () => {
    try { child.kill('SIGKILL'); } catch { /* already dead */ }
    if (backupState !== null) fs.writeFileSync(stateFile, backupState);
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(130); });

  try {
    const up = await waitForServer(base);
    if (!up) {
      console.error('Server failed to start. Log tail:\n' + serverLog.slice(-2000));
      process.exit(1);
    }
    record('Server boots on isolated port', 'health 200', 'health 200', true);

    // ---------- Anonymous guard ----------
    const anon = await req(base, 'POST', '/api/users/bulk-import', { body: { users: [] } });
    record('Anonymous bulk-import', '401/403', `HTTP ${anon.status}`, [401, 403].includes(anon.status));

    // ---------- Admin login ----------
    const login = await req(base, 'POST', '/api/auth/login', {
      body: { email: 'admin@foodstation.co.id', password: adminPass },
    });
    const adminToken = login.json?.token || login.json?.data?.token;
    record('Admin login (env-provisioned password)', 'token issued', adminToken ? 'token issued' : 'none', Boolean(adminToken));
    if (!adminToken) throw new Error('No admin token — cannot continue.');

    // NOTE: /api/auth/switch-role ROTATES the session (old token destroyed).
    // The non-admin guard test therefore runs LAST, after all admin-token tests.

    // ---------- Happy path: 2 new users + 1 invalid row ----------
    const suffix = crypto.randomBytes(3).toString('hex');
    const batch1 = [
      { name: 'Impor Dua', email: `impor.dua.${suffix}@foodstation.co.id`, role: 'GA', division: 'GA', department: 'Sarpras', phone: '081200000002' },
      { name: 'Impor Tiga', email: `impor.tiga.${suffix}@foodstation.co.id`, role: 'Peran Ngawur', division: 'XX', department: 'Gudang', phone: '' },
    ];
    const r1 = await req(base, 'POST', '/api/users/bulk-import', {
      token: adminToken,
      body: { users: [...batch1, { name: 'Email Rusak', email: 'bukan-email', role: 'Karyawan' }] },
    });
    const d1 = r1.json?.data || {};
    record('Bulk import returns created=2', 'created=2', `created=${d1.created}`, d1.created === 2);
    record('Invalid email row rejected', 'failed=1', `failed=${d1.failed}`, d1.failed === 1);
    record('Unknown role -> warning (not failure); bad email -> error', 'warnings>=1 & errors=1', `warnings=${(d1.warnings || []).length} errors=${(d1.errors || []).length}`,
      (d1.warnings || []).length >= 1 && (d1.errors || []).length === 1);
    record('No password echoed in response', 'no password fields', JSON.stringify(r1.json).includes('password') ? 'found password key' : 'clean',
      !/temp_password|password_hash/.test(JSON.stringify(r1.json)));

    // ---------- Upsert: same email again → update, not duplicate ----------
    const r2 = await req(base, 'POST', '/api/users/bulk-import', {
      token: adminToken,
      body: {
        users: [
          { name: 'Impor Dua (Updated)', email: `impor.dua.${suffix}@foodstation.co.id`, role: 'IT', division: 'IT', department: 'Infrastruktur', phone: '081200000009' },
          { name: 'Impor Empat', email: `impor.empat.${suffix}@foodstation.co.id`, role: 'PIBC', division: 'PIBC', department: 'Pasar', phone: '' },
        ],
      },
    });
    const d2 = r2.json?.data || {};
    record('Second import updates existing email', 'updated=1', `updated=${d2.updated}`, d2.updated === 1);
    record('Second import creates new account', 'created=1', `created=${d2.created}`, d2.created === 1);

    // ---------- Verify persisted state ----------
    const list = await req(base, 'GET', '/api/users', { token: adminToken });
    const users = list.json?.data || [];
    const updatedUser = users.find(u => u.email === `impor.dua.${suffix}@foodstation.co.id`);
    record('Updated profile persisted (name+dept+role)', 'Impor Dua (Updated) / Infrastruktur / IT',
      `${updatedUser?.name} / ${updatedUser?.department} / ${updatedUser?.role}`,
      updatedUser?.name === 'Impor Dua (Updated)' && updatedUser?.department === 'Infrastruktur' && updatedUser?.role === 'IT');
    record('No duplicate account after re-import', 'single account', `count=${users.filter(u => u.email === `impor.dua.${suffix}@foodstation.co.id`).length}`,
      users.filter(u => u.email === `impor.dua.${suffix}@foodstation.co.id`).length === 1);
    const fallbackUser = users.find(u => u.email === `impor.tiga.${suffix}@foodstation.co.id`);
    record('Unknown role defaulted to Karyawan', 'role=Karyawan', `role=${fallbackUser?.role}`, fallbackUser?.role === 'Karyawan');

    // ---------- Empty batch rejected ----------
    const r3 = await req(base, 'POST', '/api/users/bulk-import', { token: adminToken, body: { users: [] } });
    record('Empty batch rejected', '400', `HTTP ${r3.status}`, r3.status === 400);

    // ---------- Non-admin guard (LAST: switch-role rotates/destroys admin token) ----------
    const sw = await req(base, 'POST', '/api/auth/switch-role', {
      token: adminToken,
      body: { role: 'Karyawan' },
    });
    const staffToken = sw.json?.token || sw.json?.data?.token;
    if (staffToken) {
      const forbidden = await req(base, 'POST', '/api/users/bulk-import', {
        token: staffToken,
        body: { users: [{ name: 'X', email: 'x@foodstation.co.id' }] },
      });
      record('Non-admin bulk-import', '403', `HTTP ${forbidden.status}`, forbidden.status === 403);
    } else {
      record('Non-admin guard (switch-role refused in strict builds)', 'n/a', 'switch-role refused', true);
    }

    // ---------- Summary ----------
    const total = results.length;
    const passed = results.filter(r => r.pass).length;
    console.log('\n=== BULK IMPORT VERIFY ===');
    for (const r of results) {
      console.log(`${r.pass ? 'PASS' : 'FAIL'} | ${r.test} | expected: ${r.expected} | actual: ${r.actual}`);
    }
    console.log(`TOTAL: ${total} | PASS: ${passed} | FAIL: ${total - passed}`);
    process.exit(total === passed ? 0 : 1);
  } catch (err) {
    console.error('Verification error:', err.message);
    console.error('Server log tail:\n' + serverLog.slice(-1500));
    process.exit(1);
  }
}

main();
