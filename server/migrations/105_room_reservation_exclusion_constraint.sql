-- GABAH Migration 105: Enforce room reservation anti-overlap at the database level.
--
-- Migration 015 added a partial GiST index and a trigger-based overlap check.
-- A normal GiST index does not itself prohibit overlapping ranges. The
-- EXCLUDE constraint below is the concurrency-safe invariant: PostgreSQL
-- serializes conflicting inserts/updates and rejects the second transaction.
--
-- Existing conflicting active reservations intentionally make this migration
-- fail closed. Resolve those records from verified business evidence before
-- retrying; this migration never silently cancels or rewrites reservations.

CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
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
        tstzrange(start_datetime, end_datetime) WITH &&
      )
      WHERE (status IN ('pending', 'pending_approval', 'approved', 'in_use', 'checked_in'));
  END IF;
END
$$;

-- The exclusion constraint owns the same lookup path; remove the earlier
-- non-enforcing partial index to avoid maintaining duplicate GiST structures.
DROP INDEX IF EXISTS idx_room_reservations_no_double_booking;
