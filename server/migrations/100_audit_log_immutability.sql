-- Make the PostgreSQL audit trail append-only.
-- Preserve the human-readable actor snapshot when a user account is deleted;
-- only the nullable FK reference may be cleared by PostgreSQL's FK action.
ALTER TABLE audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;

ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- The sole permitted update is the nested FK action that detaches a
    -- deleted user. Direct application/SQL updates remain prohibited.
    IF pg_trigger_depth() > 1
      AND OLD.user_id IS NOT NULL
      AND NEW.user_id IS NULL
      AND (to_jsonb(OLD) - 'user_id') = (to_jsonb(NEW) - 'user_id') THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Audit log is immutable: UPDATE is prohibited.'
      USING ERRCODE = '55000';
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Audit log is immutable: DELETE is prohibited.'
      USING ERRCODE = '55000';
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

CREATE OR REPLACE FUNCTION prevent_audit_log_truncate()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit log is immutable: TRUNCATE is prohibited.'
    USING ERRCODE = '55000';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_no_truncate ON audit_logs;
CREATE TRIGGER trg_audit_logs_no_truncate
  BEFORE TRUNCATE ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_log_truncate();
