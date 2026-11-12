-- GABAH migration 044: enforce room reservation collision prevention atomically.
--
-- Migration 015 used a partial GiST index plus a BEFORE trigger that performs
-- a SELECT-before-INSERT check. That trigger alone is race-prone: two concurrent
-- transactions can both observe no conflicting row and both insert. A PostgreSQL
-- EXCLUDE constraint performs the conflict check inside the index and is safe
-- under concurrent transactions.
--
-- Do not silently delete or rewrite existing reservations. If legacy conflicts
-- exist, fail this migration with an actionable error so an administrator can
-- reconcile them before retrying.

CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM room_reservations a
    JOIN room_reservations b
      ON a.room_id = b.room_id
     AND a.id < b.id
     AND a.status IN ('pending', 'approved', 'in_use', 'checked_in')
     AND b.status IN ('pending', 'approved', 'in_use', 'checked_in')
     AND tstzrange(a.start_datetime, a.end_datetime, '[)')
         && tstzrange(b.start_datetime, b.end_datetime, '[)')
  ) THEN
    RAISE EXCEPTION
      'Migration 044 blocked: overlapping active room reservations exist. Reconcile conflicts; no reservation data was changed.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'room_reservations_no_double_booking'
      AND conrelid = 'room_reservations'::regclass
  ) THEN
    ALTER TABLE room_reservations
      ADD CONSTRAINT room_reservations_no_double_booking
      EXCLUDE USING gist (
        room_id WITH =,
        tstzrange(start_datetime, end_datetime, '[)') WITH &&
      )
      WHERE (status IN ('pending', 'approved', 'in_use', 'checked_in'));
  END IF;
END
$$;

-- The EXCLUDE constraint owns an equivalent GiST index. Remove the old
-- non-enforcing index to avoid duplicate storage and write amplification.
DROP INDEX IF EXISTS idx_room_reservations_no_double_booking;
