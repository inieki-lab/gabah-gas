-- GABAH Contract Management (separate business domain, not helpdesk)
-- Phase 1: register + owner/PIC + document + expiry/notice + reminders + audit.
-- Versioning-ready: documents are append-only; renewal chains use parent_contract_id.
--
-- CR-04 (fixed): migration 001 creates a legacy `contracts` table (owner_division_id
-- BIGINT, no PIC/reminder/notice columns). This file previously assumed the Contract
-- Management layout and failed on every database where the legacy table existed
-- ("column owner_division does not exist" on idx_contracts_owner), which silently
-- disabled PostgreSQL persistence. The legacy layout is now converted here with
-- explicit, idempotent ALTER TABLE statements BEFORE any index is created, so the
-- whole chain runs cleanly from an empty database AND on legacy databases.
-- No data is dropped: existing rows keep id/contract_number/dates/status/notes.

CREATE TABLE IF NOT EXISTS contracts (
  id VARCHAR(64) PRIMARY KEY,
  contract_number VARCHAR(100) NOT NULL UNIQUE,
  contract_type VARCHAR(100) NOT NULL DEFAULT 'Umum',
  title VARCHAR(255) NOT NULL,
  vendor_name VARCHAR(255) NOT NULL,
  owner_division VARCHAR(50) NOT NULL,
  pic_user_id VARCHAR(64) REFERENCES users(id),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  notice_period_days INTEGER NOT NULL DEFAULT 0,
  notice_date DATE,
  contract_value NUMERIC(18,2) NOT NULL DEFAULT 0,
  auto_renewal BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  renewal_outcome VARCHAR(40) NOT NULL DEFAULT 'pending_decision',
  renewal_notes TEXT,
  replaced_by_contract_id VARCHAR(64),
  parent_contract_id VARCHAR(64),
  reminder1_days INTEGER NOT NULL DEFAULT 60,
  reminder2_days INTEGER NOT NULL DEFAULT 35,
  reminder3_days INTEGER NOT NULL DEFAULT 7,
  escalation_user_id VARCHAR(64) REFERENCES users(id),
  restricted BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_by VARCHAR(64) REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- Legacy layout alignment (001 contracts -> Contract Management layout).
-- Idempotent: no-op on databases already migrated; data-preserving ALTERs.
-- ---------------------------------------------------------------------

-- Align both supported starting schemas:
-- 1) fresh 001 schema already has owner_division (VARCHAR) and no owner_division_id;
-- 2) older legacy schema may have owner_division_id (BIGINT FK).
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS owner_division VARCHAR(50);

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = 'contracts'
       AND column_name = 'owner_division_id'
  ) THEN
    UPDATE contracts
       SET owner_division = COALESCE(
             (SELECT d.code FROM divisions d WHERE d.id = contracts.owner_division_id),
             'GA')
     WHERE owner_division IS NULL;
  END IF;
END
$migration$;

UPDATE contracts SET owner_division = 'GA' WHERE owner_division IS NULL;
ALTER TABLE contracts ALTER COLUMN owner_division SET DEFAULT 'GA';
ALTER TABLE contracts ALTER COLUMN owner_division SET NOT NULL;

-- Identity / governance columns.
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS contract_type VARCHAR(100) NOT NULL DEFAULT 'Umum';
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS pic_user_id VARCHAR(64) REFERENCES users(id);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS notice_period_days INTEGER NOT NULL DEFAULT 0;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS notice_date DATE;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS contract_value NUMERIC(18,2) NOT NULL DEFAULT 0;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS auto_renewal BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS renewal_outcome VARCHAR(40) NOT NULL DEFAULT 'pending_decision';
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS renewal_notes TEXT;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS replaced_by_contract_id VARCHAR(64);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS parent_contract_id VARCHAR(64);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS reminder1_days INTEGER NOT NULL DEFAULT 60;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS reminder2_days INTEGER NOT NULL DEFAULT 35;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS reminder3_days INTEGER NOT NULL DEFAULT 7;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS escalation_user_id VARCHAR(64) REFERENCES users(id);
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS restricted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS created_by VARCHAR(64) REFERENCES users(id);

-- Backfill notice_date for rows that already carry a notice period.
UPDATE contracts
   SET notice_date = (end_date - (notice_period_days || ' days')::interval)::date
 WHERE notice_period_days > 0
   AND (notice_date IS NULL OR notice_date > end_date);

CREATE INDEX IF NOT EXISTS idx_contracts_expiry ON contracts(end_date, status);
CREATE INDEX IF NOT EXISTS idx_contracts_owner ON contracts(owner_division, pic_user_id);

CREATE TABLE IF NOT EXISTS contract_documents (
  id VARCHAR(64) PRIMARY KEY,
  contract_id VARCHAR(64) NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  kind VARCHAR(30) NOT NULL DEFAULT 'original_contract', -- original_contract | amendment | renewal | supporting_document
  file_name VARCHAR(255) NOT NULL,
  file_ref TEXT NOT NULL,
  uploaded_by VARCHAR(64) REFERENCES users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contract_documents_contract ON contract_documents(contract_id);

CREATE TABLE IF NOT EXISTS contract_milestones (
  id VARCHAR(64) PRIMARY KEY,
  contract_id VARCHAR(64) NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  type VARCHAR(40) NOT NULL, -- payment | service_maintenance | evaluation | other_obligation
  title VARCHAR(255) NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC(18,2),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_contract_milestones_contract ON contract_milestones(contract_id, due_date);

CREATE TABLE IF NOT EXISTS contract_notification_logs (
  id VARCHAR(64) PRIMARY KEY,
  contract_id VARCHAR(64) NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  notification_type VARCHAR(40) NOT NULL, -- EXPIRY_60 | EXPIRY_35 | EXPIRY_7 | NOTICE_DATE | MILESTONE_DUE
  channel VARCHAR(20) NOT NULL, -- in_app | email | telegram
  recipient VARCHAR(120) NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  error_message TEXT
);
CREATE INDEX IF NOT EXISTS idx_contract_notif_logs_contract ON contract_notification_logs(contract_id, notification_type);

-- Linked ticket: contract linkage recorded on tickets (action work item)
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS contract_id VARCHAR(64) REFERENCES contracts(id);
CREATE INDEX IF NOT EXISTS idx_tickets_contract ON tickets(contract_id);
