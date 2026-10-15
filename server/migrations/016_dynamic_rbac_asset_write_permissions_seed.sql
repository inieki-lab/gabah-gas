-- Dynamic RBAC Stage 10: asset write permissions for legacy roles.
-- Grants only the six asset write permission keys to the canonical legacy roles
-- whose current runtime behavior authorizes asset mutations (Admin GABAH /
-- superadmin, IT, GA, Supply Chain, PIBC). Roles already denied by the legacy
-- guards (Karyawan, Auditor, Humas, Sekretaris Direksi) receive no grant and
-- custom roles receive no implicit permission. Domain-service division
-- authority, scope checks, duplicates validation, and audit logging remain the
-- authoritative business rules on top of the permission gate.
-- The migration runner owns the transaction; safe to apply repeatedly.

INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM gabah_roles r
JOIN gabah_permissions p ON p.permission_key IN (
  'assets.create',
  'assets.update',
  'assets.bulk_import',
  'assets.assign',
  'assets.move',
  'assets.lifecycle'
)
WHERE r.role_key IN ('superadmin', 'it', 'ga', 'supply_chain', 'pibc')
  AND p.is_active = TRUE
  AND r.is_active = TRUE
ON CONFLICT (role_id, permission_key) DO NOTHING;
