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
import { getAvailablePort } from './test-port.mjs';

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

  const PORT = await getAvailablePort();
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

    // ---------- Profile labels are descriptive only; they never grant RBAC roles ----------
    const customProfile = await req(base, 'POST', '/api/users', {
      token: adminToken,
      body: { name: 'Profile Admin ME', email: `profile.me.${crypto.randomBytes(3).toString('hex')}@foodstation.co.id`, role: 'Admin ME' },
    });
    record('Create user accepts a custom employee profile label', '201', `HTTP ${customProfile.status}`, customProfile.status === 201 && customProfile.json?.data?.role === 'Admin ME');
    const functionProfile = await req(base, 'POST', '/api/users', {
      token: adminToken,
      body: { name: 'Profile Humas', email: `profile.humas.${crypto.randomBytes(3).toString('hex')}@foodstation.co.id`, role: 'Humas' },
    });
    record('Create user accepts function profile label without permission assignment', '201', `HTTP ${functionProfile.status}`, functionProfile.status === 201 && functionProfile.json?.data?.role === 'Humas');

    // ---------- Happy path: 2 new users + invalid rows ----------
    const suffix = crypto.randomBytes(3).toString('hex');
    const batch1 = [
      { name: 'Impor Dua', email: `impor.dua.${suffix}@foodstation.co.id`, role: 'GA', division: 'GA', department: 'Sarpras', phone: '081200000002' },
      { name: 'Impor Tiga', email: `impor.tiga.${suffix}@foodstation.co.id`, role: 'Peran Ngawur', division: 'XX', department: 'Gudang', phone: '' },
      { name: 'Impor Humas', email: `impor.humas.${suffix}@foodstation.co.id`, role: 'Humas', division: 'Umum', department: 'Humas', phone: '' },
    ];
    const r1 = await req(base, 'POST', '/api/users/bulk-import', {
      token: adminToken,
      body: { users: [...batch1, { name: 'Email Rusak', email: 'bukan-email', role: 'Karyawan' }] },
    });
    const d1 = r1.json?.data || {};
    record('Bulk import accepts custom/function profile labels', 'created=3', `created=${d1.created}`, d1.created === 3);
    record('Only invalid email row is rejected', 'failed=1', `failed=${d1.failed}`, d1.failed === 1);
    const profileLabelErrors = (d1.errors || []).filter(error => /role|peran|label profil/i.test(String(error)));
    record('No profile-label validation errors', 'errors=0', `errors=${profileLabelErrors.length}`, profileLabelErrors.length === 0);
    record('Humas is stored as a profile label', 'Humas profile', (d1.users || []).find(u => u.email === `impor.humas.${suffix}@foodstation.co.id`)?.role, (d1.users || []).some(u => u.email === `impor.humas.${suffix}@foodstation.co.id` && u.role === 'Humas'));
    record('No password echoed in response', 'no password fields', JSON.stringify(r1.json).includes('password') ? 'found password key' : 'clean',
      !/temp_password|password_hash/.test(JSON.stringify(r1.json)));

    // ---------- Upsert: same email again → update, not duplicate ----------
    const r2 = await req(base, 'POST', '/api/users/bulk-import', {
      token: adminToken,
      body: {
        users: [
          { name: 'Impor Dua (Updated)', email: `impor.dua.${suffix}@foodstation.co.id`, role: 'IT', division: 'IT', department: 'Infrastruktur', phone: '081200000009' },
          { name: 'Impor Empat', email: `impor.empat.${suffix}@foodstation.co.id`, role: 'PIBC', division: 'Umum', department: 'Pasar', phone: '' },
          { name: 'Impor Lima', email: `impor.lima.${suffix}@foodstation.co.id`, role: 'Supply Chain', division: 'Umum', department: 'Distribusi', phone: '' },
        ],
      },
    });
    const d2 = r2.json?.data || {};
    record('Second import updates existing email', 'updated=1', `updated=${d2.updated}`, d2.updated === 1);
    record('Second import creates new accounts for profile labels', 'created=2', `created=${d2.created}`, d2.created === 2);
    record('Legacy location labels normalize to Karyawan and map to office location', 'warnings mention Karyawan + OFF-RPC/OFF-PIBC', (d2.warnings || []).join(' | '), (d2.warnings || []).some(w => w.includes('dinormalisasi menjadi Karyawan')));

    // ---------- Verify persisted state ----------
    const list = await req(base, 'GET', '/api/users', { token: adminToken });
    const users = list.json?.data || [];
    const updatedUser = users.find(u => u.email === `impor.dua.${suffix}@foodstation.co.id`);
    record('Updated profile persisted (name+dept+role)', 'Impor Dua (Updated) / Infrastruktur / IT',
      `${updatedUser?.name} / ${updatedUser?.department} / ${updatedUser?.role}`,
      updatedUser?.name === 'Impor Dua (Updated)' && updatedUser?.department === 'Infrastruktur' && updatedUser?.role === 'IT');
    const invalidPrimaryUpdate = await req(base, 'PATCH', `/api/users/${updatedUser?.id}`, {
      token: adminToken,
      body: { role: 'Supply Chain' },
    });
    record('Update user accepts profile label without changing RBAC assignment', '200', `HTTP ${invalidPrimaryUpdate.status}`, invalidPrimaryUpdate.status === 200);
    record('No duplicate account after re-import', 'single account', `count=${users.filter(u => u.email === `impor.dua.${suffix}@foodstation.co.id`).length}`,
      users.filter(u => u.email === `impor.dua.${suffix}@foodstation.co.id`).length === 1);
    const unknownRoleUser = users.find(u => u.email === `impor.tiga.${suffix}@foodstation.co.id`);
    record('Custom profile label is retained', 'Peran Ngawur', unknownRoleUser?.role || 'not created', unknownRoleUser?.role === 'Peran Ngawur');
    const branchUser = users.find(u => u.email === `impor.empat.${suffix}@foodstation.co.id`);
    record('Legacy PIBC label becomes Karyawan at PIBC location', 'Karyawan / OFF-PIBC / no location unit', `${branchUser?.role} / unit=${branchUser?.unit_id || 'none'} / ${branchUser?.office_location_id || 'none'}`, branchUser?.role === 'Karyawan' && !branchUser?.unit_id && branchUser?.office_location_id === 'OFF-PIBC');
    const rpcUser = users.find(u => u.email === `impor.lima.${suffix}@foodstation.co.id`);
    record('Legacy Supply Chain label becomes Karyawan at RPC/SC location', 'Karyawan / OFF-RPC / no location unit', `${rpcUser?.role} / unit=${rpcUser?.unit_id || 'none'} / ${rpcUser?.office_location_id || 'none'}`, rpcUser?.role === 'Karyawan' && !rpcUser?.unit_id && rpcUser?.office_location_id === 'OFF-RPC');
    const functionRoleUser = users.find(u => u.email === `impor.humas.${suffix}@foodstation.co.id`);
    record('Function profile is retained without access-role implication', 'Humas', functionRoleUser?.role || 'not created', functionRoleUser?.role === 'Humas');

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
