# GABAH — Project Rules & Engineering Standards

**Repository:** inieki-lab/GABAH  
**Organisasi:** PT Food Station Tjipinang Jaya (Perseroda)  
**Tujuan Dokumen:** Standar acuan rekayasa perangkat lunak, aturan arsitektur, dan disiplin pengembangan yang wajib dipatuhi oleh seluruh pengembang dan agen kecerdasan buatan (AI).  
**Status:** Authoritative Rules (Mencerminkan 100% Implementasi Aktual)  

---

## 1. Arsitektur & Teknologi Wajib (Core Stack)

1. **Frontend**: React 19, TypeScript (~5.8), Vite 6, Tailwind CSS v4, Lucide React icons, Motion.
2. **Backend**: Node.js 20+, Express 4.21+, TSX (untuk runtime development), esbuild (untuk bundling server produksi).
3. **Database**: PostgreSQL 17 (driver `pg`), skema ternormalisasi relasional (11 tabel inti + 2 tabel auth & trigger).
4. **Resilience Store**: Fail-safe snapshot JSON file (`server/data/gabah_state.json`) untuk kelangsungan operasional cold-boot jika instance database host mengalami gangguan jaringan.
5. **Containerization**: Docker Compose (`gabah_database` + `gabah_app`).

### Aturan Bebas PHP / Laravel:
> **MUTLAK:** Proyek GABAH tidak menggunakan PHP atau Laravel. Seluruh logika server disajikan oleh server Express pada `server.ts` dan modul di direktori `server/`. Dilarang memperkenalkan dependensi Composer, artisan, atau skrip PHP.

---

## 2. Server-Authoritative Logic (Prinsip Otoritas Server)

Semua aturan bisnis kritis **wajib dieksekusi dan divalidasi di level server backend** (`server/services.ts`, `server/runtime-hardening.ts`, `server/auth.ts`, `server/numbering.ts`). Klien frontend (`src/`) hanya berperan sebagai antarmuka presentasi dan tidak boleh dijadikan satu-satunya pelindung integritas data.

### 2.1 Penomoran Aset (Asset Numbering)
- Format resmi: `{OWNER_DIVISION}-{ASSET_CODE}-{YEAR}-{SEQUENCE}` (Contoh: `IT-HLT-2026-0001`, `GA-INV-F-2026-0001`).
- Penomoran di-generate secara atomik oleh backend melalui `AssetNumberingEngine.generateAssetNumber()`.
- Urutan sequence nomor mereset per tahun per kombinasi divisi pemilik dan kode aset.
- Frontend dilarang meng-generate atau meng-hardcode nomor aset secara manual saat create asset.
- Nomor ERP Accurate disimpan secara terpisah di kolom `corporate_asset_number` dan tidak boleh menimpa nomor kanonikal.

### 2.2 Pencegahan Tabrakan Peminjaman (Loan Anti-Collision)
- Backend memeriksa ketersediaan aset secara otoritatif sebelum permohonan pinjaman dibuat dan sebelum pinjaman disetujui.
- Tabrakan jadwal dihitung **strictly per aset**: jika aset A sedang dipinjam/disetujui pada rentang tanggal tertentu, aset A tidak boleh dipinjam lagi pada rentang tersebut.
- Pengguna yang sama diperbolehkan meminjam aset yang berbeda (misalnya laptop IT dan mobil GA) secara simultan tanpa ada bentrok.
- Pada level database, integritas diperkuat oleh trigger PL/pgSQL `trg_check_loan_schedule_collision` pada tabel `loans`.

### 2.3 Hak Milik Divisi (Division Asset Ownership)
- **Barang IT (IT-H & IT-S)**: Seluruh laptop, komputer, server, perangkat jaringan, dan lisensi software adalah hak milik mutlak Divisi IT. Divisi GA hanya memiliki akses baca (*read-only*).
- **Furniture (INV-F)**: Seluruh furniture (meja, kursi, lemari) adalah hak milik mutlak Divisi GA di manapun furniture tersebut diletakkan secara fisik.
- **Armada Logistik & Mesin Pabrik**: Truk muatan beras (`KDR-SC`) dan mesin pabrik/forklift (`MSN`) adalah milik Divisi Supply Chain.
- **Sarana Pasar & Timbangan**: Jembatan timbang truk 60 ton dan sarana los/kios adalah milik Divisi PIBC.

---

## 3. Keamanan, Autentikasi & RBAC

1. **Bearer Token Authentication**:
   - Autentikasi menggunakan header standar `Authorization: Bearer <token>`.
   - Token dikelola pada tabel `user_sessions` dengan masa berlaku 7 hari.
   - Browser `localStorage` **hanya** diizinkan menyimpan kunci `gabah_auth_token`. Tidak boleh ada data transaksi operasional yang disimpan permanen di localStorage sebagai database alternatif.
2. **Anti-Spoofing & Zero Fallback**:
   - Header manipulasi `x-user-id` yang tidak sesuai dengan token sesi aktif akan ditolak seketika dengan status `403 Forbidden` (`spoofAttempt: true`).
   - Request tanpa token yang valid tidak pernah di-fallback otomatis menjadi Super Admin.
3. **Auditor Strictly Read-Only**:
   - Pengguna dengan peran `Auditor` diblokir dari seluruh request yang bermutasi (`POST`, `PATCH`, `PUT`, `DELETE`), kecuali logout, switch-role dev, dan menandai notifikasi terbaca. Setiap percobaan mutasi data oleh Auditor menghasilkan `403 Forbidden`.
4. **Audit Logging Wajib**:
   - Setiap mutasi administratif (buat aset, ubah status, serah terima pinjaman, buat tiket, ubah master data, alih peran) wajib mencatat riwayat audit ke tabel `audit_logs` secara otomatis melalui `GabahDomainService.recordAudit()`.
5. **Rate Limiting**:
   - API rate limiter aktif membatasi maksimal 200 request per menit per alamat IP klien.
   - Header informasi `X-RateLimit-Limit`, `X-RateLimit-Remaining`, dan `X-RateLimit-Reset` disertakan pada setiap respon API.

---

## 4. Standar Kode & Antarmuka (Coding Standards)

1. **TypeScript Strictest Discipline**:
   - Seluruh kode wajib lolos kompilasi tanpa error: `npm run lint` (`tsc --noEmit`) wajib 0 error.
   - Model data shared didefinisikan pada `src/types.ts` dan disinkronkan dengan interface `server/db.ts`.
2. **Styling & Design System**:
   - Menggunakan Tailwind CSS v4 (impor global `@import "tailwindcss";` di `src/index.css`).
   - Font tipografi kanonikal: `Plus Jakarta Sans`.
   - Warna tema identitas korporat Food Station Tjipinang Jaya:
     - Primary Teal: `#4ABDAC` / `#206f65`
     - Secondary Accent Peach: `#FC4A1A`
     - Warning Yellow Gold: `#F7B733`
     - Clean Slate Base: `#DFDCE3` / `slate-50` s/d `slate-900`
3. **Verifikasi Build Sebelum Rilis**:
   - Build produksi wajib dipastikan sukses: `npm run build` menghasilkan bundle frontend di `dist/` dan bundle backend di `dist/server.cjs`.

---

## 5. Alur Pemesanan Ruang Rapat & Notifikasi Terpadu

1. **Prioritas Pemesanan**:
   - Reservasi yang diajukan oleh `Sekretaris Direksi` berstatus prioritas VIP dan otomatis disetujui (*auto-approved*).
   - Reservasi oleh karyawan/divisi lain berstatus `pending_approval` dan menunggu persetujuan Divisi GA.
2. **Multi-Divisi Notification Dispatch**:
   - Fasilitas IT (Polycom, Smart TV, Proyektor, HDMI, WiFi) memicu notifikasi otomatis ke Divisi IT Support.
   - Fasilitas fisik GA (Sound System, Mic Wireless, Whiteboard) memicu notifikasi ke GA Sarpras.
   - Pesanan konsumsi (Snack, Lunch Box, VIP Buffet) memicu notifikasi ke GA Pantry.
   - Permintaan dokumentasi (Foto/Video) memicu notifikasi khusus ke Humas & Protokoler.
