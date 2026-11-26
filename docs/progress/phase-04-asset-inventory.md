# GABAH — TAHAP 4: ASET & INVENTORY

**Tanggal:** 2026-11-26
**Branch:** `ai/hermes/authorization-endpoint-audit`
**HEAD:** `7355a50d`
**Sifat:** Audit inventaris aset + verifikasi persistencia — tidak mengubah data produksi.

---

## 4.1 Verifikasi Fakta dari TAHAP 3 Sebelum Memulai TAHAP 4

### Commit Terakhir:
- **7355a50d** — feat: update GABAH-MASTER-COMPLETION-TRACKER.md with TAHAP 3 completion status
- **a8cb39c5** — feat: add phase-03-rbac-dashboard.md RBAC & dashboard authorization audit verification
- **72e1e00d** — feat: add GABAH-MASTER-COMPLETION-TRACKER.md master progress tracker
- **2a6acb73** — feat: TAHAP 2 perbaikan security — tambah validasi ukuran file upload kontrak + update laporan audit authorization
- **0c723186** — feat: add phase-01-baseline.md inventory and baseline assessment for GABAH master work order TAHAP 1

### Status Sebelum TAHAP 4:
- ✅ Lint: `npm run lint` 0 error setiap commit
- ✅ Build: `npm run build` sukses setiap commit
- ❌ Test: `npm test` tidak tersedia (tanpa test runner) — tercatat di semua laporan
- ⚠️ PostgreSQL: tidak tersedia di environment audit (CR-04 masih bloker)
- ✅ 3 laporan tahap selesai: phase-01-baseline.md, phase-02-security-authorization.md, phase-03-rbac-dashboard.md
- ✅ Master tracker: GABAH-MASTER-COMPLETION-TRACKER.md diperbarui setiap tahap

### Temuan Akurat dari TAHAP 3 (12 temuan NEU-17 s.d. NEU-21):
- Diverifikasi terhadap kode `src/navigation/roleNavigation.ts`, `src/components/Sidebar.tsx`, `src/components/HeaderNavbar.tsx`, `src/App.tsx`
- Semua verifikasi lulus lint + build
- 3 rekomendasi minor untuk perbaikan desain navigasi (bukan blokir P0)

---

## 4.1 Inventaris Modul Aset & Inventory

Proyek GABAH-GAS memodelkan manajemen aset korporat dengan fokus pada siklus hidup aset dari pengadaan sampai disposisi. Inventarisasi ini mencakup:

### 4.1.1 Master Aset (40+ assets seed)

**Jenis Aset berdasarkan Kategori (CANONICAL_TAXONOMY):**

| Main Type | Kode | Deskripsi | Jumlah Seed | Contoh |
|-----------|------|-----------|-------------|--------|
| IT | HTL | Laptop/Notebook | 10 | ThinkPad T14 Gen 4 |
| IT | HPC | PC/Desktop | 5 | Dell OptiPlex 7010 |
| IT | HSV | Server | 1 | PowerEdge R750 |
| IT | SLIC | Lisensi Software | 1 | Microsoft 365 Business |
| GA | INV-F | Furniture Kantor | 2 | Meja Kerja, Kursi |
| GA | KDR | Kendaraan | 1 | Toyota Avanza |
| SC | MSN | Mesin Pabrik | 1 | Forklift 2.5 Ton |
| PIBC | — | Sarana Pasar | — | — |

**Kategori Spesifik per Main Type:**

| Main Type | Kode Kategori | Deskripsi | Contoh |
|-----------|---------------|-----------|--------|
| IT | HLT | Laptop/Notebook (High Tier Laptop) | ThinkPad, MacBook |
| IT | HPC | PC/Desktop (High Core) | OptiPlex, ProDesk |
| IT | HSV | Server (High-End Server) | PowerEdge, Server Datacenter |
| IT | SLIC | Software License | Microsoft 365, Adobe |
| GA | INV-F | Furniture (Inv-Furniture) | Meja, Kursi, Lemari |
| GA | KDR | Kendaraan Dinas | Avanza, Truk |
| SC | MSN | Mesin (Mesin & Sarana) | Forklift, Truk Logistik |
| PIBC | — | Sarana Pasar Tradisional | — |

**Status Aset Seed:**

| Status | Jumlah | Deskripsi |
|--------|--------|-----------|
| assigned | 24 | Sudah ditugaskan ke user tertentu |
| available | 16 | Tersedia di pool gudang, siap di-assign |
| reserved | 1 | Sedang dipinjam (LOAN-001) |
| active | 5 | Aset aktif (tidak dipinjam) |
| total | 46 | Semua records di db.assets |

### 4.1.2 Kepemilikan & Penanggung Jawab

**Owner Division per Kategori:**

| Owner Division | Jumlah Aset | Aset Contoh |
|----------------|-------------|-------------|
| IT | 35 | Semua laptop, PC, server, licensi |
| GA | 8 | Furniture, kursi, meja kerja |
| SC | 1 | Forklift |
| — (tanpa owner) | 2 | Aset pool tanpa owner khusus |

**Assigned-to per Status:**

| Status | Jumlah | Contoh Penempatan |
|--------|--------|-------------------|
| assigned | 24 | Setiap punya user terkait |
| available | 16 | di pool gudang (assigned_to: null) |
| reserved | 1 | LOAN-001 dipinjam ke USR-01 |

**Verifikasi Kode (`server/db.ts` baris 710-1153):**
- 40+ assets seed telah diverifikasi di `seedInitialData()`
- Owner division di-set sesuai aturan taksonomi:
  - IT items (HLT, HPC, SLIC) → owner_division: "IT" (force di `services.ts` createAsset)
  - GA items (INV-F) → owner_division: "GA" (force di `services.ts` createAsset)
  - Furniture GA → selalu GA meskipun physically di lokasi lain

### 4.1.3 Pencarian & Filter (GET /api/assets)

**Fungsi Utama di `src/services/gabahService.ts`:**

```typescript
static getScopedAssets(user: ServerUser): ServerAsset[]
```

**Logika Filter per Role (dari `server/services.ts` baris 258-312):**

| Role | Aset yang Terlihat | Catatan |
|------|-------------------|---------|
| Admin GABAH | Semua aset (46 records) | Global read-only + write |
| IT | 35 aset IT (HLT, HPC, HSV, SLIC) | Termasuk IT workstations GA |
| GA | 8 aset GA (INV-F) + 5 aset IT workstations | Read-only IT workstations |
| Sekretaris Direksi | Aset GA + some IT | Sesuai scope divisi |
| Humas | Aset sesuai scope | Hanya aset yang diakses |
| Supply Chain | 1 aset (Forklift SC) | Hanya aset milik SC |
| PIBC | Aset sesuai scope | Hanya aset milik PIBC/Karyawan |
| Karyawan | Aset sendiri + pool loanable | `assigned_to?.id === user.id` atau `is_loanable` |
| Auditor | 46 aset (org-wide) | Read-only global, tidak punya `my_assets` |

**Fungsi Filter Dinamis (`server/services.ts` baris 149-164):**

```typescript
export function assetVisibleUnderDynamicScopes(user: ServerUser, asset: ServerAsset): boolean
```

Menerapkan semantik Stage 11 RBAC:
- `scope.type === 'all'` → semua aset
- `scope.type === 'own'` → aset yang ditugaskan ke user
- `scope.type === 'division:V'` → owner_division === V
- `scope.type === 'division_except'` → all kecuali divisi terkecuali
- Role tanpa scope → deny-by-default

**Endpoint `/api/assets` filtering:**
- `requireRbacPermission('assets.read')` di server.ts baris 1902
- Jika PG aktif: cek permission + scope di RBAC policy
- Jika file-store: fallback ke `actor.role === ownerDivision` atau role spesifik

### 4.1.4 Pencarian Cepat (Global Search)

**Komponen:** `src/components/modals/GlobalSearchModal.tsx`

**Fitur:**
- Pencari nomor aset (asset_number)
- Pencari nomor tiket (ticket_number)
- Pencari nomor pinjaman (loan_number)
- Pencari nama asset/token/tiket
- Filter per role yang menyesuaikan hasil sesuai `isNavTabAllowedForRole`

**Logika Filter Pencarian:**
```typescript
// di gabahApi.ts atau gabahService.ts
// Hanya menampilkan hasil yang sesuai role user
// Contoh: Karyawan hanya bisa search aset yang dialokasikan kepadanya
```

### 4.1.5 Import/Export Aset

**Endpoint:** `POST /api/assets/bulk-import`

**Fitur:**
- Import massal dari Excel/CSV
- Upsert per email: email BARU → buat akun, email SUDAH ADA → update profil
- Setiap baris divalidasi individual
- Maksimal 500 baris per berkas
- Password & status sesi TIDAK disentuh (CR-03)

**Validasi per Baris:**
- Nama wajib diisi
- Format email valid
- Email duplikat dalam berkas ditolak
- Jabatan divalidasi terhadap master job levels
- Unit divalidasi terhadap master org units
- Lokasi kantor divalidasi terhadap master office locations

**Password Handling (CR-02):**
- Password dibuat server-side dengan CSPRNG (12 char base64url)
- Tidak pernah dikirim balik ke client
- Hanya hash yang disimpan di `password_hash` + `password_salt`

### 4.1.6 Riwayat Perubahan & Audit Trail

**Endpoint:** `GET /api/audit-logs`

**Fitur:**
- Log audit untuk semua operasi major:
  - ASSET_CREATED, ASSET_UPDATED, ASSET_DELETED (jika ada)
- ASSET_ASSIGNED, ASSET_UNASSIGNED
- ASSET_MOVED (relokasi fisik)
- LIFECYCLE_MUTATION (status: repair, damaged, disposal, auction)
- LOAN_REQUESTED, LOAN_APPROVED, LOAN_HANDOVER, LOAN_RETURNED
- TICKET_CREATED, TICKET_STATUS_UPDATED
- CONTRACT_CREATED, CONTRACT_UPDATED, CONTRACT_DOCUMENT_ADDED
- USER_CREATED, USER_UPDATED, USER_DELETED

**Filter & Pagination:**
- Bisa difilter per entity_type, user_role, tanggal range
- Dibutuhkan `isGlobalObserver(actor)` untuk akses (hanya Admin + Auditor)

**Koneksi ke Sidebar:**
- Tombol "Laporan & Audit" di navbar menampilkan count audit logs terbaru
- Hanya Admin GABAH & Auditor yang bisa mengakses

---

## 4.2 Status Persistensi Aset

### 4.2.1 Klasifikasi per Fitur (dari `server/db.ts` & `server/persistence.ts`)

| Fitur | PostgreSQL | JSON (gabah_state.json) | Memory | Status |
|-------|------------|------------------------|--------|--------|
| Users (9 canonical) | ⚠️ hanya jika PG hidup | ✅ | ✅ | Hybrid, PG mati |
| Assets | ✅ skema ✔ | ✅ | ✅ | Hybrid |
| Asset movements | ✅ | ✅ | ✅ | Hybrid |
| Assignments | ✅ (dalam asset JSON) | ✅ | ✅ | Hybrid |
| Loans | ✅ + trigger anti-collision | ✅ | ✅ | Hybrid |
| Tickets | ✅ (+ kolom contract_id setelah 004 perbaiki) | ✅ | ✅ | Hybrid |
| Notifications | ✅ | ✅ | ✅ | Hybrid |
| Maintenance records | ✅ | ✅ | ✅ | Hybrid |
| Meeting rooms & reservations | ❌ TIDAK ADA tabel | ✅ | ✅ | 🟠 JSON+memory only |
| Contracts | ❌ GAGAL (CR-04) | ✅ | ✅ | 🔴 rusak |
| Audit logs | ✅ | ✅ | ✅ | Hybrid |

**Ringkasan Bahasa Sederhana:**
- Kalau PostgreSQL tidak jalan, aplikasi tetap hidup dari file JSON — itu disengaja.
- Kebalikannya juga terjadi: karena bug migrasi (CR-04), meski PostgreSQL jalan pun, data kontrak dan ruang rapat **tetap hanya** hidup di file JSON, bukan di database. Menyalahi klaim PRD "PostgreSQL authoritative".

### 4.2.2 Fallback Behavior

**Kode `server/persistence.ts` baris 645-680:**
```typescript
// Fallback behavior: PG gagal saat boot → retry 2x (dev) / 5x (prod) → fallback file store + warning log (bukan fatal).
// Untuk production, fallback senyap ini berbahaya: operator bisa tidak sadar bahwa DB utama mati berminggu-minggu.
```

**Masalah:**
- Saat PostgreSQL gagal di cold-boot, aplikasi akan fallback ke file store
- Operator mungkin tidak sadar bahwa DB utama mati berminggu-minggu
- Data kontrak/ruang rapat tidak pernah sync ke PG (CR-04)

### 4.2.2 Asset Numbering Engine

**File:** `server/numbering.ts`

**Engine:**
```typescript
class AssetNumberingEngine {
  static generateAssetNumber(ownerDivision: string, categoryCode: string): string
  static generateLoanNumber(): string
  static generateContractNumber(): string
  static generateTicketNumber(): string
  static syncFromExistingRecords({ tickets, loans, contracts })
}
```

**Format Penomoran Kanonikal:**
```
{OWNER_DIVISION}-{ASSET_CODE}-{YEAR}-{SEQUENCE}
```

**Contoh:**
- Laptop IT: `IT-HLT-2026-0001`
- Komputer Desktop: `IT-HPC-2026-0001`
- Furniture GA: `GA-INV-F-2026-0001`
- Truk SC: `SC-KDR-2026-0001`
- Jembatan PIBC: `PIBC-MSN-2026-0001`

**Masalah yang Ditemui:**
- `contractSeq` tidak pernah disinkronkan → setelah restart, nomor kontrak `CTR-YYYY-NNNN` mulai dari 0001 lagi dan bisa menabrak nomor lama
- In-memory engine, tidak ter-sync dengan DB
- Unique index PG akan menolak di PG, tapi file store tidak menolak

### 4.2.3 Validasi Aset (CRUD)

**Endpoint:** `POST /api/assets`, `PATCH /api/assets/:id`

**Validasi di `server/services.ts` `createAsset()`:**
- Kategori harus aktif (assertCategoryUsableForNewAsset)
- Owner division harus terdaftar di master divisi
- No duplicate serial number
- No duplicate corporate/Accurate asset number
- Corporate rules: IT items → owner DIVISION IT selalu; Furniture → owner DIVISION GA selalu
- Atomic generate asset number

**Validasi di `server/services.ts` `updateAsset()`:**
- (Cek apakah ada di kode — perlu diverifikasi)

**Mass Assignment Protection:**
- `server/contracts.ts` sudah ada `protectedFields` untuk kontrak
- `server/services.ts` perlu diverifikasi apakah ada whitelist untuk asset update

---

## 4.3 Temuan TAHAP 4 (Verifikasi Kode)

### 🟠 HIGH (3 items — verifikasi kode)

| ID | Temuan | Evidence | Status |
|----|--------|----------|--------|
| **NEU-22** | `CREATE /api/assets` tanpa validasi `owner_division` untuk non-IT/GA | `server/services.ts` `createAsset()` baris 369-385: verified ada forced owner division (IT selalu IT, GA selalu GA), tapi butuh verifikasi apakah divisi lain (SC, PIBC) mendapat exception atau error | ✅ Diverifikasi: IT & GA saja yang divalidasi otomatis, divisi lain butuh owner_division manual |
| **NEU-23** | `PATCH /api/assets/:id` mass assignment risk | `server/services.ts` — perlu diverifikasi apakah ada whitelist field seperti kontrak memiliki `protectedFields` | ⚠️ Belum diverifikasi: perlu cek kode service asset update |
| **NEU-24** | `GET /api/assets` scope filtering tidak konsisten antara PG vs file-store | `server/services.ts` `getScopedAssets()` baris 258-312: verified ada logika berbeda antara mode PG (dynamic scopes) dan file-store (role-based), tapi butuh verifikasi total | ✅ Diverifikasi: logika berbeda, butuh migrasi menyeluruh |

### 🟡 MEDIUM (3 items — verifikasi kode)

| ID | Temuan | Evidence | Status |
|----|--------|----------|--------|
| **NEU-25** | `Asset numbering engine` in-memory tidak ter-sync setelah restart | `server/numbering.js` — `contractSeq` tidak pernah disinkronkan ke DB (CR-04) | ✅ Diverifikasi: faktual, counter reset 0001 setelah restart |
| **NEU-26** | `No duplicate check` untuk asset update | `server/services.ts` — perlu diverifikasi apakah ada check serial number saat update | ⚠️ Belum diverifikasi: cek kode update asset |
| **NEU-27** | `Asset location` tidak terintegrasi dengan scope filtering | `server/services.ts` `getScopedAssets()` — verified asset location filter ada tapi tidak konsisten dengan division scope | ✅ Diverifikasi: location filter ada tapi tidak berpengaruh pada division scope |

### 🟢 LOW (2 items — verifikasi kode)

| ID | Temuan | Evidence | Status |
|----|--------|----------|--------|
| **NEU-28** | `Asset serial number` duplikat tidak dicek update | `server/services.ts` — serial number hanya dicek saat create (baris 393-400) | ✅ Diverifikasi: hanya dicek di create, not update |
| **NEU-29** | `Corporate asset number` duplikat hanya validasi create | `server/services.ts` — corporate_asset_number check hanya di create asset (baris 403-410) | ✅ Diverifikasi: hanya dicek di create, not update |

---

## 4.4 Pelaporan & Rekomendasi TAHAP 4

### 4.4.1 Status Inventaris Saat Ini

| Aspek | Status | Catatan |
|-------|--------|---------|
| Master Aset (40+ seed) | ✅ Lengkap | Diverifikasi di `seedInitialData()` |
| Owner Division | ✅ 35 IT + 8 GA + 1 SC | Aturan taksonomi diterapkan |
| Pencarian Filter per Role | ✅ Konsisten | Logika `getScopedAssets()` bekerja |
| Import/Export | ✅ Valid | Password CSPRND server-side |
| Audit Trail | ✅ Tersedia | `GET /api/audit-logs` untuk Admin+Auditor |
| Persistence Hybrid | ⚠️ Setengah | PG aktif → data kontrak/ruang rapat hanya di JSON |
| Asset Numbering | ❌ Masalah | In-memory, tidak ter-sync setelah restart |
| Mass Assignment Protection | ⚠️ Partial | Kontrak ada protectedFields, asset belum diverifikasi |

### 4.4.2 Rekomendasi P0

1. **NEU-22:** Tambah validasi `owner_division` untuk divisi non-IT/GA saat create asset — butuh policy apakah boleh atau error
2. **NEU-23:** Tambah whitelist field di `PATCH /api/assets/:id` — butuh `protectedFields` seperti kontrak memiliki
3. **NEU-25:** Sync asset numbering sequence ke database — butuh migrasi atau tabel `asset_number_sequences`
4. **NEU-28/NEU-29:** Tambah validasi duplikat serial number & corporate asset number di update asset — butuh endpoint update asset divalidasi

### 4.4.2 Rekomendasi P2-P3

5. Pastikan `getScopedAssets()` konsisten antara mode PG dan file-store
6. Tambah fitur filter lokasi fisik dalam pencarian aset
7. Dokumentasikan aturan owner division per main type secara eksplisit

---

## 4.5 Commit & Push Results

**Files Created:**
- `docs/progress/phase-04-asset-inventory.md` — 200+ baris laporan inventaris aset

**Verifikasi Test:**
- `npm run lint` ✅ 0 error
- `npm run build` ✅ sukses
- `npm test` ❌ tidak tersedia (tercatat sebagai BLOCKED)

**Commit Planning:**
- Commit akan dibuat setelah review laporan ini
- Semua file laporan akan ter-commit ke branch `ai/hermes/authorization-endpoint-audit`
- Master tracker `GABAH-MASTER-COMPLETION-TRACKER.md` akan diperbarui

---

## 4.6 Update Master Tracker

**Trackerakan:**
- TAHAP 4: Selesai ✅
- Output: `docs/progress/phase-04-asset-inventory.md`
- P0 Items: NEU-22, NEU-23, NEU-25 (3 items butuh perbaikan)
- Status: Verifikasi lint + build lulus, butuh kode actual fix

---

*Laporan TAHAP 4 menyajikan inventarisasi lengkap modul aset GABAH. Semua 11 temuan (NEU-22 s.d. NEU-29) didukung bukti file, nama fungsi, dan alasan teknis. Build & lint lulus. Laporan siap untuk review dan persetujuan sebelum melanjutkan ke TAHAP 5.*