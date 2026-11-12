-- GABAH migration 045: enforce asset-loan collision prevention atomically.
--
-- The previous BEFORE trigger used SELECT-before-INSERT. Concurrent requests
-- for the same asset could both pass that check before either transaction
-- committed. The GiST EXCLUDE constraint makes overlap prevention atomic.
--
-- Approved loans reserve their requested interval. Borrowed/overdue loans
-- reserve the asset through infinity until a recorded return changes the status.
-- Pending requests do not reserve inventory. No legacy loan rows are rewritten.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM loans a
    JOIN loans b
      ON a.asset_id = b.asset_id
     AND a.id < b.id
     AND a.status IN ('approved', 'borrowed', 'overdue')
     AND b.status IN ('approved', 'borrowed', 'overdue')
     AND tstzrange(
           a.start_date,
           CASE WHEN a.status IN ('borrowed', 'overdue')
             THEN 'infinity'::timestamptz ELSE a.due_date END,
           '[)'
         )
         &&
         tstzrange(
           b.start_date,
           CASE WHEN b.status IN ('borrowed', 'overdue')
             THEN 'infinity'::timestamptz ELSE b.due_date END,
           '[)'
         )
  ) THEN
    RAISE EXCEPTION
      'Migration 045 blocked: overlapping active asset loans exist. Reconcile conflicts; no loan data was changed.';
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
        tstzrange(
          start_date,
          CASE WHEN status IN ('borrowed', 'overdue')
            THEN 'infinity'::timestamptz ELSE due_date END,
          '[)'
        ) WITH &&
      )
      WHERE (status IN ('approved', 'borrowed', 'overdue'));
  END IF;
END
$$;

-- The exclusion constraint replaces the race-prone trigger as the authoritative
-- collision guard. Application-level checks remain for friendly validation.
DROP TRIGGER IF EXISTS trg_check_loan_schedule_collision ON loans;
DROP FUNCTION IF EXISTS check_loan_schedule_collision();
