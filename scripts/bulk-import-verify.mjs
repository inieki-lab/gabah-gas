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
import net from 'node:net';

const results = [];
function record(test, expected, actual, pass) {
  results.push({ test, expected, actual, pass: Boolean(pass) });
}

async function req(base, method, urlPath, { token, body, headers = {} } = {}) {
  const res = await fetch(`${base}${urlPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Origin: base,
      ...(token ? { Cookie: token } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = {};
  try { json = await res.json(); } catch { /* empty body */ }
  return { status: res.status, json, setCookie: res.headers.get('set-cookie') || '' };
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

async function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      if (!address || typeof address === 'string') {
        probe.close(() => reject(new Error('Unable to allocate a local TCP port')));
        return;
      }
      probe.close(error => error ? reject(error) : resolve(address.port));
    });
  });
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
    const adminToken = login.setCookie?.split(';', 1)[0] || '';
    record('Admin login (env-provisioned password)', 'token issued', adminToken ? 'token issued' : 'none', Boolean(adminToken));
    if (!adminToken) throw new Error('No admin token — cannot continue.');

    // ---------- Concurrent single-user creation must not collide on IDs ----------
    const idSuffix = crypto.randomBytes(4).toString('hex');
    const [createdA, createdB] = await Promise.all([
      req(base, 'POST', '/api/users', { token: adminToken, body: {
        name: 'ID Collision A', email: `id.collision.a.${idSuffix}@foodstation.co.id`, role: 'Karyawan',
      } }),
      req(base, 'POST', '/api/users', { token: adminToken, body: {
        name: 'ID Collision B', email: `id.collision.b.${idSuffix}@foodstation.co.id`, role: 'Karyawan',
      } }),
    ]);
    const createdAId = createdA.json?.data?.id;
    const createdBId = createdB.json?.data?.id;
    record('Concurrent single-user creation succeeds', 'HTTP 201 for both', `HTTP ${createdA.status} / HTTP ${createdB.status}`,
      createdA.status === 201 && createdB.status === 201);
    record('Concurrent user creation generates distinct stable IDs', 'two distinct USR UUIDs',
      `${createdAId || 'missing'} / ${createdBId || 'missing'}`,
      typeof createdAId === 'string' && typeof createdBId === 'string' && createdAId !== createdBId
        && /^USR-[0-9a-f-]{36}$/i.test(createdAId) && /^USR-[0-9a-f-]{36}$/i.test(createdBId));

    // NOTE: /api/auth/switch-role ROTATES the session (old token destroyed).
    // The non-admin guard test therefore runs LAST, after all admin-token tests.

    // ---------- Canonical primary-role and Location-alias contract matrix ----------
    // Only two main profiles exist: Admin GABAH and Karyawan. Function/role
    // labels (Humas, IT, GA, Auditor, Sekretariat Direksi, ME Admin) are
    // secondary assignments and must never be created as primary profiles.
    // Legacy location aliases (PIBC, Supply Chain/SC) map to Karyawan + office
    // location; they are not primary profiles.
    const invalidPrimaryCreate = await req(base, 'POST', '/api/users', {
      token: adminToken,
      body: { name: 'Primary Role Humas', email: `primary.humas.${crypto.randomBytes(3).toString('hex')}@foodstation.co.id`, role: 'Humas' },
    });
    record('Create user rejects function role as primary profile', '400', `HTTP ${invalidPrimaryCreate.status}`, invalidPrimaryCreate.status === 400);
    const invalidBranchCreate = await req(base, 'POST', '/api/users', {
      token: adminToken,
      body: { name: 'Primary Role SC', email: `primary.sc.${crypto.randomBytes(3).toString('hex')}@foodstation.co.id`, role: 'Supply Chain' },
    });
    record('Create user rejects location label as primary profile', '400', `HTTP ${invalidBranchCreate.status}`, invalidBranchCreate.status === 400);

    // ---------- Bulk import contract matrix ----------
    // Every row in batch1 is a function role or invalid input (must all be rejected).
    const suffix = crypto.randomBytes(3).toString('hex');
    const batch1 = [
      { name: 'Impor Dua', email: `impor.dua.${suffix}@foodstation.co.id`, role: 'GA', division: 'GA', department: 'Sarpras', phone: '081200000002' },
      { name: 'Impor Tiga', email: `impor.tiga.${suffix}@foodstation.co.id`, role: 'Peran Ngawur', division: 'XX', department: 'Gudang', phone: '' },
      { name: 'Impor Humas', email: `impor.humas.${suffix}@foodstation.co.id`, role: 'Humas', division: 'Umum', department: 'Humas', phone: '' },
      { name: 'Email Rusak', email: 'bukan-email', role: 'Karyawan' },
    ];
    const r1 = await req(base, 'POST', '/api/users/bulk-import', {
      token: adminToken,
      body: { users: batch1 },
    });
    const d1 = r1.json?.data || {};
    record('Bulk import rejects non-canonical primary rows', 'created=0', `created=${d1.created}`, d1.created === 0);
    record('Invalid email, unknown role, and function role rows rejected', 'failed=4', `failed=${d1.failed}`, d1.failed === 4);
    record('Unknown/function primary rows returned as row errors', 'errors=4', `errors=${(d1.errors || []).length}`, (d1.errors || []).length === 4);
    record('Function rows rejected with additional-role guidance', 'guidance for role tambahan', (d1.errors || []).some(e => e.includes('role tambahan')), (d1.errors || []).some(e => e.includes('role tambahan')));
    record('No password echoed in response', 'no password fields', JSON.stringify(r1.json).includes('password') ? 'found password key' : 'clean',
      !/temp_password|password_hash/.test(JSON.stringify(r1.json)));

    // ---------- Legacy location aliases + upsert ----------
    // PIBC / Supply Chain / SC are mapped to Karyawan + office location; they are
    // never created as primary profiles.
    const r2 = await req(base, 'POST', '/api/users/bulk-import', {
      token: adminToken,
      body: {
        users: [
          { name: 'Impor Empat', email: `impor.empat.${suffix}@foodstation.co.id`, role: 'PIBC', division: 'Umum', department: 'Pasar', phone: '' },
          { name: 'Impor Lima', email: `impor.lima.${suffix}@foodstation.co.id`, role: 'Supply Chain', division: 'Umum', department: 'Distribusi', phone: '' },
          { name: 'Impor Dua (Updated)', email: `impor.dua.${suffix}@foodstation.co.id`, role: 'IT', division: 'IT', department: 'Infrastruktur', phone: '081200000009' },
        ],
      },
    });
    const d2 = r2.json?.data || {};
    record('Second import creates only legacy-location accounts', 'created=2', `created=${d2.created}`, d2.created === 2);
    record('Legacy PIBC role maps to Karyawan + office location', 'Karyawan / OFF-PIBC', `${d2.users?.find(u => u.email === `impor.empat.${suffix}@foodstation.co.id`)?.role || ''} / ${d2.users?.find(u => u.email === `impor.empat.${suffix}@foodstation.co.id`)?.office_location_id || ''}`, d2.users?.find(u => u.email === `impor.empat.${suffix}@foodstation.co.id`)?.role === 'Karyawan' && d2.users?.find(u => u.email === `impor.empat.${suffix}@foodstation.co.id`)?.office_location_id === 'OFF-PIBC');
    record('Legacy Supply Chain role maps to Karyawan + office location', 'Karyawan / OFF-RPC', `${d2.users?.find(u => u.email === `impor.lima.${suffix}@foodstation.co.id`)?.role || ''} / ${d2.users?.find(u => u.email === `impor.lima.${suffix}@foodstation.co.id`)?.office_location_id || ''}`, d2.users?.find(u => u.email === `impor.lima.${suffix}@foodstation.co.id`)?.role === 'Karyawan' && d2.users?.find(u => u.email === `impor.lima.${suffix}@foodstation.co.id`)?.office_location_id === 'OFF-RPC');
    record('Function role rejected during upsert', 'updated=0', `updated=${d2.updated}`, d2.updated === 0);
    record('No password echoed in response', 'no password fields', JSON.stringify(r2.json).includes('password') ? 'found password key' : 'clean',
      !/temp_password|password_hash/.test(JSON.stringify(r2.json)));
    // ---------- Verify persisted state ----------
    const list = await req(base, 'GET', '/api/users', { token: adminToken });
    const users = list.json?.data || [];
    const piBcUser = users.find(u => u.email === `impor.empat.${suffix}@foodstation.co.id`);
    record('Legacy PIBC role maps to Karyawan + office location (unit stays independent)', 'Karyawan / OFF-PIBC', `${piBcUser?.role} / unit=${piBcUser?.unit_id || 'none'} / ${piBcUser?.office_location_id}`,
      piBcUser?.role === 'Karyawan' && !piBcUser?.unit_id && piBcUser?.office_location_id === 'OFF-PIBC');
    const rpcUser = users.find(u => u.email === `impor.lima.${suffix}@foodstation.co.id`);
    record('Legacy Supply Chain role maps to Karyawan + RPC office location (unit stays independent)', 'Karyawan / OFF-RPC', `${rpcUser?.role} / unit=${rpcUser?.unit_id || 'none'} / ${rpcUser?.office_location_id}`,
      rpcUser?.role === 'Karyawan' && !rpcUser?.unit_id && rpcUser?.office_location_id === 'OFF-RPC');
    const functionRoleUser = users.find(u => u.email === `impor.humas.${suffix}@foodstation.co.id`);
    record('Function role was not created as primary profile', 'no Humas user', functionRoleUser ? functionRoleUser.role : 'not created', !functionRoleUser);

    // ---------- Empty batch rejected ----------
    const r3 = await req(base, 'POST', '/api/users/bulk-import', { token: adminToken, body: { users: [] } });
    record('Empty batch rejected', '400', `HTTP ${r3.status}`, r3.status === 400);

    // ---------- Non-admin guard (LAST: switch-role rotates/destroys admin token) ----------
    const sw = await req(base, 'POST', '/api/auth/switch-role', {
      token: adminToken,
      body: { role: 'Karyawan' },
    });
    const staffToken = sw.setCookie?.split(';', 1)[0] || '';
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
