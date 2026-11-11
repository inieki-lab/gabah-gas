-- Safely consolidate the legacy Supply Chain (SC) identifiers into RPC.
-- Preserve assets, sequence counters, user assignments, permissions and audit history.
-- Abort with a clear message when a legacy asset number would collide with an RPC number.
BEGIN;

DO $$
DECLARE
  old_division_id BIGINT;
  rpc_division_id BIGINT;
  old_unit_exists BOOLEAN;
  old_role_id BIGINT;
  rpc_role_id BIGINT;
  old_category_id BIGINT;
  rpc_category_id BIGINT;
BEGIN
  SELECT id INTO old_division_id FROM divisions WHERE UPPER(code) = 'SC' LIMIT 1;
  SELECT id INTO rpc_division_id FROM divisions WHERE UPPER(code) = 'RPC' LIMIT 1;

  IF old_division_id IS NOT NULL AND rpc_division_id IS NULL THEN
    INSERT INTO divisions (code, name, is_active)
    VALUES ('RPC', 'RPC', TRUE)
    RETURNING id INTO rpc_division_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM assets legacy
    JOIN assets canonical
      ON canonical.asset_number = 'RPC-' || SUBSTRING(legacy.asset_number FROM 4)
     AND canonical.id <> legacy.id
    WHERE legacy.asset_number LIKE 'SC-%'
  ) THEN
    RAISE EXCEPTION 'RPC migration stopped: an SC-* asset number maps to an existing RPC-* number. Resolve the duplicate before retrying.';
  END IF;

  IF old_division_id IS NOT NULL THEN
    -- Merge counters before moving owner references; preserve the highest issued number.
    INSERT INTO asset_number_sequences
      (owner_division_id, asset_code, sequence_year, last_sequence)
    SELECT
      CASE WHEN s.owner_division_id = old_division_id THEN rpc_division_id ELSE s.owner_division_id END,
      CASE WHEN s.asset_code = 'KDR-SC' THEN 'KDR-RPC' ELSE s.asset_code END,
      s.sequence_year,
      s.last_sequence
    FROM asset_number_sequences s
    WHERE s.owner_division_id = old_division_id OR s.asset_code = 'KDR-SC'
    ON CONFLICT (owner_division_id, asset_code, sequence_year)
    DO UPDATE SET last_sequence = GREATEST(asset_number_sequences.last_sequence, EXCLUDED.last_sequence);

    DELETE FROM asset_number_sequences
    WHERE owner_division_id = old_division_id OR asset_code = 'KDR-SC';

    UPDATE assets SET owner_division_id = rpc_division_id WHERE owner_division_id = old_division_id;
    UPDATE asset_categories SET owner_division_id = rpc_division_id WHERE owner_division_id = old_division_id;
    UPDATE departments SET division_id = rpc_division_id WHERE division_id = old_division_id;
    UPDATE users SET division_id = rpc_division_id WHERE division_id = old_division_id;
    UPDATE notifications SET recipient_division_id = rpc_division_id WHERE recipient_division_id = old_division_id;
    UPDATE org_units SET division_code = 'RPC' WHERE UPPER(division_code) = 'SC';
    DELETE FROM divisions WHERE id = old_division_id;
  ELSE
    -- KDR-SC counters may exist even when the old SC division row was already removed.
    INSERT INTO asset_number_sequences
      (owner_division_id, asset_code, sequence_year, last_sequence)
    SELECT owner_division_id, 'KDR-RPC', sequence_year, last_sequence
    FROM asset_number_sequences
    WHERE asset_code = 'KDR-SC'
    ON CONFLICT (owner_division_id, asset_code, sequence_year)
    DO UPDATE SET last_sequence = GREATEST(asset_number_sequences.last_sequence, EXCLUDED.last_sequence);

    DELETE FROM asset_number_sequences WHERE asset_code = 'KDR-SC';
  END IF;

  -- UNIT-SC is a legacy unit alias. UNIT-RPC is already seeded on fresh installs.
  SELECT EXISTS (SELECT 1 FROM org_units WHERE id = 'UNIT-SC') INTO old_unit_exists;
  IF old_unit_exists THEN
    INSERT INTO org_units (id, name, division_code, is_active)
    VALUES ('UNIT-RPC', 'RPC', 'RPC', TRUE)
    ON CONFLICT (id) DO NOTHING;

    UPDATE users SET unit_id = 'UNIT-RPC' WHERE unit_id = 'UNIT-SC';
    UPDATE assets SET managing_unit_id = 'UNIT-RPC' WHERE managing_unit_id = 'UNIT-SC';
    DELETE FROM org_units WHERE id = 'UNIT-SC';
  END IF;

  UPDATE org_units
  SET name = 'RPC', division_code = 'RPC'
  WHERE UPPER(division_code) = 'SC' OR LOWER(name) IN ('supply chain', 'rpc/sc');

  UPDATE org_office_locations
  SET name = 'RPC'
  WHERE id = 'OFF-RPC' OR LOWER(name) IN ('rpc/sc', 'supply chain', 'rpc');

  -- Merge the legacy category into the canonical RPC category without losing assets.
  SELECT id INTO old_category_id FROM asset_categories WHERE code = 'KDR-SC' LIMIT 1;
  SELECT id INTO rpc_category_id FROM asset_categories WHERE code = 'KDR-RPC' LIMIT 1;
  IF old_category_id IS NOT NULL AND rpc_category_id IS NOT NULL THEN
    UPDATE assets SET category_id = rpc_category_id WHERE category_id = old_category_id;
    DELETE FROM asset_categories WHERE id = old_category_id;
  ELSIF old_category_id IS NOT NULL THEN
    UPDATE asset_categories SET code = 'KDR-RPC' WHERE id = old_category_id;
  END IF;

  UPDATE assets
  SET asset_number = 'RPC-' || SUBSTRING(asset_number FROM 4)
  WHERE asset_number LIKE 'SC-%';

  UPDATE contracts SET owner_division = 'RPC' WHERE UPPER(owner_division) = 'SC';
  UPDATE tickets SET category = 'RPC' WHERE UPPER(category) = 'SC';
  UPDATE notifications SET category = 'RPC' WHERE UPPER(category) = 'SC';
  UPDATE users SET role = 'RPC' WHERE role = 'Supply Chain';
  UPDATE notifications SET recipient_role = 'RPC' WHERE recipient_role = 'Supply Chain';

  -- Normalize legacy role assignments into the already-seeded RPC role.
  SELECT id INTO old_role_id FROM gabah_roles WHERE role_key = 'supply_chain' LIMIT 1;
  SELECT id INTO rpc_role_id FROM gabah_roles WHERE role_key = 'rpc' LIMIT 1;

  IF old_role_id IS NOT NULL AND rpc_role_id IS NULL THEN
    UPDATE gabah_roles
    SET role_key = 'rpc',
        name = 'RPC',
        description = REPLACE(COALESCE(description, ''), 'Supply Chain', 'RPC'),
        updated_at = NOW()
    WHERE id = old_role_id;
    rpc_role_id := old_role_id;
    old_role_id := NULL;
  END IF;

  IF old_role_id IS NOT NULL AND rpc_role_id IS NOT NULL THEN
    INSERT INTO gabah_role_permissions (role_id, permission_key, created_at)
    SELECT rpc_role_id, permission_key, created_at
    FROM gabah_role_permissions
    WHERE role_id = old_role_id
    ON CONFLICT DO NOTHING;

    -- Preserve primary role status when both role assignments already exist.
    CREATE TEMP TABLE rpc_legacy_primary_users ON COMMIT DROP AS
      SELECT user_id FROM gabah_user_roles
      WHERE role_id = old_role_id AND is_primary = TRUE;

    UPDATE gabah_user_roles legacy
    SET is_primary = FALSE
    WHERE legacy.role_id = old_role_id
      AND EXISTS (
        SELECT 1 FROM gabah_user_roles canonical
        WHERE canonical.user_id = legacy.user_id AND canonical.role_id = rpc_role_id
      );

    UPDATE gabah_user_roles canonical
    SET is_primary = TRUE
    WHERE canonical.role_id = rpc_role_id
      AND EXISTS (
        SELECT 1 FROM rpc_legacy_primary_users legacy
        WHERE legacy.user_id = canonical.user_id
      );

    UPDATE gabah_user_roles legacy
    SET role_id = rpc_role_id
    WHERE legacy.role_id = old_role_id
      AND NOT EXISTS (
        SELECT 1 FROM gabah_user_roles canonical
        WHERE canonical.user_id = legacy.user_id AND canonical.role_id = rpc_role_id
      );

    DELETE FROM gabah_user_roles WHERE role_id = old_role_id;

    INSERT INTO gabah_role_division_scopes (role_id, scope_type, scope_value, created_at)
    SELECT rpc_role_id, scope_type,
      CASE
        WHEN scope_value = 'SC' THEN 'RPC'
        WHEN scope_value = 'UNIT-SC' THEN 'UNIT-RPC'
        WHEN scope_value = 'RPC/SC' THEN 'RPC'
        ELSE scope_value
      END,
      created_at
    FROM gabah_role_division_scopes
    WHERE role_id = old_role_id
    ON CONFLICT DO NOTHING;

    DELETE FROM gabah_role_division_scopes WHERE role_id = old_role_id;
    DELETE FROM gabah_role_permissions WHERE role_id = old_role_id;
    DELETE FROM gabah_roles WHERE id = old_role_id;
  END IF;
END $$;

-- Normalize legacy SC scopes for all remaining roles, safely merging duplicates.
INSERT INTO gabah_role_division_scopes (role_id, scope_type, scope_value, created_at)
SELECT role_id, scope_type,
  CASE
    WHEN scope_value = 'SC' THEN 'RPC'
    WHEN scope_value = 'UNIT-SC' THEN 'UNIT-RPC'
    WHEN scope_value = 'RPC/SC' THEN 'RPC'
    ELSE scope_value
  END,
  created_at
FROM gabah_role_division_scopes
WHERE scope_value IN ('SC', 'UNIT-SC', 'RPC/SC')
ON CONFLICT DO NOTHING;

DELETE FROM gabah_role_division_scopes
WHERE scope_value IN ('SC', 'UNIT-SC', 'RPC/SC');

COMMIT;
