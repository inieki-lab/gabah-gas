-- GABAH migration 044: database-enforced collision safety for loans and rooms.
--
-- The legacy BEFORE triggers used SELECT-before-write checks. They are useful
-- for readable errors, but concurrent transactions can both pass the SELECT.
-- The exclusion constraints below are the authoritative concurrency-safe guard.
--
-- Existing overlaps are NOT deleted or silently rewritten. The migration stops
-- with a clear error so the data owner can review and resolve the affected rows.

CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $migration$
DECLARE
  room_conflicts BIGINT;
  loan_conflicts BIGINT;
BEGIN
  SELECT COUNT(*) INTO room_conflicts
  FROM room_reservations a
  JOIN room_reservations b
    ON a.id < b.id
   AND a.room_id = b.room_id
   AND a.status IN ('pending_approval', 'pending', 'approved', 'in_use', 'checked_in')
   AND b.status IN ('pending_approval', 'pending', 'approved', 'in_use', 'checked_in')
   AND tstzrange(a.start_datetime, a.end_datetime, '[)')
       && tstzrange(b.start_datetime, b.end_datetime, '[)');

  IF room_conflicts > 0 THEN
    RAISE EXCEPTION
      'Migration 044 dihentikan: ditemukan % pasangan reservasi ruangan aktif yang bertabrakan. Tinjau data sebelum menerapkan constraint.',
      room_conflicts;
  END IF;

  SELECT COUNT(*) INTO loan_conflicts
  FROM loans a
  JOIN loans b
    ON a.id < b.id
   AND a.asset_id = b.asset_id
   AND a.status IN ('approved', 'borrowed', 'overdue')
   AND b.status IN ('approved', 'borrowed', 'overdue')
   AND (
     CASE
       WHEN a.status = 'overdue' OR (a.status = 'borrowed' AND a.due_date < NOW())
         THEN tstzrange(a.start_date, 'infinity'::timestamptz, '[)')
       ELSE tstzrange(a.start_date, a.due_date, '[)')
     END
   ) && (
     CASE
       WHEN b.status = 'overdue' OR (b.status = 'borrowed' AND b.due_date < NOW())
         THEN tstzrange(b.start_date, 'infinity'::timestamptz, '[)')
       ELSE tstzrange(b.start_date, b.due_date, '[)')
     END
   );

  IF loan_conflicts > 0 THEN
    RAISE EXCEPTION
      'Migration 044 dihentikan: ditemukan % pasangan pinjaman aset aktif yang bertabrakan. Tinjau data sebelum menerapkan constraint.',
      loan_conflicts;
  END IF;
END
$migration$;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'room_reservations_no_time_overlap'
      AND conrelid = 'room_reservations'::regclass
  ) THEN
    ALTER TABLE room_reservations
      ADD CONSTRAINT room_reservations_no_time_overlap
      EXCLUDE USING gist (
        room_id WITH =,
        tstzrange(start_datetime, end_datetime, '[)') WITH &&
      )
      WHERE (status IN ('pending_approval', 'pending', 'approved', 'in_use', 'checked_in'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'loans_no_confirmed_asset_overlap'
      AND conrelid = 'loans'::regclass
  ) THEN
    ALTER TABLE loans
      ADD CONSTRAINT loans_no_confirmed_asset_overlap
      EXCLUDE USING gist (
        asset_id WITH =,
        (CASE
          WHEN status = 'overdue'
            THEN tstzrange(start_date, 'infinity'::timestamptz, '[)')
          ELSE tstzrange(start_date, due_date, '[)')
        END) WITH &&
      )
      WHERE (status IN ('approved', 'borrowed', 'overdue'));
  END IF;
END
$migration$;

-- Serialize writes per room before the friendly overlap check. The exclusion
-- constraint remains authoritative even if another writer bypasses this trigger.
CREATE OR REPLACE FUNCTION prevent_double_booking()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('pending_approval', 'pending', 'approved', 'in_use', 'checked_in') THEN
    PERFORM pg_advisory_xact_lock(44001, hashtext(NEW.room_id));

    IF EXISTS (
      SELECT 1 FROM room_reservations
      WHERE room_id = NEW.room_id
        AND id <> NEW.id
        AND status IN ('pending_approval', 'pending', 'approved', 'in_use', 'checked_in')
        AND tstzrange(start_datetime, end_datetime, '[)')
            && tstzrange(NEW.start_datetime, NEW.end_datetime, '[)')
    ) THEN
      RAISE EXCEPTION 'Double-booking terdeteksi: Ruangan % sudah dipesan pada rentang waktu tersebut.', NEW.room_name;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_double_booking ON room_reservations;
CREATE TRIGGER trg_prevent_double_booking
  BEFORE INSERT OR UPDATE OF room_id, start_datetime, end_datetime, status
  ON room_reservations
  FOR EACH ROW
  EXECUTE FUNCTION prevent_double_booking();

-- Serialize loan writes per asset. This also preserves the application rule
-- that an overdue loan or an expired-but-not-yet-reconciled borrowed loan keeps
-- the physical asset unavailable until its return is recorded.
CREATE OR REPLACE FUNCTION check_loan_schedule_collision()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('approved', 'borrowed', 'overdue') THEN
    PERFORM pg_advisory_xact_lock(44002, hashtext(NEW.asset_id));

    IF EXISTS (
      SELECT 1 FROM loans
      WHERE asset_id = NEW.asset_id
        AND id <> NEW.id
        AND status IN ('approved', 'borrowed', 'overdue')
        AND (
          status = 'overdue'
          OR (status = 'borrowed' AND due_date < NOW())
          OR NEW.status = 'overdue'
          OR (NEW.status = 'borrowed' AND NEW.due_date < NOW())
          OR (NEW.start_date < due_date AND NEW.due_date > start_date)
        )
    ) THEN
      RAISE EXCEPTION 'Tabrakan Jadwal: Aset masih direservasi, dipinjam, atau belum dikembalikan.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_loan_schedule_collision ON loans;
CREATE TRIGGER trg_check_loan_schedule_collision
  BEFORE INSERT OR UPDATE OF asset_id, start_date, due_date, status
  ON loans
  FOR EACH ROW
  EXECUTE FUNCTION check_loan_schedule_collision();
