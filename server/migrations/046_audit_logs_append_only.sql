-- GABAH migration 046: make normalized audit records append-only.
--
-- Application persistence only inserts audit rows (ON CONFLICT DO NOTHING).
-- Updates, deletes, and truncation would destroy accountability history and
-- are not valid business operations. Retention must use an approved archive
-- process, not mutate the live audit trail.

CREATE OR REPLACE FUNCTION reject_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only: % is not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_append_only_row ON audit_logs;
CREATE TRIGGER trg_audit_logs_append_only_row
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION reject_audit_log_mutation();

DROP TRIGGER IF EXISTS trg_audit_logs_append_only_truncate ON audit_logs;
CREATE TRIGGER trg_audit_logs_append_only_truncate
  BEFORE TRUNCATE ON audit_logs
  FOR EACH STATEMENT
  EXECUTE FUNCTION reject_audit_log_mutation();
