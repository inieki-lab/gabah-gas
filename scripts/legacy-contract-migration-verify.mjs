#!/usr/bin/env node
/**
 * Regression for upgrading the pre-Contract-Management legacy contracts table.
 * This is deliberately separate from the fresh-database migration test:
 * production databases may already contain contracts.owner_division_id (BIGINT).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';

const adminUrl = process.env.GABAH_TEST_PG_ADMIN_URL;
if (!adminUrl) {
  console.error('GABAH_TEST_PG_ADMIN_URL is required; refusing to guess a database target.');
  process.exit(2);
}

const dbName = `gabah_legacy_contract_${crypto.randomBytes(5).toString('hex')}`;
const admin = new pg.Client({ connectionString: adminUrl });
const targetUrl = new URL(adminUrl);
targetUrl.pathname = `/${dbName}`;
let client;

async function main() {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${dbName}"`);
  client = new pg.Client({ connectionString: targetUrl.toString() });
  await client.connect();

  // Reproduce the older normalized schema before migration 004 was introduced.
  await client.query(`
    CREATE TABLE divisions (
      id BIGINT PRIMARY KEY,
      code VARCHAR(20) NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL
    );
    CREATE TABLE users (id VARCHAR(64) PRIMARY KEY);
    CREATE TABLE tickets (id VARCHAR(64) PRIMARY KEY);
    CREATE TABLE contracts (
      id VARCHAR(64) PRIMARY KEY,
      contract_number VARCHAR(100) NOT NULL UNIQUE,
      vendor_name VARCHAR(255) NOT NULL,
      title VARCHAR(255) NOT NULL,
      start_date DATE,
      end_date DATE NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'active',
      owner_division_id BIGINT REFERENCES divisions(id),
      document_ref TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    INSERT INTO divisions (id, code, name) VALUES (17, 'IT', 'Information Technology');
    INSERT INTO contracts
      (id, contract_number, vendor_name, title, start_date, end_date, status, owner_division_id, notes)
    VALUES
      ('LEGACY-CONTRACT-1', 'LEGACY/IT/001', 'Vendor Lama', 'Kontrak pemeliharaan server',
       '2025-01-01', '2027-01-01', 'active', 17, 'Catatan lama harus tetap utuh');
  `);

  const migrationPath = path.resolve('server/migrations/004_contract_management.sql');
  const migrationSql = fs.readFileSync(migrationPath, 'utf8');
  await client.query(migrationSql);

  const migrated = await client.query(`
    SELECT id, contract_number, vendor_name, title,
           to_char(start_date, 'YYYY-MM-DD') AS start_date,
           to_char(end_date, 'YYYY-MM-DD') AS end_date,
           status, owner_division, contract_type, notes, notice_period_days, reminder1_days
      FROM contracts WHERE id = 'LEGACY-CONTRACT-1'
  `);
  const row = migrated.rows[0];
  const checks = [
    ['legacy row retained', migrated.rowCount === 1],
    ['owner division ID mapped to division code', row?.owner_division === 'IT'],
    ['contract number retained', row?.contract_number === 'LEGACY/IT/001'],
    ['vendor and title retained', row?.vendor_name === 'Vendor Lama' && row?.title === 'Kontrak pemeliharaan server'],
    ['dates and status retained', row?.start_date === '2025-01-01'
      && row?.end_date === '2027-01-01' && row?.status === 'active'],
    ['legacy notes retained', row?.notes === 'Catatan lama harus tetap utuh'],
    ['new governance defaults applied', row?.contract_type === 'Umum'
      && row?.notice_period_days === 0 && row?.reminder1_days === 60],
    ['ticket linkage column created', (await client.query(
      "SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'tickets' AND column_name = 'contract_id'"
    )).rowCount === 1],
  ];

  // The migration must also be safe to retry after an interrupted deployment.
  await client.query(migrationSql);
  checks.push(['migration is idempotent on upgraded database',
    (await client.query("SELECT count(*)::int AS n FROM contracts WHERE id = 'LEGACY-CONTRACT-1'")).rows[0].n === 1]);

  for (const [name, pass] of checks) console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}`);
  const failed = checks.filter(([, pass]) => !pass);
  console.log(`SUMMARY: ${checks.length - failed.length}/${checks.length} PASS`);
  if (failed.length) process.exitCode = 1;
}

try {
  await main();
} catch (error) {
  console.error('[FAIL] legacy contract migration regression:', error?.stack || error);
  process.exitCode = 1;
} finally {
  try { await client?.end(); } catch {}
  try {
    // The admin connection remains open until this cleanup block.
    await admin.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
  } catch (error) {
    console.error('[WARN] could not drop isolated migration test database:', error.message);
    process.exitCode = 1;
  }
  try { await admin.end(); } catch {}
}
