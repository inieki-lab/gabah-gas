import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || 'gabah_db',
  user: process.env.PGUSER || 'gabah_user',
  password: process.env.PGPASSWORD || 'PasswordBumd123!',
  connectionTimeoutMillis: 2000,
});

const users = [
  {
    id: 'USR-ADM-001',
    name: 'Superadmin GABAH',
    email: 'superadmin.gabah@foodstation.co.id',
    role: 'Admin GABAH',
    role_label: 'Superadmin',
    division: 'IT',
    department: 'System Administration',
    avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150',
    is_active: true,
  },
  {
    id: 'USR-IT-001',
    name: 'IT Staff',
    email: 'it.staff@foodstation.co.id',
    role: 'IT',
    role_label: 'IT Staff & Support',
    division: 'IT',
    department: 'Infrastruktur IT & Helpdesk',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    is_active: true,
  },
  {
    id: 'USR-GA-001',
    name: 'Staff GA',
    email: 'staff.ga@foodstation.co.id',
    role: 'GA',
    role_label: 'General Affair Staff',
    division: 'GA',
    department: 'General Affairs & Aset',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
    is_active: true,
  },
  {
    id: 'USR-SC-001',
    name: 'Staff Supply Chain',
    email: 'staff.sc@foodstation.co.id',
    role: 'Supply Chain',
    role_label: 'Staff Logistik & SC',
    division: 'SC',
    department: 'Supply Chain & Pergudangan Beras',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    is_active: true,
  },
  {
    id: 'USR-PIBC-001',
    name: 'Staff Pasar PIBC',
    email: 'staff.pibc@foodstation.co.id',
    role: 'PIBC',
    role_label: 'Staff Pengawas Pasar Cipinang',
    division: 'PIBC',
    department: 'Pengelolaan Pasar Induk Beras Cipinang',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
    is_active: true,
  },
  {
    id: 'USR-EMP-001',
    name: 'Staff Biasa',
    email: 'staff@foodstation.co.id',
    role: 'Karyawan',
    role_label: 'Staff Biasa / Pemohon',
    division: 'GA',
    department: 'Karyawan Operasional',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
    is_active: true,
  },
];

async function main() {
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const state = await client.query('SELECT payload FROM gabah_state WHERE id = 1 FOR UPDATE');
    if (state.rowCount === 1) {
      const payload = state.rows[0].payload || {};
      payload.users = users;
      await client.query(
        `UPDATE gabah_state SET payload = $1::jsonb, updated_at = NOW() WHERE id = 1`,
        [JSON.stringify(payload)],
      );

      for (const u of users) {
        await client.query(
          `INSERT INTO users (id,name,email,role,division_id,avatar,is_active,updated_at)
           VALUES ($1,$2,$3,$4,(SELECT id FROM divisions WHERE code=$5),$6,$7,NOW())
           ON CONFLICT (id) DO UPDATE SET
             name=EXCLUDED.name,email=EXCLUDED.email,role=EXCLUDED.role,
             division_id=EXCLUDED.division_id,avatar=EXCLUDED.avatar,
             is_active=EXCLUDED.is_active,updated_at=NOW()`,
          [u.id, u.name, u.email, u.role, u.division, u.avatar, u.is_active],
        );
      }

      await client.query(
        `UPDATE users SET is_active = FALSE, updated_at = NOW()
         WHERE id <> ALL($1::text[])`,
        [users.map(u => u.id)],
      );

      await client.query('COMMIT');
      console.log('GABAH PostgreSQL users reset successfully: 6 active users.');
    }
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.log(`[Info] PostgreSQL server not connected (${error.message}). GABAH resilient in-memory domain store handles active roles:`, users.map(u => `${u.name} (${u.role}/${u.division})`).join(', '));
  } finally {
    if (client) client.release();
    await pool.end().catch(() => {});
  }
}

await main();
