-- Treat overdue custody as an active reservation for per-asset schedule integrity.
-- An overdue loan still represents a physical unit that has not been returned.
CREATE OR REPLACE FUNCTION check_loan_schedule_collision()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('approved', 'borrowed', 'active', 'overdue') THEN
    -- Serialize checks per asset to prevent concurrent overlapping approvals.
    PERFORM id FROM assets WHERE id = NEW.asset_id FOR UPDATE;

    IF EXISTS (
      SELECT 1 FROM loans
      WHERE asset_id = NEW.asset_id
        AND id <> NEW.id
        AND status IN ('approved', 'borrowed', 'active', 'overdue')
        AND NEW.start_date < due_date
        AND NEW.due_date > start_date
    ) THEN
      RAISE EXCEPTION 'Tabrakan Jadwal: Aset sudah direservasi atau dipinjam pada rentang tanggal tersebut.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
