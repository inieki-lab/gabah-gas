/**
 * Authoritative category matching for the corporate asset inventory.
 * Prefer canonical category codes and asset numbers. Human-readable names
 * are only a legacy fallback when neither source carries a known code.
 */
export type AssetCategoryFilterRecord = {
  category_code?: string | null;
  category_type?: string | null;
  asset_number?: string | null;
  name?: string | null;
};

const CATEGORY_CODES: Record<string, readonly string[]> = {
  'IT-H': ['IT-H', 'HLT', 'HPC', 'HSV', 'HWS', 'HMON', 'HPRN', 'HSCN', 'HNET', 'HFW', 'HSTG', 'HUPS', 'HRCK'],
  'IT-S': ['IT-S', 'SLIC'],
  'INV-F': ['INV-F'],
  'INV-P': ['INV-P'],
  'KDR': ['KDR', 'KDR-SC'],
  'MSN': ['MSN', 'MSN-PIBC'],
  'BGN': ['BGN'],
  'TNH': ['TNH'],
  'LNY': ['LNY'],
};

const ALL_KNOWN_CODES = new Set(Object.values(CATEGORY_CODES).flat());
const ASSET_NUMBER_CODE = /-(HLT|HPC|HSV|HWS|HMON|HPRN|HSCN|HNET|HFW|HSTG|HUPS|HRCK|SLIC|INV-F|INV-P|KDR-SC|KDR|MSN-PIBC|MSN|BGN|TNH|LNY)-/i;

const LEGACY_NAME_PATTERNS: Record<string, RegExp> = {
  'IT-H': /\b(macbook|laptop|notebook|komputer|desktop|server|workstation|monitor|printer|scanner|switch|router|firewall|storage|nas|ups|rack)\b/i,
  'IT-S': /\b(lisensi|license|software|saas|erp|os)\b/i,
  'INV-F': /\b(meja|kursi|lemari|furniture|partisi)\b/i,
  'INV-P': /\b(kompor|dispenser|ac|apar|peralatan|perlengkapan|vacuum|toolkit)\b/i,
  'KDR': /\b(avanza|truk|motor|mobil|kendaraan)\b/i,
  'MSN': /\b(mesin|forklift|timbang|genset|milling|conveyor)\b/i,
  'BGN': /\b(gedung|gudang|bangunan)\b/i,
  'TNH': /\b(tanah|lahan)\b/i,
  'LNY': /$a/,
};

export function matchesAssetCategoryFilter(
  asset: AssetCategoryFilterRecord,
  selectedCategory: string,
): boolean {
  if (!selectedCategory || selectedCategory === 'ALL') return true;
  const allowedCodes = CATEGORY_CODES[selectedCategory];
  if (!allowedCodes) return true;

  const code = String(asset.category_code || '').trim().toUpperCase();
  if (code && ALL_KNOWN_CODES.has(code)) return allowedCodes.includes(code);

  const numberMatch = String(asset.asset_number || '').toUpperCase().match(ASSET_NUMBER_CODE);
  if (numberMatch) return allowedCodes.includes(numberMatch[1]);

  if (selectedCategory === 'IT-S' && String(asset.category_type || '') === 'License') return true;
  return LEGACY_NAME_PATTERNS[selectedCategory]?.test(String(asset.name || '')) ?? false;
}
