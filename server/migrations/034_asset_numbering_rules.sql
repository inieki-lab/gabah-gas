-- GABAH Migration 034: configurable asset numbering rules
-- Rules affect future number issuance only; previously issued asset numbers are immutable.
CREATE TABLE IF NOT EXISTS asset_numbering_rules (
  id VARCHAR(64) PRIMARY KEY,
  owner_division VARCHAR(30) NOT NULL,
  asset_code VARCHAR(30) NOT NULL,
  separator VARCHAR(3) NOT NULL DEFAULT '-',
  sequence_digits SMALLINT NOT NULL DEFAULT 4 CHECK (sequence_digits BETWEEN 3 AND 8),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_division, asset_code)
);
CREATE INDEX IF NOT EXISTS idx_asset_numbering_rules_active
  ON asset_numbering_rules (is_active, owner_division, asset_code);
