-- Stage 19: retire Supply Chain/PIBC as application roles.
-- Business decision: Supply Chain and PIBC identify office locations/branches.
-- Employees at those locations keep their job level and work-unit attributes,
-- but use the common Karyawan application baseline. The old roles and units
-- remain as inactive records for historical references; asset owner_division,
-- tickets, loans, and audit history are not rewritten.
-- Additive/idempotent; migration runner owns the transaction.

-- Preserve an explicitly assigned office location. If none exists, infer only
-- from the legacy account label: Supply Chain -> RPC/Supply Chain, PIBC -> PIBC.
UPDATE users
SET office_location_id = COALESCE(
      office_location_id,
      CASE role
        WHEN 'Supply Chain' THEN 'OFF-RPC'
        WHEN 'PIBC' THEN 'OFF-PIBC'
        ELSE NULL
      END
    ),
    unit_id = CASE
      WHEN unit_id = 'UNIT-SC' THEN NULL
      WHEN unit_id = 'UNIT-PIBC' THEN NULL
      ELSE unit_id
    END,
    role = 'Karyawan'
WHERE role IN ('Supply Chain', 'PIBC');

-- Remove only the obsolete branch-role assignments for users now represented
-- as Karyawan, then ensure the canonical employee role is assigned.
DELETE FROM gabah_user_roles ur
USING gabah_roles r, users u
WHERE ur.role_id = r.id
  AND ur.user_id = u.id::text
  AND r.role_key IN ('supply_chain', 'pibc')
  AND u.role = 'Karyawan';

INSERT INTO gabah_user_roles (user_id, role_id)
SELECT u.id::text, r.id
FROM users u
JOIN gabah_roles r ON r.role_key = 'karyawan' AND r.is_active = TRUE
WHERE u.role = 'Karyawan'
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Retire old role templates from assignment pickers; do not delete history.
UPDATE gabah_roles
SET is_active = FALSE, updated_at = NOW()
WHERE role_key IN ('supply_chain', 'pibc')
  AND is_active = TRUE;

-- Branch names are locations, not organizational units. Keep the records for
-- FK/history compatibility, but remove them from active unit selection.
UPDATE org_units
SET is_active = FALSE
WHERE id IN ('UNIT-SC', 'UNIT-PIBC')
  AND is_active = TRUE;
