-- GABAH migration 035: unit-targeted notifications for the PIBC Maintenance Engineering team.
-- Existing notifications remain unchanged; unit targeting is additive.
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS recipient_unit_id VARCHAR(64)
  REFERENCES org_units(id);

INSERT INTO org_units (id, name, division_code, is_active)
VALUES ('UNIT-PIBC-ME', 'Tim Perawatan (ME)', 'PIBC', TRUE)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    division_code = EXCLUDED.division_code,
    is_active = TRUE;

-- Keep the stable office-location ID so existing user references remain valid.
UPDATE org_office_locations
SET name = 'RPC'
WHERE id = 'OFF-RPC';
