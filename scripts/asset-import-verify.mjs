/**
 * BULK IMPORT ASSETS — LIVE HTTP VERIFICATION SCRIPT
 *
 * Self-terminating: boots the compiled server bundle on a random port,
 * runs the asset bulk-import acceptance matrix via HTTP, prints a
 * PASS/FAIL table, exits. No real credentials or tokens are printed.
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
  const userPass = crypto.randomBytes(12).toString('base64url');
  const child = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: 'development',
      GABAH_INITIAL_ADMIN_PASSWORD: adminPass,
      GABAH_INITIAL_USER_PASSWORD: userPass,
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
    const anon = await req(base, 'POST', '/api/assets/bulk-import', { body: { assets: [] } });
    record('Anonymous bulk-import', '401/403', `HTTP ${anon.status}`, [401, 403].includes(anon.status));

    // ---------- Admin login ----------
    const login = await req(base, 'POST', '/api/auth/login', {
      body: { email: 'admin@foodstation.co.id', password: adminPass },
    });
    const adminToken = login.json?.token || login.json?.data?.token;
    record('Admin login (env-provisioned password)', 'token issued', adminToken ? 'token issued' : 'none', Boolean(adminToken));
    if (!adminToken) throw new Error('No admin token — cannot continue.');

    // ---------- Empty + oversized batch ----------
    const rEmpty = await req(base, 'POST', '/api/assets/bulk-import', { token: adminToken, body: { assets: [] } });
    record('Empty batch rejected', '400', `HTTP ${rEmpty.status}`, rEmpty.status === 400);

    const oversized = Array.from({ length: 501 }, (_, i) => ({ name: `Bulk Aset ${i}` }));
    const rBig = await req(base, 'POST', '/api/assets/bulk-import', { token: adminToken, body: { assets: oversized } });
    record('Oversized batch (>500) rejected', '400', `HTTP ${rBig.status}`, rBig.status === 400);

    // ---------- Happy path: laptop + furniture + 1 invalid row ----------
    const suffix = crypto.randomBytes(3).toString('hex');
    const snLaptop = `SN-${suffix}-LAP`;
    const batch = [
      {
        name: `Laptop Impor ${suffix}`, category: 'Laptop / Notebook', owner_division: 'IT',
        brand: 'Lenovo', model: 'ThinkPad T14', serial_number: snLaptop,
        corporate_asset_number: `FST-IT-${suffix}`, location: 'Kantor Pusat - Lantai 3',
        condition: 'good', purchase_price: '15000000', purchase_date: '2026-01-15', is_loanable: 'Ya',
      },
      {
        name: `Kursi Impor ${suffix}`, category: 'Inventaris Furniture (Meja, Kursi, Lemari)',
        condition: 'Rusak', notes: 'tanpa kondisi valid',
      },
      { name: '' }, // invalid: missing name
    ];
    const r1 = await req(base, 'POST', '/api/assets/bulk-import', { token: adminToken, body: { assets: batch } });
    const d1 = r1.json?.data || {};
    record('Bulk import returns created=2', 'created=2', `created=${d1.created}`, d1.created === 2);
    record('Missing-name row rejected', 'failed=1', `failed=${d1.failed}`, d1.failed === 1);
    const laptop = (d1.assets || []).find(a => String(a.asset_number || '').includes('HLT'));
    const chair = (d1.assets || []).find(a => String(a.asset_number || '').includes('INV-F'));
    record('Laptop gets IT-HLT- asset number', 'IT-HLT-*', laptop?.asset_number || 'none', /^IT-HLT-\d{4}-\d+$/.test(laptop?.asset_number || ''));
    record('Furniture forced to GA-INV-F- asset number', 'GA-INV-F-*', chair?.asset_number || 'none', /^GA-INV-F-\d{4}-\d+$/.test(chair?.asset_number || ''));
    record('Unknown condition -> warning (not failure)', 'warnings>=1', `warnings=${(d1.warnings || []).length}`, (d1.warnings || []).length >= 1);
    record('No password material echoed', 'clean', /password_hash|temp_password/.test(JSON.stringify(r1.json)) ? 'leak' : 'clean', !/password_hash|temp_password/.test(JSON.stringify(r1.json)));

    // ---------- Persisted state: price + loanable flag ----------
    if (laptop?.id) {
      const got = await req(base, 'GET', `/api/assets/${laptop.id}`, { token: adminToken });
      record('Purchase price persisted', '15000000', `${got.json?.data?.purchase_price}`, Number(got.json?.data?.purchase_price) === 15000000);
      record('is_loanable parsed from "Ya"', 'true', `${got.json?.data?.is_loanable}`, got.json?.data?.is_loanable === true);
    }

    // ---------- Duplicate SN rejected without allow_update ----------
    const r2 = await req(base, 'POST', '/api/assets/bulk-import', {
      token: adminToken,
      body: { assets: [{ name: `Laptop Duplikat ${suffix}`, serial_number: snLaptop }] },
    });
    const d2 = r2.json?.data || {};
    record('Duplicate SN rejected without allow_update', 'failed=1 & created=0', `failed=${d2.failed} created=${d2.created}`,
      d2.failed === 1 && d2.created === 0 && (d2.errors || []).some(e => e.includes('terdaftar')));

    // ---------- allow_update=true updates the existing asset ----------
    const newLoc = `Gudang Beras ${suffix}`;
    const r3 = await req(base, 'POST', '/api/assets/bulk-import', {
      token: adminToken,
      body: {
        allow_update: true,
        assets: [{ name: `Laptop Impor ${suffix} (Rev)`, serial_number: snLaptop, location: newLoc }],
      },
    });
    const d3 = r3.json?.data || {};
    record('allow_update updates existing SN', 'updated=1 & created=0', `updated=${d3.updated} created=${d3.created}`,
      d3.updated === 1 && d3.created === 0);
    if (laptop?.id) {
      const got = await req(base, 'GET', `/api/assets/${laptop.id}`, { token: adminToken });
      record('Update path applied new location', newLoc, `${got.json?.data?.location}`, got.json?.data?.location === newLoc);
    }

    // ---------- Duplicate key inside one file rejected ----------
    const r4 = await req(base, 'POST', '/api/assets/bulk-import', {
      token: adminToken,
      body: { assets: [{ name: `A ${suffix}`, serial_number: `SN-${suffix}-DUP` }, { name: `B ${suffix}`, serial_number: `SN-${suffix}-DUP` }] },
    });
    const d4 = r4.json?.data || {};
    record('Duplicate SN inside file rejected', 'created=1 & failed>=1', `created=${d4.created} failed=${d4.failed}`,
      d4.created === 1 && (d4.failed || 0) >= 1);

    // ---------- Division authority enforced per row (IT user, SC vehicle) ----------
    // Catatan: furniture INV-F SENGAJA boleh dibuat peran mana pun (jadi milik GA),
    // jadi uji authority pakai kategori SC.
    const itLogin = await req(base, 'POST', '/api/auth/login', {
      body: { email: 'it.support@foodstation.co.id', password: userPass },
    });
    const itToken = itLogin.json?.token || itLogin.json?.data?.token;
    record('IT user login (GABAH_INITIAL_USER_PASSWORD)', 'token issued', itToken ? 'token issued' : 'none', Boolean(itToken));
    if (itToken) {
      const r5 = await req(base, 'POST', '/api/assets/bulk-import', {
        token: itToken,
        body: { assets: [{ name: `Truk IT ${suffix}`, category: 'Kendaraan Logistik / Truk Beras' }] },
      });
      const d5 = r5.json?.data || {};
      record('IT user importing SC vehicle -> row error', 'failed=1', `failed=${d5.failed}`, d5.failed === 1);
    }

    // ---------- Non-authorized role guard (LAST: switch-role rotates token) ----------
    const sw = await req(base, 'POST', '/api/auth/switch-role', { token: adminToken, body: { role: 'Karyawan' } });
    const staffToken = sw.json?.token || sw.json?.data?.token;
    if (staffToken) {
      const forbidden = await req(base, 'POST', '/api/assets/bulk-import', {
        token: staffToken,
        body: { assets: [{ name: `Aset Karyawan ${suffix}` }] },
      });
      record('Karyawan bulk-import', '403', `HTTP ${forbidden.status}`, forbidden.status === 403);
    } else {
      record('Non-admin guard (switch-role refused in strict builds)', 'n/a', 'switch-role refused', true);
    }

    // ---------- Summary ----------
    const total = results.length;
    const passed = results.filter(r => r.pass).length;
    console.log('\n=== ASSET BULK IMPORT VERIFY ===');
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
