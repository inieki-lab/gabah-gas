-- GABAH Module Lifecycle — registry and append-only status history.
-- Additive/idempotent. Existing modules are seeded Active so rollout does not
-- unexpectedly disable any currently shipped navigation capability.
-- This migration does not alter user roles, RBAC permissions, or business data.

CREATE TABLE IF NOT EXISTS gabah_modules (
  module_key VARCHAR(80) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 100,
  is_system BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by_user_id TEXT,
  CONSTRAINT gabah_modules_key_format CHECK (module_key ~ '^[a-z][a-z0-9_]{1,79}$'),
  CONSTRAINT gabah_modules_sort_order_check CHECK (sort_order >= 0)
);

CREATE TABLE IF NOT EXISTS gabah_module_status_audit (
  id BIGSERIAL PRIMARY KEY,
  module_key VARCHAR(80) NOT NULL REFERENCES gabah_modules(module_key) ON DELETE RESTRICT,
  previous_is_active BOOLEAN NOT NULL,
  new_is_active BOOLEAN NOT NULL,
  reason TEXT NOT NULL CHECK (LENGTH(TRIM(reason)) >= 5),
  changed_by_user_id TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gabah_module_status_change_check CHECK (previous_is_active <> new_is_active)
);

CREATE INDEX IF NOT EXISTS gabah_module_status_audit_module_time_idx
  ON gabah_module_status_audit (module_key, changed_at DESC);

-- Keep these keys aligned with AppNavTab in src/navigation/roleNavigation.ts.
-- Seed all shipped tabs Active; no user or role access is granted by this table.
INSERT INTO gabah_modules (module_key, name, description, is_active, sort_order, is_system)
VALUES
  ('dashboard', 'Dashboard', 'Ringkasan operasional dan perhatian utama.', TRUE, 10, TRUE),
  ('my_assets', 'Aset Saya', 'Daftar aset yang menjadi tanggung jawab pengguna.', TRUE, 20, TRUE),
  ('meeting_rooms', 'Booking Ruang Meeting', 'Reservasi ruang rapat dan pengelolaan fasilitas meeting.', TRUE, 30, TRUE),
  ('assets', 'Manajemen Aset', 'Inventaris, penempatan, mutasi, dan siklus hidup aset.', TRUE, 40, TRUE),
  ('maintenance', 'Pemeliharaan', 'Jadwal dan pencatatan pemeliharaan aset.', TRUE, 50, TRUE),
  ('loans', 'Peminjaman', 'Permohonan, persetujuan, serah terima, dan pengembalian.', TRUE, 60, TRUE),
  ('tickets', 'Helpdesk', 'Permintaan bantuan dan penanganan tiket layanan.', TRUE, 70, TRUE),
  ('licenses', 'Lisensi', 'Informasi dan administrasi lisensi perangkat lunak.', TRUE, 80, TRUE),
  ('contracts', 'Manajemen Kontrak', 'Kontrak, dokumen, milestone, dan pengingat.', TRUE, 90, TRUE),
  ('vendors', 'Vendor', 'Master data dan administrasi vendor.', TRUE, 100, TRUE),
  ('knowledge', 'Knowledge Base', 'Artikel panduan dan basis pengetahuan.', TRUE, 110, TRUE),
  ('reports', 'Laporan', 'Laporan dan analisis operasional.', TRUE, 120, TRUE)
ON CONFLICT (module_key) DO NOTHING;

-- Enforce the audit trail as append-only at the database boundary.
-- UPDATE/DELETE and TRUNCATE are rejected even if an application path is added
-- incorrectly in the future. Database superusers can still administer the schema.
CREATE OR REPLACE FUNCTION gabah_reject_module_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'gabah_module_status_audit is append-only; % is not permitted', TG_OP
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS gabah_module_status_audit_no_row_mutation
  ON gabah_module_status_audit;
CREATE TRIGGER gabah_module_status_audit_no_row_mutation
  BEFORE UPDATE OR DELETE ON gabah_module_status_audit
  FOR EACH ROW
  EXECUTE FUNCTION gabah_reject_module_audit_mutation();

DROP TRIGGER IF EXISTS gabah_module_status_audit_no_truncate
  ON gabah_module_status_audit;
CREATE TRIGGER gabah_module_status_audit_no_truncate
  BEFORE TRUNCATE ON gabah_module_status_audit
  FOR EACH STATEMENT
  EXECUTE FUNCTION gabah_reject_module_audit_mutation();
