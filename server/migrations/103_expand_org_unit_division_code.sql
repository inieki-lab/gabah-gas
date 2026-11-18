-- Keep org-unit parent codes aligned with divisions.code (VARCHAR(20)).
ALTER TABLE org_units
  ALTER COLUMN division_code TYPE VARCHAR(20);
