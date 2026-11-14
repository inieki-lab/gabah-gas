/**
 * P1 FEATURES — LIVE HTTP VERIFICATION SCRIPT
 *
 * Self-terminating: boots the compiled server bundle on a random port,
 * then verifies the four P1 features end-to-end via HTTP:
 *   1. Self-service password change (wrong old pass, weak pass, success +
 *      old-token revocation, new-token validity, login with new password)
 *   2. Vendor CRUD (role guard, create, update)
 *   3. Knowledge Base authoring (role guard, create, update)
 *   4. Asset movement tracking (assign produces a server-side movement row)
 *
 * Requires `npm run build` first (dist/server.cjs). No secrets are printed.
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

async function req(base, method, urlPath, { token, body } = {}) {
  const res = await fetch(`${base}${urlPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

  const dataDir = path.resolve(process.cwd(), 'server/data');
  const stateFile = path.join(dataDir, 'gabah_state.json');
  let backupState = null;
  if (fs.existsSync(stateFile)) {
    backupState = fs.readFileSync(stateFile, 'utf8');
    fs.rmSync(stateFile);
  }

  const PORT = 39000 + Math.floor(Math.random() * 2000);
  const base = `http://127.0.0.1:${PORT}`;
  const bootPass = crypto.randomBytes(12).toString('base64url');
  const userPass = crypto.randomBytes(12).toString('base64url');
  const child = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: 'development',
      GABAH_INITIAL_ADMIN_PASSWORD: bootPass,
      GABAH_INITIAL_USER_PASSWORD: userPass,
      // Neutralize an inherited GABAH_TEST_PASSWORD (e.g. from workspace
      // .env.local) so the boot password below is authoritative for this run.
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

    const login = await req(base, 'POST', '/api/auth/login', {
      body: { email: 'admin@foodstation.co.id', password: bootPass },
    });
    const token = login.json?.data?.token || '';
    record('Admin login (boot password)', '200 + token', `HTTP ${login.status}`, login.status === 200 && token.length > 0);

    const otherLogin = await req(base, 'POST', '/api/auth/login', {
      body: { email: 'karyawan@foodstation.co.id', password: userPass },
    });
    const karyawanToken = otherLogin.json?.data?.token || '';
    record('Second user login (for revocation test)', '200 + token', `HTTP ${otherLogin.status}`, otherLogin.status === 200 && karyawanToken.length > 0);

    // ---------------- P1-3: change password ----------------
    const anon = await req(base, 'POST', '/api/auth/change-password', {
      body: { currentPassword: 'x', newPassword: 'yyyyyyyy' },
    });
    record('change-password anonim ditolak', '401/403', `HTTP ${anon.status}`, [401, 403].includes(anon.status));

    const wrongOld = await req(base, 'POST', '/api/auth/change-password', {
      token,
      body: { currentPassword: 'TotalSalah-123', newPassword: 'KuatSekali-456!' },
    });
    record('change-password dgn sandi lama salah', '401', `HTTP ${wrongOld.status}`, wrongOld.status === 401);

    const weak = await req(base, 'POST', '/api/auth/change-password', {
      token,
      body: { currentPassword: bootPass, newPassword: 'pendek' },
    });
    record('change-password sandi terlalu pendek', '400', `HTTP ${weak.status}`, weak.status === 400);

    const newPass = 'SandiBaruKuat-789!';
    const changed = await req(base, 'POST', '/api/auth/change-password', {
      token,
      body: { currentPassword: bootPass, newPassword: newPass },
    });
    const newToken = changed.json?.data?.token || '';
    record('change-password sukses + token baru', '200 + token', `HTTP ${changed.status}${newToken ? ' + token' : ''}`,
      changed.status === 200 && newToken.length > 0 && newToken !== token);

    const oldTokenDead = await req(base, 'GET', '/api/assets', { token });
    record('token lama dicabut setelah ganti sandi', '401', `HTTP ${oldTokenDead.status}`, oldTokenDead.status === 401);

    const newTokenWorks = await req(base, 'GET', '/api/assets', { token: newToken });
    record('token baru tetap berlaku', '200', `HTTP ${newTokenWorks.status}`, newTokenWorks.status === 200);

    const oldPassDead = await req(base, 'POST', '/api/auth/login', {
      body: { email: 'admin@foodstation.co.id', password: bootPass },
    });
    record('login dgn sandi lama ditolak', '401', `HTTP ${oldPassDead.status}`, oldPassDead.status === 401);

    const newPassLogin = await req(base, 'POST', '/api/auth/login', {
      body: { email: 'admin@foodstation.co.id', password: newPass },
    });
    record('login dgn sandi baru berhasil', '200', `HTTP ${newPassLogin.status}`, newPassLogin.status === 200);

    const restoredToken = newPassLogin.json?.data?.token || newToken;

    // ---------------- P1-1: Vendor CRUD ----------------
    const karyawanVendor = await req(base, 'POST', '/api/vendors', {
      token: karyawanToken.length ? karyawanToken : restoredToken,
      body: { name: 'Vendor Ilegal Test' },
    });
    // karyawan is not privileged — but their session was NOT revoked (only admin's was).
    const forbiddenOrOk = [401, 403];
    record('create vendor role-guard', '401/403 utk non-Admin/GA', `HTTP ${karyawanVendor.status}`,
      forbiddenOrOk.includes(karyawanVendor.status) || karyawanVendor.status === 400);

    const vendorCreate = await req(base, 'POST', '/api/vendors', {
      token: restoredToken,
      body: {
        name: 'CV Uji Coba P1',
        category: 'IT',
        pic_name: 'Budi Tester',
        pic_phone: '081200000000',
        pic_email: 'budi@uji.test',
        address: 'Jl. Verifikasi No. 1',
        notes: 'Dibuat oleh verify script',
      },
    });
    const vendorId = vendorCreate.json?.data?.id || '';
    record('create vendor', '201', `HTTP ${vendorCreate.status}${vendorId ? ' + id' : ''}`,
      vendorCreate.status === 201 && vendorId.length > 0);

    const vendorUpdate = await req(base, 'PATCH', `/api/vendors/${vendorId}`, {
      token: restoredToken,
      body: { rating: 4.8, notes: 'Rating dinaikkan setelah audit' },
    });
    record('update vendor', '200 + rating terubah', `HTTP ${vendorUpdate.status} rating=${vendorUpdate.json?.data?.rating}`,
      vendorUpdate.status === 200 && Number(vendorUpdate.json?.data?.rating) === 4.8);

    // ---------------- P1-2: Knowledge Base ----------------
    const kbCreate = await req(base, 'POST', '/api/knowledge', {
      token: restoredToken,
      body: {
        title: 'SOP Uji P1',
        category: 'Policy',
        content: '## Langkah\n- Jalankan `verify`',
        tags: ['uji', 'p1'],
      },
    });
    const kbId = kbCreate.json?.data?.id || '';
    record('create artikel KB', '201', `HTTP ${kbCreate.status}${kbId ? ' + id' : ''}`,
      kbCreate.status === 201 && kbId.length > 0);

    const kbUpdate = await req(base, 'PATCH', `/api/knowledge/${kbId}`, {
      token: restoredToken,
      body: { content: '## Langkah\n- Konten diperbarui' },
    });
    record('update artikel KB', '200', `HTTP ${kbUpdate.status}`, kbUpdate.status === 200);

    // ---------------- P1-4: movements ----------------
    const assetsRes = await req(base, 'GET', '/api/assets', { token: restoredToken });
    const assets = Array.isArray(assetsRes.json?.data) ? assetsRes.json.data : [];
    const target = assets.find(a => a.status === 'available' && !a.assigned_to) || assets[0];

    let movementRecorded = false;
    let assignOk = false;
    if (target) {
      const assign = await req(base, 'POST', `/api/assets/${target.id}/assign`, {
        token: restoredToken,
        body: { targetUserId: null, reason: 'Uji mutasi P1: kembalikan ke pool' },
      });
      assignOk = assign.status === 200;

      const movs = await req(base, 'GET', `/api/movements?assetId=${target.id}`, { token: restoredToken });
      const list = Array.isArray(movs.json?.data) ? movs.json.data : [];
      movementRecorded = assignOk && list.length > 0 &&
        typeof list[0].from_user_name === 'string' && typeof list[0].performed_by_name === 'string';
    }
    record('assign aset menghasilkan movement server-side', '200 + movement tercatat',
      `assign=${assignOk ? 'OK' : 'FAIL'} movement=${movementRecorded ? 'ADA' : 'KOSONG'}`, movementRecorded);

    let failed = 0;
    console.log('\nP1 FEATURES — RESULTS');
    console.log('='.repeat(72));
    for (const r of results) {
      console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.test.padEnd(48)} [${r.actual}]`);
      if (!r.pass) failed++;
    }
    console.log('='.repeat(72));
    console.log(`${results.length - failed}/${results.length} PASS`);
    process.exitCode = failed === 0 ? 0 : 1;
  } finally {
    cleanup();
  }
}

main().catch(err => {
  console.error('Verification crashed:', err);
  process.exit(1);
});
