-- GABAH migration 043: overdue loans continue reserving the physical asset.
-- A loan marked overdue has not been returned; its elapsed due_date must not
-- make the asset appear available for a new reservation.
-- Safe to re-run: function replacement and trigger recreation are idempotent.

CREATE OR REPLACE FUNCTION check_loan_schedule_collision()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('approved', 'borrowed', 'overdue') THEN
    IF EXISTS (
      SELECT 1 FROM loans
      WHERE asset_id = NEW.asset_id
        AND id <> NEW.id
        AND status IN ('approved', 'borrowed', 'overdue')
        AND (
          status = 'overdue'
          OR NEW.status = 'overdue'
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
