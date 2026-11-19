-- GABAH migration 046: backfill newly introduced IT/GA loan catalog categories
-- into both normalized asset_categories and the persisted gabah_state snapshot.
-- Existing category rows/customizations are never overwritten. This is needed
-- because older snapshots carry a non-empty categories array and intentionally
-- override the current in-code canonical seed during hydration.

WITH seed(code, name, category_type, main_type, description, owner_code, is_loanable_by_default) AS (
  VALUES
    ('HHDM', 'Kabel HDMI / DisplayPort / VGA', 'IT', 'IT-H', 'Kabel display untuk presentasi dan kebutuhan kerja (Milik IT)', 'IT', TRUE),
    ('HPTR', 'Wireless Presenter / Pointer', 'IT', 'IT-H', 'Presenter nirkabel dan pointer presentasi (Milik IT)', 'IT', TRUE),
    ('HADP', 'Adaptor & Video Converter', 'IT', 'IT-H', 'Adaptor USB-C, HDMI converter, charger dan adaptor laptop (Milik IT)', 'IT', TRUE),
    ('HDCK', 'Docking Station & USB Hub', 'IT', 'IT-H', 'Docking station, USB-C hub dan multiport adapter (Milik IT)', 'IT', TRUE),
    ('HKEY', 'Keyboard & Mouse', 'IT', 'IT-H', 'Keyboard dan mouse eksternal (Milik IT)', 'IT', TRUE),
    ('HWEB', 'Webcam & Headset', 'IT', 'IT-H', 'Webcam, headset dan perangkat konferensi personal (Milik IT)', 'IT', TRUE),
    ('HAUD', 'Audio Portable & Mikrofon', 'IT', 'IT-H', 'Speaker portable, mikrofon dan perangkat audio presentasi (Milik IT)', 'IT', TRUE),
    ('HUSB', 'Flashdisk & Media Penyimpanan Portable', 'IT', 'IT-H', 'Flashdisk dan media penyimpanan portable milik IT (Milik IT)', 'IT', TRUE),
    ('HEXT', 'External HDD / SSD', 'IT', 'IT-H', 'Hard disk dan SSD eksternal portable (Milik IT)', 'IT', TRUE),
    ('GPRJ', 'Projector & Perangkat Presentasi GA', 'General', 'INV-P', 'Projector dan perlengkapan presentasi milik GA; peminjaman disetujui GA', 'GA', TRUE),
    ('GCCTV', 'CCTV & Perangkat Pengawasan', 'General', 'INV-P', 'Kamera CCTV dan perangkat pengawasan milik GA untuk instalasi tetap; bukan barang pinjaman umum', 'GA', FALSE)
)
INSERT INTO asset_categories (code, name, category_type, main_type, description, owner_division_id, is_loanable_by_default, is_active, updated_at)
SELECT s.code, s.name, s.category_type, s.main_type, s.description, d.id, s.is_loanable_by_default, TRUE, NOW()
FROM seed s
JOIN divisions d ON d.code = s.owner_code
ON CONFLICT (code) DO NOTHING;

-- The app hydrates db.categories from gabah_state.payload.categories when a
-- snapshot exists. Append only missing canonical additions; preserve every
-- existing category row exactly as configured by administrators.
WITH seed(code, name, category_type, main_type, description, owner_division, is_loanable_by_default) AS (
  VALUES
    ('HHDM', 'Kabel HDMI / DisplayPort / VGA', 'IT', 'IT-H', 'Kabel display untuk presentasi dan kebutuhan kerja (Milik IT)', 'IT', TRUE),
    ('HPTR', 'Wireless Presenter / Pointer', 'IT', 'IT-H', 'Presenter nirkabel dan pointer presentasi (Milik IT)', 'IT', TRUE),
    ('HADP', 'Adaptor & Video Converter', 'IT', 'IT-H', 'Adaptor USB-C, HDMI converter, charger dan adaptor laptop (Milik IT)', 'IT', TRUE),
    ('HDCK', 'Docking Station & USB Hub', 'IT', 'IT-H', 'Docking station, USB-C hub dan multiport adapter (Milik IT)', 'IT', TRUE),
    ('HKEY', 'Keyboard & Mouse', 'IT', 'IT-H', 'Keyboard dan mouse eksternal (Milik IT)', 'IT', TRUE),
    ('HWEB', 'Webcam & Headset', 'IT', 'IT-H', 'Webcam, headset dan perangkat konferensi personal (Milik IT)', 'IT', TRUE),
    ('HAUD', 'Audio Portable & Mikrofon', 'IT', 'IT-H', 'Speaker portable, mikrofon dan perangkat audio presentasi (Milik IT)', 'IT', TRUE),
    ('HUSB', 'Flashdisk & Media Penyimpanan Portable', 'IT', 'IT-H', 'Flashdisk dan media penyimpanan portable milik IT (Milik IT)', 'IT', TRUE),
    ('HEXT', 'External HDD / SSD', 'IT', 'IT-H', 'Hard disk dan SSD eksternal portable (Milik IT)', 'IT', TRUE),
    ('GPRJ', 'Projector & Perangkat Presentasi GA', 'General', 'INV-P', 'Projector dan perlengkapan presentasi milik GA; peminjaman disetujui GA', 'GA', TRUE),
    ('GCCTV', 'CCTV & Perangkat Pengawasan', 'General', 'INV-P', 'Kamera CCTV dan perangkat pengawasan milik GA untuk instalasi tetap; bukan barang pinjaman umum', 'GA', FALSE)
),
snapshot AS (
  SELECT id, COALESCE(payload->'categories', '[]'::jsonb) AS categories
  FROM gabah_state
  WHERE id = 1
),
missing AS (
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object(
      'code', s.code,
      'name', s.name,
      'category_type', s.category_type,
      'main_type', s.main_type,
      'description', s.description,
      'owner_division', s.owner_division,
      'is_loanable_by_default', s.is_loanable_by_default,
      'is_active', TRUE
    )),
    '[]'::jsonb
  ) AS additions
  FROM seed s
  CROSS JOIN snapshot snap
  WHERE NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(snap.categories) AS existing(item)
    WHERE UPPER(COALESCE(existing.item->>'code', '')) = s.code
  )
)
UPDATE gabah_state g
SET payload = jsonb_set(
  COALESCE(g.payload, '{}'::jsonb),
  '{categories}',
  COALESCE(g.payload->'categories', '[]'::jsonb) || missing.additions,
  TRUE
),
updated_at = NOW()
FROM missing
WHERE g.id = 1
  AND jsonb_array_length(missing.additions) > 0;
