# GABAH — Project Rules & Engineering Standards

**Repository:** inieki-lab/GABAH  
**Organisasi:** PT Food Station Tjipinang Jaya (Perseroda)  
**Tujuan Dokumen:** Standar acuan rekayasa perangkat lunak, aturan arsitektur, dan disiplin pengembangan yang wajib dipatuhi oleh seluruh pengembang dan agen kecerdasan buatan (AI).  
**Status:** Aturan rekayasa wajib; kesesuaian implementasi diverifikasi per perubahan, bukan diasumsikan.  

---

## 0. Wajib Dibaca oleh Semua AI dan Kontributor

Sebelum mengubah kode atau dokumen, baca [docs/GABAH-DOCUMENTATION-CONTROL.md](./docs/GABAH-DOCUMENTATION-CONTROL.md). Panduan tersebut menetapkan urutan otoritas sumber, label APPROVED/IMPLEMENTED/TESTED/PARTIAL/PROPOSED/DECISION REQUIRED/NOT VERIFIED/HISTORICAL, dokumen yang wajib diselaraskan, aturan keamanan, dan format handoff. Jangan menyebut dokumen 100% sinkron, fitur selesai, atau production-ready tanpa bukti pada exact commit. Jika business intent bertentangan dengan implementasi, catat gap dan minta keputusan; jangan diam-diam mengubah aturan.

## 1. Arsitektur & Teknologi Wajib (Core Stack)

1. **Frontend**: React 19, TypeScript (~5.8), Vite 6, Tailwind CSS v4, Lucide React icons, Motion.
2. **Backend**: Node.js 20+, Express 4.21+, TSX (untuk runtime development), esbuild (untuk bundling server produksi).
3. **Database**: PostgreSQL 17 (driver `pg`), skema ternormalisasi relasional (11 tabel inti + 2 tabel auth & trigger).
4. **Development/Test File Store**: Snapshot JSON (`server/data/gabah_state.json`) hanya untuk standalone development/test atau fallback saat PostgreSQL tidak tersedia pada startup di lingkungan non-production. Production wajib fail-fast jika PostgreSQL tidak tersedia; setelah PostgreSQL authoritative, kegagalan runtime dilatch dan operasi ditolak sampai layanan dipulihkan serta aplikasi direstart. Ini bukan mekanisme production failover otomatis.
5. **Containerization**: Docker Compose (`gabah_database` + `gabah_app`).

### Aturan Bebas PHP / Laravel:
> **MUTLAK:** Proyek GABAH tidak menggunakan PHP atau Laravel. Seluruh logika server disajikan oleh server Express pada `server.ts` dan modul di direktori `server/`. Dilarang memperkenalkan dependensi Composer, artisan, atau skrip PHP.

---

## 2. Server-Authoritative Logic (Prinsip Otoritas Server)

Semua aturan bisnis kritis **wajib dieksekusi dan divalidasi di level server backend** (`server/services.ts`, `server/runtime-hardening.ts`, `server/auth.ts`, `server/numbering.ts`). Klien frontend (`src/`) hanya berperan sebagai antarmuka presentasi dan tidak boleh dijadikan satu-satunya pelindung integritas data.

### 2.1 Penomoran Aset (Asset Numbering)
- Format resmi: `{OWNER_DIVISION}-{ASSET_CODE}-{YEAR}-{SEQUENCE}` (Contoh: `IT-HLT-2026-0001`, `GA-INV-F-2026-0001`).
- Penomoran dibuat oleh backend. PostgreSQL mode wajib memakai reservasi atomik pada tabel `asset_number_sequences` (UPSERT di dalam transaksi) dan tidak boleh fallback ke counter lokal saat database gagal. File-store development boleh memakai counter in-memory. Jangan klaim production-ready sebelum uji concurrent multi-instance dan restart lulus.
- Urutan sequence nomor mereset per tahun per kombinasi divisi pemilik dan kode aset.
- Frontend dilarang meng-generate atau meng-hardcode nomor aset secara manual saat create asset.
- Aturan format disimpan di PostgreSQL (`asset_numbering_rules`) dan hanya dapat dikelola Superadmin. Aturan yang sudah dipakai boleh mengubah format penerbitan berikutnya, tetapi identitas divisi/kode dikunci dan nomor historis tidak boleh ditulis ulang.
- Penghapusan hanya untuk aturan tanpa aset/sequence, wajib konfirmasi kode `DIV/CODE` dan alasan minimal 20 karakter; aturan terpakai harus dinonaktifkan, bukan dihapus.
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

1. **HttpOnly Cookie Session**:
   - Browser menggunakan cookie sesi `gabah_session` dengan atribut HttpOnly, SameSite=Strict, Path=/, dan Secure pada production; masa berlaku cookie maksimum 7 hari.
   - Token sesi tidak dikirim dalam JSON dan tidak disimpan di `localStorage` atau dapat dibaca JavaScript browser. Request mutasi berbasis cookie wajib lolos pemeriksaan Origin same-origin.
   - Sesi server tetap memory-only — tidak disimpan ke tabel `user_sessions`, snapshot `gabah_state.json`, maupun blob PostgreSQL; restart mengharuskan re-authentication. Penerbitan ulang password/role/privilege mencabut seluruh sesi user (authVersion).
2. **Anti-Spoofing & Zero Fallback**:
   - Header manipulasi `x-user-id` yang tidak sesuai dengan sesi aktif akan ditolak seketika dengan status `403 Forbidden` (`spoofAttempt: true`).
   - Request tanpa cookie sesi yang valid tidak pernah di-fallback otomatis menjadi Super Admin.
3. **Auditor Strictly Read-Only**:
   - Pengguna dengan peran `Auditor` diblokir dari seluruh request yang bermutasi (`POST`, `PATCH`, `PUT`, `DELETE`), kecuali logout dan menandai notifikasi terbaca. Pergantian peran (`switch-role`) bersifat **admin-only** dan bukan pengecualian Auditor. Setiap percobaan mutasi data oleh Auditor menghasilkan `403 Forbidden`.
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
     - Primary Green: `#176B45` / `#218653` (Green Enterprise theme)
     - Secondary Accent Coral: `#FC4A1A`
     - Warning Yellow Gold: `#F7B733`
     - Clean Green-Slate Base: `#F4F8F5` canvas / `#E1EBE4` border / `slate-50` s/d `slate-900`
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
