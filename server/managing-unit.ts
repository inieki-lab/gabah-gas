import { db, OrgUnit } from './db';

/**
 * T2B-1 — ASSET OWNERSHIP CORE MODEL
 *
 * owner_division   = legacy/canonical ownership domain (RBAC scope + asset
 *                    numbering) — TIDAK diubah oleh tahap ini.
 * managing_unit_id = unit operasional yang mengelola lifecycle aset;
 *                    relasi ke org_units.id (master hasil org-model refactor).
 *
 * Prinsip: Owner/Managing Unit ≠ Asset Location ≠ Custodian/PIC ≠ Category.
 * Backfill SELALU berbasis ownership (owner_division), TIDAK PERNAH lokasi.
 *
 * ATURAN DETERMINISTIK (harus dijaga sinkron dengan backfill SQL di
 * server/migrations/007_asset_managing_unit.sql):
 *   1. Unit dengan id persis `UNIT-{DIVISION}` dan division_code = DIVISION
 *      (unit level divisi: SC → UNIT-SC, PIBC → UNIT-PIBC).
 *   2. Jika tidak ada, tepat SATU unit dengan division_code = DIVISION
 *      (IT → UNIT-IT-MIS).
 *   3. Selain itu NULL — mapping ambigu TIDAK ditebak (contoh: GA memiliki dua
 *      kandidat UNIT-GA-SARPRAS & UNIT-GA-UMUM → unresolved, biarkan kosong).
 */

/** Resolusi managing unit untuk sebuah owner_division (ownership-based). */
export function resolveManagingUnitForOwnerDivision(
  ownerDivision: string | null | undefined,
  units: OrgUnit[] = db.orgUnits,
): string | null {
  if (!ownerDivision) return null;
  const div = String(ownerDivision).trim();
  if (!div) return null;
  const byExactId = units.find(u => u && u.id === `UNIT-${div}` && u.division_code === div);
  if (byExactId) return byExactId.id;
  const candidates = units.filter(u => u && u.division_code === div);
  if (candidates.length === 1) return candidates[0].id;
  return null;
}

/**
 * Validasi untuk create/update asset: unit harus terdaftar DAN aktif —
 * mengikuti aturan master org_units yang sudah dipakai untuk atribut user
 * (POST/PATCH /api/users). Melempar Error agar tertangkap sebagai 400.
 * Mengembalikan id ternormalisasi, atau null bila input kosong.
 */
export function validateManagingUnit(
  unitId: string | null | undefined,
  units: OrgUnit[] = db.orgUnits,
): string | null {
  const id = String(unitId || '').trim();
  if (!id) return null;
  if (!units.some(u => u && u.id === id && u.is_active)) {
    throw new Error(`Unit "${id}" tidak terdaftar atau sedang nonaktif.`);
  }
  return id;
}

export interface ManagingUnitBackfillStats {
  total: number;
  /** Aset yang belum punya nilai → diisi hasil resolusi ownership. */
  assigned: number;
  /** Hasil resolusi ambigu / sengaja kosong / referensi asing → null. */
  unresolved: number;
  /** Nilai eksplisit valid yang dipertahankan (tidak ditimpa). */
  preserved: number;
}

/**
 * Backfill idempoten untuk aset existing (JSON fallback & PostgreSQL blob):
 * - Field yang belum ada (undefined) → diisi hasil resolusi ownership-based.
 * - Nilai eksplisit valid → dipertahankan (tidak pernah ditimpa).
 * - null eksplisit → TIDAK diisi ulang (hasil ambigu / sengaja dikosongkan).
 * - Referensi asing/tidak dikenal → direset ke null agar tetap FK-valid.
 * TIDAK menyentuh owner_division, asset_number, location, atau field lain.
 */
export function normalizeAssetManagingUnits(): ManagingUnitBackfillStats {
  const units: OrgUnit[] = Array.isArray(db.orgUnits) ? db.orgUnits : [];
  const knownIds = new Set(units.filter(u => u && typeof u.id === 'string').map(u => u.id));
  const stats: ManagingUnitBackfillStats = { total: 0, assigned: 0, unresolved: 0, preserved: 0 };

  for (const a of db.assets as any[]) {
    if (!a) continue;
    stats.total++;
    const current = a.managing_unit_id;
    if (current === undefined) {
      const resolved = resolveManagingUnitForOwnerDivision(a.owner_division, units);
      a.managing_unit_id = resolved;
      if (resolved) stats.assigned++;
      else stats.unresolved++;
    } else if (current === null) {
      stats.unresolved++;
    } else if (typeof current === 'string' && knownIds.has(current)) {
      stats.preserved++;
    } else {
      a.managing_unit_id = null;
      stats.unresolved++;
    }
  }
  return stats;
}
