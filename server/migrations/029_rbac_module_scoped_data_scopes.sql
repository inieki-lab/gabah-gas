-- Stage 22: make data scopes module-specific.
-- Legacy role scopes default to '*' for backward compatibility, but the
-- canonical IT/GA owner scopes from Stage 15 are narrowed to the modules that
-- actually use owner-domain authorization. Super Admin can configure further
-- module scopes in the role administration UI.

ALTER TABLE gabah_role_division_scopes
  ADD COLUMN IF NOT EXISTS module VARCHAR(80) NOT NULL DEFAULT '*';

ALTER TABLE gabah_role_division_scopes
  DROP CONSTRAINT IF EXISTS gabah_role_division_scopes_role_id_scope_type_scope_value_key;

CREATE UNIQUE INDEX IF NOT EXISTS gabah_role_scope_module_uq
  ON gabah_role_division_scopes (role_id, module, scope_type, COALESCE(scope_value, ''));

-- Convert the legacy IT/GA asset-owner scopes into explicit per-module scopes.
INSERT INTO gabah_role_division_scopes (role_id, module, scope_type, scope_value)
SELECT r.id, module_name, s.scope_type, s.scope_value
FROM gabah_roles r
JOIN gabah_role_division_scopes s ON s.role_id = r.id AND s.module = '*'
CROSS JOIN (VALUES ('assets'), ('loans'), ('tickets'), ('vendors'), ('contracts')) AS modules(module_name)
WHERE r.role_key IN ('it', 'ga')
  AND s.scope_type = 'division'
  AND s.scope_value = CASE r.role_key WHEN 'it' THEN 'IT' WHEN 'ga' THEN 'GA' END
ON CONFLICT DO NOTHING;

DELETE FROM gabah_role_division_scopes s
USING gabah_roles r
WHERE s.role_id = r.id
  AND r.role_key IN ('it', 'ga')
  AND s.module = '*'
  AND s.scope_type = 'division'
  AND s.scope_value = CASE r.role_key WHEN 'it' THEN 'IT' WHEN 'ga' THEN 'GA' END;
