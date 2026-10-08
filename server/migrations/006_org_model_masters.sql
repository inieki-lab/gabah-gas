-- ============================================================
-- ORG-MODEL migration (2026-10-08)
-- Rombak struktur master organisasi: Jabatan/Level, Unit, dan
-- Kantor/Lokasi menjadi master terpisah & configurable.
--
-- Prinsip:
-- 1. Role ≠ Jabatan/Level ≠ Unit ≠ Lokasi. Kombinasi disimpan sebagai
--    atribut user (job_level_code, unit_id, office_location_id).
-- 2. Jabatan/level TIDAK otomatis memberikan permission — permission
--    tetap dari RBAC per role.
-- 3. Unit ≠ Jabatan (PIBC/Supply Chain/Pangsub = unit, bukan jabatan).
-- 4. Lokasi ≠ Unit; satu lokasi bisa banyak unit; tanpa mapping permanen
--    level→lokasi.
-- 5. Migration aman & idempoten: data existing tetap terbaca; user lama
--    di-backfill STAF/NULL tanpa mengubah role/divisi.
-- ============================================================

-- Master Jabatan/Level (configurable: tambah/edit/disable oleh Admin GABAH)
CREATE TABLE IF NOT EXISTS org_job_levels (
  code       VARCHAR(32) PRIMARY KEY,
  label      VARCHAR(120) NOT NULL,
  order_num  INTEGER NOT NULL DEFAULT 99,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO org_job_levels (code, label, order_num, is_active) VALUES
  ('DIREKSI', 'Direksi', 1, TRUE),
  ('KADIV',   'Kepala Divisi', 2, TRUE),
  ('KADEP',   'Kepala Departemen', 3, TRUE),
  ('KASI',    'Kepala Seksi', 4, TRUE),
  ('STAF',    'Staf', 5, TRUE)
ON CONFLICT (code) DO NOTHING;

-- Master Unit/Bagian (terpisah dari jabatan & lokasi)
CREATE TABLE IF NOT EXISTS org_units (
  id            VARCHAR(64) PRIMARY KEY,
  name          VARCHAR(160) NOT NULL,
  division_code VARCHAR(16) NOT NULL REFERENCES divisions(code),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO org_units (id, name, division_code, is_active) VALUES
  ('UNIT-SEKDIR',     'Sekretariat Direksi', 'Umum', TRUE),
  ('UNIT-HUMAS',      'Humas & Protokoler', 'Umum', TRUE),
  ('UNIT-IT-MIS',     'IT & MIS', 'IT', TRUE),
  ('UNIT-GA-SARPRAS', 'GA / Sarpras', 'GA', TRUE),
  ('UNIT-GA-UMUM',    'GA / Urus Rumah Tangga', 'GA', TRUE),
  ('UNIT-SC',         'Supply Chain', 'SC', TRUE),
  ('UNIT-PIBC',       'PIBC', 'PIBC', TRUE),
  ('UNIT-PANGSUB',    'Pangsub', 'SC', TRUE),
  ('UNIT-AUDIT',      'Satuan Pengawas Internal', 'Audit', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Master Kantor/Lokasi penempatan (terpisah dari unit; tanpa mapping permanen)
CREATE TABLE IF NOT EXISTS org_office_locations (
  id         VARCHAR(64) PRIMARY KEY,
  name       VARCHAR(160) NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO org_office_locations (id, name, is_active) VALUES
  ('OFF-KP',        'Kantor Pusat', TRUE),
  ('OFF-PIBC',      'PIBC', TRUE),
  ('OFF-PERAWATAN', 'Kantor Perawatan', TRUE),
  ('OFF-PANGSUB',   'Kantor Pangsub', TRUE),
  ('OFF-RPC',       'RPC/Supply Chain', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Atribut user: kombinasi role + jabatan + unit + lokasi disimpan sebagai
-- atribut user — TIDAK membuat role baru. Permission tetap dari role/RBAC.
ALTER TABLE users ADD COLUMN IF NOT EXISTS job_level_code      VARCHAR(32)  REFERENCES org_job_levels(code);
ALTER TABLE users ADD COLUMN IF NOT EXISTS unit_id             VARCHAR(64)  REFERENCES org_units(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS office_location_id  VARCHAR(64)  REFERENCES org_office_locations(id);

-- Backfill aman: user lama tanpa jabatan → STAF (tanpa mengubah role/divisi);
-- unit & lokasi dibiarkan NULL sampai ditugaskan Admin.
UPDATE users SET job_level_code = 'STAF' WHERE job_level_code IS NULL;

-- Catatan desain aset (tidak berubah — ditegaskan kembali):
--   assets.owner_division = pemilik (IT/GA/SC/PIBC) — TIDAK diubah oleh lokasi.
--   assets.location       = lokasi fisik bebas (PIBC, Kantor Pusat, dst).
--   Asset numbering {DIV}-{CODE}-{YEAR}-{SEQ} tetap berbasis owner division.
