import 'dotenv/config';
import { Pool } from 'pg';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { db, seedInitialData, CANONICAL_USERS } from './db';
import { hashPassword } from './crypto';
import { AssetNumberingEngine } from './numbering';

/**
 * SECURITY (CR-02): initial canonical-account passwords are provisioned from
 * environment secrets — never hardcoded. The Admin GABAH bootstrap account
 * requires GABAH_INITIAL_ADMIN_PASSWORD; all other canonical accounts use
 * GABAH_INITIAL_USER_PASSWORD. When neither is set (development only), each
 * account receives a unique, CSPRNG-generated random password that is written
 * once to a Git-ignored file so the first interactive login remains possible.
 * The generated values are NEVER embedded in source code or committed files.
 */
export function provisionCanonicalUserPasswords(): void {
  const adminPass = process.env.GABAH_INITIAL_ADMIN_PASSWORD;
  const userPass = process.env.GABAH_INITIAL_USER_PASSWORD;
  const devFallback = !adminPass && !userPass && process.env.NODE_ENV !== 'production';

  // UAT convenience (explicit operator request, dev/test only): when
  // GABAH_TEST_PASSWORD is set OUTSIDE production, EVERY canonical account is
  // (re)provisioned with that one short shared password so QA can test all 9
  // roles without managing credentials. Sessions are not revoked here; users
  // simply re-login with the test password.
  const testPassword = process.env.NODE_ENV === 'production' ? undefined : process.env.GABAH_TEST_PASSWORD;

  let devNote: string[] | null = devFallback ? [] : null;
  let devFile: string | null = devFallback ? path.join(DATA_DIR, 'initial_credentials_dev.txt') : null;

  for (const cu of CANONICAL_USERS) {
    const user = db.users.find(u => u.id === cu.id || (u.email && u.email.toLowerCase() === cu.email.toLowerCase()));
    if (!user) continue;

    let plain: string;
    if (testPassword) {
      plain = testPassword;
    } else {
      // Never clobber an existing credential (e.g. an operator already changed it)
      if (user.password_hash && user.password_salt) continue;
      if (cu.role === 'Admin GABAH') {
        plain = adminPass || userPass || crypto.randomBytes(18).toString('base64url');
      } else {
        plain = userPass || crypto.randomBytes(18).toString('base64url');
      }
    }

    const { hash, salt } = hashPassword(plain);
    user.password_hash = hash;
    user.password_salt = salt;
    delete user.temp_password;
    if (typeof user.authVersion !== 'number') user.authVersion = 1;

    if (devNote) devNote.push(`${cu.email} => ${plain}`);
  }

  if (testPassword) {
    console.log('[GABAH Security] UAT mode: all canonical accounts share the GABAH_TEST_PASSWORD test credential (non-production only).');
  }

  if (devNote && devNote.length > 0 && devFile) {
    try {
      fs.writeFileSync(devFile, devNote.join('\n') + '\n', { encoding: 'utf8', mode: 0o600 });
      console.log(`[GABAH Security] Dev-only initial credentials written once to ${path.basename(devFile)} (gitignored). Set GABAH_INITIAL_ADMIN_PASSWORD in production.`);
    } catch {
      console.warn('[GABAH Security] Could not write dev credential note file.');
    }
  }
}

function resolveDbConfig() {
  const rawUrl = process.env.DATABASE_URL;
  const rawHost = process.env.PGHOST;

  // DATABASE_URL and PGHOST are explicit database configuration. Docker Compose
  // service names such as "database" and "postgres" are valid DNS hostnames.
  const isConfigured = Boolean(rawUrl || rawHost);

  return {
    isConfigured,
    poolConfig: {
      connectionString: rawUrl || undefined,
      host: rawHost || (rawUrl ? undefined : '127.0.0.1'),
      port: Number(process.env.PGPORT || 5432),
      database: process.env.PGDATABASE || 'gabah_db',
      user: process.env.PGUSER || 'gabah_user',
      password: process.env.PGPASSWORD || '',
      max: 5,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 2000,
    },
  };
}

const dbConfig = resolveDbConfig();
const pool = new Pool(dbConfig.poolConfig);

let isPostgresAvailable = false;
let persistQueue: Promise<void> = Promise.resolve();

// Prevent unhandled error crashes from pg pool background events
pool.on('error', (err) => {
  if (isPostgresAvailable) {
    console.log('[GABAH Persistence] PostgreSQL pool status changed:', err.message);
    isPostgresAvailable = false;
  }
});

const DATA_DIR = path.resolve(process.cwd(), 'server/data');
const STATE_FILE = path.join(DATA_DIR, 'gabah_state.json');

/**
 * SECURITY (CR-03 §3.7): global revocation epoch. Incremented whenever exposed
 * or previously valid credentials must be force-invalidated (e.g. after the
 * committed gabah_state.json token leak). Sessions carry the epoch they were
 * issued under; getActiveSession() rejects any token from an older epoch.
 * Override via GABAH_SECURITY_EPOCH to force re-login across a deployment.
 */
const SECURITY_EPOCH = Number(process.env.GABAH_SECURITY_EPOCH || '2');
export function getSecurityEpoch(): number {
  return SECURITY_EPOCH;
}

function ensureDataDirectory(): void {
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch {
      // ignore
    }
  }
}

function saveStateToFile(payload: any): void {
  try {
    ensureDataDirectory();
    const tempFile = `${STATE_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(payload, null, 2), 'utf8');
    fs.renameSync(tempFile, STATE_FILE);
  } catch (err: any) {
    console.warn('[GABAH Persistence] Notice saving state to file:', err.message);
  }
}

function hydrateDbFromState(state: any): void {
  const existingUsers: any[] = Array.isArray(state.users) ? state.users : [];
  const mergedUsers: any[] = [...existingUsers];

  // Guarantee all 9 canonical enterprise users are always present in the datastore.
  // SECURITY (CR-02): canonical users are merged WITHOUT password material —
  // provisioning happens in provisionCanonicalUserPasswords() from env secrets.
  for (const cu of CANONICAL_USERS) {
    const foundIndex = mergedUsers.findIndex(u => u.id === cu.id || (u.email && u.email.toLowerCase() === cu.email.toLowerCase()));
    if (foundIndex === -1) {
      mergedUsers.push({
        ...cu,
        authVersion: 1,
      });
    } else {
      // Sync canonical role and label if needed
      mergedUsers[foundIndex].role = cu.role;
      mergedUsers[foundIndex].role_label = cu.role_label || mergedUsers[foundIndex].role_label;
      if (typeof mergedUsers[foundIndex].authVersion !== 'number') mergedUsers[foundIndex].authVersion = 1;
    }
  }

  // SECURITY (CR-02): never backfill missing password hashes from hardcoded
  // fallback passwords. Users without a stored hash are provisioned from env
  // secrets by provisionCanonicalUserPasswords() below; unknown non-canonical
  // accounts without hash material cannot log in until an Admin resets them.
  db.users = mergedUsers;

  // SECURITY (CR-03): session tokens are NEVER restored from persisted state.
  // Snapshot files/PG blobs may have been committed to Git (gabah_state.json)
  // and every token that has ever been in source control is considered
  // COMPROMISED. Sessions are in-memory only; users re-authenticate on boot.
  db.sessions = [];
  if (Array.isArray(state.assets) && state.assets.length > 0) db.assets = state.assets;
  if (Array.isArray(state.movements) && state.movements.length > 0) db.movements = state.movements;
  if (Array.isArray(state.loans) && state.loans.length > 0) db.loans = state.loans;
  if (Array.isArray(state.tickets) && state.tickets.length > 0) db.tickets = state.tickets;
  if (Array.isArray(state.notifications) && state.notifications.length > 0) db.notifications = state.notifications;
  if (Array.isArray(state.auditLogs) && state.auditLogs.length > 0) db.auditLogs = state.auditLogs;
  if (Array.isArray(state.rooms) && state.rooms.length > 0) db.rooms = state.rooms;
  if (Array.isArray(state.roomReservations) && state.roomReservations.length > 0) db.roomReservations = state.roomReservations;
  if (Array.isArray(state.categories) && state.categories.length > 0) db.categories = state.categories;
  if (Array.isArray(state.locations) && state.locations.length > 0) db.locations = state.locations;
  if (Array.isArray(state.divisions) && state.divisions.length > 0) db.divisions = state.divisions;
  if (Array.isArray(state.meetingTypes) && state.meetingTypes.length > 0) db.meetingTypes = state.meetingTypes;
  if (Array.isArray(state.meetingFacilities) && state.meetingFacilities.length > 0) db.meetingFacilities = state.meetingFacilities;
  if (Array.isArray(state.contracts) && state.contracts.length > 0) db.contracts = state.contracts;
  if (Array.isArray(state.contractNotificationLogs) && state.contractNotificationLogs.length > 0) db.contractNotificationLogs = state.contractNotificationLogs;
  // Maintenance schedules, vendor directory, and knowledge base are
  // server-authoritative collections — never silently reset on boot.
  if (Array.isArray(state.maintenances) && state.maintenances.length > 0) db.maintenances = state.maintenances;
  if (Array.isArray(state.vendors) && state.vendors.length > 0) db.vendors = state.vendors;
  if (Array.isArray(state.knowledgeArticles) && state.knowledgeArticles.length > 0) db.knowledgeArticles = state.knowledgeArticles;

  // Ticket category normalization: legacy 'License'/'General' collapse into divisional categories.
  // Software/License/SaaS → IT; General (facility) → GA. Contract Management is a separate domain.
  for (const t of db.tickets as any[]) {
    if (t.category === 'License' || t.category === 'General') {
      t.category = t.category === 'License' ? 'IT' : 'GA';
    }
  }
}

function loadStateFromFile(): boolean {
  try {
    if (!fs.existsSync(STATE_FILE)) return false;
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const state = JSON.parse(raw);
    if (state && typeof state === 'object') {
      // SECURITY (CR-03): sessions are stripped before hydration — tokens from
      // Git-tracked snapshots must never become live sessions.
      if (state.sessions) delete state.sessions;
      hydrateDbFromState(state);
      return true;
    }
  } catch (err: any) {
    console.warn('[GABAH Persistence] Notice reading state from file:', err.message);
  }
  return false;
}

function createPayload() {
  return {
    users: db.users,
    // SECURITY (CR-03): sessions are deliberately excluded from persisted
    // payloads. Session state lives in memory only and is never written to
    // the JSON snapshot or PostgreSQL gabah_state blob.
    sessions: [] as typeof db.sessions,
    assets: db.assets,
    movements: db.movements,
    loans: db.loans,
    tickets: db.tickets,
    notifications: db.notifications,
    auditLogs: db.auditLogs,
    rooms: db.rooms,
    roomReservations: db.roomReservations,
    categories: db.categories,
    locations: db.locations,
    divisions: db.divisions,
    meetingTypes: db.meetingTypes,
    meetingFacilities: db.meetingFacilities,
    contracts: db.contracts,
    contractNotificationLogs: db.contractNotificationLogs,
    maintenances: db.maintenances,
    vendors: db.vendors,
    knowledgeArticles: db.knowledgeArticles,
  };
}

/**
 * CR-04: authoritative migration runner.
 * - Creates a schema_migrations ledger first so the runner itself is repeatable
 *   and each applied file is recorded exactly once.
 * - Every migration file runs inside its own transaction; a failing migration
 *   aborts the whole schema bootstrap with a CLEAR error (no silent fallback).
 * - Migration files are expected to be idempotent (IF NOT EXISTS / ALTER guards)
 *   so re-running them on an already-migrated database is a safe no-op.
 */
async function ensureNormalizedSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(16) PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const migrationsDir = path.resolve(process.cwd(), 'server/migrations');
  if (!fs.existsSync(migrationsDir)) return;
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    const version = file.match(/^(\d+)/)?.[1] || file;
    const applied = await pool.query('SELECT 1 FROM schema_migrations WHERE version = $1', [version]);
    if (applied.rowCount && applied.rowCount > 0) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        `INSERT INTO schema_migrations (version, name, applied_at) VALUES ($1, $2, NOW())
         ON CONFLICT (version) DO NOTHING`,
        [version, file.replace(/\.sql$/, '')],
      );
      await client.query('COMMIT');
      console.log(`[GABAH Persistence] Migration applied: ${file}`);
    } catch (err: any) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw new Error(`Migration ${file} gagal dijalankan: ${err.message || err}`);
    } finally {
      client.release();
    }
  }
}

/**
 * Keep the existing operational administrator stable while the application
 * transitions from the legacy role model to the final Superadmin/RBAC model.
 * Superadmin remains a supported canonical frontend role, but must not be
 * persisted onto USR-01 yet because several legacy backend authorization
 * paths still explicitly recognize Admin GABAH.
 */
function ensureCanonicalAdministrator(): void {
  const legacy = db.users.find(u => u.id === 'USR-01');
  if (legacy) {
    (legacy as any).role = 'Admin GABAH';
    (legacy as any).role_label = 'Admin GABAH';
  }
}

async function backfillNormalizedTables(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const u of db.users) {
      await client.query(
        `INSERT INTO users (id,name,email,role,division_id,phone,avatar,is_active,password_hash,password_salt,updated_at)
         VALUES ($1,$2,$3,$4,(SELECT id FROM divisions WHERE code=$5),$6,$7,$8,$9,$10,NOW())
         ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,email=EXCLUDED.email,role=EXCLUDED.role,
           division_id=EXCLUDED.division_id,phone=EXCLUDED.phone,avatar=EXCLUDED.avatar,is_active=EXCLUDED.is_active,
           password_hash=COALESCE(EXCLUDED.password_hash, users.password_hash),
           password_salt=COALESCE(EXCLUDED.password_salt, users.password_salt),
           updated_at=NOW()`,
        [u.id,u.name,u.email,u.role,u.division,u.phone || null,u.avatar || null,u.is_active,u.password_hash || null,u.password_salt || null],
      );
    }
    // SECURITY (CR-03): db.sessions are deliberately NOT backfilled into
    // user_sessions — bearer tokens must never be restored to a durable store
    // from the application runtime (they were previously committed to Git).
    for (const a of db.assets) {
      await client.query(
        `INSERT INTO asset_categories (code,name,category_type,owner_division_id)
         VALUES ($1,$2,$3,(SELECT id FROM divisions WHERE code=$4)) ON CONFLICT (code) DO NOTHING`,
        [a.category_code,a.category_code,a.category_type,a.owner_division],
      );
      await client.query(
        `INSERT INTO assets (id,asset_number,corporate_asset_number,name,category_id,owner_division_id,brand,model,serial_number,specifications,purchase_date,purchase_price,warranty_until,status,condition,location,is_loanable,license_detail,notes,created_at,updated_at)
         VALUES ($1,$2,$3,$4,(SELECT id FROM asset_categories WHERE code=$5),(SELECT id FROM divisions WHERE code=$6),$7,$8,$9,$10,NULLIF($11,'')::date,$12,NULLIF($13,'')::date,$14,$15,$16,$17,$18,$19,$20,$21)
         ON CONFLICT (id) DO UPDATE SET asset_number=EXCLUDED.asset_number,corporate_asset_number=EXCLUDED.corporate_asset_number,name=EXCLUDED.name,category_id=EXCLUDED.category_id,owner_division_id=EXCLUDED.owner_division_id,brand=EXCLUDED.brand,model=EXCLUDED.model,serial_number=EXCLUDED.serial_number,specifications=EXCLUDED.specifications,purchase_date=EXCLUDED.purchase_date,purchase_price=EXCLUDED.purchase_price,warranty_until=EXCLUDED.warranty_until,status=EXCLUDED.status,condition=EXCLUDED.condition,location=EXCLUDED.location,is_loanable=EXCLUDED.is_loanable,license_detail=EXCLUDED.license_detail,notes=EXCLUDED.notes,updated_at=EXCLUDED.updated_at`,
        [a.id,a.asset_number,a.corporate_asset_number,a.name,a.category_code,a.owner_division,a.brand,a.model,a.serial_number,a.specifications,a.purchase_date || '',Number(a.purchase_price || 0),a.warranty_until || '',a.status,a.condition,a.location,a.is_loanable,a.license_detail ? JSON.stringify(a.license_detail) : null,a.notes || null,a.created_at,a.updated_at],
      );
      if (a.assigned_to?.id) {
        const userExists = db.users.some(u => u.id === a.assigned_to!.id);
        if (userExists) {
          await client.query(
            `INSERT INTO asset_assignments (asset_id,user_id,assigned_date,assigned_by,notes) VALUES ($1,$2,COALESCE(NULLIF($3,'')::date,CURRENT_DATE),NULL,$4) ON CONFLICT DO NOTHING`,
            [a.id,a.assigned_to.id,a.assigned_to.assigned_date || '','Backfilled from GABAH state'],
          );
        }
      }
    }
    for (const m of db.movements) await client.query(
      `INSERT INTO asset_movements (id,asset_id,from_user_id,to_user_id,from_location,to_location,reason,document_ref,performed_by_id,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`,
      [m.id,m.asset_id,m.from_user_id || null,m.to_user_id || null,m.from_location || null,m.to_location || null,m.reason || '',m.document_ref || null,m.performed_by_id || null,m.created_at],
    );
    for (const l of db.loans) {
      const borrowerExists = db.users.some(u => u.id === l.borrower_id);
      if (!borrowerExists) continue;
      const approverId = (l.approver_id && db.users.some(u => u.id === l.approver_id)) ? l.approver_id : null;
      const handoverId = (l.handover_by_id && db.users.some(u => u.id === l.handover_by_id)) ? l.handover_by_id : null;
      const returnInspectorId = (l.return_inspected_by_id && db.users.some(u => u.id === l.return_inspected_by_id)) ? l.return_inspected_by_id : null;
      await client.query(
        `INSERT INTO loans (id,loan_number,asset_id,borrower_id,purpose,start_date,due_date,status,approver_id,approved_at,handover_by_id,handover_at,handover_notes,actual_returned_at,return_condition,return_inspected_by_id,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status,approver_id=EXCLUDED.approver_id,approved_at=EXCLUDED.approved_at,handover_by_id=EXCLUDED.handover_by_id,handover_at=EXCLUDED.handover_at,handover_notes=EXCLUDED.handover_notes,actual_returned_at=EXCLUDED.actual_returned_at,return_condition=EXCLUDED.return_condition,return_inspected_by_id=EXCLUDED.return_inspected_by_id,updated_at=EXCLUDED.updated_at`,
        [l.id,l.loan_number,l.asset_id,l.borrower_id,l.purpose,l.start_date,l.due_date,l.status,approverId,l.approved_at || null,handoverId,l.handover_at || null,l.handover_notes || null,l.actual_returned_at || null,l.return_condition || null,returnInspectorId,l.created_at,l.updated_at],
      );
    }
    for (const t of db.tickets) {
      const reporterExists = db.users.some(u => u.id === t.reporter_id);
      if (!reporterExists) continue;
      const agentId = (t.assigned_agent_id && db.users.some(u => u.id === t.assigned_agent_id)) ? t.assigned_agent_id : null;
      await client.query(
        `INSERT INTO tickets (id,ticket_number,ticket_code,title,description,category,priority,status,reporter_id,assigned_agent_id,related_asset_id,sla_hours,sla_resolution_deadline,resolved_at,resolution_notes,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status,assigned_agent_id=EXCLUDED.assigned_agent_id,resolved_at=EXCLUDED.resolved_at,resolution_notes=EXCLUDED.resolution_notes,updated_at=EXCLUDED.updated_at`,
        [t.id,t.ticket_number,t.ticket_code,t.title,t.description,t.category,t.priority,t.status,t.reporter_id,agentId,t.related_asset_id || null,t.sla_hours,t.sla_resolution_deadline,t.resolved_at || null,t.resolution_notes || null,t.created_at,t.updated_at],
      );
    }
    for (const n of db.notifications) await client.query(
      `INSERT INTO notifications (id,recipient_user_id,recipient_role,recipient_division_id,title,message,severity,category,link_type,link_id,is_read,created_at) VALUES ($1,$2,$3,(SELECT id FROM divisions WHERE code=$4),$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO UPDATE SET is_read=EXCLUDED.is_read`,
      [n.id,n.recipient_user_id || null,n.recipient_role || null,n.recipient_division || null,n.title,n.message,n.severity,n.category,n.link_type || null,n.link_id || null,n.is_read,n.created_at],
    );
    // Contract Management (separate domain) — authoritative sync into PostgreSQL
    for (const c of (db as any).contracts || []) {
      await client.query(
        `INSERT INTO contracts (id,contract_number,contract_type,title,vendor_name,owner_division,pic_user_id,start_date,end_date,notice_period_days,notice_date,contract_value,auto_renewal,status,renewal_outcome,renewal_notes,replaced_by_contract_id,parent_contract_id,reminder1_days,reminder2_days,reminder3_days,escalation_user_id,restricted,notes,created_by,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27) ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status,renewal_outcome=EXCLUDED.renewal_outcome,renewal_notes=EXCLUDED.renewal_notes,updated_at=EXCLUDED.updated_at,notice_date=EXCLUDED.notice_date,end_date=EXCLUDED.end_date,notice_period_days=EXCLUDED.notice_period_days,restricted=EXCLUDED.restricted,escalation_user_id=EXCLUDED.escalation_user_id,reminder1_days=EXCLUDED.reminder1_days,reminder2_days=EXCLUDED.reminder2_days,reminder3_days=EXCLUDED.reminder3_days,auto_renewal=EXCLUDED.auto_renewal,contract_value=EXCLUDED.contract_value`,
        [c.id,c.contract_number,c.contract_type,c.title,c.vendor_name,c.owner_division,c.pic_user_id,c.start_date,c.end_date,c.notice_period_days,c.notice_date,c.contract_value||0,c.auto_renewal,c.status,c.renewal_outcome,c.renewal_notes||null,c.replaced_by_contract_id||null,c.parent_contract_id||null,c.reminder_config?.reminder1_days??60,c.reminder_config?.reminder2_days??35,c.reminder_config?.reminder3_days??7,c.escalation_user_id||null,c.restricted,c.notes||null,c.created_by,c.created_at,c.updated_at],
      );
      for (const d of c.documents || []) {
        await client.query(
          `INSERT INTO contract_documents (id,contract_id,kind,file_name,file_ref,uploaded_by,uploaded_at) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
          [d.id,c.id,d.kind,d.file_name,d.file_ref,d.uploaded_by,d.uploaded_at],
        );
      }
      for (const m of c.milestones || []) {
        await client.query(
          `INSERT INTO contract_milestones (id,contract_id,type,title,due_date,amount,status,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
          [m.id,c.id,m.type,m.title,m.due_date,m.amount||null,m.status,m.notes||null],
        );
      }
    }
    for (const l of (db as any).contractNotificationLogs || []) {
      await client.query(
        `INSERT INTO contract_notification_logs (id,contract_id,notification_type,channel,recipient,scheduled_at,sent_at,status,error_message) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
        [l.id,l.contract_id,l.notification_type,l.channel,l.recipient,l.scheduled_at,l.sent_at||null,l.status,l.error_message||null],
      );
    }
    // CR-04: also sync the ticket -> contract linkage so restarts/rebuilds keep it.
    for (const t of db.tickets) {
      const contractId = (t as any).contract_id;
      if (contractId) {
        await client.query(`UPDATE tickets SET contract_id=$1 WHERE id=$2`, [contractId, t.id]);
      }
    }
    for (const log of db.auditLogs) {
      const user = db.users.find(u => u.name === log.user_name);
      await client.query(
        `INSERT INTO audit_logs (id,action,entity,entity_id,user_id,user_name,user_role,details,timestamp) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
        [log.id,log.action,log.entity,log.entity_id || null,user?.id || null,log.user_name,log.user_role,log.details,log.timestamp],
      );
    }
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

async function persistPostgresState(): Promise<void> {
  const payload = createPayload();
  await pool.query(
    `INSERT INTO gabah_state (id,payload,updated_at) VALUES (1,$1::jsonb,NOW()) ON CONFLICT (id) DO UPDATE SET payload=EXCLUDED.payload,updated_at=NOW()`,
    [JSON.stringify(payload)],
  );
  await backfillNormalizedTables();
}

export async function initializePersistence(): Promise<void> {
  // If PostgreSQL is not configured with an external address, operate standalone with local persistent file store
  if (!dbConfig.isConfigured) {
    isPostgresAvailable = false;
    console.log('[GABAH Persistence] Standalone environment active. Utilizing resilient local file storage.');

    const loaded = loadStateFromFile();
    if (loaded) {
      console.log('[GABAH Persistence] Successfully hydrated state from local storage file.');
    } else {
      saveStateToFile(createPayload());
      console.log('[GABAH Persistence] Initialized new persistent local storage file.');
    }

    ensureCanonicalAdministrator();
    provisionCanonicalUserPasswords();
    AssetNumberingEngine.syncFromExistingAssets(db.assets);
    return;
  }

  const maxAttempts = process.env.NODE_ENV === 'production' ? 5 : 2;
  let lastError: any = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await ensureNormalizedSchema();
      await pool.query(`CREATE TABLE IF NOT EXISTS gabah_state (id SMALLINT PRIMARY KEY CHECK (id = 1), payload JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
      const result = await pool.query('SELECT payload FROM gabah_state WHERE id = 1');
      if (result.rows.length > 0) {
        const state = result.rows[0].payload;
        if (state && typeof state === 'object') {
          hydrateDbFromState(state);
        }
      }
      if (!db.assets || db.assets.length === 0) {
        seedInitialData();
      }
      ensureCanonicalAdministrator();
      provisionCanonicalUserPasswords();
      await persistPostgresState();
      await backfillNormalizedTables();
      AssetNumberingEngine.syncFromExistingAssets(db.assets);
      isPostgresAvailable = true;
      console.log('[GABAH Persistence] PostgreSQL persistence ready; normalized tables backfilled');
      saveStateToFile(createPayload());
      return;
    } catch (error: any) {
      lastError = error;
      if (attempt < maxAttempts) {
        console.log(`[GABAH Persistence] PostgreSQL connection attempt ${attempt}/${maxAttempts} notice: ${error.message || error}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  // SECURITY/RELIABILITY (CR-04): production must never silently degrade to the
  // JSON file store when PostgreSQL is explicitly configured but unavailable —
  // that hides data-integrity incidents (authoritative store bypassed). The file
  // fallback remains ONLY for local development/test convenience.
  isPostgresAvailable = false;
  if (process.env.NODE_ENV === 'production') {
    console.error(`[GABAH Persistence] FATAL: PostgreSQL unavailable in production (${lastError?.code || lastError?.message || 'unknown'}). Refusing to fall back to the file store.`);
    throw lastError instanceof Error ? lastError : new Error(`PostgreSQL unavailable in production: ${lastError?.message || lastError}`);
  }
  console.log(`[GABAH Persistence] PostgreSQL unavailable (${lastError?.code || lastError?.message || 'standalone'}). Development fallback: activating resilient persistent file store.`);

  // Hydrate from persistent file store if it exists
  const loaded = loadStateFromFile();
  if (loaded) {
    console.log('[GABAH Persistence] Successfully hydrated state from local storage file.');
  } else {
    saveStateToFile(createPayload());
    console.log('[GABAH Persistence] Initialized new persistent local storage file.');
  }

  ensureCanonicalAdministrator();
  provisionCanonicalUserPasswords();
  AssetNumberingEngine.syncFromExistingAssets(db.assets);
}

export function persistDataStore(): Promise<void> {
  const payload = createPayload();
  // Always persist immediately to local storage file
  saveStateToFile(payload);

  // If PostgreSQL is available, sync to database asynchronously
  if (isPostgresAvailable) {
    persistQueue = persistQueue.then(async () => {
      if (!isPostgresAvailable) return;
      try {
        await persistPostgresState();
      } catch (error: any) {
        isPostgresAvailable = false;
        console.warn('[GABAH Persistence] PostgreSQL disconnected during persist. Reverted to file store:', error.message || error);
      }
    });
  }

  return persistQueue;
}

export function getDbPool(): Pool {
  return pool;
}

/**
 * CR-04 observability: reports whether PostgreSQL is currently the active
 * persistence layer. Exposed via /api/health so operators can detect a
 * development file-store fallback immediately (production fail-fast makes
 * that state impossible by design).
 */
export function isPostgresPersistenceActive(): boolean {
  return isPostgresAvailable;
}

