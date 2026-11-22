-- Serialize room reservation collision checks per room.
-- The previous BEFORE trigger used IF EXISTS without a lock, allowing two
-- concurrent transactions to both observe an empty time range and commit.
-- A transaction-scoped advisory lock makes the check authoritative across
-- independent application processes even though room master rows are not yet
-- normalized into PostgreSQL.
CREATE OR REPLACE FUNCTION prevent_double_booking()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('pending', 'approved', 'in_use', 'checked_in') THEN
    -- hashtextextended provides a stable 64-bit advisory-lock key per room.
    -- Hash collisions can only serialize unrelated rooms; they cannot permit
    -- overlapping reservations.
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.room_id, 0));

    IF EXISTS (
      SELECT 1
      FROM room_reservations
      WHERE room_id = NEW.room_id
        AND id <> NEW.id
        AND status IN ('pending', 'approved', 'in_use', 'checked_in')
        AND tstzrange(start_datetime, end_datetime) && tstzrange(NEW.start_datetime, NEW.end_datetime)
    ) THEN
      RAISE EXCEPTION 'Double-booking terdeteksi: Ruangan % sudah dipesan pada rentang waktu tersebut.', NEW.room_name
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
