-- Stage 32: configurable owner-domain exclusions.
-- Enables policies such as "GA may manage all non-IT assets" without
-- hardcoding a closed list of owner domains. Permission + module scope remain
-- mandatory; explicit division grants may coexist with an exclusion.
ALTER TABLE gabah_role_division_scopes
  DROP CONSTRAINT IF EXISTS gabah_role_division_scopes_scope_type_check;

ALTER TABLE gabah_role_division_scopes
  ADD CONSTRAINT gabah_role_scope_type_check
  CHECK (scope_type IN ('all', 'own', 'division', 'division_except', 'unit', 'location'));

ALTER TABLE gabah_role_division_scopes
  DROP CONSTRAINT IF EXISTS gabah_role_scope_value_check;

ALTER TABLE gabah_role_division_scopes
  ADD CONSTRAINT gabah_role_scope_value_check
  CHECK (
    (scope_type IN ('all', 'own') AND scope_value IS NULL)
    OR (scope_type IN ('division', 'division_except', 'unit', 'location')
        AND scope_value IS NOT NULL AND LENGTH(TRIM(scope_value)) > 0)
  );
