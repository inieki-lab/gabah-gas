-- GABAH Migration 099: centralized company-profile system settings.
-- Operational SLA values are deliberately not stored here; the current server
-- policy remains authoritative until a dedicated SLA policy workflow is built.
CREATE TABLE IF NOT EXISTS gabah_system_settings (
  settings_key VARCHAR(80) PRIMARY KEY CHECK (settings_key = 'company_profile'),
  settings JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by_user_id TEXT
);

CREATE TABLE IF NOT EXISTS gabah_system_settings_audit (
  id BIGSERIAL PRIMARY KEY,
  settings_key VARCHAR(80) NOT NULL,
  previous_settings JSONB NOT NULL,
  new_settings JSONB NOT NULL,
  changed_by_user_id TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gabah_system_settings_audit_change_check
    CHECK (previous_settings IS DISTINCT FROM new_settings)
);

INSERT INTO gabah_system_settings (settings_key, settings)
VALUES (
  'company_profile',
  '{"companyName":"PT Food Station Tjipinang Jaya (Perseroda)","accountingStandard":"PSAK 16 (Aset Tetap & Depresiasi Garis Lurus)","baseCurrency":"IDR (Rupiah)","fiscalYear":"2026"}'::jsonb
)
ON CONFLICT (settings_key) DO NOTHING;

CREATE INDEX IF NOT EXISTS gabah_system_settings_audit_time_idx
  ON gabah_system_settings_audit (settings_key, changed_at DESC);

CREATE OR REPLACE FUNCTION gabah_reject_system_settings_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'gabah_system_settings_audit is append-only; % is not permitted', TG_OP
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS gabah_system_settings_audit_no_row_mutation
  ON gabah_system_settings_audit;
CREATE TRIGGER gabah_system_settings_audit_no_row_mutation
  BEFORE UPDATE OR DELETE ON gabah_system_settings_audit
  FOR EACH ROW
  EXECUTE FUNCTION gabah_reject_system_settings_audit_mutation();

DROP TRIGGER IF EXISTS gabah_system_settings_audit_no_truncate
  ON gabah_system_settings_audit;
CREATE TRIGGER gabah_system_settings_audit_no_truncate
  BEFORE TRUNCATE ON gabah_system_settings_audit
  FOR EACH STATEMENT
  EXECUTE FUNCTION gabah_reject_system_settings_audit_mutation();
