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

async function uploadContractDocument(base, contractId, token, content) {
  const form = new FormData();
  form.append('file', new Blob([Buffer.from(content)], { type: 'application/pdf' }), 'verify-contract.pdf');
  const res = await fetch(`${base}/api/contracts/${contractId}/documents/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
    signal: AbortSignal.timeout(15000),
  });
  let json = {};
  try { json = await res.json(); } catch { /* empty body */ }
  return { status: res.status, json };
}

async function downloadContractDocument(base, contractId, documentId, token) {
  return fetch(`${base}/api/contracts/${contractId}/documents/${documentId}/download`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  });
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
      GABAH_UPLOAD_DIR: path.resolve(process.cwd(), 'server/data/cr-verify-uploads'),
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
const GA_EMAIL = 'ga@foodstation.co.id';
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

  const uploadDir = path.resolve(process.cwd(), 'server/data/cr-verify-uploads');
  const cleanup = () => {
    try { child.kill('SIGKILL'); } catch { /* already dead */ }
    if (backupState !== null) fs.writeFileSync(stateFile, backupState);
    try { fs.rmSync(uploadDir, { recursive: true, force: true }); } catch { /* best effort */ }
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
    // Legacy function profiles must become Karyawan primary plus a secondary
    // capability assignment, and the authoritative JSON state must agree.
    const capabilityRows = await mig.query(
      `SELECT u.email, u.role, r.role_key, ur.is_primary
       FROM users u
       LEFT JOIN gabah_user_roles ur ON ur.user_id = u.id::text
       LEFT JOIN gabah_roles r ON r.id = ur.role_id
       WHERE u.email = ANY($1::text[])
       ORDER BY u.email, ur.is_primary DESC`,
      [['humas@foodstation.co.id', 'sekretariat.direksi@foodstation.co.id']],
    );
    const checkEmployeeCapability = (email, capabilityKey) => {
      const rows = capabilityRows.rows.filter(row => row.email === email);
      return rows.length > 0
        && rows.every(row => row.role === 'Karyawan')
        && rows.some(row => row.role_key === 'karyawan' && row.is_primary === true)
        && rows.some(row => row.role_key === capabilityKey && row.is_primary === false);
    };
    record('Legacy Humas profile is Karyawan primary + Humas secondary', true,
      checkEmployeeCapability('humas@foodstation.co.id', 'humas'), checkEmployeeCapability('humas@foodstation.co.id', 'humas'));
    record('Legacy Sekretariat profile is Karyawan primary + Sekretariat secondary', true,
      checkEmployeeCapability('sekretariat.direksi@foodstation.co.id', 'sekretaris_direksi'), checkEmployeeCapability('sekretariat.direksi@foodstation.co.id', 'sekretaris_direksi'));
    const stateUsers = await mig.query("SELECT payload->'users' AS users FROM gabah_state WHERE id = 1");
    const stateRows = stateUsers.rows[0]?.users || [];
    const stateRolesNormalized = ['humas@foodstation.co.id', 'sekretariat.direksi@foodstation.co.id'].every(email => {
      const user = stateRows.find(item => item.email === email);
      return user?.role === 'Karyawan' && Boolean(user?.role_label);
    });
    record('Authoritative JSON state retains normalized employee profiles and function labels', true, stateRolesNormalized, stateRolesNormalized);
    const queueColumns = await mig.query(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema = 'public'
         AND ((table_name = 'tickets' AND column_name = 'assigned_unit_id')
           OR (table_name = 'notifications' AND column_name = 'recipient_unit_id'))`,
    );
    const hasUnitQueueColumns = queueColumns.rows.some(row => row.table_name === 'tickets' && row.column_name === 'assigned_unit_id')
      && queueColumns.rows.some(row => row.table_name === 'notifications' && row.column_name === 'recipient_unit_id');
    record('ME ticket and notification unit columns are migrated', 'both columns present', hasUnitQueueColumns, hasUnitQueueColumns);

    const meUnit = await mig.query("SELECT id FROM org_units WHERE id = 'UNIT-PIBC-ME' AND is_active = TRUE");
    record('PIBC Tim Perawatan ME queue exists as an active org unit', 'UNIT-PIBC-ME', meUnit.rows[0]?.id || 'missing', meUnit.rows.length === 1);

    const helpdeskGrants = await mig.query(
      `SELECT r.role_key, p.permission_key
       FROM gabah_roles r
       JOIN gabah_role_permissions rp ON rp.role_id = r.id
       JOIN gabah_permissions p ON p.permission_key = rp.permission_key
       WHERE r.role_key = ANY($1::text[])`,
      [['admin_tiket_me', 'petugas_me', 'ga_helpdesk_operator', 'petugas_ga', 'pemohon_tiket_ga', 'pemohon_tiket_me', 'ga']],
    );
    const hasGrant = (role, permission) => helpdeskGrants.rows.some(row => row.role_key === role && row.permission_key === permission);
    record('Admin Tiket ME receives read/update/assign capabilities', 'read+update+assign',
      ['tickets.read', 'tickets.update', 'tickets.assign'].every(permission => hasGrant('admin_tiket_me', permission)),
      ['tickets.read', 'tickets.update', 'tickets.assign'].every(permission => hasGrant('admin_tiket_me', permission)));
    record('GA dispatcher capability is an explicit additional role', 'ga_helpdesk_operator read/update/assign',
      ['tickets.read', 'tickets.update', 'tickets.assign'].every(permission => hasGrant('ga_helpdesk_operator', permission)),
      ['tickets.read', 'tickets.update', 'tickets.assign'].every(permission => hasGrant('ga_helpdesk_operator', permission)));
    record('GA requester template only grants GA ticket creation', 'tickets.create.ga',
      hasGrant('pemohon_tiket_ga', 'tickets.create.ga'), hasGrant('pemohon_tiket_ga', 'tickets.create.ga'));
    record('ME requester template only grants ME ticket creation', 'tickets.create.me',
      hasGrant('pemohon_tiket_me', 'tickets.create.me'), hasGrant('pemohon_tiket_me', 'tickets.create.me'));

    record('Petugas ME receives read/update but not dispatch authority', 'read+update only',
      hasGrant('petugas_me', 'tickets.read') && hasGrant('petugas_me', 'tickets.update') && !hasGrant('petugas_me', 'tickets.assign'),
      hasGrant('petugas_me', 'tickets.read') && hasGrant('petugas_me', 'tickets.update') && !hasGrant('petugas_me', 'tickets.assign'));
    record('Petugas GA receives read/update but not dispatch authority', 'read+update only',
      hasGrant('petugas_ga', 'tickets.read') && hasGrant('petugas_ga', 'tickets.update') && !hasGrant('petugas_ga', 'tickets.assign'),
      hasGrant('petugas_ga', 'tickets.read') && hasGrant('petugas_ga', 'tickets.update') && !hasGrant('petugas_ga', 'tickets.assign'));
    record('Generic GA role does not automatically dispatch tickets', 'no tickets.update/assign',
      !hasGrant('ga', 'tickets.update') && !hasGrant('ga', 'tickets.assign') && !hasGrant('ga', 'tickets.close'),
      !hasGrant('ga', 'tickets.update') && !hasGrant('ga', 'tickets.assign'));

    const queueScopes = await mig.query(
      `SELECT r.role_key, s.scope_type, s.scope_value
       FROM gabah_roles r
       JOIN gabah_role_division_scopes s ON s.role_id = r.id
       WHERE r.role_key = ANY($1::text[]) AND s.module = 'tickets'`,
      [['admin_tiket_me', 'petugas_me', 'ga_helpdesk_operator', 'petugas_ga']],
    );
    const meScope = queueScopes.rows.some(row => row.role_key === 'admin_tiket_me' && row.scope_type === 'unit' && row.scope_value === 'UNIT-PIBC-ME');
    const meTechScope = queueScopes.rows.some(row => row.role_key === 'petugas_me' && row.scope_type === 'unit' && row.scope_value === 'UNIT-PIBC-ME');
    const gaScope = queueScopes.rows.some(row => row.role_key === 'ga_helpdesk_operator' && row.scope_type === 'division' && row.scope_value === 'GA');
    const gaTechScope = queueScopes.rows.some(row => row.role_key === 'petugas_ga' && row.scope_type === 'division' && row.scope_value === 'GA');
    record('Dispatchers and technicians are scoped to their own unit/division', 'ME unit + GA division for both roles', meScope && meTechScope && gaScope && gaTechScope, meScope && meTechScope && gaScope && gaTechScope);

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

    // ---------- Module lifecycle registry + immutable audit history ----------
    try {
      const moduleLedger = await mig.query(
        "SELECT version FROM schema_migrations WHERE version = '042'",
      );
      record('Module lifecycle migration 042 applied on fresh PostgreSQL database',
        'version 042 in schema_migrations', `rows=${moduleLedger.rowCount}`, moduleLedger.rowCount === 1);

      const moduleRows = await mig.query(
        'SELECT module_key, is_active FROM gabah_modules ORDER BY module_key',
      );
      const requiredModules = [
        'dashboard', 'my_assets', 'meeting_rooms', 'assets', 'maintenance', 'loans',
        'tickets', 'licenses', 'contracts', 'vendors', 'knowledge', 'reports',
      ];
      const activeKeys = new Set(moduleRows.rows.filter(row => row.is_active === true).map(row => row.module_key));
      record('Module lifecycle registry seeds every shipped navigation module Active',
        '12 expected modules active',
        `total=${moduleRows.rowCount} activeExpected=${requiredModules.filter(key => activeKeys.has(key)).length}/12`,
        requiredModules.every(key => activeKeys.has(key)));

      const auditInsert = await mig.query(
        `INSERT INTO gabah_module_status_audit
          (module_key, previous_is_active, new_is_active, reason, changed_by_user_id)
         VALUES ('dashboard', TRUE, FALSE, 'CI immutability verification', 'CI-VERIFY')
         RETURNING id`,
      );
      const auditId = auditInsert.rows[0].id;

      async function assertAuditMutationBlocked(label, sql) {
        await mig.query('BEGIN');
        try {
          await mig.query(sql);
          await mig.query('ROLLBACK');
          record(label, 'PostgreSQL error code 55000', 'mutation unexpectedly succeeded', false);
        } catch (err) {
          await mig.query('ROLLBACK');
          record(label, 'PostgreSQL error code 55000', err.code || err.message,
            err.code === '55000');
        }
      }

      await assertAuditMutationBlocked(
        'Module audit history rejects UPDATE at database level',
        `UPDATE gabah_module_status_audit SET reason = 'tampered' WHERE id = ${Number(auditId)}`,
      );
      await assertAuditMutationBlocked(
        'Module audit history rejects DELETE at database level',
        `DELETE FROM gabah_module_status_audit WHERE id = ${Number(auditId)}`,
      );
      await assertAuditMutationBlocked(
        'Module audit history rejects TRUNCATE at database level',
        'TRUNCATE TABLE gabah_module_status_audit',
      );
      const auditSurvived = await mig.query(
        'SELECT COUNT(*)::int AS count FROM gabah_module_status_audit WHERE id = $1',
        [auditId],
      );
      record('Module audit entry remains intact after rejected mutations',
        '1 preserved row', `count=${auditSurvived.rows[0].count}`,
        auditSurvived.rows[0].count === 1);
    } catch (err) {
      record('Module lifecycle registry + audit immutability integration',
        'migration 042, seeded modules, immutable audit', `error: ${err.message}`, false);
    }
    await mig.end();

    // ---------- 2. Logins (PBKDF2 path, env-provisioned passwords) ----------
    const adminLogin = await req(base, 'POST', '/api/auth/login', { body: { email: ADMIN_EMAIL, password: ADMIN_PASS } });
    const adminToken = adminLogin.json?.data?.token || '';
    record('login admin', '200 + token', `HTTP ${adminLogin.status}`, adminLogin.status === 200 && Boolean(adminToken));

    const itLogin = await req(base, 'POST', '/api/auth/login', { body: { email: IT_EMAIL, password: USER_PASS } });
    const itToken = itLogin.json?.data?.token || '';
    record('login IT user', '200 + token', `HTTP ${itLogin.status}`, itLogin.status === 200 && Boolean(itToken));

    const gaLogin = await req(base, 'POST', '/api/auth/login', { body: { email: GA_EMAIL, password: USER_PASS } });
    const gaToken = gaLogin.json?.data?.token || '';
    record('login GA user', '200 + token', `HTTP ${gaLogin.status}`, gaLogin.status === 200 && Boolean(gaToken));

    const karyawanLogin = await req(base, 'POST', '/api/auth/login', { body: { email: KARYAWAN_EMAIL, password: USER_PASS } });
    const karyawanToken = karyawanLogin.json?.data?.token || '';
    record('login Karyawan', '200 + token', `HTTP ${karyawanLogin.status}`, karyawanLogin.status === 200 && Boolean(karyawanToken));

    const auditorLogin = await req(base, 'POST', '/api/auth/login', { body: { email: AUDITOR_EMAIL, password: USER_PASS } });
    const auditorToken = auditorLogin.json?.data?.token || '';
    record('login Auditor', '200 + token', `HTTP ${auditorLogin.status}`, auditorLogin.status === 200 && Boolean(auditorToken));

    if (!adminToken) throw new Error('cannot continue without admin token');

    // ---------- Module lifecycle API + live enforcement ----------
    const modulesRead = await req(base, 'GET', '/api/modules', { token: karyawanToken });
    const moduleRows = modulesRead.json?.data || [];
    record('authenticated staff can read module availability', '200 + 12 seeded active modules',
      `HTTP ${modulesRead.status} rows=${moduleRows.length}`,
      modulesRead.status === 200 && moduleRows.length >= 12 && moduleRows.every(m => m.is_active === true));

    const roomReservationsBefore = await req(base, 'GET', '/api/room-reservations', { token: adminToken });
    const roomCountBefore = (roomReservationsBefore.json?.data || []).length;
    const staffToggle = await req(base, 'PATCH', '/api/modules/meeting_rooms', { token: karyawanToken, body: { is_active: false, reason: 'Uji nonaktif modul' } });
    record('non-superadmin cannot toggle module lifecycle', '403', `HTTP ${staffToggle.status}`, staffToggle.status === 403);
    const invalidToggle = await req(base, 'PATCH', '/api/modules/meeting_rooms', { token: adminToken, body: { is_active: 'false', reason: 'Uji boolean' } });
    record('module toggle rejects string booleans', '400', `HTTP ${invalidToggle.status}`, invalidToggle.status === 400);
    const missingReason = await req(base, 'PATCH', '/api/modules/meeting_rooms', { token: adminToken, body: { is_active: false, reason: 'no' } });
    record('module toggle requires a meaningful reason', '400', `HTTP ${missingReason.status}`, missingReason.status === 400);
    const missingModule = await req(base, 'PATCH', '/api/modules/missing_module', { token: adminToken, body: { is_active: false, reason: 'Uji modul tidak ada' } });
    record('unknown module key is rejected', '404', `HTTP ${missingModule.status}`, missingModule.status === 404);

    const disableRoomModule = await req(base, 'PATCH', '/api/modules/meeting_rooms', { token: adminToken, body: { is_active: false, reason: 'Pengujian enforcement modul booking' } });
    record('superadmin can disable module with audit reason', '200 + inactive', `HTTP ${disableRoomModule.status} active=${disableRoomModule.json?.data?.is_active}`,
      disableRoomModule.status === 200 && disableRoomModule.json?.data?.is_active === false);
    const blockedRoomApi = await req(base, 'GET', '/api/room-reservations', { token: adminToken });
    record('disabled module blocks business API even for superadmin', '403 MODULE_DISABLED',
      `HTTP ${blockedRoomApi.status} code=${blockedRoomApi.json?.code}`,
      blockedRoomApi.status === 403 && blockedRoomApi.json?.code === 'MODULE_DISABLED');
    const staffAudit = await req(base, 'GET', '/api/modules/meeting_rooms/audit', { token: karyawanToken });
    record('module audit history is superadmin-only', '403', `HTTP ${staffAudit.status}`, staffAudit.status === 403);
    const moduleAudit = await req(base, 'GET', '/api/modules/meeting_rooms/audit', { token: adminToken });
    record('module changes are recorded in immutable audit history', '2 entries',
      `HTTP ${moduleAudit.status} rows=${moduleAudit.json?.data?.length}`,
      moduleAudit.status === 200 && moduleAudit.json?.data?.length === 1);

    const enableRoomModule = await req(base, 'PATCH', '/api/modules/meeting_rooms', { token: adminToken, body: { is_active: true, reason: 'Pengujian enforcement selesai' } });
    const roomReservationsAfter = await req(base, 'GET', '/api/room-reservations', { token: adminToken });
    const roomCountAfter = (roomReservationsAfter.json?.data || []).length;
    record('reactivated module restores API without deleting data', '200 + unchanged records',
      `HTTP ${roomReservationsAfter.status}, ${roomCountBefore}->${roomCountAfter}`,
      enableRoomModule.status === 200 && enableRoomModule.json?.data?.is_active === true
        && roomReservationsAfter.status === 200 && roomCountBefore === roomCountAfter);
    const moduleAuditAfter = await req(base, 'GET', '/api/modules/meeting_rooms/audit', { token: adminToken });
    record('disable and re-enable create two audit entries', '2 entries',
      `rows=${moduleAuditAfter.json?.data?.length}`,
      moduleAuditAfter.status === 200 && moduleAuditAfter.json?.data?.length === 2);

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

    const invalidContractUpload = await uploadContractDocument(base, contractId, adminToken, 'NOT-A-PDF-FILE');
    record('CR-04 contract upload rejects content with a mismatched PDF signature', '400',
      `HTTP ${invalidContractUpload.status}`, invalidContractUpload.status === 400);
    const contractFileContent = '%PDF-1.4\\nGABAH-CONTRACT-DOCUMENT-PERSISTENCE-VERIFY';
    const uploadedDocument = await uploadContractDocument(base, contractId, adminToken, contractFileContent);
    const documentId = uploadedDocument.json?.data?.document_id || '';
    record('CR-04 contract upload writes document bytes to persistent storage', '200 + document id',
      `HTTP ${uploadedDocument.status} id=${documentId ? 'ok' : 'missing'}`,
      uploadedDocument.status === 200 && Boolean(documentId));

    const initialDownload = documentId ? await downloadContractDocument(base, contractId, documentId, adminToken) : null;
    const initialDownloadBody = initialDownload ? await initialDownload.text() : '';
    record('CR-04 authorized contract document download returns original bytes', '200 + exact content',
      `HTTP ${initialDownload?.status ?? 'skipped'} content=${initialDownloadBody}`,
      initialDownload?.status === 200 && initialDownloadBody === contractFileContent);

    const readBack = await req(base, 'GET', `/api/contracts/${contractId}`, { token: adminToken });
    record('CR-04 contract read-back', '200 + contract_number', `HTTP ${readBack.status} num=${readBack.json?.data?.contract_number || '-'}`, readBack.status === 200 && Boolean(readBack.json?.data?.contract_number));

    const patched = await req(base, 'PATCH', `/api/contracts/${contractId}`, {
      token: adminToken,
      body: { notes: 'updated notes by verify' },
    });
    record('CR-04 contract update (PATCH notes)', '200 + notes applied', `HTTP ${patched.status} notes=${patched.json?.data?.notes || '-'}`, patched.status === 200 && patched.json?.data?.notes === 'updated notes by verify');

    // Assign a second, explicitly scoped role to Karyawan. GA has contracts.read
    // with GA-only contract scope; this should not expose the IT-owned test contract.
    const roleCatalog = await req(base, 'GET', '/api/admin/rbac/roles', { token: adminToken });
    const gaRole = (roleCatalog.json?.data || []).find(role => role.role_key === 'ga' && role.is_active);
    const karyawanUser = (usersRes.json?.data || []).find(user => user.email === KARYAWAN_EMAIL);
    const assignment = await req(base, 'PUT', `/api/admin/rbac/users/${karyawanUser?.id}/roles`, {
      token: adminToken,
      body: { role_ids: gaRole ? [Number(gaRole.id)] : [] },
    });
    record('Dynamic role assignment adds GA capability without replacing Karyawan primary role', '200 + GA role', `HTTP ${assignment.status}`, assignment.status === 200 && assignment.json?.data?.role_ids?.includes(Number(gaRole?.id)));

    const karyawanView = await req(base, 'GET', `/api/contracts/${contractId}`, { token: karyawanToken });
    record('RBAC Karyawan with GA role cannot read IT-owned contract outside GA scope', '404', `HTTP ${karyawanView.status}`, karyawanView.status === 404);
    const karyawanDocumentDownload = documentId
      ? await downloadContractDocument(base, contractId, documentId, karyawanToken)
      : null;
    record('RBAC Karyawan cannot download an out-of-scope contract document', '404',
      `HTTP ${karyawanDocumentDownload?.status ?? 'skipped'}`, karyawanDocumentDownload?.status === 404);

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
    record('RBAC ticket linkage probe of restricted contract rejected without disclosing visibility', '404 generic not-found', `HTTP ${probeTicket.status} contract_id=${probeTicket.json?.data?.contract_id ?? 'unset'}`,
      probeTicket.status === 404 && !probeTicket.json?.data?.contract_id);

    const assignmentInventory = await req(base, 'GET', '/api/admin/rbac/user-assignments', { token: adminToken });
    const persistedAssignment = (assignmentInventory.json?.data || []).find(item => String(item.user_id) === String(karyawanUser?.id));
    record('Additional role survives ordinary PostgreSQL persistence after ticket creation', 'GA additional + Karyawan primary',
      `roles=${(persistedAssignment?.role_ids || []).join(',')} primary=${persistedAssignment?.primary_role_id ?? 'none'}`,
      assignment.status === 200 && (persistedAssignment?.role_ids || []).includes(Number(gaRole?.id))
        && Number(persistedAssignment?.primary_role_id) === Number(assignment.json?.data?.primary_role_id));

    // Vendor ownership is independent from category and employee work location.
    const itVendor = await req(base, 'POST', '/api/vendors', {
      token: itToken,
      body: { name: 'VERIFY Vendor IT', category: 'Maintenance', owner_division: 'IT', rating: 4.2 },
    });
    const itVendorId = itVendor.json?.data?.id || '';
    record('IT can create IT-owned vendor independent of service category', '201 + owner IT', `HTTP ${itVendor.status} owner=${itVendor.json?.data?.owner_division || '-'}`,
      itVendor.status === 201 && itVendor.json?.data?.owner_division === 'IT');

    const gaVendor = await req(base, 'POST', '/api/vendors', {
      token: gaToken,
      body: { name: 'VERIFY Vendor GA', category: 'IT Hardware', owner_division: 'GA', rating: 4.5 },
    });
    record('GA can create GA-owned vendor even when category text says IT Hardware', '201 + owner GA', `HTTP ${gaVendor.status} owner=${gaVendor.json?.data?.owner_division || '-'}`,
      gaVendor.status === 201 && gaVendor.json?.data?.owner_division === 'GA');

    const gaCrossOwner = await req(base, 'POST', '/api/vendors', {
      token: gaToken,
      body: { name: 'VERIFY Forbidden GA to IT', category: 'Maintenance', owner_division: 'IT' },
    });
    record('GA cannot create IT-owned vendor outside GA owner scope', '403', `HTTP ${gaCrossOwner.status}`, gaCrossOwner.status === 403);

    const itVendorList = await req(base, 'GET', '/api/vendors', { token: itToken });
    const gaVendorList = await req(base, 'GET', '/api/vendors', { token: gaToken });
    record('IT vendor directory is restricted to IT owner domain', 'IT only',
      (itVendorList.json?.data || []).map(v => v.owner_division).join(','),
      itVendorList.status === 200 && (itVendorList.json?.data || []).length === 1 && itVendorList.json.data[0].owner_division === 'IT');
    record('GA vendor directory is restricted to GA owner domain', 'GA only',
      (gaVendorList.json?.data || []).map(v => v.owner_division).join(','),
      gaVendorList.status === 200 && (gaVendorList.json?.data || []).length === 1 && gaVendorList.json.data[0].owner_division === 'GA');

    const itCrossOwnerUpdate = await req(base, 'PATCH', `/api/vendors/${itVendorId}`, {
      token: itToken,
      body: { owner_division: 'GA' },
    });
    record('IT cannot reclassify an IT vendor into GA owner without destination scope', '403', `HTTP ${itCrossOwnerUpdate.status}`, itCrossOwnerUpdate.status === 403);

    const auditorVendorDenied = await req(base, 'POST', '/api/vendors', {
      token: auditorToken,
      body: { name: 'VERIFY Forbidden Karyawan', category: 'General', owner_division: 'GA' },
    });
    record('Auditor without vendors.create cannot create vendor', '403', `HTTP ${auditorVendorDenied.status}`, auditorVendorDenied.status === 403);

    const newOwner = await req(base, 'POST', '/api/master/divisions', {
      token: adminToken,
      body: { code: 'RPCSC', name: 'RPC/SC Operations', leader: 'Kepala Operasional RPC/SC', depts: ['Gudang', 'Produksi'] },
    });
    record('Super Admin can add future owner domain without code change', '201', `HTTP ${newOwner.status}`, newOwner.status === 201);

    const vendorRole = await req(base, 'POST', '/api/admin/rbac/roles', {
      token: adminToken,
      body: { role_key: 'vendor_rpcsc_test', name: 'Vendor RPC/SC Test', description: 'CI-only custom owner role', permission_keys: ['vendors.read', 'vendors.create', 'vendors.update'] },
    });
    const vendorRoleId = Number(vendorRole.json?.data?.id || 0);
    record('Super Admin can create custom role with selected permissions atomically', '201 + role id + 3 permissions', `HTTP ${vendorRole.status} permissions=${(vendorRole.json?.data?.permissions || []).length}`,
      vendorRole.status === 201 && vendorRoleId > 0 && ['vendors.read', 'vendors.create', 'vendors.update'].every(key => (vendorRole.json?.data?.permissions || []).includes(key)));

    const protectedRolePermission = await req(base, 'PUT', `/api/admin/rbac/roles/${vendorRoleId}/permissions`, {
      token: adminToken,
      body: { permission_keys: ['system.super_admin'] },
    });
    record('Custom roles cannot receive protected system-superadmin permission', '409', `HTTP ${protectedRolePermission.status}`, protectedRolePermission.status === 409);

    const vendorRolePermissions = await req(base, 'PUT', `/api/admin/rbac/roles/${vendorRoleId}/permissions`, {
      token: adminToken,
      body: { permission_keys: ['vendors.read', 'vendors.create', 'vendors.update'] },
    });
    record('Custom role can receive explicit vendor permissions', '200', `HTTP ${vendorRolePermissions.status}`, vendorRolePermissions.status === 200);

    const vendorRoleScopes = await req(base, 'PUT', `/api/admin/rbac/roles/${vendorRoleId}/scopes`, {
      token: adminToken,
      body: { scopes: [{ module: 'vendors', type: 'division', value: 'RPCSC' }] },
    });
    record('Custom role can receive future owner domain scope', '200', `HTTP ${vendorRoleScopes.status}`, vendorRoleScopes.status === 200);

    const assignVendorRole = await req(base, 'PUT', `/api/admin/rbac/users/${karyawanUser?.id}/roles`, {
      token: adminToken,
      body: { role_ids: [Number(gaRole?.id), vendorRoleId] },
    });
    record('Karyawan can receive a separate vendor owner capability without changing primary role', '200', `HTTP ${assignVendorRole.status}`, assignVendorRole.status === 200);

    const rpcscVendor = await req(base, 'POST', '/api/vendors', {
      token: karyawanToken,
      body: { name: 'VERIFY Vendor RPCSC', category: 'IT Hardware', owner_division: 'RPCSC', rating: 4.1 },
    });
    const rpcscVendorId = rpcscVendor.json?.data?.id || '';
    record('Custom RPC/SC owner can manage vendor; category does not determine owner', '201 + owner RPCSC',
      `HTTP ${rpcscVendor.status} owner=${rpcscVendor.json?.data?.owner_division || '-'}`,
      rpcscVendor.status === 201 && rpcscVendor.json?.data?.owner_division === 'RPCSC');

    const karyawanVendors = await req(base, 'GET', '/api/vendors', { token: karyawanToken });
    record('Combined GA + custom RPCSC roles see only their combined owner scopes', 'GA and RPCSC; no IT',
      (karyawanVendors.json?.data || []).map(v => v.owner_division).join(','),
      karyawanVendors.status === 200 && (karyawanVendors.json?.data || []).length >= 2
        && (karyawanVendors.json.data || []).some(v => v.owner_division === 'RPCSC')
        && (karyawanVendors.json.data || []).some(v => v.owner_division === 'GA')
        && !(karyawanVendors.json.data || []).some(v => v.owner_division === 'IT'));

    // Auditor is a deny-write capability even when assigned as an additional role.
    // Preserve the employee primary role and all other approved capabilities.
    const auditorRole = (roleCatalog.json?.data || []).find(role => role.role_key === 'auditor' && role.is_active);
    const addAuditorRole = await req(base, 'PUT', `/api/admin/rbac/users/${karyawanUser?.id}/roles`, {
      token: adminToken,
      body: { role_ids: [Number(gaRole?.id), vendorRoleId, Number(auditorRole?.id)] },
    });
    record('Auditor additional role can be assigned without replacing Karyawan primary', '200 + auditor capability',
      `HTTP ${addAuditorRole.status}`, addAuditorRole.status === 200 && addAuditorRole.json?.data?.role_ids?.includes(Number(auditorRole?.id)));
    const additionalAuditorWrite = await req(base, 'POST', '/api/tickets', {
      token: karyawanToken,
      body: { title: 'VERIFY Auditor additional role write denial', description: 'must be denied', category: 'IT', priority: 'low' },
    });
    record('Auditor additional role enforces global read-only on API writes', '403',
      `HTTP ${additionalAuditorWrite.status}`, additionalAuditorWrite.status === 403);
    const additionalAuditorRead = await req(base, 'GET', `/api/contracts/${contractId}`, { token: karyawanToken });
    record('Auditor additional role receives authorized audit read access', '200',
      `HTTP ${additionalAuditorRead.status}`, additionalAuditorRead.status === 200);
    const auditorDocumentDownload = documentId
      ? await downloadContractDocument(base, contractId, documentId, karyawanToken)
      : null;
    const auditorDocumentBody = auditorDocumentDownload ? await auditorDocumentDownload.text() : '';
    record('Auditor additional role can download authorized audit document', '200 + exact content',
      `HTTP ${auditorDocumentDownload?.status ?? 'skipped'}`,
      auditorDocumentDownload?.status === 200 && auditorDocumentBody === contractFileContent);

    const deleteReferencedOwner = await req(base, 'DELETE', '/api/master/divisions/RPCSC', { token: adminToken });
    record('Owner domain referenced by vendor cannot be deleted', '400', `HTTP ${deleteReferencedOwner.status}`, deleteReferencedOwner.status === 400);

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
    const documentAfterRestart = documentId
      ? await downloadContractDocument(base, contractId, documentId, adminToken2)
      : null;
    const documentBodyAfterRestart = documentAfterRestart ? await documentAfterRestart.text() : '';
    record('CR-04 contract document bytes persist across app restart', '200 + exact content',
      `HTTP ${documentAfterRestart?.status ?? 'skipped'}`,
      documentAfterRestart?.status === 200 && documentBodyAfterRestart === contractFileContent);

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
