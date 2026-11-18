-- GABAH Migration 098: PostgreSQL-authoritative notification rule switches.
-- Rule definitions remain code-owned; only the enabled/disabled state is mutable.
CREATE TABLE IF NOT EXISTS gabah_notification_rule_settings (
  rule_id VARCHAR(80) PRIMARY KEY,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by_user_id TEXT
);

CREATE TABLE IF NOT EXISTS gabah_notification_rule_audit (
  id BIGSERIAL PRIMARY KEY,
  rule_id VARCHAR(80) NOT NULL,
  previous_is_active BOOLEAN NOT NULL,
  new_is_active BOOLEAN NOT NULL,
  changed_by_user_id TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gabah_notification_rule_status_change_check
    CHECK (previous_is_active <> new_is_active)
);

INSERT INTO gabah_notification_rule_settings (rule_id, is_active)
VALUES
  ('rule-warranty', TRUE),
  ('rule-loan', TRUE),
  ('rule-sla', TRUE),
  ('rule-bast', TRUE)
ON CONFLICT (rule_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS gabah_notification_rule_audit_time_idx
  ON gabah_notification_rule_audit (rule_id, changed_at DESC);

CREATE OR REPLACE FUNCTION gabah_reject_notification_rule_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'gabah_notification_rule_audit is append-only; % is not permitted', TG_OP
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS gabah_notification_rule_audit_no_row_mutation
  ON gabah_notification_rule_audit;
CREATE TRIGGER gabah_notification_rule_audit_no_row_mutation
  BEFORE UPDATE OR DELETE ON gabah_notification_rule_audit
  FOR EACH ROW
  EXECUTE FUNCTION gabah_reject_notification_rule_audit_mutation();

DROP TRIGGER IF EXISTS gabah_notification_rule_audit_no_truncate
  ON gabah_notification_rule_audit;
CREATE TRIGGER gabah_notification_rule_audit_no_truncate
  BEFORE TRUNCATE ON gabah_notification_rule_audit
  FOR EACH STATEMENT
  EXECUTE FUNCTION gabah_reject_notification_rule_audit_mutation();
