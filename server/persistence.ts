import 'dotenv/config';
import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { db, seedInitialData } from './db';
import { hashPassword } from './crypto';
import { AssetNumberingEngine } from './numbering';

function isPlaceholderHostname(hostname?: string | null): boolean {
  if (!hostname) return false;
  const lower = hostname.toLowerCase();
  return lower === 'database' || lower === 'postgres';
}

function resolveDbConfig() {
  const rawUrl = process.env.DATABASE_URL;
  const rawHost = process.env.PGHOST;

  let isPlaceholder = false;
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      if (isPlaceholderHostname(parsed.hostname)) {
        isPlaceholder = true;
      }
    } catch {
      if (rawUrl.includes('@database:') || rawUrl.includes('@database/') || rawUrl.includes('@postgres:')) {
        isPlaceholder = true;
      }
    }
  }

  if (rawHost && isPlaceholderHostname(rawHost)) {
    isPlaceholder = true;
  }

  // If the host is a docker-compose placeholder ('database' or 'postgres'),
  // do NOT target it to prevent DNS EAI_AGAIN resolution failures in standalone environments.
  if (isPlaceholder) {
    return {
      isConfigured: false,
      poolConfig: {
        host: '127.0.0.1',
        port: 5432,
        database: 'gabah_db',
        user: 'gabah_user',
        password: '',
        max: 1,
        idleTimeoutMillis: 1000,
        connectionTimeoutMillis: 500,
      },
    };
  }

  const hasRealConfig = Boolean(rawUrl || (rawHost && rawHost !== '127.0.0.1' && rawHost !== 'localhost'));
  return {
    isConfigured: hasRealConfig,
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
  if (Array.isArray(state.users) && state.users.length > 0) {
    db.users = state.users.map((u: any) => {
      if (!u.password_hash || !u.password_salt) {
        const pass = u.temp_password || (u.role === 'Admin GABAH' ? 'AdminGabah#2026' : 'Pangan2026!');
        const { hash, salt } = hashPassword(pass);
        return { ...u, password_hash: hash, password_salt: salt };
      }
      return u;
    });
  }
  if (Array.isArray(state.sessions)) db.sessions = state.sessions;
  if (Array.isArray(state.assets) && state.assets.length > 0) db.assets = state.assets;
  if (Array.isArray(state.movements) && state.movements.length > 0) db.movements = state.movements;
  if (Array.isArray(state.loans) && state.loans.length > 0) db.loans = state.loans;
  if (Array.isArray(state.tickets) && state.tickets.length > 0) db.tickets = state.tickets;
  if (Array.isArray(state.notifications) && state.notifications.length > 0) db.notifications = state.notifications;
  if (Array.isArray(state.auditLogs) && state.auditLogs.length > 0) db.auditLogs = state.auditLogs;
  if (Array.isArray(state.rooms) && state.rooms.length > 0) db.rooms = state.rooms;
  if (Array.isArray(state.roomReservations) && state.roomReservations.length > 0) db.roomReservations = state.roomReservations;
}

function loadStateFromFile(): boolean {
  try {
    if (!fs.existsSync(STATE_FILE)) return false;
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const state = JSON.parse(raw);
    if (state && typeof state === 'object') {
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
    sessions: db.sessions,
    assets: db.assets,
    movements: db.movements,
    loans: db.loans,
    tickets: db.tickets,
    notifications: db.notifications,
    auditLogs: db.auditLogs,
    rooms: db.rooms,
    roomReservations: db.roomReservations,
  };
}

async function ensureNormalizedSchema(): Promise<void> {
  const migrationsDir = path.resolve(process.cwd(), 'server/migrations');
  if (!fs.existsSync(migrationsDir)) return;
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await pool.query(sql);
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
    for (const s of db.sessions) {
      await client.query(
        `INSERT INTO user_sessions (id,token,user_id,created_at,expires_at,last_active_at,ip_address,user_agent)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO UPDATE SET last_active_at=EXCLUDED.last_active_at,expires_at=EXCLUDED.expires_at`,
        [s.id, s.token, s.user_id, s.created_at, s.expires_at, s.last_active_at, s.ip_address || null, s.user_agent || null],
      );
    }
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

  isPostgresAvailable = false;
  console.log(`[GABAH Persistence] PostgreSQL unavailable (${lastError?.code || lastError?.message || 'standalone'}). Activating resilient persistent file store.`);

  // Hydrate from persistent file store if it exists
  const loaded = loadStateFromFile();
  if (loaded) {
    console.log('[GABAH Persistence] Successfully hydrated state from local storage file.');
  } else {
    saveStateToFile(createPayload());
    console.log('[GABAH Persistence] Initialized new persistent local storage file.');
  }

  ensureCanonicalAdministrator();
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

