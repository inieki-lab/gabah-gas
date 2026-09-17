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
export function resolveTaxonomyByHumanName(nameOrCode?: string, requestedDivision?: 'IT' | 'GA' | 'SC' | 'PIBC'): AssetTaxonomyItem {
  if (!nameOrCode || typeof nameOrCode !== 'string' || !nameOrCode.trim()) {
    if (requestedDivision === 'IT') return CANONICAL_TAXONOMY.find(t => t.code === 'HLT')!;
    if (requestedDivision === 'GA') return CANONICAL_TAXONOMY.find(t => t.code === 'INV-P')!;
    if (requestedDivision === 'SC') return CANONICAL_TAXONOMY.find(t => t.code === 'KDR-SC')!;
    if (requestedDivision === 'PIBC') return CANONICAL_TAXONOMY.find(t => t.code === 'MSN-PIBC')!;
    return CANONICAL_TAXONOMY[0];
  }
  const query = nameOrCode.trim().toLowerCase();
  
  // 1. Check exact match by code
  const byCode = CANONICAL_TAXONOMY.find(t => t.code.toLowerCase() === query);
  if (byCode) {
    if (requestedDivision && (byCode.code === 'KDR' || byCode.code === 'MSN')) {
      // Allow division override for shared categories like KDR and MSN
      return { ...byCode, owner_division: requestedDivision };
    }
    return byCode;
  }

  // 2. Exact match by name
  const byName = CANONICAL_TAXONOMY.find(t => t.name.toLowerCase() === query);
  if (byName) return byName;

  // 3. Normalized keyword match
  if (query.includes('laptop') || query.includes('notebook')) return CANONICAL_TAXONOMY.find(t => t.code === 'HLT')!;
  if (query.includes('komputer') || query.includes('pc') || query.includes('desktop')) return CANONICAL_TAXONOMY.find(t => t.code === 'HPC')!;
  if (query.includes('server')) return CANONICAL_TAXONOMY.find(t => t.code === 'HSV')!;
  if (query.includes('workstation')) return CANONICAL_TAXONOMY.find(t => t.code === 'HWS')!;
  if (query.includes('monitor') || query.includes('display')) return CANONICAL_TAXONOMY.find(t => t.code === 'HMON')!;
  if (query.includes('printer')) return CANONICAL_TAXONOMY.find(t => t.code === 'HPRN')!;
  if (query.includes('scanner')) return CANONICAL_TAXONOMY.find(t => t.code === 'HSCN')!;
  if (query.includes('network') || query.includes('switch') || query.includes('router')) return CANONICAL_TAXONOMY.find(t => t.code === 'HNET')!;
  if (query.includes('firewall')) return CANONICAL_TAXONOMY.find(t => t.code === 'HFW')!;
  if (query.includes('storage') || query.includes('nas') || query.includes('san')) return CANONICAL_TAXONOMY.find(t => t.code === 'HSTG')!;
  if (query.includes('ups')) return CANONICAL_TAXONOMY.find(t => t.code === 'HUPS')!;
  if (query.includes('rack')) return CANONICAL_TAXONOMY.find(t => t.code === 'HRCK')!;
  if (query.includes('license') || query.includes('lisensi') || query.includes('saas') || query.includes('software') || query.includes('it-s') || query.includes('slic')) {
    return CANONICAL_TAXONOMY.find(t => t.code === 'SLIC')!;
  }
  if (query.includes('furniture') || query.includes('kursi') || query.includes('meja') || query.includes('lemari') || query.includes('inv-f')) {
    return CANONICAL_TAXONOMY.find(t => t.code === 'INV-F')!;
  }
  if (query.includes('kompor') || query.includes('dispenser') || query.includes('peralatan') || query.includes('perlengkapan') || query.includes('dapur') || query.includes('inv-p') || query.includes('apar') || query.includes('ac')) {
    return CANONICAL_TAXONOMY.find(t => t.code === 'INV-P')!;
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
    return CANONICAL_TAXONOMY.find(t => t.code === 'MSN-PIBC')!;
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
  if (query.includes('tanah') || query.includes('lahan') || query.includes('tnh')) return CANONICAL_TAXONOMY.find(t => t.code === 'TNH')!;
  if (query.includes('gedung') || query.includes('bangunan') || query.includes('gudang') || query.includes('bgn')) return CANONICAL_TAXONOMY.find(t => t.code === 'BGN')!;
  if (query.includes('lainnya') || query.includes('lny')) return CANONICAL_TAXONOMY.find(t => t.code === 'LNY')!;

  // Default fail-safe
  return CANONICAL_TAXONOMY.find(t => t.code === 'LNY')!;
}

