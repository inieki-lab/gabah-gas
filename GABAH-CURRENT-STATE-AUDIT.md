# GABAH REPOSITORY AUDIT: CURRENT STATE & ARCHITECTURAL CONFLICT ANALYSIS
**Date:** 2026-09-10  
**Audit Mode:** READ-ONLY (No code modified, no migrations executed, no features added)  
**Target Repository:** GABAH Enterprise Portal (PT Food Station Tjipinang Jaya Perseroda)

---

## 1. Executive Summary

Audit ini memetakan kondisi aktual arsitektur repository **GABAH**. Repository saat ini berada dalam kondisi **Dual-Architecture Disconnect**:
1. **Frontend Application (Active Runtime):** Aplikasi React 19 + Vite 6 + Tailwind CSS v4 yang berjalan di port 3000. Seluruh state disimpan di **Client-side Memory** dan **Browser `localStorage`**, disimulasikan dari `src/data/mockData.ts`.
2. **Backend Application (Isolated Spec / Archive):** Kerangka aplikasi Laravel 11 + PostgreSQL di subfolder `/opt/gabah/` yang dilengkapi skema database, Eloquent models, controllers, services, dan Spatie permission. **Aplikasi frontend saat ini sama sekali tidak melakukan HTTP fetch ke backend Laravel ini.**
3. **Kesenjangan Peran (RBAC Gap):** Terdapat perbedaan signifikan antara 9 peran operasional yang ditargetkan (Management, Admin GABAH, IT, GA, Supply Chain, PIBC, Karyawan, Auditor, Vendor) dengan implementasi aktual pada frontend (hanya 5 peran) dan backend Laravel (hanya 7 peran).

---

## 2. Peta Arsitektur Aktual (Frontend vs Backend)

```
+------------------------------------------------------------------------------------+
|                                REPOSITORY ROOT                                     |
+------------------------------------------------------------------------------------+
       |                                                            |
       v                                                            v
[ RUNTIME AKTIF: FRONTEND ]                              [ TERISOLIR: BACKEND ]
Location: /src                                           Location: /opt/gabah
Runtime : Node.js 20 / Vite 6                            Framework: Laravel 11 / PHP 8.3
Port    : 3000 (Cloud Run Container)                     Database : PostgreSQL 17 (Spec)
State   : React useState + localStorage                  ORM      : Eloquent + DB Transactions
API Calls: NONE (Semua logic lokal di browser)           API      : routes/api.php (Belum dikonsumsi)
```

### 2.1 File & Layer Mapping
* **Frontend Runtime:**
  * `src/App.tsx`: Mengelola seluruh root state (`assets`, `loans`, `tickets`, `auditLogs`, `currentUser`).
  * `src/services/gabahService.ts`: Meniru (mirroring) business logic nomor aset, collision check, SLA, dan RBAC matrix.
  * `src/data/mockData.ts`: Menyimpan data awal untuk user, aset, tiket, vendor, dan artikel SOP.
* **Backend Skeleton (`/opt/gabah`):**
  * `database/migrations/`: 11 file migration PostgreSQL.
  * `app/Services/`: `AssetNumberingService`, `LoanReservationService`, `TicketSlaService`, `AssetService`, `AuditLogService`.
  * `routes/api.php`: Rute API Sanctum (`/api/assets`, `/api/loans`, `/api/tickets`).
  * `docker-compose.yml`: Mendefinisikan service `database` (Postgres 17) dan `app` (Node.js serve dist). Namun, service PHP-FPM / Laravel Nginx **tidak ada** dalam file `docker-compose.yml` ini!

---

## 3. Konflik Arsitektur Utama

### 3.1 Konflik Persistence (State vs Database)
* **Kondisi Aktual Frontend:**
  * Penyimpanan murni berbasis `localStorage` dengan key: `gabah_assets`, `gabah_loans`, `gabah_tickets`, `gabah_audit_logs`.
  * Jika cache browser dibersihkan, data pengguna kembali ke `INITIAL_ASSETS` di `src/data/mockData.ts`.
  * Perubahan data tidak bersifat multi-user. Seorang admin tidak dapat melihat peminjaman yang diajukan oleh user di perangkat lain secara real-time.
* **Kondisi Aktual Backend:**
  * Backend Laravel memiliki skema PostgreSQL lengkap dengan foreign key constraints, pessimistic lock (`lockForUpdate()`), dan database transactions (`DB::transaction`).
  * **Titik Konflik:** Tidak ada API client (`axios` / `fetch` wrapper) di frontend yang mengarah ke `/api/*`. Frontend berjalan 100% offline-first/mock.

### 3.2 Konflik User, Role & Access Control (RBAC)

Perbandingan antara **Target Spesifikasi Baru**, **Kondisi Aktual Frontend**, dan **Kondisi Aktual Backend Laravel**:

| User / Role (Target Baru) | Tanggung Jawab / Kemampuan Target | Status Aktual di Frontend (`src/types.ts`) | Status Aktual di Backend (`DatabaseSeeder.php`) | Kesenjangan / Konflik Arsitektur |
| :--- | :--- | :--- | :--- | :--- |
| **Management** | Melihat dashboard, laporan, approval | ❌ **Tidak ada** (Hanya ada `super_admin`) | ❌ **Tidak ada** | Direksi/Manajemen saat ini terpaksa memakai akun `super_admin` yang memiliki akses modifikasi teknis berlebih. |
| **Admin GABAH** | Mengatur hampir seluruh sistem | ⚠️ Dinamai `super_admin` | ⚠️ Dinamai `Super Admin` | Istilah peran belum selaras dengan tata kelola enterprise BUMD GABAH. |
| **IT** | Mengelola aset IT, helpdesk, maintenance | ⚠️ `it_admin` & `helpdesk_agent` | ⚠️ `IT Manager` & `IT Support` | Frontend memisahkan admin dan helpdesk agent; backend memisahkan Manager dan Support. Skema role tidak sinkron. |
| **GA** | Mengelola aset GA / furniture / kendaraan | ⚠️ `ga_admin` | ⚠️ `GA` & `GA Staff` | Di frontend, GA Admin menangani operasional sekaligus approval; di backend terpisah menjadi GA & GA Staff. |
| **Supply Chain** | Mengelola aset tanggung jawab SC | ❌ **Tidak ada** sama sekali | ❌ **Tidak ada** sama sekali | Aset logistik dan inventaris gudang Food Station belum memiliki kepemilikan peran khusus. |
| **PIBC** | Mengelola aset tanggung jawab Pasar Induk Beras Cipinang | ❌ **Tidak ada** sama sekali | ❌ **Tidak ada** sama sekali | Wilayah operasional khusus PIBC belum memiliki segmentasi peran terisolasi. |
| **Karyawan** | Melihat aset miliknya, membuat tiket & pinjam | ⚠️ Dinamai `employee` | ⚠️ Dinamai `User` | Naming convention tidak konsisten antara UI (`employee`) dan DB seeder (`User`). |
| **Auditor** | Melihat data & audit trail (read-only) | ❌ **Tidak ada di UI** (Hanya `super_admin` yang bisa lihat Audit) | ⚠️ Ada di seeder `Auditor`, tapi belum ada policy khusus | Di frontend, tab Audit Log terkunci di dalam `DashboardView` hanya untuk `super_admin`. Tidak ada mode auditor read-only. |
| **Vendor** | Akses terbatas rekanan (rekanan/kontrak) | ❌ **Tidak ada** (Hanya ada tabel data `Vendor`, bukan user role login) | ❌ **Tidak ada** user role vendor | Entitas `Vendor` di frontend dan backend hanyalah master record pasif, bukan subjek autentikasi yang dapat login. |

### 3.3 Konflik Entitas Aset & Data Structure

Struktur data aset di Frontend dan Backend memiliki perbedaan penamaan kolom (*schema mismatch*):

| Field / Atribut | Frontend (`src/types.ts: Asset`) | Backend (`opt/gabah/database/...create_assets_table.php`) | Analisis Dampak |
| :--- | :--- | :--- | :--- |
| **ID** | `id: string` (UUID / Client string `AST-UUID-001`) | `id: bigIncrements` (Integer ID) | Serialisasi relasi `asset_id` pada Loans dan Tickets akan bertabrakan jika dihubungkan langsung. |
| **Nomor Aset Standar** | `astick_internal_number` | `asset_number` (Unique varchar 50) | Inkonsistensi penamaan atribut (*camelCase* vs *snake_case* dan penamaan field berbeda). |
| **Nomor Accurate/ERP** | `corporate_asset_number` | ❌ **Tidak ada di tabel `assets`** | Backend Laravel belum memiliki kolom untuk nomor barcode akuntansi korporat FST (`FST-24-XXXX`). |
| **Harga Beli** | `purchase_price: number` | `price: decimal(15,2)` | Beda nama field (`purchase_price` vs `price`). |
| **Masa Garansi** | `warranty_expiry: string` | `warranty_until: date` | Beda nama field (`warranty_expiry` vs `warranty_until`). |
| **PIC Lapangan** | `assigned_to?: { id, name, ... }` | `assigned_to (foreignId)` & `pic_id (foreignId)` | Frontend menyimpan denormalized object, backend menyimpan normalized relational ID. |
| **Kategori Aset** | `category_type: 'IT' \| 'General' \| 'License'` | `category_type: string` + `asset_category_id` (relasi) | Frontend memfilter aset berdasarkan string enum langsung tanpa tabel relasi `asset_categories`. |

### 3.4 Konflik Logika Penomoran Aset (Asset Numbering Engine)

Terdapat **dua implementasi penomoran aset** yang berjalan secara terpisah:

1. **Frontend (`src/services/gabahService.ts`):**
   * Format: `IT-{CATEGORY_CODE}-{YEAR}-{SEQUENCE}` (contoh: `IT-HLT-2026-0001`).
   * Menggunakan scanning in-memory array `assets`:
     ```ts
     for (const a of assets) {
       if (a.astick_internal_number.startsWith(prefix)) { ... maxSeq ... }
     }
     return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
     ```
   * **Kelemahan:** Jika dua tab/user membuka form bersamaan, akan menghasilkan nomor aset kembar (*race condition*).
2. **Backend (`opt/gabah/app/Services/AssetNumberingService.php`):**
   * Format sama: `IT-{CATEGORY_CODE}-{YEAR}-{SEQUENCE}`.
   * Menggunakan tabel sekuens `asset_number_sequences` dengan **Pessimistic Row-Level Locking**:
     ```php
     $sequence = AssetNumberSequence::where(...)->lockForUpdate()->first();
     $sequence->last_number += 1;
     $sequence->save();
     ```
   * **Kelemahan Integrasi:** Logic backend ini belum pernah dipanggil oleh form pendaftaran aset di frontend (`CreateAssetModal.tsx`).

### 3.5 Duplikasi Business Logic (Duplicate Logic Divergence)

Terdapat 3 domain logika bisnis yang diduplikasi di dua ekosistem:

1. **Anti-Collision Engine (Peminjaman Aset):**
   * *Frontend (`gabahService.ts:128`):* Menghitung overlap waktu JavaScript `(StartA < EndB && EndA > StartB)` terhadap array `loans`.
   * *Backend (`LoanReservationService.php:29`):* Menjalankan query SQL Eloquent dengan `where('loan_date', '<', $endDate)->where('due_date', '>', $startDate)` dengan lock row aset.
   * *Risiko:* Perbedaan zona waktu (UTC ISO String vs Carbon timezone aplikasi) dapat menimbulkan ketidaksesuaian status bentrok.
2. **SLA Deadlines Engine (Helpdesk Tickets):**
   * *Frontend (`gabahService.ts:173`):* Menghitung SLA resolusi saja (Urgent: 4 jam, High: 8 jam, Medium: 24 jam, Low: 48 jam).
   * *Backend (`TicketSlaService.php:23`):* Menghitung **dua** deadline terpisah: SLA Respon Pertama (Urgent: 1 jam, High: 2 jam, Medium: 4 jam, Low: 8 jam) dan SLA Resolusi Tiket.
   * *Konflik:* Form tiket di UI tidak menampilkan atau memvalidasi SLA Respon Pertama yang diwajibkan oleh backend service.
3. **Pemberian Izin Approval Aset (RBAC Logic):**
   * *Frontend:* Ditentukan via fungsi statis `GabahService.canApproveLoan()` dan `canManageAsset()`.
   * *Backend:* Ditentukan via Laravel Gates / Policy `AssetPolicy.php` dan Spatie Permission.
   * *Konflik:* Aturan frontend bersifat hardcoded untuk 5 role, mengabaikan permission dinamis yang dimiliki user di backend.

---

## 4. Evaluasi Terhadap 9 Target Peran Pengguna

Berdasarkan permintaan struktur baru:
1. **Management**: Memerlukan dashboard eksekutif read-only, ringkasan laporan keuangan/penyusutan, serta hak approval lintas divisi (IT, GA, SC, PIBC). Saat ini modul approval terkunci pada role admin masing-masing kategori.
2. **Admin GABAH**: Pengganti peran `super_admin`. Harus memiliki akses menyeluruh termasuk konfigurasi kategori, audit trail, dan manajemen akun.
3. **IT**: Khusus mengelola aset kategori `IT` dan `License`, helpdesk tiket IT, serta jadwal maintenance IT.
4. **GA**: Khusus mengelola aset kategori `General` (kendaraan operasional, furniture, AC, fasilitas gedung) dan approval peminjaman GA.
5. **Supply Chain (Baru)**: Perlu kategori aset baru atau penanda kepemilikan aset logistik/distribusi (misal: forklift, pallet, rak gudang, timbangan digital beras).
6. **PIBC (Baru)**: Perlu segmentasi aset fasilitas Pasar Induk Beras Cipinang (misal: pos timbang, portal gerbang, CCTV kawasan, mesin jahit karung).
7. **Karyawan**: Pengguna biasa yang hanya dapat melihat aset yang ditugaskan kepadanya (`assigned_to == currentUser.id`), membuat permohonan peminjaman, dan membuat tiket gangguan.
8. **Auditor (Baru)**: Memerlukan akses *Read-Only* ke seluruh aset, audit trail (`AuditLog`), riwayat BAST peminjaman, dan laporan SLA tanpa tombol tambah/edit/hapus.
9. **Vendor (Baru)**: Akun akses terbatas untuk pihak ketiga rekanan (misal: teknisi AC atau vendor sewa laptop) untuk memperbarui status tiket maintenance yang ditugaskan kepada mereka.

---

## 5. Ringkasan Temuan & Rekomendasi Roadmap

1. **Arsitektur Saat Ini:** Aplikasi berjalan sebagai Single Page Application (SPA) React yang terisolasi dengan mock state di `localStorage`. Backend Laravel di `/opt/gabah` merupakan spesifikasi cetak biru arsitektural yang belum terhubung lewat REST API.
2. **Struktur Model & RBAC:** Penambahan 4 peran baru (`Management`, `Supply Chain`, `PIBC`, `Auditor`) dan relasi kepemilikan aset divisi perlu diperluas pada type definition frontend (`src/types.ts`) dan seeder backend (`DatabaseSeeder.php`).
3. **Penyelarasan Kolom Aset:** Perlu penyesuaian penamaan atribut antara UI (`astick_internal_number`, `corporate_asset_number`, `purchase_price`) dengan tabel database backend agar proses sinkronisasi tidak mengalami kehilangan data (*data loss*).
4. **Audit Status:** Laporan ini telah disimpan pada file `GABAH-CURRENT-STATE-AUDIT.md`.

---

## 6. ADDENDUM AUDIT & STATUS IMPLEMENTASI (2026-09-22)

Pembaruan operasional dan penyelesaian masalah arsitektur per 22 September 2026:
1. **Perbaikan Keamanan Autentikasi:**
   - Celah auth-bypass superadmin tanpa token dan impersonasi via header `x-user-id` pada `server/auth.ts` telah ditutup.
   - Sinkronisasi kredensial superadmin ke `admin@foodstation.co.id` / `AdminGabah#2026`.
2. **Sinkronisasi User Management & 9 Peran:**
   - Seluruh 9 peran (`Admin GABAH`, `IT`, `GA`, `Sekretaris Direksi`, `Humas`, `Supply Chain`, `PIBC`, `Karyawan`, `Auditor`) telah terintegrasi di frontend, login page, dan administration panel.
   - Form Tambah Pengguna dan Edit Pengguna disinkronkan 100% menggunakan `SYSTEM_ROLES`.
3. **Fleksibilitas Struktur Organisasi (Divisi & Departemen):**
   - Mendukung penuh penambahan divisi baru, penyesuaian susunan departemen, serta penghapusan divisi tak beraset.
4. **Perbaikan Master Data:**
   - Tombol **"Tambah Lokasi"** yang sebelumnya tidak merespons kini telah dilengkapi modal form interaktif dan handler API.
   - Ditambahkan fitur **Edit Kategori Aset** dan **Edit Lokasi** (ikon Pencil).
   - Standardisasi **"Jenis Utama Aset (Main Type)"** (PSAK 16) dan **"Tipe Taksonomi GABAH"** (Modul Fungsional IT/License/General).
5. **Kebijakan Akses Mode Pengembangan:**
   - Selama fase development, akses ke Administration Control Panel dibuka untuk semua peran tanpa mengunci pengujian, sementara integritas profil dan identitas peran masing-masing tetap terjaga.
   - Detail dokumentasi selengkapnya dicatat di `AUDIT_NOTES.md`.
