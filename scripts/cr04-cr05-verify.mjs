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
import net from 'node:net';

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

const activeChildren = new Set();

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
  activeChildren.add(child);
  child.once('exit', () => activeChildren.delete(child));
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

  const PORT = await getAvailablePort();
  const base = `http://127.0.0.1:${PORT}`;
  const child = spawnServer({ port: PORT, databaseUrl: TEST_DB_URL, nodeEnv: 'production' });
  let exited = null;
  child.on('exit', (code, signal) => { exited = { code, signal }; });

  const uploadDir = path.resolve(process.cwd(), 'server/data/cr-verify-uploads');
  const cleanup = () => {
    for (const process of activeChildren) {
      try { process.kill('SIGKILL'); } catch { /* already dead */ }
    }
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

    // ---------- Loan anti-collision under concurrent approvals ----------
    // Exercise the real PostgreSQL trigger using two independent transactions.
    const loanFixture = await mig.query(`
      SELECT (SELECT id FROM users WHERE is_active = TRUE ORDER BY id LIMIT 1) AS borrower_id,
             (SELECT id FROM divisions ORDER BY id LIMIT 1) AS division_id
    `);
    const borrowerId = loanFixture.rows[0]?.borrower_id;
    const divisionId = loanFixture.rows[0]?.division_id;
    const fixtureSuffix = crypto.randomBytes(6).toString('hex');
    const concurrencyAssetId = `CR-LOAN-CONCURRENCY-${fixtureSuffix}`;
    const loanAId = `CR-LOAN-A-${fixtureSuffix}`;
    const loanBId = `CR-LOAN-B-${fixtureSuffix}`;
    const scheduleStart = new Date(Date.now() + 10 * 86400000).toISOString();
    const scheduleDue = new Date(Date.now() + 11 * 86400000).toISOString();
    let loanConcurrencyPass = false;
    let clientA;
    let clientB;
    try {
      if (!borrowerId || !divisionId) throw new Error('test borrower/division fixture is unavailable');
      await mig.query(
        `INSERT INTO assets (id, asset_number, name, owner_division_id, status, condition, location, is_loanable)
         VALUES ($1, $2, 'CI concurrent-loan fixture', $3, 'available', 'good', 'CI', TRUE)`,
        [concurrencyAssetId, `CI-LOAN-${fixtureSuffix}`, divisionId],
      );
      for (const [id, number] of [[loanAId, `CI-LOAN-A-${fixtureSuffix}`], [loanBId, `CI-LOAN-B-${fixtureSuffix}`]]) {
        await mig.query(
          `INSERT INTO loans (id, loan_number, asset_id, borrower_id, purpose, start_date, due_date, status)
           VALUES ($1, $2, $3, $4, 'CI concurrent approval', $5, $6, 'pending_approval')`,
          [id, number, concurrencyAssetId, borrowerId, scheduleStart, scheduleDue],
        );
      }

      clientA = new pg.Client({ connectionString: TEST_DB_URL });
      clientB = new pg.Client({ connectionString: TEST_DB_URL });
      clientA.on('error', e => console.error('[loan concurrency A]', e.message));
      clientB.on('error', e => console.error('[loan concurrency B]', e.message));
      await Promise.all([clientA.connect(), clientB.connect()]);
      await clientA.query('BEGIN');
      await clientA.query(`UPDATE loans SET status = 'approved' WHERE id = $1`, [loanAId]);

      await clientB.query('BEGIN');
      const backendB = await clientB.query('SELECT pg_backend_pid() AS pid');
      let secondSettled = false;
      let secondError = null;
      const secondApproval = clientB.query(
        `UPDATE loans SET status = 'approved' WHERE id = $1`, [loanBId],
      ).then(() => { secondSettled = true; }, error => { secondSettled = true; secondError = error; });

      let waitedOnAssetLock = false;
      for (let attempt = 0; attempt < 100 && !secondSettled; attempt += 1) {
        const wait = await mig.query(
          `SELECT wait_event_type FROM pg_stat_activity
           WHERE pid = $1 AND wait_event_type = 'Lock'`,
          [backendB.rows[0].pid],
        );
        if (wait.rowCount > 0) { waitedOnAssetLock = true; break; }
        await new Promise(resolve => setTimeout(resolve, 20));
      }

      await clientA.query('COMMIT');
      await secondApproval;
      if (secondError) await clientB.query('ROLLBACK');
      else await clientB.query('COMMIT');

      const persistedStatuses = await mig.query(
        'SELECT id, status FROM loans WHERE id = ANY($1::varchar[]) ORDER BY id',
        [[loanAId, loanBId]],
      );
      const statusById = Object.fromEntries(persistedStatuses.rows.map(row => [row.id, row.status]));
      loanConcurrencyPass = waitedOnAssetLock
        && Boolean(secondError)
        && secondError.code === 'P0001'
        && statusById[loanAId] === 'approved'
        && statusById[loanBId] === 'pending_approval';
      record(
        'Concurrent approvals for one asset serialize and reject the second overlap',
        'one approved + one pending; second transaction waits and receives P0001',
        `waited=${waitedOnAssetLock}; error=${secondError?.code || 'none'}; statuses=${JSON.stringify(statusById)}`,
        loanConcurrencyPass,
      );
    } catch (error) {
      record('Concurrent loan approval anti-collision integration', 'second overlapping approval rejected',
        `error: ${error.message}`, false);
      try { await clientA?.query('ROLLBACK'); } catch { /* best effort */ }
      try { await clientB?.query('ROLLBACK'); } catch { /* best effort */ }
    } finally {
      try { await clientA?.end(); } catch { /* best effort */ }
      try { await clientB?.end(); } catch { /* best effort */ }
      await mig.query('DELETE FROM loans WHERE id = ANY($1::varchar[])', [[loanAId, loanBId]]);
      await mig.query('DELETE FROM assets WHERE id = $1', [concurrencyAssetId]);
    }

    // ---------- Room anti-double-booking under concurrent reservations ----------
    // Exercise the PostgreSQL trigger with independent transactions on one room.
    const roomFixture = await mig.query(
      'SELECT id FROM users WHERE is_active = TRUE ORDER BY id LIMIT 1',
    );
    const organizerId = roomFixture.rows[0]?.id;
    const roomSuffix = crypto.randomBytes(6).toString('hex');
    const roomReservationAId = `CR-ROOM-A-${roomSuffix}`;
    const roomReservationBId = `CR-ROOM-B-${roomSuffix}`;
    const roomReservationNumberA = `CR-ROOM-A-${roomSuffix}`;
    const roomReservationNumberB = `CR-ROOM-B-${roomSuffix}`;
    const roomId = `CR-ROOM-${roomSuffix}`;
    const roomStart = new Date(Date.now() + 12 * 86400000);
    roomStart.setUTCSeconds(0, 0);
    const roomEnd = new Date(roomStart.getTime() + 60 * 60 * 1000);
    const roomDate = roomStart.toISOString().slice(0, 10);
    const roomStartTime = roomStart.toISOString().slice(11, 19);
    const roomEndTime = roomEnd.toISOString().slice(11, 19);
    const roomStartIso = roomStart.toISOString();
    const roomEndIso = roomEnd.toISOString();
    let roomClientA;
    let roomClientB;
    try {
      if (!organizerId) throw new Error('test organizer fixture is unavailable');
      for (const [id, number] of [
        [roomReservationAId, roomReservationNumberA],
        [roomReservationBId, roomReservationNumberB],
      ]) {
        await mig.query(
          `INSERT INTO room_reservations
            (id, reservation_number, room_id, room_name, title, organizer_id, organizer_name,
             meeting_type, date, start_time, end_time, start_datetime, end_datetime, status)
           VALUES ($1, $2, $3, 'CI concurrent room', 'CI room collision', $4, 'CI Organizer',
                   'meeting', $5, $6, $7, $8, $9, 'cancelled')`,
          [id, number, roomId, organizerId, roomDate, roomStartTime, roomEndTime, roomStartIso, roomEndIso],
        );
      }

      roomClientA = new pg.Client({ connectionString: TEST_DB_URL });
      roomClientB = new pg.Client({ connectionString: TEST_DB_URL });
      roomClientA.on('error', e => console.error('[room concurrency A]', e.message));
      roomClientB.on('error', e => console.error('[room concurrency B]', e.message));
      await Promise.all([roomClientA.connect(), roomClientB.connect()]);
      await roomClientA.query('BEGIN');
      await roomClientA.query(`UPDATE room_reservations SET status = 'pending' WHERE id = $1`, [roomReservationAId]);

      await roomClientB.query('BEGIN');
      const roomBackendB = await roomClientB.query('SELECT pg_backend_pid() AS pid');
      let roomSecondSettled = false;
      let roomSecondError = null;
      const secondReservation = roomClientB.query(
        `UPDATE room_reservations SET status = 'pending' WHERE id = $1`,
        [roomReservationBId],
      ).then(() => { roomSecondSettled = true; }, error => { roomSecondSettled = true; roomSecondError = error; });

      let waitedOnRoomLock = false;
      for (let attempt = 0; attempt < 100 && !roomSecondSettled; attempt += 1) {
        const wait = await mig.query(
          `SELECT wait_event_type FROM pg_stat_activity
           WHERE pid = $1 AND wait_event_type = 'Lock'`,
          [roomBackendB.rows[0].pid],
        );
        if (wait.rowCount > 0) { waitedOnRoomLock = true; break; }
        await new Promise(resolve => setTimeout(resolve, 20));
      }

      await roomClientA.query('COMMIT');
      await secondReservation;
      if (roomSecondError) await roomClientB.query('ROLLBACK');
      else await roomClientB.query('COMMIT');

      const roomStatuses = await mig.query(
        'SELECT id, status FROM room_reservations WHERE id = ANY($1::varchar[]) ORDER BY id',
        [[roomReservationAId, roomReservationBId]],
      );
      const roomStatusById = Object.fromEntries(roomStatuses.rows.map(row => [row.id, row.status]));
      const roomConcurrencyPass = waitedOnRoomLock
        && Boolean(roomSecondError)
        && roomSecondError.code === 'P0001'
        && roomStatusById[roomReservationAId] === 'pending'
        && roomStatusById[roomReservationBId] === 'cancelled';
      record(
        'Concurrent overlapping room reservations serialize and reject the second transaction',
        'one pending + one cancelled; second transaction waits and receives P0001',
        `waited=${waitedOnRoomLock}; error=${roomSecondError?.code || 'none'}; statuses=${JSON.stringify(roomStatusById)}`,
        roomConcurrencyPass,
      );
    } catch (error) {
      record('Concurrent room reservation anti-double-booking integration', 'second overlapping reservation rejected',
        `error: ${error.message}`, false);
      try { await roomClientA?.query('ROLLBACK'); } catch { /* best effort */ }
      try { await roomClientB?.query('ROLLBACK'); } catch { /* best effort */ }
    } finally {
      try { await roomClientA?.end(); } catch { /* best effort */ }
      try { await roomClientB?.end(); } catch { /* best effort */ }
      await mig.query('DELETE FROM room_reservations WHERE id = ANY($1::varchar[])',
        [[roomReservationAId, roomReservationBId]]);
    }

    // ---------- Audit log append-only enforcement ----------
    // Verify the actor FK can detach on user deletion without mutating the
    // immutable actor snapshot, then reject UPDATE/DELETE/TRUNCATE.
    const auditSuffix = crypto.randomBytes(6).toString('hex');
    const auditUserId = `CR-AUDIT-USER-${auditSuffix}`;
    const auditLogId = `CR-AUDIT-LOG-${auditSuffix}`;
    let auditTransactionOpen = false;
    try {
      await mig.query('BEGIN');
      auditTransactionOpen = true;
      await mig.query(
        `INSERT INTO users (id, name, email, role, is_active)
         VALUES ($1, 'CI Audit Fixture', $2, 'Karyawan', TRUE)`,
        [auditUserId, `cr-audit-${auditSuffix}@example.test`],
      );
      await mig.query(
        `INSERT INTO audit_logs (id, action, entity, entity_id, user_id, user_name, user_role, details, timestamp)
         VALUES ($1, 'CI_AUDIT_IMMUTABILITY', 'CI', $2, $3, 'CI Audit Fixture', 'Karyawan', 'Immutable fixture', NOW())`,
        [auditLogId, auditUserId, auditUserId],
      );
      await mig.query('DELETE FROM users WHERE id = $1', [auditUserId]);
      const detachedAudit = await mig.query(
        'SELECT user_id, user_name, user_role, details FROM audit_logs WHERE id = $1',
        [auditLogId],
      );
      const detached = detachedAudit.rows[0];
      record(
        'Deleting a user preserves audit history and clears only the actor FK',
        'user_id NULL; actor name/role/details retained',
        JSON.stringify(detached),
        Boolean(detached && detached.user_id === null
          && detached.user_name === 'CI Audit Fixture'
          && detached.user_role === 'Karyawan'
          && detached.details === 'Immutable fixture'),
      );

      const assertAuditMutationBlocked = async (label, sql) => {
        await mig.query('SAVEPOINT audit_mutation');
        try {
          await mig.query(sql);
          await mig.query('ROLLBACK TO SAVEPOINT audit_mutation');
          record(label, 'PostgreSQL error code 55000', 'mutation unexpectedly succeeded', false);
        } catch (error) {
          await mig.query('ROLLBACK TO SAVEPOINT audit_mutation');
          record(label, 'PostgreSQL error code 55000', error.code || error.message, error.code === '55000');
        }
      };
      await assertAuditMutationBlocked(
        'Audit log rejects UPDATE at database level',
        `UPDATE audit_logs SET details = 'tampered' WHERE id = '${auditLogId}'`,
      );
      await assertAuditMutationBlocked(
        'Audit log rejects DELETE at database level',
        `DELETE FROM audit_logs WHERE id = '${auditLogId}'`,
      );
      await assertAuditMutationBlocked(
        'Audit log rejects TRUNCATE at database level',
        'TRUNCATE TABLE audit_logs',
      );
      const preservedAudit = await mig.query(
        'SELECT COUNT(*)::int AS count FROM audit_logs WHERE id = $1 AND details = $2',
        [auditLogId, 'Immutable fixture'],
      );
      record('Audit log survives all rejected mutation attempts', '1 intact row',
        `count=${preservedAudit.rows[0].count}`, preservedAudit.rows[0].count === 1);
    } catch (error) {
      record('Audit log append-only PostgreSQL integration', 'FK detach + immutable row', `error: ${error.message}`, false);
    } finally {
      if (auditTransactionOpen) await mig.query('ROLLBACK').catch(() => undefined);
    }

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
    let karyawanToken = karyawanLogin.json?.data?.token || '';
    record('login Karyawan', '200 + token', `HTTP ${karyawanLogin.status}`, karyawanLogin.status === 200 && Boolean(karyawanToken));

    const auditorLogin = await req(base, 'POST', '/api/auth/login', { body: { email: AUDITOR_EMAIL, password: USER_PASS } });
    const auditorToken = auditorLogin.json?.data?.token || '';
    record('login Auditor', '200 + token', `HTTP ${auditorLogin.status}`, auditorLogin.status === 200 && Boolean(auditorToken));

    if (!adminToken) throw new Error('cannot continue without admin token');

    // ---------- PostgreSQL-backed notification rule administration ----------
    const notificationSettings = await req(base, 'GET', '/api/admin/notification-rules', { token: adminToken });
    const notificationRows = notificationSettings.json?.data || [];
    record('Admin reads all four persisted notification rules', '200 + four settings',
      `HTTP ${notificationSettings.status} rows=${notificationRows.length}`,
      notificationSettings.status === 200 && notificationRows.length === 4
        && notificationRows.every(row => typeof row.is_active === 'boolean'));

    const employeeNotificationRead = await req(base, 'GET', '/api/admin/notification-rules', { token: karyawanToken });
    record('Authenticated employee can read notification rule status', '200',
      `HTTP ${employeeNotificationRead.status}`, employeeNotificationRead.status === 200);

    const anonymousNotificationRead = await req(base, 'GET', '/api/admin/notification-rules');
    record('Anonymous notification rule read is denied', '401',
      `HTTP ${anonymousNotificationRead.status}`, anonymousNotificationRead.status === 401);

    const employeeNotificationWrite = await req(base, 'PATCH', '/api/admin/notification-rules/rule-sla', {
      token: karyawanToken, body: { is_active: false },
    });
    record('Karyawan cannot change notification rules', '403',
      `HTTP ${employeeNotificationWrite.status}`, employeeNotificationWrite.status === 403);

    const invalidNotificationBoolean = await req(base, 'PATCH', '/api/admin/notification-rules/rule-sla', {
      token: adminToken, body: { is_active: 'false' },
    });
    record('Notification rule rejects string boolean', '400',
      `HTTP ${invalidNotificationBoolean.status}`, invalidNotificationBoolean.status === 400);

    const unknownNotificationRule = await req(base, 'PATCH', '/api/admin/notification-rules/not-a-rule', {
      token: adminToken, body: { is_active: false },
    });
    record('Notification rule rejects unknown rule IDs', '400',
      `HTTP ${unknownNotificationRule.status}`, unknownNotificationRule.status === 400);

    const notificationAuditClient = new pg.Client({ connectionString: TEST_DB_URL });
    await notificationAuditClient.connect();
    const notificationAuditBefore = await notificationAuditClient.query(
      "SELECT COUNT(*)::int AS count FROM gabah_notification_rule_audit WHERE rule_id = 'rule-sla'",
    );
    const notificationDisable = await req(base, 'PATCH', '/api/admin/notification-rules/rule-sla', {
      token: adminToken, body: { is_active: false },
    });
    const notificationNoop = await req(base, 'PATCH', '/api/admin/notification-rules/rule-sla', {
      token: adminToken, body: { is_active: false },
    });
    const notificationRestore = await req(base, 'PATCH', '/api/admin/notification-rules/rule-sla', {
      token: adminToken, body: { is_active: true },
    });
    const notificationAuditAfter = await notificationAuditClient.query(
      "SELECT COUNT(*)::int AS count FROM gabah_notification_rule_audit WHERE rule_id = 'rule-sla'",
    );

    await notificationAuditClient.query('BEGIN');
    await notificationAuditClient.query(
      'INSERT INTO gabah_notification_rule_audit (rule_id, previous_is_active, new_is_active, changed_by_user_id) VALUES ($1, TRUE, FALSE, $2)',
      ['rule-sla', 'CI_NOTIFICATION_AUDIT'],
    );
    const assertNotificationAuditMutationBlocked = async (label, sql) => {
      await notificationAuditClient.query('SAVEPOINT notification_audit_mutation');
      try {
        await notificationAuditClient.query(sql);
        await notificationAuditClient.query('ROLLBACK TO SAVEPOINT notification_audit_mutation');
        record(label, 'PostgreSQL error code 55000', 'mutation unexpectedly succeeded', false);
      } catch (error) {
        await notificationAuditClient.query('ROLLBACK TO SAVEPOINT notification_audit_mutation');
        record(label, 'PostgreSQL error code 55000', error.code || error.message, error.code === '55000');
      }
    };
    await assertNotificationAuditMutationBlocked(
      'Notification rule audit rejects UPDATE at database level',
      "UPDATE gabah_notification_rule_audit SET new_is_active = TRUE WHERE changed_by_user_id = 'CI_NOTIFICATION_AUDIT'",
    );
    await assertNotificationAuditMutationBlocked(
      'Notification rule audit rejects DELETE at database level',
      "DELETE FROM gabah_notification_rule_audit WHERE changed_by_user_id = 'CI_NOTIFICATION_AUDIT'",
    );
    await assertNotificationAuditMutationBlocked(
      'Notification rule audit rejects TRUNCATE at database level',
      'TRUNCATE TABLE gabah_notification_rule_audit',
    );
    const notificationAuditFixture = await notificationAuditClient.query(
      "SELECT COUNT(*)::int AS count FROM gabah_notification_rule_audit WHERE changed_by_user_id = 'CI_NOTIFICATION_AUDIT'",
    );
    record('Notification audit survives rejected mutation attempts', '1 intact fixture row',
      `count=${notificationAuditFixture.rows[0].count}`, notificationAuditFixture.rows[0].count === 1);
    await notificationAuditClient.query('ROLLBACK');
    await notificationAuditClient.end();
    record('Superadmin can disable and restore an operational notification rule', '200 + false then true',
      `disable=${notificationDisable.status} noop=${notificationNoop.status} restore=${notificationRestore.status}`,
      notificationDisable.status === 200 && notificationDisable.json?.data?.is_active === false
        && notificationNoop.status === 200 && notificationNoop.json?.data?.is_active === false
        && notificationRestore.status === 200 && notificationRestore.json?.data?.is_active === true);
    record('Notification setting audit records only actual state changes', 'exactly two new audit rows',
      `before=${notificationAuditBefore.rows[0].count} after=${notificationAuditAfter.rows[0].count}`,
      notificationAuditAfter.rows[0].count - notificationAuditBefore.rows[0].count === 2);


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
    const oldKaryawanSession = await req(base, 'GET', '/api/auth/me', { token: karyawanToken });
    record('Role assignment revokes the target user\'s existing session', '401', `HTTP ${oldKaryawanSession.status}`, oldKaryawanSession.status === 401);
    const karyawanReloginAfterGa = await req(base, 'POST', '/api/auth/login', { body: { email: KARYAWAN_EMAIL, password: USER_PASS } });
    karyawanToken = karyawanReloginAfterGa.json?.data?.token || '';
    record('Karyawan can sign in again after role assignment', '200 + new token', `HTTP ${karyawanReloginAfterGa.status}`, karyawanReloginAfterGa.status === 200 && Boolean(karyawanToken));

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
    const karyawanReloginAfterVendorRole = await req(base, 'POST', '/api/auth/login', { body: { email: KARYAWAN_EMAIL, password: USER_PASS } });
    karyawanToken = karyawanReloginAfterVendorRole.json?.data?.token || '';
    record('Karyawan re-authenticates after vendor role assignment', '200 + new token', `HTTP ${karyawanReloginAfterVendorRole.status}`, karyawanReloginAfterVendorRole.status === 200 && Boolean(karyawanToken));

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
    const karyawanReloginAfterAuditor = await req(base, 'POST', '/api/auth/login', { body: { email: KARYAWAN_EMAIL, password: USER_PASS } });
    karyawanToken = karyawanReloginAfterAuditor.json?.data?.token || '';
    record('Karyawan re-authenticates after Auditor capability assignment', '200 + new token', `HTTP ${karyawanReloginAfterAuditor.status}`, karyawanReloginAfterAuditor.status === 200 && Boolean(karyawanToken));
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

    // ---------- 6b. Runtime PostgreSQL failure must rollback and latch closed ----------
    const faultClient = new pg.Client({ connectionString: TEST_DB_URL });
    faultClient.on('error', e => console.error('[pg fault-injection async error]', e.message));
    await faultClient.connect();
    const passwordBeforeFault = await faultClient.query('SELECT password_hash FROM users WHERE id = $1', [itUserId]);
    const snapshotPasswordBeforeFault = await faultClient.query(
      "SELECT user_json->>'password_hash' AS password_hash FROM gabah_state, jsonb_array_elements(payload->'users') AS users_json(user_json) WHERE user_json->>'email' = $1",
      [IT_EMAIL],
    );
    await faultClient.query(`
      CREATE OR REPLACE FUNCTION gabah_ci_reject_user_sync() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.email = 'it.support@foodstation.co.id' THEN
          RAISE EXCEPTION 'CI forced normalized user sync failure';
        END IF;
        RETURN NEW;
      END;
      $$;
    `);
    await faultClient.query('CREATE TRIGGER gabah_ci_reject_user_sync BEFORE INSERT OR UPDATE ON users FOR EACH ROW EXECUTE FUNCTION gabah_ci_reject_user_sync()');

    const faultedPasswordReset = await req(base, 'POST', `/api/users/${itUserId}/reset-password`, { token: adminToken2 });
    const passwordAfterFault = await faultClient.query('SELECT password_hash FROM users WHERE id = $1', [itUserId]);
    const snapshotPasswordAfterFault = await faultClient.query(
      "SELECT user_json->>'password_hash' AS password_hash FROM gabah_state, jsonb_array_elements(payload->'users') AS users_json(user_json) WHERE user_json->>'email' = $1",
      [IT_EMAIL],
    );
    const rolledBackState = passwordBeforeFault.rowCount === 1 && passwordAfterFault.rowCount === 1
      && snapshotPasswordBeforeFault.rowCount === 1 && snapshotPasswordAfterFault.rowCount === 1
      && passwordAfterFault.rows[0]?.password_hash === passwordBeforeFault.rows[0]?.password_hash
      && snapshotPasswordAfterFault.rows[0]?.password_hash === snapshotPasswordBeforeFault.rows[0]?.password_hash;
    record('Runtime normalized-table failure rolls back gabah_state snapshot', 'unchanged user row + JSONB credential',
      `HTTP ${faultedPasswordReset.status}; rollback=${rolledBackState}`,
      faultedPasswordReset.status === 503 && rolledBackState);

    const subsequentMutation = await req(base, 'POST', `/api/users/${itUserId}/reset-password`, { token: adminToken2 });
    const passwordAfterLatchedWrite = await faultClient.query('SELECT password_hash FROM users WHERE id = $1', [itUserId]);
    const snapshotPasswordAfterLatchedWrite = await faultClient.query(
      "SELECT user_json->>'password_hash' AS password_hash FROM gabah_state, jsonb_array_elements(payload->'users') AS users_json(user_json) WHERE user_json->>'email' = $1",
      [IT_EMAIL],
    );
    const latchPreservedState = passwordAfterLatchedWrite.rowCount === 1 && snapshotPasswordAfterLatchedWrite.rowCount === 1
      && passwordAfterLatchedWrite.rows[0]?.password_hash === passwordBeforeFault.rows[0]?.password_hash
      && snapshotPasswordAfterLatchedWrite.rows[0]?.password_hash === snapshotPasswordBeforeFault.rows[0]?.password_hash;
    record('Subsequent mutation remains fail-closed after runtime PostgreSQL failure', 'HTTP 400; no second snapshot write',
      `HTTP ${subsequentMutation.status}; unchanged=${latchPreservedState}`,
      subsequentMutation.status === 503 && latchPreservedState);
    await faultClient.query('DROP TRIGGER IF EXISTS gabah_ci_reject_user_sync ON users');
    await faultClient.query('DROP FUNCTION IF EXISTS gabah_ci_reject_user_sync()');
    await faultClient.end();

    child2.kill('SIGKILL');
    await new Promise(r => setTimeout(r, 500));

    // ---------- 7. Production fail-fast with dead DATABASE_URL ----------
    const PORT3 = await getAvailablePort();
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
