-- GABAH migration 044: database-enforced collision safety for loans and rooms.
--
-- Legacy BEFORE triggers used SELECT-before-write checks. Concurrent
-- transactions can both pass those checks; the exclusion constraints below
-- are the authoritative concurrency-safe guard.
--
-- Existing overlaps are never deleted or rewritten. The migration stops with
-- a clear error so the data owner can review and reconcile affected records.

CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $migration$
DECLARE
  room_conflicts BIGINT;
  loan_conflicts BIGINT;
  overdue_duplicates BIGINT;
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
   AND a.status IN ('approved', 'borrowed')
   AND b.status IN ('approved', 'borrowed')
   AND tstzrange(a.start_date, a.due_date, '[)')
       && tstzrange(b.start_date, b.due_date, '[)');

  IF loan_conflicts > 0 THEN
    RAISE EXCEPTION
      'Migration 044 dihentikan: ditemukan % pasangan pinjaman aset approved/borrowed yang bertabrakan. Tinjau data sebelum menerapkan constraint.',
      loan_conflicts;
  END IF;

  SELECT COUNT(*) INTO overdue_duplicates
  FROM (
    SELECT asset_id
    FROM loans
    WHERE status = 'overdue'
    GROUP BY asset_id
    HAVING COUNT(*) > 1
  ) duplicates;

  IF overdue_duplicates > 0 THEN
    RAISE EXCEPTION
      'Migration 044 dihentikan: ditemukan % aset dengan lebih dari satu pinjaman overdue. Tinjau data sebelum menerapkan constraint.',
      overdue_duplicates;
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
        (tstzrange(start_datetime, end_datetime, '[)')) WITH &&
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
        (tstzrange(start_date, due_date, '[)')) WITH &&
      )
      WHERE (status IN ('approved', 'borrowed'));
  END IF;
END
$migration$;

CREATE UNIQUE INDEX IF NOT EXISTS loans_one_overdue_per_asset
  ON loans (asset_id)
  WHERE status = 'overdue';

-- The exclusion constraint owns the equivalent GiST index; remove the old
-- non-enforcing index to avoid duplicate storage and write amplification.
DROP INDEX IF EXISTS idx_room_reservations_no_double_booking;

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

-- Serialize loan writes by locking the asset row. Overdue transitions must be
-- recorded even when a future reservation already exists; operators can then
-- resolve that booking, while every NEW request is blocked until physical return.
CREATE OR REPLACE FUNCTION check_loan_schedule_collision()
RETURNS TRIGGER AS $
DECLARE
  asset_is_loanable BOOLEAN;
  asset_status TEXT;
  asset_condition TEXT;
BEGIN
  IF NEW.status IN ('pending_approval', 'approved', 'borrowed', 'overdue') THEN
    SELECT is_loanable, status, condition
      INTO asset_is_loanable, asset_status, asset_condition
      FROM assets
      WHERE id = NEW.asset_id
      FOR UPDATE;

    -- Requests and approvals must target an eligible, unassigned asset.
    -- The handover transition to borrowed is exempt because the custody
    -- assignment is created as part of the same business operation.
    IF NEW.status IN ('pending_approval', 'approved') AND (
      NOT COALESCE(asset_is_loanable, FALSE)
      OR LOWER(BTRIM(COALESCE(asset_status, ''))) NOT IN ('active', 'available')
      OR LOWER(BTRIM(COALESCE(asset_condition, ''))) IN ('poor', 'broken', 'damaged')
      OR EXISTS (
        SELECT 1 FROM asset_assignments
        WHERE asset_id = NEW.asset_id AND returned_date IS NULL
      )
    ) THEN
      RAISE EXCEPTION 'Aset tidak memenuhi syarat peminjaman atau sudah ditugaskan kepada pegawai.';
    END IF;

    -- Handover may create an active assignment for this loan's own
    -- borrower, but must never transfer an already-assigned asset from another
    -- employee while changing the loan state.
    IF NEW.status = 'borrowed' AND EXISTS (
      SELECT 1 FROM asset_assignments
      WHERE asset_id = NEW.asset_id
        AND returned_date IS NULL
        AND assigned_to_user_id IS NOT NULL
        AND assigned_to_user_id <> NEW.borrower_id
    ) THEN
      RAISE EXCEPTION 'Aset sudah ditugaskan kepada pegawai lain; serah-terima pinjaman ditolak.';
    END IF;

    IF NEW.status <> 'overdue' AND EXISTS (
      SELECT 1 FROM loans
      WHERE asset_id = NEW.asset_id
        AND id <> NEW.id
        AND status IN ('approved', 'borrowed', 'overdue')
        AND (
          status = 'overdue'
          OR (status = 'borrowed' AND due_date < NOW())
          OR (NEW.start_date < due_date AND NEW.due_date > start_date)
        )
    ) THEN
      RAISE EXCEPTION 'Tabrakan Jadwal: Aset masih direservasi, dipinjam, atau belum dikembalikan.';
    END IF;
  END IF;
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_loan_schedule_collision ON loans;
CREATE TRIGGER trg_check_loan_schedule_collision
  BEFORE INSERT OR UPDATE OF asset_id, start_date, due_date, status
  ON loans
  FOR EACH ROW
  EXECUTE FUNCTION check_loan_schedule_collision();
