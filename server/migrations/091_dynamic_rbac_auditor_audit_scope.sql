-- Stage 39: Auditor's cross-domain audit visibility is explicit and read-only.
-- The runtime security middleware enforces deny-write for every principal with
-- the Auditor capability; this scope grants only audit-domain read visibility.

INSERT INTO gabah_role_division_scopes (role_id, module, scope_type, scope_value)
SELECT r.id, 'audit', 'all', NULL
FROM gabah_roles r
WHERE r.role_key = 'auditor' AND r.is_active = TRUE
ON CONFLICT DO NOTHING;
