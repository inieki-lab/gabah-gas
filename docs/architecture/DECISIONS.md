# GABAH — Architectural Decision Records (ADRs)

**Dokumen:** `docs/architecture/DECISIONS.md`  
**Sistem:** GABAH (*General Asset, Business & Automated Helpdesk*)  
**Organisasi:** PT Food Station Tjipinang Jaya (Perseroda)  
**Status:** Authoritative Decision Log (Hanya Mencatat Keputusan yang Benar-Benar Diterapkan di Source Code)  
**Terakhir Diperbarui:** 28 September 2026  

---

## ADR-001: Adopsi React 19 SPA + Vite 6 + Tailwind CSS v4
- **Konteks**: Aplikasi membutuhkan antarmuka operasional yang responsif, modern, cepat dimuat, dan mudah dikembangkan secara modular untuk multi-divisi.
- **Keputusan**: Menggunakan **React 19** berbasis SPA (*Single Page Application*) dengan **Vite 6** sebagai bundler dan **Tailwind CSS v4** dengan import global `@import "tailwindcss";`. Tipografi distandarisasi ke *Plus Jakarta Sans*.
- **Status**: Diterapkan & Aktif (`src/App.tsx`, `package.json`, `index.html`).

---

## ADR-002: Arsitektur Fullstack Node.js + Express Server
- **Konteks**: Sistem memerlukan lapisan API server yang menyatu dengan environment Vite pada tahap pengembangan, namun dapat dikompilasi secara mandiri untuk produksi.
- **Keputusan**: Menggunakan **Node.js** dengan **Express 4.21** di file induk `server.ts`. Pada mode development, Express me-mount `vite.middlewares` (`"dev": "tsx server.ts"`). Pada mode produksi, server di-bundle menggunakan `esbuild` menjadi file tunggal `dist/server.cjs` (`"start": "node dist/server.cjs"`).
- **Status**: Diterapkan & Aktif (`server.ts`, `scripts/build-server.cjs`).

---

## ADR-003: PostgreSQL 17 sebagai Basis Data Otoritatif
- **Konteks**: Tata kelola BUMD menuntut integritas data relasional yang ketat, relasi foreign key, validasi anti-tabrakan jadwal, audit log, dan kepatuhan transaksi ACID.
- **Keputusan**: Memilih **PostgreSQL 17** sebagai basis data persisten otoritatif menggunakan library koneksi `pg` (`Pool`). Seluruh skema DDL dipecah menjadi file migrasi SQL pada `server/migrations/` dan dieksekusi otomatis saat server startup.
- **Status**: Diterapkan & Aktif (`server/persistence.ts`, `server/migrations/`).

---

## ADR-004: Kontainerisasi Docker Compose untuk Produksi
- **Konteks**: Deployment di server on-premise atau Cloud BUMD memerlukan standardisasi runtime environment tanpa dependensi manual.
- **Keputusan**: Mengonfigurasi `docker-compose.yml` dengan dua kontainer:
  1. `gabah_database`: Image `postgres:17-alpine` dengan persistent volume `postgres_data`.
  2. `gabah_app`: Image `node:20-alpine` yang menjalankan build dan server aplikasi pada port 80:3000.
  Disediakan skrip `deploy.sh` untuk otomasi deploy satu baris di server Linux.
- **Status**: Diterapkan & Aktif (`docker-compose.yml`, `deploy.sh`).

---

## ADR-005: Penghapusan Seluruh Artefak & Referensi PHP / Laravel
- **Konteks**: Dokumen lama dan sisa prototipe awal mengandung referensi ke backend Laravel 11 (PHP 8.3) yang menyebabkan kebingungan bagi tim pengembang dan agen AI.
- **Keputusan**: Melakukan pembersihan total (*purge*): menghapus file modal `LaravelArchitectureModal.tsx`, menghapus arsip unduhan `public/gabah-source.tar.gz`, menghapus tab `laravel_spec` dari navigasi sidebar, dan memperbarui seluruh dokumentasi bahwa GABAH adalah murni fullstack TypeScript (Node.js/Express + React).
- **Status**: Diterapkan & Selesai (Tidak ada dependensi PHP yang tersisa di source code).

---

## ADR-006: Server-Authoritative Authorization & Anti-Spoofing RBAC
- **Konteks**: Keamanan enterprise melarang mempercayai identitas pengguna dari klaim sepihak klien (misal manipulasi header `x-user-id` atau token palsu).
- **Keputusan**:
  1. Identitas pengguna diverifikasi secara eksklusif melalui Bearer session token yang tersimpan di tabel `user_sessions`.
  2. Setiap percobaan manipulasi identitas melalui header `x-user-id` yang tidak sesuai dengan token sesi langsung dibatalkan dengan HTTP `403 Forbidden` (`spoofAttempt: true`).
  3. Menghapus celah auto-login ke akun Super Admin jika token tidak disertakan (request tanpa token menghasilkan `401 Unauthorized`).
  4. Menegakkan pembatasan bahwa peran `Auditor` dikunci 100% read-only pada seluruh rute non-GET.
- **Status**: Diterapkan & Aktif (`server/runtime-hardening.ts`, `server/auth.ts`).

---

## ADR-007: Standardisasi Format Penomoran Aset Korporat
- **Konteks**: Divisi akuntansi, logistik, dan IT membutuhkan format penomoran inventaris yang konsisten dan mencerminkan divisi pemilik serta tahun perolehan.
- **Keputusan**: Menetapkan format baku kanonikal `{OWNER_DIVISION}-{ASSET_CODE}-{YEAR}-{SEQUENCE}` yang di-generate atomik oleh `AssetNumberingEngine` di backend. Nomor aset Accurate ERP dipisahkan ke kolom `corporate_asset_number` agar tidak merusak format kanonikal internal.
- **Status**: Diterapkan & Aktif (`server/numbering.ts`, `server/taxonomy.ts`, `server/services.ts`).

---

## ADR-008: Dual-Persistence Resilience Architecture
- **Konteks**: Dalam lingkungan pengembangan atau saat kontainer basis data host sedang restart, aplikasi tidak boleh crash atau kehilangan data operasional yang sedang diuji.
- **Keputusan**: Mengimplementasikan arsitektur ketahanan ganda (*dual-persistence*):
  - Primary store: PostgreSQL 17 relasional.
  - Secondary fallback store: Snapshot file lokal terstruktur `server/data/gabah_state.json`.
  Server mampu melakukan auto-fallback ke file store jika koneksi PostgreSQL terputus, dan melakukan sinkronisasi kembali (*backfill*) saat database kembali online.
- **Status**: Diterapkan & Aktif (`server/persistence.ts`).

---

## ADR-009: Pemisahan Entitas Peran Login (9 Roles) dari Vendor dan Manajemen
- **Konteks**: Sebelumnya terdapat kerancuan mengenai peran `Management` dan `Vendor` dalam RBAC login.
- **Keputusan**:
  1. Menetapkan **9 peran login resmi**: `Admin GABAH`, `IT`, `GA`, `Sekretaris Direksi`, `Humas`, `Supply Chain`, `PIBC`, `Karyawan`, dan `Auditor`.
  2. Peran `Management` dihapus dari autentikasi login pengguna (fungsi pengawasan eksekutif menggunakan akun `Auditor` atau `Admin GABAH`).
  3. Entitas `Vendor` dikelola murni sebagai entitas data master rekanan servis/kontrak pada tabel `contracts` dan modul Master Data.
- **Status**: Diterapkan & Aktif (`server/db.ts`, `src/types.ts`).

---

## ADR-010: VIP Auto-Approval Reservasi Ruangan & Notifikasi Multi-Divisi
- **Konteks**: Ruang rapat representatif sering digunakan oleh jajaran Direksi secara mendesak, dan kebutuhan rapat memerlukan koordinasi paralel antara IT (vicon/layar), GA Sarpras (kursi/sound), Pantry (snack/makan), serta Humas (dokumentasi/liputan).
- **Keputusan**:
  1. Pemesanan oleh `Sekretaris Direksi` (mewakili pimpinan BUMD) langsung disetujui secara otomatis (*auto-approved*) dengan prioritas High.
  2. Pemesanan oleh staf umum berstatus `pending_approval` menunggu verifikasi GA.
  3. Dispatching notifikasi multi-divisi otomatis: mengirim peringatan ke IT Support jika fasilitas IT dipilih, ke GA Sarpras jika kebutuhan fisik dipilih, ke GA Pantry jika konsumsi dipesan, dan ke Humas jika peliputan/dokumentasi dicentang.
- **Status**: Diterapkan & Aktif (`server/services.ts` baris 945-1065).
