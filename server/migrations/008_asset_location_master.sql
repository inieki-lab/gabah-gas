-- ============================================================
-- T2B-2 migration (2026-10-09) — Asset Location Master
-- ADDITIVE & IDEMPOTENT. Tidak mengubah kolom lama apa pun:
--   * assets.owner_division      tetap (legacy/canonical ownership domain)
--   * assets.managing_unit_id    tetap (T2B-1) — unit pengelola lifecycle
--   * assets.location            tetap teks bebas (legacy compatibility)
--   * assets.asset_number        TIDAK berubah (numbering di T2B-4)
--   * RBAC / taxonomy            tidak disentuh
--
-- Master baru:
--   asset_locations → id stabil, nama, parent_id (self-reference hierarki
--   sederhana), status aktif/nonaktif. TERPISAH dari org_office_locations
--   (penempatan user) dan org_units (unit pengelola).
--
-- Kolom baru:
--   assets.asset_location_id → asset_locations.id (nullable; aset legacy
--   yang tidak cocok unik dengan master dibiarkan NULL — jangan menebak).
--
-- Delete behavior: ON DELETE SET NULL — menghapus sebuah lokasi tidak
-- pernah menghapus/mengubah data aset existing (aman untuk data lama).
-- ============================================================

CREATE TABLE IF NOT EXISTS asset_locations (
  id         VARCHAR(64) PRIMARY KEY,
  name       VARCHAR(160) NOT NULL,
  parent_id  VARCHAR(64) REFERENCES asset_locations(id) ON DELETE SET NULL,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed DITURUNKAN dari nilai `location` aktual pada seed aset (bukan
-- karangan). Path lengkap "Induk - Anak" = teks legacy, sehingga backfill
-- exact-match di bawah dapat memetakan seluruh aset seed secara deterministik.
-- Urutan: root dulu (self-reference FK), lalu anak.
INSERT INTO asset_locations (id, name, parent_id, is_active) VALUES
  ('ALOC-HO',            'Head Office',                            NULL, TRUE),
  ('ALOC-GBC',           'Gudang Beras Cipinang',                  NULL, TRUE),
  ('ALOC-PIBC',          'Pasar Induk Beras Cipinang',             NULL, TRUE),
  ('ALOC-CLOUD',         'Cloud Tenant Microsoft Azure',           NULL, TRUE),
  ('ALOC-HO-PDK',        'Divisi Perdagangan & Komersial Lt. 2',   'ALOC-HO',  TRUE),
  ('ALOC-HO-IT',         'Ruang IT & Server Lt. 2',                'ALOC-HO',  TRUE),
  ('ALOC-HO-SEKDIR',     'Sekretariat Direksi Lt. 3',              'ALOC-HO',  TRUE),
  ('ALOC-HO-HUMAS',      'Ruang Humas & Protokoler Lt. 2',         'ALOC-HO',  TRUE),
  ('ALOC-HO-GA',         'Ruang General Affairs Lt. 1',            'ALOC-HO',  TRUE),
  ('ALOC-HO-ITPOOL',     'Gudang IT Pool (Lt. 2)',                 'ALOC-HO',  TRUE),
  ('ALOC-HO-DC',         'Server Room Datacenter Lt. 2',           'ALOC-HO',  TRUE),
  ('ALOC-HO-DIREKSI',    'Ruang Direksi',                          'ALOC-HO',  TRUE),
  ('ALOC-HO-PARKIR',     'Parkir Kendaraan Dinas',                 'ALOC-HO',  TRUE),
  ('ALOC-GBC-TIMBANGAN', 'Pos Timbangan & Kontrol Distribusi',     'ALOC-GBC', TRUE),
  ('ALOC-GBC-WH-A',      'Warehouse A',                            'ALOC-GBC', TRUE),
  ('ALOC-PIBC-KANTOR-1', 'Kantor Pos 1',                           'ALOC-PIBC',TRUE)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS asset_location_id VARCHAR(64) REFERENCES asset_locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_assets_asset_location ON assets(asset_location_id);

-- Self-reference aman: constraint FK inline pada kolom parent_id memakai
-- CREATE TABLE di atas; untuk database yang sudah keburu membuat tabel tanpa
-- kolom (tidak terjadi pada jalur CREATE IF NOT EXISTS), jalankan ulang aman.

-- ------------------------------------------------------------
-- BACKFILL deterministik dari teks legacy `location` (identik dengan
-- resolveAssetLocationIdByText di server/asset-location.ts):
--   * normalisasi: trim + collapse spasi + huruf kecil;
--   * cocokkan teks aset dengan path lengkap lokasi ("Induk - Anak",
--     root = nama saja);
--   * HANYA baris dengan hasil cocok UNIK yang diisi — ambigu/tidak
--     dikenal dibiarkan NULL (jangan menebak);
--   * hanya baris yang masih NULL; aman dijalankan ulang;
--   * owner_division, managing_unit_id, location, dan asset_number
--     tidak pernah disentuh oleh statement ini.
-- ------------------------------------------------------------
UPDATE assets a
SET asset_location_id = m.id
FROM (
  SELECT l.id,
         btrim(lower(COALESCE(p.name || ' - ' || l.name, l.name))) AS path
  FROM asset_locations l
  LEFT JOIN asset_locations p ON p.id = l.parent_id
) m
WHERE a.asset_location_id IS NULL
  AND btrim(lower(a.location)) = m.path
  AND NOT EXISTS (
    SELECT 1
    FROM asset_locations l2
    LEFT JOIN asset_locations p2 ON p2.id = l2.parent_id
    WHERE btrim(lower(a.location)) = btrim(lower(COALESCE(p2.name || ' - ' || l2.name, l2.name)))
      AND l2.id <> m.id
  );

-- Observability: jumlah total / terpetakan / belum terpetak (biarkan NULL = aman).
DO $$
DECLARE
  v_total   INT;
  v_mapped  INT;
BEGIN
  SELECT COUNT(*), COUNT(asset_location_id) INTO v_total, v_mapped FROM assets;
  RAISE NOTICE 'T2B-2 backfill: total=%, mapped=%, unresolved=%', v_total, v_mapped, v_total - v_mapped;
END $$;
