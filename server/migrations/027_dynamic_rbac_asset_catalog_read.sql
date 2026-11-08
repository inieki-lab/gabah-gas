-- Stage 20: distinguish personal asset reads from the operational asset catalogue.
-- assets.read supports the shared employee workspace (My Assets / loanable view).
-- assets.catalog.read is required to open the full scoped inventory module.
-- Auditor receives assets.audit.read only and remains read-only.
-- Additive/idempotent; custom roles receive no implicit grants.

INSERT INTO gabah_permissions (permission_key, module, action, description) VALUES
  ('assets.catalog.read', 'assets', 'catalog_read', 'Melihat inventaris aset sesuai owner scope')
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, 'assets.catalog.read'
FROM gabah_roles r
WHERE r.role_key IN ('superadmin', 'it', 'ga')
  AND r.is_active = TRUE
ON CONFLICT (role_id, permission_key) DO NOTHING;
