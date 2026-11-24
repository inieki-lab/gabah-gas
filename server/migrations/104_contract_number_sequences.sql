-- Durable yearly contract-number counter shared by every PostgreSQL-backed app instance.
CREATE TABLE IF NOT EXISTS contract_number_sequences (
  sequence_year INTEGER PRIMARY KEY CHECK (sequence_year BETWEEN 2000 AND 2100),
  last_sequence INTEGER NOT NULL DEFAULT 0 CHECK (last_sequence >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
