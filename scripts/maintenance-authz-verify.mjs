/**
 * GABAH MAINTENANCE AUTHZ — LIVE HTTP VERIFICATION SCRIPT (Stage 13F)
 *
 * Self-terminating: boots the compiled server bundle on a random port with the
 * development file store, logs in with provisioned canonical credentials, and
 * asserts the legacy maintenance authorization matrix is invariant:
 *   - read filter chain (IT/GA/SC filtered; Auditor full; legacy fall-through)
 *   - write allowlist (Admin GABAH / IT / GA) + division authority
 * PostgreSQL-mode enforcement is verified statically by
 * dynamic-rbac-foundation-verify.mjs; CI has no PostgreSQL instance, so no
 * runtime-PG claim is made here.
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.PORT = process.env.PORT || '0';

import fs from 'node:fs';
import path from 'node:path';
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
  } catch {
    return {};
  }
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

async function waitForServer(base, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) return true;
    } catch { /* not ready yet */ }
    await new Promise(r => setTimeout(r, 300));
  }
  return false;
}

function codes(data) {
  return new Set((data || []).map(m => String(m.schedule_code || '')));
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

  const PORT = 39500 + Math.floor(Math.random() * 2000);
  const base = `http://127.0.0.1:${PORT}`;
  const child = spawn(process.execPath, [serverPath], {
    env: { ...process.env, PORT: String(PORT), NODE_ENV: 'development' },
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

  let failed = 0;
  try {
    if (!(await waitForServer(base))) {
      console.error('Server failed to start. Log tail:\n' + serverLog.slice(-2000));
      process.exit(1);
    }
    record('Server boots on isolated port', 'health 200', 'health 200', true);

    // Log in the canonical accounts needed for the matrix.
    const creds = readDevCredentials();
    const tokens = {};
    const accounts = {
      admin: 'admin@foodstation.co.id',        // Admin GABAH (superadmin)
      it: 'it.support@foodstation.co.id',      // IT
      ga: 'ga@foodstation.co.id',              // GA
      sc: 'sc.warehouse@foodstation.co.id',    // Supply Chain
      pibc: 'pibc.admin@foodstation.co.id',    // PIBC
      karyawan: 'hendra.w@foodstation.co.id',  // Karyawan
      auditor: 'auditor@foodstation.co.id',    // Auditor
    };
    for (const [key, email] of Object.entries(accounts)) {
      const pass = creds[email] || process.env.GABAH_TEST_PASSWORD || '';
      const login = await req(base, 'POST', '/api/auth/login', { body: { email, password: pass } });
      record(`login ${key} (${email})`, '200 + token', `HTTP ${login.status}`, login.status === 200 && !!login.json?.data?.token);
      if (login.status === 200 && login.json?.data?.token) tokens[key] = login.json.data.token;
    }

    // ---------- READ (legacy filter chain invariance, file-store) ----------
    const anon = await req(base, 'GET', '/api/maintenances');
    record('GET anonymous', '401', `HTTP ${anon.status}`, anon.status === 401);

    const adminList = await req(base, 'GET', '/api/maintenances', { token: tokens.admin });
    record('GET admin sees full seeded schedule', 'full list', `HTTP ${adminList.status} (${codes(adminList.json?.data).size} sched)`,
      adminList.status === 200 && codes(adminList.json?.data).has('MNT-2026-001') && codes(adminList.json?.data).has('MNT-2026-002'));

    const auditorList = await req(base, 'GET', '/api/maintenances', { token: tokens.auditor });
    record('GET auditor sees full list', 'full list', `HTTP ${auditorList.status} (${codes(auditorList.json?.data).size} sched)`,
      auditorList.status === 200 && codes(auditorList.json?.data).has('MNT-2026-001') && codes(auditorList.json?.data).has('MNT-2026-002'));

    const itList = await req(base, 'GET', '/api/maintenances', { token: tokens.it });
    record('GET IT filtered to IT scope only', 'MNT-002 only', `HTTP ${itList.status} (${[...codes(itList.json?.data)].join(',')})`,
      itList.status === 200 && codes(itList.json?.data).has('MNT-2026-002') && !codes(itList.json?.data).has('MNT-2026-001'));

    const gaList = await req(base, 'GET', '/api/maintenances', { token: tokens.ga });
    record('GET GA filtered to GA/General scope', 'MNT-001+003 (General)', `HTTP ${gaList.status} (${[...codes(gaList.json?.data)].join(',')})`,
      gaList.status === 200 && codes(gaList.json?.data).has('MNT-2026-001') && codes(gaList.json?.data).has('MNT-2026-003') && !codes(gaList.json?.data).has('MNT-2026-002'));

    const scList = await req(base, 'GET', '/api/maintenances', { token: tokens.sc });
    record('GET Supply Chain sees only SC schedules', 'MNT-003 only', `HTTP ${scList.status} (${[...codes(scList.json?.data)].join(',')})`,
      scList.status === 200 && codes(scList.json?.data).has('MNT-2026-003') && !codes(scList.json?.data).has('MNT-2026-001') && !codes(scList.json?.data).has('MNT-2026-002'));

    const karList = await req(base, 'GET', '/api/maintenances', { token: tokens.karyawan });
    record('GET Karyawan legacy fall-through (full list) invariant', 'full list', `HTTP ${karList.status} (${codes(karList.json?.data).size} sched)`,
      karList.status === 200 && codes(karList.json?.data).has('MNT-2026-001') && codes(karList.json?.data).has('MNT-2026-002'));

    const pibcList = await req(base, 'GET', '/api/maintenances', { token: tokens.pibc });
    record('GET PIBC legacy fall-through (full list) invariant', 'full list', `HTTP ${pibcList.status} (${codes(pibcList.json?.data).size} sched)`,
      pibcList.status === 200 && codes(pibcList.json?.data).has('MNT-2026-001') && codes(pibcList.json?.data).has('MNT-2026-002'));

    // ---------- CREATE (allowlist + division authority) ----------
    const anonPost = await req(base, 'POST', '/api/maintenances', { body: { asset_id: 'AST-HSV-001' } });
    record('POST anonymous', '401', `HTTP ${anonPost.status}`, anonPost.status === 401);

    const karPost = await req(base, 'POST', '/api/maintenances', { token: tokens.karyawan, body: { asset_id: 'AST-HSV-001', title: 'Test Karyawan' } });
    record('POST Karyawan blocked (legacy allowlist)', '403', `HTTP ${karPost.status}`, karPost.status === 403);

    const auditorPost = await req(base, 'POST', '/api/maintenances', { token: tokens.auditor, body: { asset_id: 'AST-HSV-001', title: 'Test Auditor' } });
    record('POST Auditor blocked (read-only)', '403', `HTTP ${auditorPost.status}`, auditorPost.status === 403);

    const scPost = await req(base, 'POST', '/api/maintenances', { token: tokens.sc, body: { asset_id: 'AST-HSV-001', title: 'Test SC' } });
    record('POST Supply Chain blocked (legacy rule: not in allowlist)', '403', `HTTP ${scPost.status}`, scPost.status === 403);

    const pibcPost = await req(base, 'POST', '/api/maintenances', { token: tokens.pibc, body: { asset_id: 'AST-HSV-001', title: 'Test PIBC' } });
    record('POST PIBC blocked (legacy rule: not in allowlist)', '403', `HTTP ${pibcPost.status}`, pibcPost.status === 403);

    const gaOnIt = await req(base, 'POST', '/api/maintenances', { token: tokens.ga, body: { asset_id: 'AST-HSV-001', title: 'GA membuat jadwal aset IT' } });
    record('POST GA on IT asset blocked (division authority)', '403', `HTTP ${gaOnIt.status}`, gaOnIt.status === 403);

    const itOnGa = await req(base, 'POST', '/api/maintenances', { token: tokens.it, body: { asset_id: 'AST-KDR-001', title: 'IT membuat jadwal aset GA' } });
    record('POST IT on GA asset blocked (division authority)', '403', `HTTP ${itOnGa.status}`, itOnGa.status === 403);

    const itOnIt = await req(base, 'POST', '/api/maintenances', { token: tokens.it, body: { asset_id: 'AST-HSV-001', title: 'IT jadwal verify' } });
    record('POST IT on IT asset allowed', '201', `HTTP ${itOnIt.status}`, itOnIt.status === 201);
    const createdId = itOnIt.json?.data?.id;

    const adminOnGa = await req(base, 'POST', '/api/maintenances', { token: tokens.admin, body: { asset_id: 'AST-KDR-001', title: 'Admin jadwal verify' } });
    record('POST admin (superadmin) on GA asset allowed', '201', `HTTP ${adminOnGa.status}`, adminOnGa.status === 201);

    // ---------- UPDATE (allowlist + division authority) ----------
    const karPatch = await req(base, 'PATCH', '/api/maintenances/mnt-002', { token: tokens.karyawan, body: { notes: 'x' } });
    record('PATCH Karyawan blocked (legacy allowlist)', '403', `HTTP ${karPatch.status}`, karPatch.status === 403);

    const auditorPatch = await req(base, 'PATCH', '/api/maintenances/mnt-002', { token: tokens.auditor, body: { notes: 'x' } });
    record('PATCH Auditor blocked (read-only)', '403', `HTTP ${auditorPatch.status}`, auditorPatch.status === 403);

    const scPatch = await req(base, 'PATCH', '/api/maintenances/mnt-002', { token: tokens.sc, body: { notes: 'x' } });
    record('PATCH Supply Chain blocked (legacy allowlist)', '403', `HTTP ${scPatch.status}`, scPatch.status === 403);

    const gaOnItPatch = await req(base, 'PATCH', '/api/maintenances/mnt-002', { token: tokens.ga, body: { notes: 'GA ubah jadwal IT' } });
    record('PATCH GA on IT schedule blocked (division authority)', '403', `HTTP ${gaOnItPatch.status}`, gaOnItPatch.status === 403);

    const gaPatchOwn = await req(base, 'PATCH', '/api/maintenances/mnt-001', { token: tokens.ga, body: { notes: 'GA ubah jadwal GA' } });
    record('PATCH GA on GA schedule allowed', '200', `HTTP ${gaPatchOwn.status}`, gaPatchOwn.status === 200);

    const itPatchOwn = createdId
      ? await req(base, 'PATCH', `/api/maintenances/${createdId}`, { token: tokens.it, body: { notes: 'IT perbarui jadwalnya' } })
      : { status: 0 };
    record('PATCH IT on IT schedule allowed', '200', `HTTP ${itPatchOwn.status}`, itPatchOwn.status === 200);

    const adminPatch = await req(base, 'PATCH', '/api/maintenances/mnt-002', { token: tokens.admin, body: { notes: 'admin patch verify' } });
    record('PATCH admin (superadmin) on IT schedule allowed', '200', `HTTP ${adminPatch.status}`, adminPatch.status === 200);

    // CR-06 invariance: schedule asset binding must not drift via PATCH.
    const drift = await req(base, 'PATCH', `/api/maintenances/${createdId || 'mnt-002'}`, { token: tokens.admin, body: { asset_id: 'AST-KDR-001', title: 'attempt asset drift' } });
    record('PATCH cannot rebind schedule to another asset (asset_id ignored via allowlist)', 'asset_id tetap AST-HSV-001',
      `asset_id=${drift.json?.data?.asset_id}`,
      String(drift.json?.data?.asset_id) === 'AST-HSV-001');
  } catch (err) {
    console.error('Unexpected failure:', err);
    failed = 1;
  } finally {
    cleanup();
  }

  console.log('='.repeat(70));
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'} | ${r.test} | expected: ${r.expected} | actual: ${r.actual}`);
  }
  failed = failed + results.filter(r => !r.pass).length;
  console.log('='.repeat(70));
  console.log(`TOTAL: ${results.length} | PASS: ${results.filter(r => r.pass).length} | FAIL: ${results.filter(r => !r.pass).length}`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
