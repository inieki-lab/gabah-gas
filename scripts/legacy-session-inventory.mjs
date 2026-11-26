import { Pool } from 'pg';

const appMode = String(process.env.GABAH_APP_MODE || 'production').trim().toLowerCase();
const expectedDatabase = String(process.env.GABAH_LEGACY_SESSION_AUDIT_DATABASE || '').trim();
const confirmation = process.env.GABAH_LEGACY_SESSION_AUDIT_CONFIRM;
const connectionString = process.env.DATABASE_URL;

if (!['test', 'uat'].includes(appMode)) {
  throw new Error('Refusing legacy session inventory: GABAH_APP_MODE must be test or uat.');
}
if (confirmation !== 'READ_ONLY_REHEARSAL_ONLY') {
  throw new Error('Refusing legacy session inventory: explicit READ_ONLY_REHEARSAL_ONLY confirmation is required.');
}
if (!expectedDatabase || !connectionString) {
  throw new Error('Set DATABASE_URL and GABAH_LEGACY_SESSION_AUDIT_DATABASE for the isolated rehearsal database.');
}
if (/(^|[_-])(prod|production|live)([_-]|$)/i.test(expectedDatabase)) {
  throw new Error('Refusing legacy session inventory against a database name marked production/live.');
}

const pool = new Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 3000,
  application_name: 'gabah-legacy-session-readonly-audit',
});

let client;
try {
  client = await pool.connect();
  await client.query('BEGIN READ ONLY');
  const identity = await client.query(
    'SELECT current_database() AS database_name, current_user AS database_user, current_setting(\'transaction_read_only\') AS read_only',
  );
  const actualDatabase = String(identity.rows[0]?.database_name || '');
  if (actualDatabase !== expectedDatabase) {
    throw new Error('Connected database does not match GABAH_LEGACY_SESSION_AUDIT_DATABASE; audit aborted.');
  }
  if (identity.rows[0]?.read_only !== 'on') {
    throw new Error('PostgreSQL did not enter a read-only transaction; audit aborted.');
  }

  const exists = await client.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'user_sessions'
     ) AS present`,
  );
  let summary = {
    database: actualDatabase,
    tableExists: Boolean(exists.rows[0]?.present),
    rowCount: 0,
    expiredRows: 0,
    distinctUserCount: 0,
    oldestCreatedAt: null,
    newestCreatedAt: null,
  };

  if (summary.tableExists) {
    const result = await client.query(
      `SELECT
         COUNT(*)::bigint AS row_count,
         COUNT(*) FILTER (WHERE expires_at <= NOW())::bigint AS expired_rows,
         COUNT(DISTINCT user_id)::bigint AS distinct_user_count,
         MIN(created_at) AS oldest_created_at,
         MAX(created_at) AS newest_created_at
       FROM public.user_sessions`,
    );
    const row = result.rows[0] || {};
    summary = {
      ...summary,
      rowCount: Number(row.row_count || 0),
      expiredRows: Number(row.expired_rows || 0),
      distinctUserCount: Number(row.distinct_user_count || 0),
      oldestCreatedAt: row.oldest_created_at || null,
      newestCreatedAt: row.newest_created_at || null,
    };
  }

  await client.query('ROLLBACK');
  console.log(JSON.stringify({
    ...summary,
    databaseUser: String(identity.rows[0]?.database_user || ''),
    tokenValuesRead: false,
    mutationPerformed: false,
  }, null, 2));
} catch (error) {
  if (client) await client.query('ROLLBACK').catch(() => {});
  console.error('[GABAH] Legacy session inventory aborted:', error.message);
  process.exitCode = 1;
} finally {
  if (client) client.release();
  await pool.end();
}
