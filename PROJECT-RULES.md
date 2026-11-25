# GABAH — Project Rules & Engineering Standards

**Repository:** inieki-lab/GABAH  
**Organisasi:** PT Food Station Tjipinang Jaya (Perseroda)  
**Tujuan Dokumen:** Standar acuan rekayasa perangkat lunak, aturan arsitektur, dan disiplin pengembangan yang wajib dipatuhi oleh seluruh pengembang dan agen kecerdasan buatan (AI).  
**Status:** Aturan rekayasa wajib; kesesuaian implementasi diverifikasi per perubahan, bukan diasumsikan.

> **Koreksi model pengguna (25 November 2026):** Dua profil utama saja — Admin GABAH dan Karyawan. Role fungsi bersifat dinamis, tidak dibatasi sembilan label lama. Jika bagian dokumen lain masih menyebut role/divisi lama sebagai otoritas tetap, aturan Dynamic RBAC pada Bagian 3.0 dan keputusan bisnis terbaru yang berlaku.  

---

## 0. Wajib Dibaca oleh Semua AI dan Kontributor

Sebelum mengubah kode atau dokumen, baca [docs/GABAH-DOCUMENTATION-CONTROL.md](./docs/GABAH-DOCUMENTATION-CONTROL.md). Panduan tersebut menetapkan urutan otoritas sumber, label APPROVED/IMPLEMENTED/TESTED/PARTIAL/PROPOSED/DECISION REQUIRED/NOT VERIFIED/HISTORICAL, dokumen yang wajib diselaraskan, aturan keamanan, dan format handoff. Jangan menyebut dokumen 100% sinkron, fitur selesai, atau production-ready tanpa bukti pada exact commit. Jika business intent bertentangan dengan implementasi, catat gap dan minta keputusan; jangan diam-diam mengubah aturan.

## 1. Arsitektur & Teknologi Wajib (Core Stack)

1. **Frontend**: React 19, TypeScript (~5.8), Vite 6, Tailwind CSS v4, Lucide React icons, Motion.
2. **Backend**: Node.js 20+, Express 4.21+, TSX (untuk runtime development), esbuild (untuk bundling server produksi).
3. **Database**: PostgreSQL 17 (driver `pg`), skema ternormalisasi relasional (11 tabel inti + 2 tabel auth & trigger).
4. **PostgreSQL Authoritative + Recovery Snapshot**: PostgreSQL adalah sumber data otoritatif pada runtime yang dikonfigurasi. Setelah transaksi PostgreSQL berhasil commit, aplikasi menulis payload persis yang sudah commit ke `server/data/gabah_state.json` sebagai snapshot pemulihan; snapshot tidak berisi sesi. Snapshot bukan sumber otoritas dan bukan fallback setelah PostgreSQL pernah aktif lalu gagal. File-store development hanya boleh dipakai bila PostgreSQL tidak tersedia sejak startup pada lingkungan non-production. Production wajib fail-fast bila PostgreSQL/migrasi gagal; runtime outage setelah PostgreSQL authoritative melatch penolakan operasi sampai layanan pulih dan aplikasi direstart.
5. **Containerization**: Docker Compose (`gabah_database` + `gabah_app`).

### Aturan Bebas PHP / Laravel:
> **MUTLAK:** Proyek GABAH tidak menggunakan PHP atau Laravel. Seluruh logika server disajikan oleh server Express pada `server.ts` dan modul di direktori `server/`. Dilarang memperkenalkan dependensi Composer, artisan, atau skrip PHP.

---

## 2. Server-Authoritative Logic (Prinsip Otoritas Server)

Semua aturan bisnis kritis **wajib dieksekusi dan divalidasi di level server backend** (`server/services.ts`, `server/runtime-hardening.ts`, `server/auth.ts`, `server/numbering.ts`). Klien frontend (`src/`) hanya berperan sebagai antarmuka presentasi dan tidak boleh dijadikan satu-satunya pelindung integritas data.

### 2.1 Penomoran Aset (Asset Numbering)
- **Standar nomor aset korporat belum ditetapkan/ disahkan.** Jangan menyebut pola teknis yang sedang dipakai aplikasi atau prefix historis sebagai format resmi perusahaan. Perubahan standar menunggu keputusan pemilik proses/standar perusahaan.
- Penomoran dibuat oleh backend. PostgreSQL mode wajib memakai reservasi atomik pada tabel `asset_number_sequences` (UPSERT di dalam transaksi) dan tidak boleh fallback ke counter lokal saat database gagal. File-store development boleh memakai counter in-memory. Jangan klaim production-ready sebelum uji concurrent multi-instance dan restart lulus.
- Perilaku sequence, reset tahunan, owner, kategori, dan format penerbitan adalah perilaku implementasi yang harus dicatat terpisah dari standar korporat yang belum disahkan.
- Frontend dilarang meng-generate atau meng-hardcode nomor aset secara manual saat create asset.
- Aturan format disimpan di PostgreSQL (`asset_numbering_rules`) dan hanya dapat dikelola Superadmin. Aturan yang sudah dipakai boleh mengubah format penerbitan berikutnya, tetapi identitas owner/kode yang telah dipakai dan nomor historis tidak boleh ditulis ulang tanpa keputusan serta migrasi yang disetujui.
- Penghapusan hanya untuk aturan tanpa aset/sequence, wajib konfirmasi kode dan alasan; aturan terpakai harus dinonaktifkan, bukan dihapus.
- Nomor ERP Accurate disimpan secara terpisah di kolom `corporate_asset_number` dan tidak boleh menimpa nomor kanonikal.
 
### 2.2 Pencegahan Tabrakan Peminjaman (Loan Anti-Collision)
- Backend memeriksa ketersediaan aset secara otoritatif sebelum permohonan pinjaman dibuat dan sebelum pinjaman disetujui.
- Tabrakan jadwal dihitung **strictly per aset**: jika aset A sedang dipinjam/disetujui pada rentang tanggal tertentu, aset A tidak boleh dipinjam lagi pada rentang tersebut.
- Pengguna yang sama diperbolehkan meminjam aset yang berbeda (misalnya laptop IT dan mobil GA) secara simultan tanpa ada bentrok.
- Pada level database, integritas diperkuat oleh trigger PL/pgSQL `trg_check_loan_schedule_collision` pada tabel `loans`.

### 2.3 Owner Domain Aset dan Lokasi (Dynamic Ownership)
- Owner aset adalah domain/master pemilik yang dapat dikonfigurasi; bukan enum permanen yang diturunkan dari nama role, divisi, unit, atau lokasi.
- IT mengelola aset dengan owner domain IT di seluruh lokasi. GA mengelola aset dengan owner domain GA di seluruh lokasi.
- GA hanya boleh membaca Laptop/PC owner IT jika permission baca khusus diaktifkan; permission tersebut tidak memberi hak create/update/delete/approve/move atas aset IT.
- RPC/SC dan PIBC adalah lokasi/unit operasional, bukan role aplikasi dan bukan owner aset otomatis. Kode owner historis SC/PIBC dipertahankan sampai review per aset disetujui; jangan mengubah owner historis hanya berdasarkan lokasi.
- Owner domain tambahan hanya dibuat melalui master/policy yang disetujui. Lokasi fisik, lokasi kerja pegawai, jabatan, unit organisasi, kategori, dan custodian tidak otomatis menentukan owner atau hak akses.
- Backend wajib memeriksa permission tindakan dan data scope efektif untuk list, detail-by-ID, dashboard, pencarian, export, dan mutasi. Visibility tidak sama dengan authority to mutate.

---

## 3. Keamanan, Autentikasi & RBAC

### 3.0 Model Profil dan Otorisasi yang Berlaku (APPROVED)
- Profil utama hanya dua: **Admin GABAH** (administrator sistem) dan **Karyawan** (identitas pegawai). Label `Superadmin` adalah alias/kompatibilitas administrator, bukan katalog profil tambahan.
- Tidak ada katalog role fungsi yang tertutup atau berjumlah sembilan. Role/capability fungsi dibuat, diubah, dinonaktifkan, dan dihapus melalui Dynamic RBAC oleh administrator yang berwenang.
- Pegawai dapat memiliki beberapa role fungsi sekaligus. Permission menjawab tindakan apa yang boleh dilakukan; scope menjawab data/objek mana yang boleh dijangkau.
- Jabatan/level, unit organisasi, divisi, lokasi kerja, owner aset, lokasi fisik aset, dan custodian adalah dimensi terpisah. Tidak satu pun otomatis memberi permission.
- RPC/SC dan PIBC bukan role aplikasi. IT, GA, ME, Auditor, Humas, Sekretariat Direksi, dan fungsi lain adalah contoh assignment/capability yang dapat dikonfigurasi, bukan daftar wajib yang ditanam permanen dalam kode.
- Backend PostgreSQL Dynamic RBAC adalah otoritas produksi. Nama role/label tampilan dan filter frontend tidak boleh menjadi satu-satunya dasar otorisasi. Custom role tanpa permission/scope eksplisit harus ditolak secara default.
- Pemeriksaan legacy `users.role`, allowlist role, dan fallback file-store hanya boleh dipertahankan sebagai kompatibilitas migrasi yang terukur; tidak boleh dianggap sebagai model target atau sumber otoritas produksi. Setiap ketergantungan yang tersisa harus dicatat sebagai gap dan diuji.

1. **HttpOnly Cookie Session**:
   - Browser menggunakan cookie sesi `gabah_session` dengan atribut HttpOnly, SameSite=Strict, Path=/, dan Secure pada production; masa berlaku cookie maksimum 7 hari.
   - Token sesi tidak dikirim dalam JSON dan tidak disimpan di `localStorage` atau dapat dibaca JavaScript browser. Request mutasi berbasis cookie wajib lolos pemeriksaan Origin same-origin.
   - Sesi server tetap memory-only — tidak disimpan ke tabel `user_sessions`, snapshot `gabah_state.json`, maupun blob PostgreSQL; restart mengharuskan re-authentication. Penerbitan ulang password/role/privilege mencabut seluruh sesi user (authVersion).
2. **Anti-Spoofing & Zero Fallback**:
   - Header manipulasi `x-user-id` yang tidak sesuai dengan sesi aktif akan ditolak seketika dengan status `403 Forbidden` (`spoofAttempt: true`).
   - Request tanpa cookie sesi yang valid tidak pernah di-fallback otomatis menjadi Super Admin.
3. **Read-only capability / separation of duties**:
   - Sifat read-only harus ditegakkan sebagai policy/permission efektif pada backend, termasuk bila capability audit digabung dengan role fungsi lain. Jangan mengandalkan satu label `Auditor` atau nama role untuk menegakkan keamanan.
   - Endpoint mutasi memeriksa permission tindakan, scope objek, dan aturan separation-of-duties; pengecualian administratif hanya melalui capability Superadmin yang eksplisit dan diaudit.
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
   - Perlakuan prioritas/VIP ditentukan oleh permission/capability sekretariat yang ditetapkan secara eksplisit, bukan semata-mata jabatan, nama akun, atau string role `Sekretaris Direksi`.
   - Persetujuan reservasi mengikuti policy approval dan scope yang dikonfigurasi; jangan menyimpulkan hak approve hanya dari divisi atau lokasi.
2. **Multi-Divisi Notification Dispatch**:
   - Fasilitas IT (Polycom, Smart TV, Proyektor, HDMI, WiFi) memicu notifikasi otomatis ke Divisi IT Support.
   - Fasilitas fisik GA (Sound System, Mic Wireless, Whiteboard) memicu notifikasi ke GA Sarpras.
   - Pesanan konsumsi (Snack, Lunch Box, VIP Buffet) memicu notifikasi ke GA Pantry.
   - Permintaan dokumentasi (Foto/Video) memicu notifikasi khusus ke Humas & Protokoler.
