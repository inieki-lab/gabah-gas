-- GABAH migration 045: align RPC/PIBC office and unit labels with the agreed org model.
-- Stable IDs and legacy division codes remain in place for foreign-key/history compatibility.
-- SC/PIBC are not valid new asset owner domains; no asset ownership or user role is rewritten here.
UPDATE org_office_locations
SET name = 'RPC'
WHERE id = 'OFF-RPC' AND name <> 'RPC';

UPDATE org_units
SET name = 'RPC'
WHERE id = 'UNIT-SC' AND name <> 'RPC';

UPDATE org_units
SET name = 'PIBC'
WHERE id = 'UNIT-PIBC' AND name <> 'PIBC';

-- Keep old division codes available for existing references, but make their
-- display labels explicit that they are legacy compatibility references only.
UPDATE divisions
SET name = 'RPC (legacy references)'
WHERE code = 'SC' AND name <> 'RPC (legacy references)';

UPDATE divisions
SET name = 'PIBC (legacy references)'
WHERE code = 'PIBC' AND name <> 'PIBC (legacy references)';
