-- Stage 33: align office labels while preserving the approved active locations.
-- Preserve IDs and historical user references. Do not delete office locations.
-- Kantor Perawatan remains active; no assets or user history are reassigned.
-- Future locations are added through Super Admin master data.
UPDATE org_office_locations
SET name = CASE id
  WHEN 'OFF-KP' THEN 'HO'
  WHEN 'OFF-RPC' THEN 'RPC/SC'
  ELSE name
END
WHERE id IN ('OFF-KP', 'OFF-RPC');

-- Canonical labels for the five currently active offices. Existing IDs are kept.
UPDATE org_office_locations
SET name = 'PIBC', is_active = TRUE
WHERE id = 'OFF-PIBC';

UPDATE org_office_locations
SET name = 'Pangsub', is_active = TRUE
WHERE id = 'OFF-PANGSUB';

-- Kantor Perawatan is operational and must remain active.
UPDATE org_office_locations
SET name = 'Kantor Perawatan', is_active = TRUE
WHERE id = 'OFF-PERAWATAN';

-- If a legacy office master row named Subang exists, retire it without deleting
-- the row or changing asset-location history. Future sites are still addable by Admin.
UPDATE org_office_locations
SET is_active = FALSE
WHERE LOWER(BTRIM(name)) = 'subang';
