-- Stage 15: explicit owner-domain write scopes for the canonical IT and GA roles.
-- This preserves their current asset-management responsibilities after domain
-- services switch from role-name checks to effective RBAC permission + scope.
-- SC/PIBC are intentionally not granted asset-owner scopes: they are locations
-- in the clarified organization model and their legacy asset data needs review.
-- Additive/idempotent; Super Admin can subsequently adjust scopes in the UI.

INSERT INTO gabah_role_division_scopes (role_id, scope_type, scope_value)
SELECT r.id, 'division', 'IT'
FROM gabah_roles r
WHERE r.role_key = 'it' AND r.is_active = TRUE
ON CONFLICT (role_id, scope_type, scope_value) DO NOTHING;

INSERT INTO gabah_role_division_scopes (role_id, scope_type, scope_value)
SELECT r.id, 'division', 'GA'
FROM gabah_roles r
WHERE r.role_key = 'ga' AND r.is_active = TRUE
ON CONFLICT (role_id, scope_type, scope_value) DO NOTHING;
