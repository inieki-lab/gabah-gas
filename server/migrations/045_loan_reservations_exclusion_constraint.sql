-- GABAH migration 045: make loan schedule collision prevention concurrency-safe.
--
-- The previous BEFORE trigger used SELECT-before-INSERT. Concurrent requests
-- for the same asset could both pass that check before either transaction
-- committed. A GiST EXCLUDE constraint atomically protects overlapping
-- approved/borrowed schedule intervals.
--
-- Overdue loans are handled by the serialized trigger below: they block every
-- NEW reservation, but an existing future reservation is not silently erased
-- and a loan must still be allowed to transition to overdue for audit accuracy.
-- The asset row is locked before the trigger checks conflicts, serializing
-- same-asset mutations. No legacy loan rows are rewritten.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM loans a
    JOIN loans b
      ON a.asset_id = b.asset_id
     AND a.id < b.id
     AND a.status IN ('approved', 'borrowed')
     AND b.status IN ('approved', 'borrowed')
     AND tstzrange(a.start_date, a.due_date, '[)')
         && tstzrange(b.start_date, b.due_date, '[)')
  ) THEN
    RAISE EXCEPTION
      'Migration 045 blocked: overlapping approved/borrowed asset loans exist. Reconcile conflicts; no loan data was changed.';
  END IF;

  IF EXISTS (
    SELECT asset_id
    FROM loans
    WHERE status = 'overdue'
    GROUP BY asset_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Migration 045 blocked: more than one overdue loan exists for an asset. Reconcile overdue records; no loan data was changed.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'loans_no_double_booking'
      AND conrelid = 'loans'::regclass
  ) THEN
    ALTER TABLE loans
      ADD CONSTRAINT loans_no_double_booking
      EXCLUDE USING gist (
        asset_id WITH =,
        tstzrange(start_date, due_date, '[)') WITH &&
      )
      WHERE (status IN ('approved', 'borrowed'));
  END IF;
END
$;

CREATE UNIQUE INDEX IF NOT EXISTS loans_one_overdue_per_asset
  ON loans (asset_id)
  WHERE status = 'overdue';

-- Keep the trigger for overdue lockout and friendly domain errors, but serialize
-- all same-asset mutations on the parent asset row before checking the schedule.
CREATE OR REPLACE FUNCTION check_loan_schedule_collision()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('approved', 'borrowed', 'overdue') THEN
    PERFORM 1 FROM assets WHERE id = NEW.asset_id FOR UPDATE;

    -- An overdue transition must be recorded even if a future reservation
    -- already exists; that reservation remains visible for operator resolution.
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_loan_schedule_collision ON loans;
CREATE TRIGGER trg_check_loan_schedule_collision
  BEFORE INSERT OR UPDATE OF asset_id, start_date, due_date, status
  ON loans
  FOR EACH ROW
  EXECUTE FUNCTION check_loan_schedule_collision();
