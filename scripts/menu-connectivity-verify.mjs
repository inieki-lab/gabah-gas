/**
 * MENU CONNECTIVITY — LIVE HTTP VERIFICATION SCRIPT
 *
 * Self-terminating: boots the compiled server bundle on a random port with
 * a generated admin password, logs in, and fetches every collection that
 * backs a sidebar menu. Prints a PASS/FAIL table (HTTP status + array type).
 * No real credentials or tokens are printed. State file is backed up and
 * restored; the test runs on a fresh re-seeded state.
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

    const login = await req(base, 'POST', '/api/auth/login', {
      body: { email: 'admin@foodstation.co.id', password: adminPass },
    });
    const token = login.json?.data?.token || '';
    record('Admin login', '200 + token', `HTTP ${login.status}`, login.status === 200 && token.length > 0);

    // Every sidebar menu and its backing collection. Read-only GETs only.
    const menuChecks = [
      ['Dashboard KPI',        '/api/dashboard/stats',          'object'],
      ['Katalog Aset',         '/api/assets',                   'array'],
      ['Aset Saya',            '/api/assets',                   'array'],
      ['Servis & Maintenance', '/api/maintenances',             'array'],
      ['Software & SaaS',      '/api/assets',                   'array'],
      ['Peminjaman Barang',    '/api/loans',                    'array'],
      ['Helpdesk & Tiket',     '/api/tickets',                  'array'],
      ['Reservasi Ruangan',    '/api/meeting-rooms',            'array'],
      ['Reservasi (booking)',  '/api/room-reservations',        'array'],
      ['Vendor Rekanan',       '/api/vendors',                  'array'],
      ['Contract Management',  '/api/contracts',                'array'],
      ['Knowledge Base',       '/api/knowledge',                'array'],
      ['Laporan (sumber data)','/api/audit-logs',               'array'],
      ['Administrasi: users',  '/api/users',                    'array'],
      ['Administrasi: kategori','/api/taxonomy/categories',     'array'],
      ['Administrasi: divisi', '/api/master/divisions',         'array'],
      ['Administrasi: lokasi', '/api/master/locations',         'array'],
      ['Administrasi: numbering','/api/numbering/sequences',    'object'],
      ['Reminder kontrak',     '/api/contracts/reminders/overview', 'object'],
      ['Mutasi aset (backend)','/api/movements',                'array'],
      ['Rekonsiliasi (backend)','/api/reconciliation',          'object'],
    ];

    for (const [label, ep, kind] of menuChecks) {
      const r = await req(base, 'GET', ep, { token });
      const payload = r.json?.data;
      const isKind =
        kind === 'array' ? Array.isArray(payload) :
        payload !== null && typeof payload === 'object';
      const label2 = `${label}  (${ep})`;
      record(label2, `HTTP 200 + ${kind}`, `HTTP ${r.status} + ${Array.isArray(payload) ? `array(${payload.length})` : typeof payload}`,
        r.status === 200 && isKind);
    }

    let failed = 0;
    console.log('\nMENU CONNECTIVITY — RESULTS');
    console.log('='.repeat(72));
    for (const r of results) {
      console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.test.padEnd(46)} [${r.actual}]`);
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
