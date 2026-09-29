-- GABAH Contract Management (separate business domain, not helpdesk)
-- Phase 1: register + owner/PIC + document + expiry/notice + reminders + audit.
-- Versioning-ready: documents are append-only; renewal chains use parent_contract_id.

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
