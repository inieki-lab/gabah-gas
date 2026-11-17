-- GABAH Migration 096: enforce room reservation anti-overlap in PostgreSQL.
-- The partial GiST index created by migration 015 only accelerates lookups;
-- it does NOT reject overlapping rows. This exclusion constraint is the
-- authoritative concurrency-safe guard across app processes/instances.
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
      'Migration 096 blocked: existing active room reservations overlap. Resolve duplicate bookings before applying the exclusion constraint.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'room_reservations_no_overlap'
      AND conrelid = 'room_reservations'::regclass
  ) THEN
    ALTER TABLE room_reservations
      ADD CONSTRAINT room_reservations_no_overlap
      EXCLUDE USING gist (
        room_id WITH =,
        (tstzrange(start_datetime, end_datetime, '[)')) WITH &&
      )
      WHERE (status IN ('pending', 'approved', 'in_use', 'checked_in'));
  END IF;
END
$$;

-- Keep migration 015's trigger as an early, human-readable validation.
-- The exclusion constraint above is the final concurrency-safe authority.
