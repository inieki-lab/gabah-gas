#!/usr/bin/env node
/**
 * CR-04 / CR-05 live verification.
 *
 * Preconditions:
 *   - `npm run build` has been run (dist/server.cjs exists).
 *   - A local PostgreSQL test instance is reachable; pass its admin connection
 *     string via GABAH_TEST_PG_ADMIN_URL (no credentials are embedded here).
 *
 * What it verifies (real behavior, no static assertions):
 *   1. Migration chain 001..005 runs on a FRESH database via server boot.
 *   2. /api/health reports persistence=postgresql (no silent file fallback).
 *   3. Production fail-fast: with a dead DATABASE_URL + NODE_ENV=production the
 *      server must exit non-zero and never serve health 200 (no JSON fallback).
 *   4. Contract CRUD via API + restricted-contract visibility (RBAC).
 *   5. Ticket→contract linkage guard (canSeeContract — no probing restricted).
 *   6. Reminder sweep: EXPIRY_7/35/60 queued, in-app sent, email/telegram
 *      skipped (unconfigured) with honest statuses, zero failures.
 *   7. Idempotency: second sweep same due-day queues nothing.
 *   8. Restart persistence: after process restart, contracts/tickets/state are
 *      reloaded from PostgreSQL (authoritative store).
 *   9. RBAC: reminders/run admin-only (403 for others), scheduler-status
 *      admin-only, Auditor read-only.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import pg from 'pg';

// Admin connection to the PostgreSQL TEST instance. No credentials are
// embedded here — pass a full URL via GABAH_TEST_PG_ADMIN_URL (e.g. a local
// throwaway instance), or rely on trust/peer auth with the no-password default.
const PG_ADMIN_URL = process.env.GABAH_TEST_PG_ADMIN_URL
  || 'postgresql://postgres@127.0.0.1:5432/postgres';
const TEST_DB = process.env.GABAH_TEST_DB_NAME || `gabah_cr_verify_${crypto.randomBytes(3).toString('hex')}`;
const TEST_DB_URL = PG_ADMIN_URL.replace(/\/[^/?]+(\?|$)/, `/${TEST_DB}$1`);

const results = [];
function record(name, expect, actual, pass) {
  results.push({ name, expect, actual, pass });
  const mark = pass ? 'PASS' : 'FAIL';
  console.log(`[${mark}] ${name} — expected: ${expect} | actual: ${actual}`);
}
function summary() {
  const failed = results.filter(r => !r.pass);
  console.log('\n=== CR-04/CR-05 VERIFY SUMMARY ===');
  console.log(`TOTAL: ${results.length} | PASS: ${results.length - failed.length} | FAIL: ${failed.length}`);
  if (failed.length > 0) {
    console.log('Failed checks:');
    for (const f of failed) console.log(`  - ${f.name} (expected ${f.expect}, got ${f.actual})`);
  }
  return failed.length === 0 ? 0 : 1;
}

async function req(base, method, urlPath, { body, token, headers } = {}) {
  const res = await fetch(`${base}${urlPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  let json = {};
  try { json = await res.json(); } catch { /* empty body */ }
  return { status: res.status, json };
}

async function waitForServer(base, tries = 80) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1500) });
      if (res.ok) return true;
    } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 300));
  }
  return false;
}

function readDevCredentials() {
  const file = path.resolve(process.cwd(), 'server/data/initial_credentials_dev.txt');
  try {
    const map = {};
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const idx = line.indexOf('=>');
      if (idx > 0) map[line.slice(0, idx).trim()] = line.slice(idx + 2).trim();
    }
    return map;
  } catch { return {}; }
}

function isoInDays(days) {
  return new Date(Date.now() + days * 24 * 3600 * 1000).toISOString().slice(0, 10);
}

function spawnServer({ port, databaseUrl, nodeEnv }) {
  const child = spawn(process.execPath, [path.resolve(process.cwd(), 'dist/server.cjs')], {
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: nodeEnv,
      DATABASE_URL: databaseUrl,
      GABAH_REMINDER_SCHEDULER_DISABLED: 'true',
      GABAH_REMINDER_RUN_ON_BOOT: 'false',
      GABAH_INITIAL_ADMIN_PASSWORD: ADMIN_PASS,
      GABAH_INITIAL_USER_PASSWORD: USER_PASS,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout.on('data', d => { log += d.toString(); });
  child.stderr.on('data', d => { log += d.toString(); });
  child.__log = () => log;
  return child;
}

const ADMIN_PASS = `Vfy-Adm-${crypto.randomBytes(9).toString('base64url')}`;
const USER_PASS = `Vfy-Usr-${crypto.randomBytes(9).toString('base64url')}`;
const ADMIN_EMAIL = 'admin@foodstation.co.id';
const IT_EMAIL = 'it.support@foodstation.co.id';
const KARYAWAN_EMAIL = 'hendra.w@foodstation.co.id';
const AUDITOR_EMAIL = 'auditor@foodstation.co.id';

async function main() {
  const serverPath = path.resolve(process.cwd(), 'dist/server.cjs');
  if (!fs.existsSync(serverPath)) {
    console.error('dist/server.cjs not found — run `npm run build` first.');
    process.exit(1);
  }

  // ---------- Preflight: PostgreSQL test instance must be reachable ----------
  let adminClient;
  try {
    adminClient = new pg.Client({ connectionString: PG_ADMIN_URL, connectionTimeoutMillis: 5000 });
    adminClient.on('error', e => console.error('[pg admin async error]', e.message));
    await adminClient.connect();
  } catch (err) {
    console.error(`PostgreSQL test instance not reachable at ${PG_ADMIN_URL.replace(/:[^:@/]+@/, ':***@')} — ${err.message}`);
    process.exit(2);
  }

  // Fresh isolated database for this run.
  await adminClient.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
  await adminClient.query(`CREATE DATABASE ${TEST_DB}`);
  await adminClient.end();

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
  const child = spawnServer({ port: PORT, databaseUrl: TEST_DB_URL, nodeEnv: 'production' });
  let exited = null;
  child.on('exit', (code, signal) => { exited = { code, signal }; });

  const cleanup = () => {
    try { child.kill('SIGKILL'); } catch { /* already dead */ }
    if (backupState !== null) fs.writeFileSync(stateFile, backupState);
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(130); });

  try {
    // ---------- 1. Fresh-DB boot + migration chain ----------
    const up = await waitForServer(base);
    record('CR-04 server boots on fresh PostgreSQL database (production mode)', 'health 200', up ? 'health 200' : `no health (exit=${exited ? exited.code : 'running'})`, up);
    if (!up) {
      console.error('Server log tail:\n' + child.__log().slice(-3000));
      process.exit(summary() || 1);
    }

    const health = await req(base, 'GET', '/api/health');
    const persistence = health.json?.persistence;
    record('CR-04 /api/health reports postgresql persistence (no silent JSON fallback)', 'postgresql', persistence, persistence === 'postgresql');

    const mig = new pg.Client({ connectionString: TEST_DB_URL });
    mig.on('error', e => console.error('[pg ledger async error]', e.message));
    await mig.connect();
    let ledger, ownerDivCol, uqIdx;
    try {
      ledger = await mig.query('SELECT version, name FROM schema_migrations ORDER BY applied_at, version');
    } catch (err) {
      record('CR-04 migration ledger readable', '5 rows incl 004+005', `query error: ${err.message}`, false);
    }
    if (ledger) {
      const files = ledger.rows.map(r => `${r.version}|${r.name}`);
      record('CR-04 migration ledger has 001..005 applied', '5 rows incl 004+005', `${files.length} rows: ${files.join(',')}`,
        files.length >= 5 && files.some(f => f.includes('004')) && files.some(f => f.includes('005')));
    }
    try {
      ownerDivCol = await mig.query(`SELECT data_type FROM information_schema.columns WHERE table_name='contracts' AND column_name='owner_division'`);
      record('CR-04 legacy contracts aligned (owner_division column exists)', 'character varying', ownerDivCol.rows[0]?.data_type || 'missing', ownerDivCol.rows[0]?.data_type === 'character varying');
      uqIdx = await mig.query(`SELECT indexname FROM pg_indexes WHERE tablename='contract_notification_logs' AND indexdef ILIKE '%UNIQUE%'`);
      record('CR-05 idempotency UNIQUE index present', '>=1 unique index', `${uqIdx.rows.length}`, uqIdx.rows.length >= 1);
    } catch (err) {
      record('CR-04 schema introspection', 'columns/indexes present', `query error: ${err.message}`, false);
    }
    await mig.end();

    // ---------- 2. Logins (PBKDF2 path, env-provisioned passwords) ----------
    const adminLogin = await req(base, 'POST', '/api/auth/login', { body: { email: ADMIN_EMAIL, password: ADMIN_PASS } });
    const adminToken = adminLogin.json?.data?.token || '';
    record('login admin', '200 + token', `HTTP ${adminLogin.status}`, adminLogin.status === 200 && Boolean(adminToken));

    const itLogin = await req(base, 'POST', '/api/auth/login', { body: { email: IT_EMAIL, password: USER_PASS } });
    const itToken = itLogin.json?.data?.token || '';
    record('login IT user', '200 + token', `HTTP ${itLogin.status}`, itLogin.status === 200 && Boolean(itToken));

    const karyawanLogin = await req(base, 'POST', '/api/auth/login', { body: { email: KARYAWAN_EMAIL, password: USER_PASS } });
    const karyawanToken = karyawanLogin.json?.data?.token || '';
    record('login Karyawan', '200 + token', `HTTP ${karyawanLogin.status}`, karyawanLogin.status === 200 && Boolean(karyawanToken));

    const auditorLogin = await req(base, 'POST', '/api/auth/login', { body: { email: AUDITOR_EMAIL, password: USER_PASS } });
    const auditorToken = auditorLogin.json?.data?.token || '';
    record('login Auditor', '200 + token', `HTTP ${auditorLogin.status}`, auditorLogin.status === 200 && Boolean(auditorToken));

    if (!adminToken) throw new Error('cannot continue without admin token');

    const usersRes = await req(base, 'GET', '/api/users', { token: adminToken });
    const itUser = (usersRes.json?.data || []).find(u => u.email === IT_EMAIL);
    const itUserId = itUser?.id || '';

    // ---------- 3. Contract CRUD + restricted visibility ----------
    const created = await req(base, 'POST', '/api/contracts', {
      token: adminToken,
      body: {
        title: 'VERIFY Kontrak Integrasi Data',
        vendor_name: 'PT Verifikasi Cendekia',
        contract_type: 'Layanan',
        owner_division: 'IT',
        pic_user_id: itUserId || ADMIN_EMAIL,
        start_date: isoInDays(-10),
        end_date: isoInDays(5), // <= 7/35/60 → all expiry thresholds due
        notice_period_days: 0,
        contract_value: 150000000,
        restricted: true,
        notes: 'initial notes',
      },
    });
    const contractId = created.json?.data?.id || '';
    record('CR-04 contract create (201)', '201 + id', `HTTP ${created.status} id=${contractId ? 'ok' : 'missing'}`, created.status === 201 && Boolean(contractId));

    const readBack = await req(base, 'GET', `/api/contracts/${contractId}`, { token: adminToken });
    record('CR-04 contract read-back', '200 + contract_number', `HTTP ${readBack.status} num=${readBack.json?.data?.contract_number || '-'}`, readBack.status === 200 && Boolean(readBack.json?.data?.contract_number));

    const patched = await req(base, 'PATCH', `/api/contracts/${contractId}`, {
      token: adminToken,
      body: { notes: 'updated notes by verify' },
    });
    record('CR-04 contract update (PATCH notes)', '200 + notes applied', `HTTP ${patched.status} notes=${patched.json?.data?.notes || '-'}`, patched.status === 200 && patched.json?.data?.notes === 'updated notes by verify');

    const karyawanView = await req(base, 'GET', `/api/contracts/${contractId}`, { token: karyawanToken });
    record('RBAC restricted contract hidden from other division (Karyawan)', '404', `HTTP ${karyawanView.status}`, karyawanView.status === 404);

    const auditorCreate = await req(base, 'POST', '/api/contracts', {
      token: auditorToken,
      body: { title: 'x', vendor_name: 'x', owner_division: 'IT', start_date: isoInDays(0), end_date: isoInDays(1), pic_user_id: itUserId },
    });
    // 403 from the runtime-hardening read-only middleware (or 400 from the domain
    // service) — both are correct rejections for a read-only role.
    record('RBAC Auditor cannot create contract (read-only)', '400/403', `HTTP ${auditorCreate.status}`, [400, 403].includes(auditorCreate.status));

    // ---------- 4. Ticket → contract linkage guard ----------
    const probeTicket = await req(base, 'POST', '/api/tickets', {
      token: karyawanToken,
      body: { title: 'probe restricted linkage', description: 'verify guard', category: 'IT', priority: 'low', contract_id: contractId },
    });
    record('RBAC ticket linkage probe of restricted contract rejected', '201 without contract_id', `HTTP ${probeTicket.status} contract_id=${probeTicket.json?.data?.contract_id ?? 'unset'}`,
      probeTicket.status === 201 && !probeTicket.json?.data?.contract_id);

    const linkedTicket = await req(base, 'POST', '/api/tickets', {
      token: adminToken,
      body: { title: 'linked to verify contract', description: 'verify linkage', category: 'IT', priority: 'low', contract_id: contractId },
    });
    const linkedTicketId = linkedTicket.json?.data?.id || '';
    record('ticket linkage honored for authorized actor', '201 + contract_id', `HTTP ${linkedTicket.status} contract_id=${linkedTicket.json?.data?.contract_id ?? 'unset'}`,
      linkedTicket.status === 201 && linkedTicket.json?.data?.contract_id === contractId);

    // ---------- 5. Reminder sweep ----------
    const itRun = await req(base, 'POST', '/api/contracts/reminders/run', { token: itToken });
    record('RBAC reminders/run denied for non-admin', '403', `HTTP ${itRun.status}`, itRun.status === 403);

    const auditorStatus = await req(base, 'GET', '/api/contracts/reminders/scheduler-status', { token: auditorToken });
    record('RBAC scheduler-status denied for Auditor', '403', `HTTP ${auditorStatus.status}`, auditorStatus.status === 403);

    const sweep = await req(base, 'POST', '/api/contracts/reminders/run', { token: adminToken });
    const sweepData = sweep.json?.data || {};
    record('CR-05 reminder sweep runs (admin)', '200', `HTTP ${sweep.status}`, sweep.status === 200);
    record('CR-05 sweep queued notifications', '>0', `queued=${sweepData.queued}`, (sweepData.queued || 0) > 0);
    record('CR-05 sweep honest statuses: zero failures', 'failed=0', `failed=${sweepData.failed}`, (sweepData.failed || 0) === 0);
    record('CR-05 in-app delivery sent', 'sent>0', `sent=${sweepData.sent}`, (sweepData.sent || 0) > 0);
    record('CR-05 email unconfigured → skipped (not fake success)', 'skipped>0', `skipped=${sweepData.skipped}`, (sweepData.skipped || 0) > 0);

    const logsRes = await req(base, 'GET', `/api/contracts/${contractId}/notification-logs`, { token: adminToken });
    const logs = logsRes.json?.data || [];
    const types = [...new Set(logs.map(l => l.notification_type))];
    record('CR-05 thresholds EXPIRY_7/35/60 all due (5 days to end)', 'all 3 types', types.join(','), ['EXPIRY_7', 'EXPIRY_35', 'EXPIRY_60'].every(t => types.includes(t)));
    const statuses = logs.map(l => l.status);
    record('CR-05 log statuses honest (sent/skipped only)', 'no failed', statuses.includes('failed') ? statuses.join(',') : 'sent|skipped', !statuses.includes('failed'));
    const inAppSent = logs.filter(l => l.channel === 'in_app' && l.status === 'sent').length;
    record('CR-05 in-app log rows sent for recipients', '>=1', `${inAppSent}`, inAppSent >= 1);

    const afterSweep = await req(base, 'GET', `/api/contracts/${contractId}`, { token: adminToken });
    record('CR-05 derived status updated to expiring', 'expiring', afterSweep.json?.data?.status, afterSweep.json?.data?.status === 'expiring');

    const sweep2 = await req(base, 'POST', '/api/contracts/reminders/run', { token: adminToken });
    record('CR-05 idempotency: second sweep same due-day queues nothing', 'queued=0', `queued=${sweep2.json?.data?.queued}`, (sweep2.json?.data?.queued ?? 0) === 0);

    const adminStatus = await req(base, 'GET', '/api/contracts/reminders/scheduler-status', { token: adminToken });
    record('CR-05 scheduler-status visible for admin', '200', `HTTP ${adminStatus.status}`, adminStatus.status === 200);

    // ---------- 6. Restart persistence (authoritative PostgreSQL) ----------
    child.kill('SIGKILL');
    await new Promise(r => setTimeout(r, 800));
    const child2 = spawnServer({ port: PORT, databaseUrl: TEST_DB_URL, nodeEnv: 'production' });
    child2.__log && child2.on('exit', () => {});
    const up2 = await waitForServer(base);
    record('CR-04 restart against same PostgreSQL succeeds', 'health 200', up2 ? 'health 200' : 'no health', up2);
    if (!up2) {
      console.error('Server#2 log tail:\n' + (child2.__log ? child2.__log().slice(-3000) : ''));
      process.exit(summary() || 1);
    }

    const adminLogin2 = await req(base, 'POST', '/api/auth/login', { body: { email: ADMIN_EMAIL, password: ADMIN_PASS } });
    const adminToken2 = adminLogin2.json?.data?.token || '';

    const afterRestart = await req(base, 'GET', `/api/contracts/${contractId}`, { token: adminToken2 });
    record('CR-04 contract persists across restart (PostgreSQL authoritative)', '200 + updated notes', `HTTP ${afterRestart.status} notes=${afterRestart.json?.data?.notes || '-'}`,
      afterRestart.status === 200 && afterRestart.json?.data?.notes === 'updated notes by verify' && afterRestart.json?.data?.contract_number === readBack.json?.data?.contract_number);

    const ticketsAfter = await req(base, 'GET', '/api/tickets', { token: adminToken2 });
    const persistedLink = (ticketsAfter.json?.data || []).some(t => t.id === linkedTicketId && t.contract_id === contractId);
    record('CR-04 ticket→contract linkage persists across restart', 'linked', persistedLink ? 'linked' : 'missing', persistedLink);

    const logsAfter = await req(base, 'GET', `/api/contracts/${contractId}/notification-logs`, { token: adminToken2 });
    record('CR-04 notification logs persist across restart', 'same count', `before=${logs.length} after=${(logsAfter.json?.data || []).length}`, (logsAfter.json?.data || []).length === logs.length);

    const health2 = await req(base, 'GET', '/api/health');
    record('CR-04 health after restart still postgresql', 'postgresql', health2.json?.persistence, health2.json?.persistence === 'postgresql');

    child2.kill('SIGKILL');
    await new Promise(r => setTimeout(r, 500));

    // ---------- 7. Production fail-fast with dead DATABASE_URL ----------
    const PORT3 = 39000 + Math.floor(Math.random() * 2000);
    const base3 = `http://127.0.0.1:${PORT3}`;
    const child3 = spawnServer({ port: PORT3, databaseUrl: `postgresql://postgres:wrongpw@127.0.0.1:5432/${TEST_DB}`, nodeEnv: 'production' });
    let exit3 = null;
    child3.on('exit', (code) => { exit3 = code; });
    const up3 = await waitForServer(base3, 40);
    await new Promise(r => setTimeout(r, 500));
    record('CR-04 production fail-fast: dead PG never serves requests', 'no health', up3 ? 'SERVED (BAD)' : 'no health', !up3);
    record('CR-04 production fail-fast: process exits non-zero', 'exit!=0', `exit=${exit3 ?? 'running'}`, exit3 === null || exit3 !== 0);
    try { child3.kill('SIGKILL'); } catch { /* done */ }
  } finally {
    cleanup();
    // Drop the isolated test database.
    try {
      const c = new pg.Client({ connectionString: PG_ADMIN_URL });
      c.on('error', () => { /* best effort during teardown */ });
      await c.connect();
      await c.query(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`);
      await c.end();
    } catch { /* best effort */ }
  }

  process.exit(summary());
}

main().catch(err => {
  console.error('Verify script crashed:', err);
  process.exit(1);
});
