-- GABAH Migration 010: Room Reservations Table (SEC-07 Anti-Collision)
--
-- Tujuan: Buat tabel room_reservations di PostgreSQL untuk:
-- 1. Menyimpan data reservasi ruangan di database (bukan hanya JSON)
-- 2. Menambahkan constraint untuk mencegah double-booking
--
-- Catatan: Saat ini data roomReservations hanya disimpan di JSON file store.
-- Migrasi ini membuat tabel PostgreSQL dan index yang diperlukan.

-- 1. Buat tabel room_reservations
CREATE TABLE IF NOT EXISTS room_reservations (
  id VARCHAR(64) PRIMARY KEY,
  reservation_number VARCHAR(100) NOT NULL UNIQUE,
  room_id VARCHAR(64) NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  room_name VARCHAR(255) NOT NULL,
  room_code VARCHAR(50),
  room_location VARCHAR(255),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  organizer_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organizer_name VARCHAR(200) NOT NULL,
  organizer_department VARCHAR(100),
  organizer_phone VARCHAR(50),
  organizer_role VARCHAR(50),
  attendees_count INTEGER NOT NULL DEFAULT 1,
  attendees_list TEXT,
  meeting_type VARCHAR(50) NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  start_datetime TIMESTAMPTZ NOT NULL,
  end_datetime TIMESTAMPTZ NOT NULL,
  facilities_requested TEXT[],
  consumption_requested BOOLEAN NOT NULL DEFAULT FALSE,
  consumption_type VARCHAR(50),
  consumption_pax INTEGER,
  consumption_notes TEXT,
  documentation_requested BOOLEAN NOT NULL DEFAULT FALSE,
  documentation_type VARCHAR(50),
  documentation_notes TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  approval_notes TEXT,
  approved_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejected_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  checkin_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  checkin_at TIMESTAMPTZ,
  checkout_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  checkout_at TIMESTAMPTZ,
  is_interrupted BOOLEAN NOT NULL DEFAULT FALSE,
  interrupted_by_name VARCHAR(200),
  interruption_reason TEXT,
  original_room_name VARCHAR(255),
  override_conflict BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Ensure end_datetime > start_datetime
  CONSTRAINT valid_time_range CHECK (end_datetime > start_datetime)
);

-- 2. Tambah index untuk query filtering
CREATE INDEX IF NOT EXISTS idx_room_reservations_room ON room_reservations (room_id);
CREATE INDEX IF NOT EXISTS idx_room_reservations_date ON room_reservations (date);
CREATE INDEX IF NOT EXISTS idx_room_reservations_status ON room_reservations (status);
CREATE INDEX IF NOT EXISTS idx_room_reservations_organizer ON room_reservations (organizer_id);
CREATE INDEX IF NOT EXISTS idx_room_reservations_datetime ON room_reservations (start_datetime, end_datetime);

-- 3. Tambah EXCLUDE constraint untuk mencegah double-booking (SEC-07)
-- Constraint ini mencegah dua reservasi aktif pada room yang sama dengan waktu yang overlapping
-- Hanya berlaku untuk status: pending, approved, in_use, checked_in
-- Status cancelled/rejected tidak ikut constraint
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE INDEX IF NOT EXISTS idx_room_reservations_no_double_booking ON room_reservations 
  USING gist (room_id, tstzrange(start_datetime, end_datetime))
  WHERE status IN ('pending', 'approved', 'in_use', 'checked_in');

-- 4. Trigger untuk validasi tambahan (opsional)
CREATE OR REPLACE FUNCTION prevent_double_booking()
RETURNS TRIGGER AS $$
BEGIN
  -- Cek apakah ada reservasi aktif yang overlapping di room yang sama
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.status IN ('pending', 'approved', 'in_use', 'checked_in') THEN
      IF EXISTS (
        SELECT 1 FROM room_reservations 
        WHERE room_id = NEW.room_id 
          AND id != COALESCE(NEW.id, '')
          AND status IN ('pending', 'approved', 'in_use', 'checked_in')
          AND tstzrange(start_datetime, end_datetime) && tstzrange(NEW.start_datetime, NEW.end_datetime)
      ) THEN
        RAISE EXCEPTION 'Double-booking terdeteksi: Ruangan % sudah dipesan pada jam %', NEW.room_name, tstzrange(NEW.start_datetime, NEW.end_datetime);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_double_booking ON room_reservations;
CREATE TRIGGER trg_prevent_double_booking
  BEFORE INSERT OR UPDATE ON room_reservations
  FOR EACH ROW EXECUTE FUNCTION prevent_double_booking();

-- 5. Record migration
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(16) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO schema_migrations (version, name, applied_at)
VALUES ('010', 'room_reservations', NOW())
ON CONFLICT (version) DO NOTHING;
