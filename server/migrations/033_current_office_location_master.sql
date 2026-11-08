-- Stage 33: align current office locations with the approved operating footprint.
-- Preserve IDs and historical user references. Do not delete closed locations.
-- This only deactivates the retired Perawatan office; no assets or user history
-- are reassigned. Future locations are added through Super Admin master data.
UPDATE org_office_locations
SET name = CASE id
  WHEN 'OFF-KP' THEN 'HO'
  WHEN 'OFF-RPC' THEN 'RPC/SC'
  ELSE name
END,
is_active = CASE
  WHEN id = 'OFF-PERAWATAN' THEN FALSE
  ELSE is_active
END
WHERE id IN ('OFF-KP', 'OFF-RPC', 'OFF-PERAWATAN');

-- Canonical labels for the four currently active sites. Existing IDs are kept.
UPDATE org_office_locations
SET name = 'PIBC', is_active = TRUE
WHERE id = 'OFF-PIBC';

UPDATE org_office_locations
SET name = 'Pangsub', is_active = TRUE
WHERE id = 'OFF-PANGSUB';
