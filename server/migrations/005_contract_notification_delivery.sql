-- GABAH Migration 005: notification delivery metadata + idempotency key (CR-05)
-- NOTE: the schema_migrations ledger table is created by the application migration
-- runner (server/persistence.ts) BEFORE any .sql file is executed, so the final
-- INSERT below is always valid (on both fresh and legacy databases).
-- This file is idempotent and is a no-op on databases migrated by 004 with the
-- delivery columns already present.

-- ------------------------------------------------------------------
-- 1. contract_notification_logs: delivery metadata + idempotency key
-- ------------------------------------------------------------------
ALTER TABLE contract_notification_logs ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE contract_notification_logs ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;

-- Idempotency key: (contract, notification type, channel, recipient, due day in UTC).
-- The UNIQUE index is the authoritative duplicate-prevention lock — the
-- application relies ON CONFLICT DO NOTHING so concurrent sweeps or retries
-- cannot produce duplicate notifications. (AT TIME ZONE 'UTC' keeps the index
-- expression immutable, unlike a plain ::date cast which depends on TimeZone.)
CREATE UNIQUE INDEX IF NOT EXISTS uq_contract_notif_idempotency
  ON contract_notification_logs (
    contract_id, notification_type, channel, recipient,
    COALESCE((scheduled_at AT TIME ZONE 'UTC')::date, DATE '1970-01-01')
  );

-- ------------------------------------------------------------------
-- 2. tickets.contract_id — also ensured here so a legacy database repaired by
--    this migration always satisfies the app write paths (idempotent).
-- ------------------------------------------------------------------
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS contract_id VARCHAR(64) REFERENCES contracts(id);
CREATE INDEX IF NOT EXISTS idx_tickets_contract ON tickets(contract_id);

-- ------------------------------------------------------------------
-- 3. Migration ledger record (the application migration runner also records
--    every file in schema_migrations after it executes successfully; the
--    CREATE IF NOT EXISTS below keeps this file self-sufficient when applied
--    with a plain psql client).
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(16) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO schema_migrations (version, name, applied_at)
VALUES ('005', 'contract_notification_delivery', NOW())
ON CONFLICT (version) DO NOTHING;
