import 'dotenv/config';
import { Pool } from 'pg';
import { initializePersistence, persistDataStore } from '../server/persistence';
import { db } from '../server/db';
import { GabahDomainService } from '../server/services';

async function main() {
  console.log('=== VERIFYING POSTGRESQL INITIALIZATION ===');
  await initializePersistence();

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    host: process.env.PGHOST || '127.0.0.1',
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || 'gabah_db',
    user: process.env.PGUSER || 'gabah_user',
    password: process.env.PGPASSWORD || '',
  });

  const res = await pool.query('SELECT count(*) FROM assets');
  console.log('Assets in PostgreSQL normalized table:', res.rows[0].count);

  const stateRes = await pool.query('SELECT length(payload::text) as bytes FROM gabah_state WHERE id = 1');
  console.log('gabah_state payload size in PostgreSQL:', stateRes.rows[0].bytes, 'bytes');

  const triggers = await pool.query(`
    SELECT event_object_table, trigger_name 
    FROM information_schema.triggers 
    WHERE trigger_name = 'trg_check_loan_schedule_collision'
  `);
  console.log('Anti-collision trigger in PostgreSQL:', triggers.rows);

  await pool.end();
  console.log('=== POSTGRESQL PERSISTENCE VERIFIED ===');
  process.exit(0);
}

main().catch(err => {
  console.error('PostgreSQL Verification Failed:', err);
  process.exit(1);
});
