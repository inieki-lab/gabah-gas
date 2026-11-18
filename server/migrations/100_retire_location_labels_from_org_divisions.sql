-- RPC/SC, PIBC, and Pangsub are physical office locations, not divisions
-- or organizational units. Preserve their legacy rows and user references,
-- but retire the location-shaped division/unit placeholders from new use.
UPDATE divisions
SET name = CASE code
  WHEN 'SC' THEN 'Legacy owner SC — lokasi RPC/SC'
  WHEN 'PIBC' THEN 'Legacy owner PIBC — lokasi PIBC'
  ELSE name
END,
is_active = FALSE
WHERE code IN ('SC', 'PIBC');

UPDATE org_units
SET name = CASE id
  WHEN 'UNIT-SC' THEN 'Legacy location placeholder — RPC/SC'
  WHEN 'UNIT-PIBC' THEN 'Legacy location placeholder — PIBC'
  WHEN 'UNIT-PANGSUB' THEN 'Legacy location placeholder — Pangsub'
  ELSE name
END,
is_active = FALSE
WHERE id IN ('UNIT-SC', 'UNIT-PIBC', 'UNIT-PANGSUB');
