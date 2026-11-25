-- GABAH Migration 106: retire location aliases from active owner domains.
-- SC/RPC and PIBC remain as historical foreign-key targets. Do not delete,
-- reassign, or rewrite assets, contracts, users, units, tickets, or history.

UPDATE divisions
SET is_active = FALSE
WHERE UPPER(BTRIM(code)) IN ('SC', 'PIBC')
  AND is_active IS DISTINCT FROM FALSE;

-- Categories owned by retired location aliases remain readable on existing
-- assets but must not be offered for new asset creation.
UPDATE asset_categories AS category
SET is_active = FALSE,
    updated_at = NOW()
FROM divisions AS owner
WHERE category.owner_division_id = owner.id
  AND UPPER(BTRIM(owner.code)) IN ('SC', 'PIBC')
  AND category.is_active IS DISTINCT FROM FALSE;
