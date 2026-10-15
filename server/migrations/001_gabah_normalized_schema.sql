-- GABAH normalized PostgreSQL foundation
-- Phase: schema preparation only.
-- Do NOT remove gabah_state until data migration and application cut-over are verified.

CREATE TABLE IF NOT EXISTS divisions (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO divisions (code, name) VALUES
  ('SC', 'Supply Chain'),
  ('PIBC', 'Pasar'),
  ('IT', 'IT'),
  ('GA', 'General Affairs')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS departments (
  id BIGSERIAL PRIMARY KEY,
  division_id BIGINT REFERENCES divisions(id),
  code VARCHAR(50) UNIQUE,
  name VARCHAR(150) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  role VARCHAR(50) NOT NULL,
  division_id BIGINT REFERENCES divisions(id),
  department_id BIGINT REFERENCES departments(id),
  phone VARCHAR(50),
  avatar TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asset_categories (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  category_type VARCHAR(30) NOT NULL,
  owner_division_id BIGINT REFERENCES divisions(id),
  is_loanable_by_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assets (
  id VARCHAR(64) PRIMARY KEY,
  asset_number VARCHAR(100) NOT NULL UNIQUE,
  corporate_asset_number VARCHAR(100),
  name VARCHAR(255) NOT NULL,
  category_id BIGINT REFERENCES asset_categories(id),
  owner_division_id BIGINT NOT NULL REFERENCES divisions(id),
  brand VARCHAR(150),
  model VARCHAR(150),
  serial_number VARCHAR(255),
  specifications TEXT,
  purchase_date DATE,
  purchase_price NUMERIC(18,2) NOT NULL DEFAULT 0,
  warranty_until DATE,
  status VARCHAR(40) NOT NULL,
  condition VARCHAR(30) NOT NULL,
  location VARCHAR(255) NOT NULL,
  is_loanable BOOLEAN NOT NULL DEFAULT FALSE,
  license_detail JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_assets_corporate_number
  ON assets (corporate_asset_number)
  WHERE corporate_asset_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS asset_assignments (
  id BIGSERIAL PRIMARY KEY,
  asset_id VARCHAR(64) NOT NULL REFERENCES assets(id),
  user_id VARCHAR(64) NOT NULL REFERENCES users(id),
  assigned_date DATE NOT NULL,
  returned_date DATE,
  assigned_by VARCHAR(64) REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_asset_active_assignment
  ON asset_assignments (asset_id)
  WHERE returned_date IS NULL;

CREATE TABLE IF NOT EXISTS asset_movements (
  id VARCHAR(64) PRIMARY KEY,
  asset_id VARCHAR(64) NOT NULL REFERENCES assets(id),
  from_user_id VARCHAR(64) REFERENCES users(id),
  to_user_id VARCHAR(64) REFERENCES users(id),
  from_location VARCHAR(255),
  to_location VARCHAR(255),
  reason TEXT NOT NULL,
  document_ref VARCHAR(150),
  performed_by_id VARCHAR(64) REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asset_number_sequences (
  id BIGSERIAL PRIMARY KEY,
  owner_division_id BIGINT NOT NULL REFERENCES divisions(id),
  asset_code VARCHAR(30) NOT NULL,
  sequence_year INTEGER NOT NULL,
  last_sequence INTEGER NOT NULL DEFAULT 0,
  UNIQUE (owner_division_id, asset_code, sequence_year)
);

CREATE TABLE IF NOT EXISTS loans (
  id VARCHAR(64) PRIMARY KEY,
  loan_number VARCHAR(100) NOT NULL UNIQUE,
  asset_id VARCHAR(64) NOT NULL REFERENCES assets(id),
  borrower_id VARCHAR(64) NOT NULL REFERENCES users(id),
  purpose TEXT NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  status VARCHAR(40) NOT NULL,
  approver_id VARCHAR(64) REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  handover_by_id VARCHAR(64) REFERENCES users(id),
  handover_at TIMESTAMPTZ,
  handover_notes TEXT,
  actual_returned_at TIMESTAMPTZ,
  return_condition VARCHAR(30),
  return_inspected_by_id VARCHAR(64) REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (due_date > start_date)
);

CREATE TABLE IF NOT EXISTS tickets (
  id VARCHAR(64) PRIMARY KEY,
  ticket_number VARCHAR(100) NOT NULL UNIQUE,
  ticket_code VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(40) NOT NULL,
  priority VARCHAR(20) NOT NULL,
  status VARCHAR(30) NOT NULL,
  reporter_id VARCHAR(64) NOT NULL REFERENCES users(id),
  assigned_agent_id VARCHAR(64) REFERENCES users(id),
  related_asset_id VARCHAR(64) REFERENCES assets(id),
  sla_hours INTEGER NOT NULL,
  sla_resolution_deadline TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_comments (
  id BIGSERIAL PRIMARY KEY,
  ticket_id VARCHAR(64) NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contracts (
  id VARCHAR(64) PRIMARY KEY,
  contract_number VARCHAR(100) NOT NULL UNIQUE,
  vendor_name VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  start_date DATE,
  end_date DATE NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  owner_division VARCHAR(50) NOT NULL,
  document_ref TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(64) PRIMARY KEY,
  recipient_user_id VARCHAR(64) REFERENCES users(id),
  recipient_role VARCHAR(50),
  recipient_division_id BIGINT REFERENCES divisions(id),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  severity VARCHAR(30) NOT NULL,
  category VARCHAR(40) NOT NULL,
  link_type VARCHAR(40),
  link_id VARCHAR(64),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  action VARCHAR(100) NOT NULL,
  entity VARCHAR(100) NOT NULL,
  entity_id VARCHAR(64),
  user_id VARCHAR(64) REFERENCES users(id),
  user_name VARCHAR(200) NOT NULL,
  user_role VARCHAR(50) NOT NULL,
  details TEXT NOT NULL,
  ip_address INET,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_owner_division ON assets(owner_division_id);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_movements_asset ON asset_movements(asset_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loans_asset_dates ON loans(asset_id, start_date, due_date);
CREATE INDEX IF NOT EXISTS idx_loans_borrower ON loans(borrower_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_scope ON tickets(category, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(recipient_user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_division_read ON notifications(recipient_division_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity, entity_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_contracts_expiry ON contracts(end_date, status);
CREATE INDEX IF NOT EXISTS idx_contracts_owner ON contracts(owner_division);
