/**
 * GABAH Authoritative Asset Taxonomy
 * Master Source of Truth for Asset Categories, Human-readable mapping, and Owner Divisions
 * 
 * Divisi / Departemen:
 * - SC: Tim Supply Chain
 * - PIBC: Tim Pasar Induk Beras Cipinang
 * - IT: Tim IT (IT Hardware IT-H, IT Software IT-S)
 * - GA: Tim General Affair (Furniture INV-F, Peralatan INV-P, Bangunan BGN, Tanah TNH, Kendaraan KDR)
 *
 * Jenis Aset Tetap:
 * - TNH: Tanah
 * - BGN: Bangunan
 * - MSN: Mesin (Milling plant, Forklift, Jembatan timbang PIBC, Genset)
 * - KDR: Kendaraan (Mobil dinas GA, Truk logistik SC)
 * - INV-F: Inventaris Furniture (meja, kursi, lemari - Semua furniture adalah milik GA meski ada dimanapun)
 * - INV-P: Inventaris Peralatan (kompor, dispenser, AC, kulkas, APAR, toolkit)
 * - IT-H: IT Hardware (HLT laptop, HPC komputer/PC, HSV server, HMON monitor, HPRN printer, HSCN scanner, HNET switch/router, HUPS)
 *         (Semua barang IT adalah milik IT asetnya dan GA hanya bisa lihat)
 * - IT-S: IT Software (SLIC lisensi software/SaaS, ERP, OS - Semua milik IT, GA hanya bisa lihat)
 * - LNY: Lainnya
 */
export interface AssetTaxonomyItem {
  code: string;
  name: string;
  main_type: 'TNH' | 'BGN' | 'MSN' | 'KDR' | 'INV-F' | 'INV-P' | 'IT-H' | 'IT-S' | 'LNY';
  owner_division: 'IT' | 'GA' | 'SC' | 'PIBC';
  category_type: 'IT' | 'General' | 'License';
  description: string;
  is_loanable_by_default: boolean;
  /**
   * T2B-3: status aktif master kategori. Nonaktif = tidak dapat dipilih untuk
   * aset BARU (400), tetapi nilai historis pada aset existing tetap terbaca.
   * Default true (master lama tanpa field ini dianggap aktif).
   */
  is_active?: boolean;
}

// ---------------------------------------------------------------------------
// T2B-3 — MASTER KATEGORI & ASET TETAP
// Domain nilai (enum) master kategori: satu sumber kebenaran untuk server,
// API admin, dan form aset. `main_type` = klasifikasi jenis utama aset tetap
// (PSAK 16 BUMD) yang menentukan kelompok depresiasi & pelaporan neraca.
// ---------------------------------------------------------------------------
export const FIXED_ASSET_MAIN_TYPES = [
  'TNH', 'BGN', 'MSN', 'KDR', 'INV-F', 'INV-P', 'IT-H', 'IT-S', 'LNY',
] as const;
export type FixedAssetMainType = (typeof FIXED_ASSET_MAIN_TYPES)[number];

export const ASSET_OWNER_DIVISIONS = ['IT', 'GA', 'SC', 'PIBC'] as const;
export const ASSET_CATEGORY_TYPES = ['IT', 'General', 'License'] as const;

export function isFixedAssetMainType(v: unknown): v is FixedAssetMainType {
  return typeof v === 'string' && (FIXED_ASSET_MAIN_TYPES as readonly string[]).includes(v);
}
export function isOwnerDivision(v: unknown): v is AssetTaxonomyItem['owner_division'] {
  return typeof v === 'string' && (ASSET_OWNER_DIVISIONS as readonly string[]).includes(v);
}
export function isGabahCategoryType(v: unknown): v is AssetTaxonomyItem['category_type'] {
  return typeof v === 'string' && (ASSET_CATEGORY_TYPES as readonly string[]).includes(v);
}

/**
 * Legacy map: dropdown admin lama (PSAK berbahasa Inggris) menulis `main_type`
 * dengan vocabulary EQUIPMENT/VEHICLE/... yang bukan domain kanonikal. Master
 * lama dinormalkan secara deterministik ke kode kanonikal saat hydrate —
 * nilai kanonikal tidak pernah diubah.
 */
const LEGACY_MAIN_TYPE_MAP: Record<string, FixedAssetMainType> = {
  EQUIPMENT: 'MSN',
  VEHICLE: 'KDR',
  FURNITURE: 'INV-F',
  BUILDING: 'BGN',
  LAND: 'TNH',
  LICENSE: 'IT-S',
  OTHER: 'LNY',
};

/**
 * Normalisasi idempoten master kategori (dipanggil saat hydrate & seed):
 * - `is_active`: default true bila belum ada (data lama tetap terbaca).
 * - `main_type`: nilai legacy dipetakan deterministik; nilai tak dikenal → 'LNY'.
 * - field wajib di-trim; `is_loanable_by_default` dipaksa boolean.
 * TIDAK menghapus kategori apa pun (hapus hanya lewat API yang ter-guard).
 */
export function normalizeCategoryMaster(list: unknown): AssetTaxonomyItem[] {
  if (!Array.isArray(list)) return CANONICAL_TAXONOMY.map(c => ({ ...c, is_active: true }));
  const seen = new Set<string>();
  const out: AssetTaxonomyItem[] = [];
  for (const raw of list as any[]) {
    if (!raw || typeof raw !== 'object') continue;
    const code = String(raw.code || '').trim().toUpperCase();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    const rawMain = String(raw.main_type || '').trim().toUpperCase();
    const mainType: FixedAssetMainType = isFixedAssetMainType(rawMain)
      ? rawMain
      : (LEGACY_MAIN_TYPE_MAP[rawMain] || 'LNY');
    out.push({
      code,
      name: String(raw.name || code).trim(),
      main_type: mainType,
      owner_division: isOwnerDivision(raw.owner_division) ? raw.owner_division : 'GA',
      category_type: isGabahCategoryType(raw.category_type)
        ? raw.category_type
        : (raw.owner_division === 'IT' ? 'IT' : 'General'),
      description: String(raw.description || ''),
      is_loanable_by_default: Boolean(raw.is_loanable_by_default),
      is_active: raw.is_active !== false,
    });
  }
  return out.length > 0 ? out : CANONICAL_TAXONOMY.map(c => ({ ...c, is_active: true }));
}

export const CANONICAL_TAXONOMY: AssetTaxonomyItem[] = [
  // IT Hardware (IT-H) - Milik IT
  { code: 'HLT', name: 'Laptop / Notebook', main_type: 'IT-H', owner_division: 'IT', category_type: 'IT', description: 'Laptop komputasi portabel dinas (Milik IT)', is_loanable_by_default: true },
  { code: 'HPC', name: 'Komputer Desktop / PC', main_type: 'IT-H', owner_division: 'IT', category_type: 'IT', description: 'Komputer kerja / PC tower (Milik IT)', is_loanable_by_default: false },
  { code: 'HSV', name: 'Server & Rackmount', main_type: 'IT-H', owner_division: 'IT', category_type: 'IT', description: 'Server datacenter & cloud on-premise (Milik IT)', is_loanable_by_default: false },
  { code: 'HWS', name: 'Workstation', main_type: 'IT-H', owner_division: 'IT', category_type: 'IT', description: 'Workstation spesifikasi tinggi desain/analisis (Milik IT)', is_loanable_by_default: false },
  { code: 'HMON', name: 'Monitor Komputer', main_type: 'IT-H', owner_division: 'IT', category_type: 'IT', description: 'Display layar monitor PC (Milik IT)', is_loanable_by_default: false },
  { code: 'HPRN', name: 'Printer & Barcode Scanner', main_type: 'IT-H', owner_division: 'IT', category_type: 'IT', description: 'Printer dokumen laser/tinta & barcode (Milik IT)', is_loanable_by_default: false },
  { code: 'HSCN', name: 'Scanner Dokumen', main_type: 'IT-H', owner_division: 'IT', category_type: 'IT', description: 'Scanner flatbed & ADF arsip (Milik IT)', is_loanable_by_default: false },
  { code: 'HNET', name: 'Perangkat Jaringan (Switch/Router)', main_type: 'IT-H', owner_division: 'IT', category_type: 'IT', description: 'Switch, router, access point wifi (Milik IT)', is_loanable_by_default: false },
  { code: 'HFW', name: 'Firewall Security', main_type: 'IT-H', owner_division: 'IT', category_type: 'IT', description: 'Perangkat keamanan siber firewall (Milik IT)', is_loanable_by_default: false },
  { code: 'HSTG', name: 'Storage NAS / SAN', main_type: 'IT-H', owner_division: 'IT', category_type: 'IT', description: 'Storage network attached backup (Milik IT)', is_loanable_by_default: false },
  { code: 'HUPS', name: 'UPS Daya Cadangan', main_type: 'IT-H', owner_division: 'IT', category_type: 'IT', description: 'Baterai cadangan server & jaringan (Milik IT)', is_loanable_by_default: false },
  { code: 'HRCK', name: 'Rack Server Enclosure', main_type: 'IT-H', owner_division: 'IT', category_type: 'IT', description: 'Lemari server rackmount datacenter (Milik IT)', is_loanable_by_default: false },

  // IT Software & License (IT-S) - Milik IT
  { code: 'SLIC', name: 'Software License / SaaS', main_type: 'IT-S', owner_division: 'IT', category_type: 'License', description: 'Lisensi M365, ERP, OS, Antivirus (Milik IT, GA hanya bisa lihat)', is_loanable_by_default: false },

  // General Affairs: Furniture (INV-F) - SEMUA Furniture adalah milik GA meski ada dimanapun
  { code: 'INV-F', name: 'Inventaris Furniture (Meja, Kursi, Lemari)', main_type: 'INV-F', owner_division: 'GA', category_type: 'General', description: 'Meja kerja, kursi, lemari arsip (Semua furniture milik GA meski ada dimanapun)', is_loanable_by_default: false },

  // General Affairs: Peralatan (INV-P)
  { code: 'INV-P', name: 'Inventaris Peralatan & Perlengkapan', main_type: 'INV-P', owner_division: 'GA', category_type: 'General', description: 'Kompor, dispenser, AC, microwave, vacuum cleaner, APAR (Milik GA)', is_loanable_by_default: true },

  // Kendaraan (KDR) - GA atau SC
  { code: 'KDR', name: 'Kendaraan Dinas & Operasional', main_type: 'KDR', owner_division: 'GA', category_type: 'General', description: 'Mobil dinas, minibus operasional, sepeda motor (Milik GA)', is_loanable_by_default: true },
  { code: 'KDR-SC', name: 'Kendaraan Logistik / Truk Beras', main_type: 'KDR', owner_division: 'SC', category_type: 'General', description: 'Truk wingbox, colt diesel muatan beras (Milik SC)', is_loanable_by_default: true },

  // Mesin (MSN) - SC atau PIBC
  { code: 'MSN', name: 'Mesin Produksi & Forklift', main_type: 'MSN', owner_division: 'SC', category_type: 'General', description: 'Forklift, rice milling plant, conveyor packaging (Milik SC)', is_loanable_by_default: false },
  { code: 'MSN-PIBC', name: 'Mesin Jembatan Timbang & Tera PIBC', main_type: 'MSN', owner_division: 'PIBC', category_type: 'General', description: 'Jembatan timbang 60 ton & alat ukur kawasan pasar (Milik PIBC)', is_loanable_by_default: false },

  // Bangunan & Fisik (BGN)
  { code: 'BGN', name: 'Bangunan Fisik & Gudang', main_type: 'BGN', owner_division: 'GA', category_type: 'General', description: 'Gedung kantor pusat, pergudangan Cipinang & Sragen (Milik GA)', is_loanable_by_default: false },

  // Tanah (TNH)
  { code: 'TNH', name: 'Tanah & Lahan Korporat', main_type: 'TNH', owner_division: 'GA', category_type: 'General', description: 'Lahan kawasan Food Station Cipinang & sentra produksi (Milik GA)', is_loanable_by_default: false },

  // Lainnya (LNY)
  { code: 'LNY', name: 'Aset Tetap Lainnya', main_type: 'LNY', owner_division: 'GA', category_type: 'General', description: 'Aset tetap umum penunjang operasional kantor', is_loanable_by_default: false },
];

/**
 * Resolve Category and Owner Division from human-readable name or code
 * User chooses human-readable "Jenis Aset", system derives canonical code and owner division.
 */
export function resolveTaxonomyByHumanName(
  nameOrCode?: string,
  requestedDivision?: 'IT' | 'GA' | 'SC' | 'PIBC',
  catalog: AssetTaxonomyItem[] = CANONICAL_TAXONOMY,
): AssetTaxonomyItem {
  // T2B-3: `catalog` = master kategori yang sedang berlaku (`db.categories`,
  // hasil CRUD Admin GABAH). Master kustom/hasil edit dipakai lebih dulu;
  // kode kanonikal yang hilang dari master tetap jatuh ke CANONICAL_TAXONOMY
  // (fail-safe) sehingga kategori yang dihapus admin tidak membuat resolusi
  // gagal atau aset legacy gagal dibaca.
  const pool: AssetTaxonomyItem[] = Array.isArray(catalog) && catalog.length > 0 ? catalog : CANONICAL_TAXONOMY;
  const pick = (code: string): AssetTaxonomyItem =>
    pool.find(t => t.code === code) || CANONICAL_TAXONOMY.find(t => t.code === code)!;

  if (!nameOrCode || typeof nameOrCode !== 'string' || !nameOrCode.trim()) {
    if (requestedDivision === 'IT') return pick('HLT');
    if (requestedDivision === 'GA') return pick('INV-P');
    if (requestedDivision === 'SC') return pick('KDR-SC');
    if (requestedDivision === 'PIBC') return pick('MSN-PIBC');
    return pool[0] || CANONICAL_TAXONOMY[0];
  }
  const query = nameOrCode.trim().toLowerCase();
  
  // 1. Check exact match by code (master aktif lebih dulu, lalu kanonikal)
  const byCode = pool.find(t => t.code.toLowerCase() === query)
    || CANONICAL_TAXONOMY.find(t => t.code.toLowerCase() === query);
  if (byCode) {
    if (requestedDivision && (byCode.code === 'KDR' || byCode.code === 'MSN')) {
      // Allow division override for shared categories like KDR and MSN
      return { ...byCode, owner_division: requestedDivision };
    }
    return byCode;
  }

  // 2. Exact match by name
  const byName = pool.find(t => t.name.toLowerCase() === query)
    || CANONICAL_TAXONOMY.find(t => t.name.toLowerCase() === query);
  if (byName) return byName;

  // 3. Normalized keyword match
  if (query.includes('laptop') || query.includes('notebook')) return pick('HLT');
  if (query.includes('komputer') || query.includes('pc') || query.includes('desktop')) return pick('HPC');
  if (query.includes('server')) return pick('HSV');
  if (query.includes('workstation')) return pick('HWS');
  if (query.includes('monitor') || query.includes('display')) return pick('HMON');
  if (query.includes('printer')) return pick('HPRN');
  if (query.includes('scanner')) return pick('HSCN');
  if (query.includes('network') || query.includes('switch') || query.includes('router')) return pick('HNET');
  if (query.includes('firewall')) return pick('HFW');
  if (query.includes('storage') || query.includes('nas') || query.includes('san')) return pick('HSTG');
  if (query.includes('ups')) return pick('HUPS');
  if (query.includes('rack')) return pick('HRCK');
  if (query.includes('license') || query.includes('lisensi') || query.includes('saas') || query.includes('software') || query.includes('it-s') || query.includes('slic')) {
    return pick('SLIC');
  }
  if (query.includes('furniture') || query.includes('kursi') || query.includes('meja') || query.includes('lemari') || query.includes('inv-f')) {
    return pick('INV-F');
  }
  if (query.includes('kompor') || query.includes('dispenser') || query.includes('peralatan') || query.includes('perlengkapan') || query.includes('dapur') || query.includes('inv-p') || query.includes('apar') || query.includes('ac')) {
    return pick('INV-P');
  }
  if (query.includes('mobil') || query.includes('motor') || query.includes('kendaraan') || query.includes('truk') || query.includes('kdr')) {
    const div = requestedDivision || (query.includes('truk') ? 'SC' : 'GA');
    return {
      code: 'KDR',
      name: 'Kendaraan',
      main_type: 'KDR',
      owner_division: div,
      category_type: 'General',
      description: 'Kendaraan Dinas & Operasional',
      is_loanable_by_default: true,
    };
  }
  if (query.includes('timbangan') || query.includes('tera') || (query.includes('mesin') && requestedDivision === 'PIBC')) {
    return pick('MSN-PIBC');
  }
  if (query.includes('mesin') || query.includes('forklift') || query.includes('mill') || query.includes('packing') || query.includes('msn')) {
    const div = requestedDivision || 'SC';
    return {
      code: 'MSN',
      name: 'Mesin',
      main_type: 'MSN',
      owner_division: div,
      category_type: 'General',
      description: 'Mesin Produksi & Penunjang',
      is_loanable_by_default: false,
    };
  }
  if (query.includes('tanah') || query.includes('lahan') || query.includes('tnh')) return pick('TNH');
  if (query.includes('gedung') || query.includes('bangunan') || query.includes('gudang') || query.includes('bgn')) return pick('BGN');
  if (query.includes('lainnya') || query.includes('lny')) return pick('LNY');

  // Default fail-safe
  return pick('LNY');
}

/**
 * T2B-3: validasi pemakaian kategori sebagai nilai BARU pada aset.
 * - Kategori terdaftar & aktif  → diperbolehkan.
 * - Kategori terdaftar & NONAKTIF → ditolak (400): pilihan baru harus ke
 *   kategori aktif; nilai historis yang sudah melekat pada aset tidak pernah
 *   dipaksa berubah oleh aturan ini.
 * - Tidak terdaftar / input kosong → dilewatkan (resolusi fallback legacy
 *   tetap berlaku — aset lama tanpa kategori master harus tetap terbaca).
 * Melempar Error agar tertangkap sebagai 400 oleh route.
 */
export function assertCategoryUsableForNewAsset(
  resolved: AssetTaxonomyItem,
  explicitInput: string,
  catalog: AssetTaxonomyItem[] = CANONICAL_TAXONOMY,
): void {
  if (!explicitInput || !explicitInput.trim()) return;
  const pool: AssetTaxonomyItem[] = Array.isArray(catalog) && catalog.length > 0 ? catalog : CANONICAL_TAXONOMY;
  const master = pool.find(c => c.code === resolved.code);
  if (master && master.is_active === false) {
    throw Object.assign(
      new Error(`Kategori "${master.code}" - ${master.name} sedang nonaktif dan tidak dapat dipilih untuk aset baru.`),
      { statusCode: 400 },
    );
  }
}

