-- GABAH Migration 097: PostgreSQL-authoritative contract number sequence.
-- A per-year row lock prevents duplicate CTR numbers across app instances.
CREATE TABLE IF NOT EXISTS contract_number_sequences (
  sequence_year INTEGER PRIMARY KEY CHECK (sequence_year BETWEEN 2000 AND 9999),
  last_sequence INTEGER NOT NULL DEFAULT 0 CHECK (last_sequence >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM contracts a
    JOIN contracts b
      ON a.id < b.id
     AND a.contract_number ~ '^CTR-[0-9]{4}-[0-9]+$'
     AND b.contract_number ~ '^CTR-[0-9]{4}-[0-9]+$'
     AND split_part(a.contract_number, '-', 2) = split_part(b.contract_number, '-', 2)
     AND split_part(a.contract_number, '-', 3) = split_part(b.contract_number, '-', 3)
  ) THEN
    RAISE EXCEPTION 'Migration 097 blocked: duplicate contract numbers already exist. Reconcile them before enabling database sequence allocation.';
  END IF;
END
$$;

-- Sequence rows are created lazily by allocateContractSequence() and seeded
-- from existing contract numbers while holding the per-year row lock.
