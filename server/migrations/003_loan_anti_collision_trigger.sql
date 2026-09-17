-- Trigger to authoritatively prevent loan collision in PostgreSQL
CREATE OR REPLACE FUNCTION check_loan_schedule_collision()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('pending_approval', 'approved', 'borrowed') THEN
    IF EXISTS (
      SELECT 1 FROM loans
      WHERE asset_id = NEW.asset_id
        AND id <> NEW.id
        AND status IN ('pending_approval', 'approved', 'borrowed')
        AND NEW.start_date < due_date
        AND NEW.due_date > start_date
    ) THEN
      RAISE EXCEPTION 'Tabrakan Jadwal: Aset sudah direservasi atau dipinjam pada rentang tanggal tersebut.';
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
