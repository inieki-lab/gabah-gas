-- ============================================================
-- T2B-3 migration (2026-10-09) — Master Kategori & Aset Tetap
-- ADDITIVE & IDEMPOTEN. Tidak mengubah/menghapus kolom lama apa pun:
--   * assets.owner_division   tetap (legacy/canonical ownership domain)
--   * assets.managing_unit_id tetap (T2B-1)
--   * assets.asset_location_id tetap (T2B-2)
--   * assets.asset_number     TIDAK berubah (numbering di T2B-4)
--   * assets.location         tetap teks bebas
--   * RBAC / taxonomy domain lain tidak disentuh
--
-- Yang ditambahkan pada tabel master `asset_categories` (sudah ada sejak
-- migration 001) agar master kategori dapat menyimpan klasifikasi aset tetap
-- (PSAK 16) secara lengkap:
--   * main_type     — jenis utama aset tetap, domain kanonikal
--                     TNH/BGN/MSN/KDR/INV-F/INV-P/IT-H/IT-S/LNY
--   * description   — deskripsi kategori
--   * updated_at    — jejak perubahan master
-- Kolom `is_active` (status aktif/nonaktif) SUDAH ada sejak 001
-- (BOOLEAN NOT NULL DEFAULT TRUE) — disable-bukan-hapus memakai kolom ini,
-- sehingga relasi aset tidak pernah rusak oleh penghapusan.
-- ============================================================

ALTER TABLE asset_categories ADD COLUMN IF NOT EXISTS main_type   VARCHAR(16);
ALTER TABLE asset_categories ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE asset_categories ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ------------------------------------------------------------
-- BACKFILL main_type (deterministik; identik dengan aturan di
-- server/taxonomy.ts normalizeCategoryMaster):
--   1. Kode kanonikal   → kelompoknya (HLT..HRCK = IT-H, SLIC = IT-S, dst).
--   2. Kode kustom      → pertahankan nilai kanonikal; vocabulary legacy
--                         dropdown lama (EQUIPMENT/VEHICLE/...) dipetakan.
--   3. Selain itu        → 'LNY' (tidak ada nilai yang dibiarkan aneh).
-- Hanya baris yang belum punya nilai valid; aman dijalankan ulang; kolom
-- lain (code/name/category_type/owner_division/is_active) tidak disentuh.
-- ------------------------------------------------------------
UPDATE asset_categories
SET main_type = CASE
  -- 1) kode kanonikal → kelompok aset tetapnya
  WHEN code IN ('HLT','HPC','HSV','HWS','HMON','HPRN','HSCN','HNET','HFW','HSTG','HUPS','HRCK') THEN 'IT-H'
  WHEN code = 'SLIC'   THEN 'IT-S'
  WHEN code = 'INV-F'  THEN 'INV-F'
  WHEN code = 'INV-P'  THEN 'INV-P'
  WHEN code IN ('KDR','KDR-SC')       THEN 'KDR'
  WHEN code IN ('MSN','MSN-PIBC')     THEN 'MSN'
  WHEN code = 'BGN'    THEN 'BGN'
  WHEN code = 'TNH'    THEN 'TNH'
  WHEN code = 'LNY'    THEN 'LNY'
  -- 2) kode kustom: nilai kanonikal dipertahankan, vocabulary legacy dipetakan
  WHEN main_type IN ('TNH','BGN','MSN','KDR','INV-F','INV-P','IT-H','IT-S','LNY') THEN main_type
  WHEN main_type = 'EQUIPMENT'  THEN 'MSN'
  WHEN main_type = 'VEHICLE'    THEN 'KDR'
  WHEN main_type = 'FURNITURE'  THEN 'INV-F'
  WHEN main_type = 'BUILDING'   THEN 'BGN'
  WHEN main_type = 'LAND'       THEN 'TNH'
  WHEN main_type = 'LICENSE'    THEN 'IT-S'
  WHEN main_type = 'OTHER'      THEN 'LNY'
  -- 3) fallback deterministik
  ELSE 'LNY'
END,
updated_at = NOW()
WHERE main_type IS NULL
   OR main_type NOT IN ('TNH','BGN','MSN','KDR','INV-F','INV-P','IT-H','IT-S','LNY');

-- ------------------------------------------------------------
-- SEED master kategori kanonikal (22 baris) — idempoten.
-- Baris yang sudah ada (mis. dibuat dari aset legacy) TIDAK ditimpa;
-- kolom lain pada baris lama tidak diubah oleh ON CONFLICT DO NOTHING.
-- ------------------------------------------------------------
INSERT INTO asset_categories (code, name, category_type, main_type, description, owner_division_id, is_loanable_by_default, is_active)
SELECT v.code, v.name, v.category_type, v.main_type, v.description, d.id, v.loanable, TRUE
FROM (VALUES
  ('HLT',    'Laptop / Notebook',                        'IT',      'IT-H',  'Laptop komputasi portabel dinas (Milik IT)',                        'IT',  TRUE),
  ('HPC',    'Komputer Desktop / PC',                    'IT',      'IT-H',  'Komputer kerja / PC tower (Milik IT)',                              'IT',  FALSE),
  ('HSV',    'Server & Rackmount',                       'IT',      'IT-H',  'Server datacenter & cloud on-premise (Milik IT)',                   'IT',  FALSE),
  ('HWS',    'Workstation',                              'IT',      'IT-H',  'Workstation spesifikasi tinggi desain/analisis (Milik IT)',         'IT',  FALSE),
  ('HMON',   'Monitor Komputer',                         'IT',      'IT-H',  'Display layar monitor PC (Milik IT)',                               'IT',  FALSE),
  ('HPRN',   'Printer & Barcode Scanner',                'IT',      'IT-H',  'Printer dokumen laser/tinta & barcode (Milik IT)',                  'IT',  FALSE),
  ('HSCN',   'Scanner Dokumen',                          'IT',      'IT-H',  'Scanner flatbed & ADF arsip (Milik IT)',                            'IT',  FALSE),
  ('HNET',   'Perangkat Jaringan (Switch/Router)',       'IT',      'IT-H',  'Switch, router, access point wifi (Milik IT)',                      'IT',  FALSE),
  ('HFW',    'Firewall Security',                        'IT',      'IT-H',  'Perangkat keamanan siber firewall (Milik IT)',                      'IT',  FALSE),
  ('HSTG',   'Storage NAS / SAN',                        'IT',      'IT-H',  'Storage network attached backup (Milik IT)',                        'IT',  FALSE),
  ('HUPS',   'UPS Daya Cadangan',                        'IT',      'IT-H',  'Baterai cadangan server & jaringan (Milik IT)',                     'IT',  FALSE),
  ('HRCK',   'Rack Server Enclosure',                    'IT',      'IT-H',  'Lemari server rackmount datacenter (Milik IT)',                     'IT',  FALSE),
  ('SLIC',   'Software License / SaaS',                  'License', 'IT-S',  'Lisensi M365, ERP, OS, Antivirus (Milik IT, GA hanya bisa lihat)',  'IT',  FALSE),
  ('INV-F',  'Inventaris Furniture (Meja, Kursi, Lemari)','General', 'INV-F', 'Meja kerja, kursi, lemari arsip (Semua furniture milik GA meski ada dimanapun)', 'GA', FALSE),
  ('INV-P',  'Inventaris Peralatan & Perlengkapan',      'General', 'INV-P', 'Kompor, dispenser, AC, microwave, vacuum cleaner, APAR (Milik GA)',  'GA',  TRUE),
  ('KDR',    'Kendaraan Dinas & Operasional',            'General', 'KDR',   'Mobil dinas, minibus operasional, sepeda motor (Milik GA)',         'GA',  TRUE),
  ('KDR-SC', 'Kendaraan Logistik / Truk Beras',          'General', 'KDR',   'Truk wingbox, colt diesel muatan beras (Milik SC)',                 'SC',  TRUE),
  ('MSN',    'Mesin Produksi & Forklift',                'General', 'MSN',   'Forklift, rice milling plant, conveyor packaging (Milik SC)',       'SC',  FALSE),
  ('MSN-PIBC','Mesin Jembatan Timbang & Tera PIBC',      'General', 'MSN',   'Jembatan timbang 60 ton & alat ukur kawasan pasar (Milik PIBC)',    'PIBC',FALSE),
  ('BGN',    'Bangunan Fisik & Gudang',                  'General', 'BGN',   'Gedung kantor pusat, pergudangan Cipinang & Sragen (Milik GA)',     'GA',  FALSE),
  ('TNH',    'Tanah & Lahan Korporat',                   'General', 'TNH',   'Lahan kawasan Food Station Cipinang & sentra produksi (Milik GA)',  'GA',  FALSE),
  ('LNY',    'Aset Tetap Lainnya',                       'General', 'LNY',   'Aset tetap umum penunjang operasional kantor',                      'GA',  FALSE)
) AS v(code, name, category_type, main_type, description, division_code, loanable)
LEFT JOIN divisions d ON d.code = v.division_code
ON CONFLICT (code) DO NOTHING;

-- Observability: jumlah total / aktif / nonaktif (nonaktif = dipakai aset
-- historis tetap terbaca, tetapi tidak dapat dipilih untuk aset baru).
DO $$
DECLARE
  v_total    INT;
  v_active   INT;
  v_inactive INT;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE is_active), COUNT(*) FILTER (WHERE NOT is_active)
    INTO v_total, v_active, v_inactive
    FROM asset_categories;
  RAISE NOTICE 'T2B-3 master kategori: total=%, aktif=%, nonaktif=%', v_total, v_active, v_inactive;
END $$;
