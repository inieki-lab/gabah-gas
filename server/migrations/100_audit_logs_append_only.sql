-- GABAH core audit log append-only enforcement.
-- Existing persistence uses INSERT ... ON CONFLICT DO NOTHING, so startup
-- synchronization remains compatible while UPDATE/DELETE/TRUNCATE are denied.

CREATE OR REPLACE FUNCTION gabah_reject_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only; % is not permitted', TG_OP
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS audit_logs_no_row_mutation ON audit_logs;
CREATE TRIGGER audit_logs_no_row_mutation
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION gabah_reject_audit_log_mutation();

DROP TRIGGER IF EXISTS audit_logs_no_truncate ON audit_logs;
CREATE TRIGGER audit_logs_no_truncate
  BEFORE TRUNCATE ON audit_logs
  FOR EACH STATEMENT
  EXECUTE FUNCTION gabah_reject_audit_log_mutation();
