-- Serialize confirmed loan schedule checks per asset.
-- Without the asset-row lock, two concurrent transactions can both observe
-- no overlapping approved/borrowed row and then commit conflicting approvals.
CREATE OR REPLACE FUNCTION check_loan_schedule_collision()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('approved', 'borrowed', 'active') THEN
    -- A row lock is held until the surrounding transaction commits. A second
    -- approval for the same asset waits, then evaluates the overlap query
    -- against the first transaction's committed loan (READ COMMITTED).
    PERFORM id FROM assets WHERE id = NEW.asset_id FOR UPDATE;

    IF EXISTS (
      SELECT 1 FROM loans
      WHERE asset_id = NEW.asset_id
        AND id <> NEW.id
        AND status IN ('approved', 'borrowed', 'active')
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
