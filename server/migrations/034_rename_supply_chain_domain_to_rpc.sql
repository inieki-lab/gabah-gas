-- Rename the former Supply Chain owner/unit identity to RPC.
-- Safe to run after older migrations: this changes canonical identifiers and
-- preserves asset rows, sequence counters, users, and audit history.
BEGIN;

DO $$
DECLARE
  old_division_id BIGINT;
  rpc_division_id BIGINT;
  old_unit_exists BOOLEAN;
  rpc_unit_exists BOOLEAN;
BEGIN
  SELECT id INTO old_division_id FROM divisions WHERE UPPER(code) = 'SC' LIMIT 1;

  IF old_division_id IS NOT NULL THEN
    SELECT id INTO rpc_division_id FROM divisions WHERE UPPER(code) = 'RPC' LIMIT 1;
    IF rpc_division_id IS NULL THEN
      INSERT INTO divisions (code, name, is_active)
      VALUES ('RPC', 'RPC', TRUE)
      RETURNING id INTO rpc_division_id;
    END IF;

    UPDATE assets SET owner_division_id = rpc_division_id WHERE owner_division_id = old_division_id;
    UPDATE asset_categories SET owner_division_id = rpc_division_id WHERE owner_division_id = old_division_id;
    UPDATE asset_number_sequences SET owner_division_id = rpc_division_id WHERE owner_division_id = old_division_id;
    UPDATE departments SET division_id = rpc_division_id WHERE division_id = old_division_id;
    UPDATE users SET division_id = rpc_division_id WHERE division_id = old_division_id;
    UPDATE notifications SET recipient_division_id = rpc_division_id WHERE recipient_division_id = old_division_id;
    UPDATE org_units SET division_code = 'RPC' WHERE UPPER(division_code) = 'SC';
    DELETE FROM divisions WHERE id = old_division_id;
  END IF;

  SELECT EXISTS (SELECT 1 FROM org_units WHERE id = 'UNIT-SC') INTO old_unit_exists;
  SELECT EXISTS (SELECT 1 FROM org_units WHERE id = 'UNIT-RPC') INTO rpc_unit_exists;

  IF old_unit_exists AND NOT rpc_unit_exists THEN
    UPDATE users SET unit_id = 'UNIT-RPC' WHERE unit_id = 'UNIT-SC';
    UPDATE org_units SET id = 'UNIT-RPC', name = 'RPC', division_code = 'RPC' WHERE id = 'UNIT-SC';
  ELSIF old_unit_exists AND rpc_unit_exists THEN
    UPDATE users SET unit_id = 'UNIT-RPC' WHERE unit_id = 'UNIT-SC';
    DELETE FROM org_units WHERE id = 'UNIT-SC';
  END IF;
END $$;

UPDATE org_units
SET name = CASE WHEN LOWER(name) LIKE '%supply chain%' THEN 'RPC' ELSE name END,
    division_code = CASE WHEN UPPER(division_code) = 'SC' THEN 'RPC' ELSE division_code END
WHERE id = 'UNIT-RPC' OR UPPER(division_code) = 'SC' OR LOWER(name) LIKE '%supply chain%';

UPDATE org_office_locations
SET name = 'RPC'
WHERE id = 'OFF-RPC' OR LOWER(name) IN ('rpc/sc', 'supply chain', 'rpc');

UPDATE users
SET role = 'RPC'
WHERE role = 'Supply Chain';

UPDATE asset_categories
SET code = 'KDR-RPC'
WHERE code = 'KDR-SC';

UPDATE assets
SET asset_number = 'RPC-' || SUBSTRING(asset_number FROM 4)
WHERE asset_number LIKE 'SC-%';

UPDATE asset_number_sequences
SET asset_code = 'KDR-RPC'
WHERE asset_code = 'KDR-SC';

UPDATE contracts SET owner_division = 'RPC' WHERE UPPER(owner_division) = 'SC';
UPDATE tickets SET category = 'RPC' WHERE UPPER(category) = 'SC';
UPDATE notifications SET category = 'RPC' WHERE UPPER(category) = 'SC';
UPDATE notifications SET recipient_role = 'RPC' WHERE recipient_role = 'Supply Chain';

-- Keep the dynamic permission model aligned with the canonical domain key.
DO $$
DECLARE
  old_role_id BIGINT;
  rpc_role_exists BOOLEAN;
BEGIN
  SELECT id INTO old_role_id FROM gabah_roles WHERE role_key = 'supply_chain' LIMIT 1;
  SELECT EXISTS (SELECT 1 FROM gabah_roles WHERE role_key = 'rpc') INTO rpc_role_exists;
  IF old_role_id IS NOT NULL AND NOT rpc_role_exists THEN
    UPDATE gabah_roles SET role_key = 'rpc', name = 'RPC',
      description = REPLACE(COALESCE(description, ''), 'Supply Chain', 'RPC'),
      updated_at = NOW()
    WHERE id = old_role_id;
  END IF;
END $$;

UPDATE gabah_role_division_scopes
SET scope_value = CASE
  WHEN scope_value = 'SC' THEN 'RPC'
  WHEN scope_value = 'UNIT-SC' THEN 'UNIT-RPC'
  WHEN scope_value = 'RPC/SC' THEN 'RPC'
  ELSE scope_value
END
WHERE scope_value IN ('SC', 'UNIT-SC', 'RPC/SC');

COMMIT;
