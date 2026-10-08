-- ============================================================
-- T2B-1 migration (2026-10-08) — Asset Ownership Core Model
-- ADDITIVE & IDEMPOTENT. Tidak mengubah kolom lama apa pun:
--   * assets.owner_division   tetap (legacy/canonical ownership domain)
--   * assets.asset_number     TIDAK berubah (numbering di T2B-4)
--   * assets.location         tetap teks bebas (location master = T2B-2)
--   * RBAC / taxonomy         tidak disentuh
--
-- Kolom baru:
--   assets.managing_unit_id → org_units.id
--   Unit yang secara operasional mengelola lifecycle aset (maintenance
--   responsibility & scope pengelolaan). Owner/Managing Unit ≠ Location ≠
--   Custodian/PIC ≠ Category.
--
-- Delete behavior: ON DELETE SET NULL — menghapus sebuah unit tidak pernah
-- menghapus/mengubah data aset existing (aman untuk data lama).
-- ============================================================

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS managing_unit_id VARCHAR(64) REFERENCES org_units(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_assets_managing_unit ON assets(managing_unit_id);

-- ------------------------------------------------------------
-- BACKFILL berbasis OWNERSHIP (owner_division), BUKAN lokasi.
-- Aturan deterministik (identik dengan server/managing-unit.ts):
--   1. Unit dengan id persis 'UNIT-' || division_code DAN division_code sama
--      (SC → UNIT-SC, PIBC → UNIT-PIBC).
--   2. Jika tidak ada, tepat SATU unit dengan division_code tersebut
--      (IT → UNIT-IT-MIS).
--   3. Selain itu TIDAK diisi (NULL) — jangan menebak. GA memiliki dua
--      kandidat (UNIT-GA-SARPRAS & UNIT-GA-UMUM) → unresolved.
-- Hanya baris yang masih NULL; aman dijalankan ulang; asset_number,
-- owner_division, dan location tidak pernah disentuh oleh statement ini.
-- ------------------------------------------------------------
UPDATE assets a
SET managing_unit_id = m.unit_id
FROM (
  SELECT
    dv.id AS division_id,
    CASE
      WHEN EXISTS (SELECT 1 FROM org_units u WHERE u.id = 'UNIT-' || dv.code AND u.division_code = dv.code)
        THEN (SELECT u.id FROM org_units u WHERE u.id = 'UNIT-' || dv.code AND u.division_code = dv.code LIMIT 1)
      WHEN (SELECT COUNT(*) FROM org_units u WHERE u.division_code = dv.code) = 1
        THEN (SELECT u.id FROM org_units u WHERE u.division_code = dv.code LIMIT 1)
      ELSE NULL
    END AS unit_id
  FROM divisions dv
) m
WHERE a.owner_division_id = m.division_id
  AND a.managing_unit_id IS NULL
  AND m.unit_id IS NOT NULL;

-- Observability: jumlah total / terisi / unresolved (biarkan NULL = aman).
DO $$
DECLARE
  v_total   INT;
  v_filled  INT;
BEGIN
  SELECT COUNT(*), COUNT(managing_unit_id) INTO v_total, v_filled FROM assets;
  RAISE NOTICE 'T2B-1 backfill: total=%, backfilled=%, unresolved=%', v_total, v_filled, v_total - v_filled;
END $$;
