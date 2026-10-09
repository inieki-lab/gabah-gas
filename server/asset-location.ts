import { db, AssetLocation } from './db';

/**
 * T2B-2 — ASSET LOCATION MASTER
 *
 * Master lokasi fisik aset yang TERPISAH dari:
 *   - org_office_locations (lokasi kantor/penempatan user), dan
 *   - managing_unit_id (unit operasional pengelola lifecycle aset, T2B-1).
 *
 * Prinsip: lokasi fisik ≠ owner_division ≠ managing unit ≠ custodian/PIC.
 * Perubahan lokasi TIDAK PERNAH menyentuh owner_division, managing_unit_id,
 * asset_number, maupun corporate_asset_number.
 *
 * Hierarki sederhana: asset_locations.parent_id (self-reference). Guard:
 * lokasi tidak boleh menjadi parent dirinya sendiri maupun membentuk siklus.
 *
 * BACKFILL deterministik (harus sinkron dengan backfill SQL di
 * server/migrations/008_asset_location_master.sql): teks legacy `location`
 * aset dipetakan ke master HANYA bila cocok persis (setelah normalisasi
 * spasi/kapital) dengan path lengkap lokasi ("Induk - Anak - ...") dan
 * cocokannya UNIK. Ambigu/tidak dikenal → NULL (jangan menebak, jangan
 * membuat lokasi palsu).
 */

/** Normalisasi teks untuk perbandingan deterministik (spasi + kapital). */
export function normalizeLocationText(text: string | null | undefined): string {
  return String(text || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Path tampilan lengkap sebuah lokasi: "Induk - Anak" (root: nama saja). */
export function getAssetLocationPath(
  location: AssetLocation,
  all: AssetLocation[] = db.assetLocations,
): string {
  const byId = new Map(all.filter(Boolean).map(l => [l.id, l]));
  const parts: string[] = [location.name];
  let cursor = location.parent_id ? byId.get(location.parent_id) : undefined;
  // Guard lemah terhadap data korup: rantai parent berhenti pada kedalaman 16.
  for (let depth = 0; cursor && depth < 16; depth++) {
    parts.unshift(cursor.name);
    cursor = cursor.parent_id ? byId.get(cursor.parent_id) : undefined;
  }
  return parts.join(' - ');
}

/**
 * Resolusi deterministik teks legacy → id master. Mengembalikan id hanya
 * bila cocokan path UNIK; tidak cocok / ambigu → null (tidak menebak).
 */
export function resolveAssetLocationIdByText(
  text: string | null | undefined,
  all: AssetLocation[] = db.assetLocations,
): string | null {
  const needle = normalizeLocationText(text);
  if (!needle) return null;
  const matches = all.filter(l => l && normalizeLocationText(getAssetLocationPath(l, all)) === needle);
  return matches.length === 1 ? matches[0].id : null;
}

/**
 * Validasi untuk create/update asset: lokasi harus terdaftar; lokasi nonaktif
 * TIDAK dapat ditetapkan sebagai nilai BARU (kecuali mempertahankan nilai yang
 * sudah melekat pada aset — kompatibilitas data historis). Melempar Error
 * agar tertangkap sebagai 400. Mengembalikan id ternormalisasi, atau null
 * bila input kosong.
 */
export function validateAssetLocation(
  locationId: string | null | undefined,
  all: AssetLocation[] = db.assetLocations,
  currentId?: string | null,
): string | null {
  const id = String(locationId || '').trim();
  if (!id) return null;
  const loc = all.find(l => l && l.id === id);
  if (!loc) {
    throw new Error(`Lokasi fisik "${id}" tidak terdaftar pada master lokasi aset.`);
  }
  if (!loc.is_active && id !== (currentId ?? null)) {
    throw new Error(`Lokasi fisik "${loc.name}" sedang nonaktif dan tidak dapat dipilih untuk perubahan baru.`);
  }
  return id;
}

/**
 * Guard hierarki: menolak parent diri sendiri maupun siklus (parent tersebut
 * merupakan keturunan dari `locationId`). Melempar Error → 400.
 */
export function assertValidLocationParent(
  locationId: string,
  parentId: string | null | undefined,
  all: AssetLocation[] = db.assetLocations,
): void {
  const pid = String(parentId || '').trim();
  if (!pid) return; // root — selalu valid
  if (pid === locationId) {
    throw new Error('Lokasi tidak boleh menjadi induk bagi dirinya sendiri.');
  }
  const byId = new Map(all.filter(Boolean).map(l => [l.id, l]));
  let cursor = byId.get(pid);
  for (let depth = 0; cursor && depth < 16; depth++) {
    if (cursor.id === locationId) {
      throw new Error('Parent lokasi membentuk siklus hierarki dan ditolak.');
    }
    cursor = cursor.parent_id ? byId.get(cursor.parent_id) : undefined;
  }
}

export interface AssetLocationBackfillStats {
  total: number;
  /** Aset tanpa relasi (undefined) → diisi bila teks legacy cocok unik. */
  assigned: number;
  /** Tanpa relasi dan teks tidak cocok unik / null eksplisit / referensi asing. */
  unresolved: number;
  /** Relasi eksplisit valid yang dipertahankan (tidak ditimpa). */
  preserved: number;
}

/**
 * Backfill idempoten untuk aset existing (JSON fallback & blob PostgreSQL):
 * - Relasi belum ada (undefined) → resolusi deterministik dari teks `location`.
 * - Relasi eksplisit valid → dipertahankan (tidak pernah ditimpa).
 * - null eksplisit → TIDAK diisi ulang.
 * - Referensi asing/tidak dikenal → direset ke null agar tetap FK-valid.
 * TIDAK menyentuh owner_division, managing_unit_id, asset_number,
 * corporate_asset_number, maupun teks `location`.
 */
export function normalizeAssetAssetLocations(): AssetLocationBackfillStats {
  const locations: AssetLocation[] = Array.isArray(db.assetLocations) ? db.assetLocations : [];
  const knownIds = new Set(locations.filter(l => l && typeof l.id === 'string').map(l => l.id));
  const stats: AssetLocationBackfillStats = { total: 0, assigned: 0, unresolved: 0, preserved: 0 };

  for (const a of db.assets as any[]) {
    if (!a) continue;
    stats.total++;
    const current = a.asset_location_id;
    if (current === undefined) {
      const resolved = resolveAssetLocationIdByText(a.location, locations);
      a.asset_location_id = resolved;
      if (resolved) stats.assigned++;
      else stats.unresolved++;
    } else if (current === null) {
      stats.unresolved++;
    } else if (typeof current === 'string' && knownIds.has(current)) {
      stats.preserved++;
    } else {
      a.asset_location_id = null;
      stats.unresolved++;
    }
  }
  return stats;
}
