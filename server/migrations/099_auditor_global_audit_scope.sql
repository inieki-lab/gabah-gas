-- Auditor has an explicit cross-domain read mandate for audit work.
-- This is a module-scoped read scope, not a business-owner mutation grant.
INSERT INTO gabah_role_division_scopes (role_id, module, scope_type, scope_value)
SELECT r.id, 'audit', 'all', NULL
FROM gabah_roles r
WHERE r.role_key = 'auditor'
  AND r.is_active = TRUE
  AND NOT EXISTS (
    SELECT 1
    FROM gabah_role_division_scopes s
    WHERE s.role_id = r.id
      AND s.module = 'audit'
      AND s.scope_type = 'all'
      AND s.scope_value IS NULL
  );
