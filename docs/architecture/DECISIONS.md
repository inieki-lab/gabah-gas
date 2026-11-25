# GABAH — Architectural Decision Records (ADRs)

**Dokumen:** `docs/architecture/DECISIONS.md`  
**Sistem:** GABAH (*General Asset, Business & Automated Helpdesk*)  
**Organisasi:** PT Food Station Tjipinang Jaya (Perseroda)  
**Status:** Register keputusan arsitektur. Setiap ADR wajib menyebut status (PROPOSED/ACCEPTED/IMPLEMENTED/SUPERSEDED), tanggal, bukti implementasi, dan keputusan pengganti bila ada.  
**Terakhir Ditinjau:** 23 November 2026 (status ADR lama direkonsiliasi bertahap; ADR-009 telah ditandai SUPERSEDED)  

---

> ADR yang pernah diterapkan tidak otomatis tetap menjadi keputusan aktif. Cocokkan setiap ADR dengan kode dan konfigurasi terkini; tambahkan ADR baru untuk keputusan baru dan tandai keputusan lama SUPERSEDED, jangan menghapus histori.

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

## ADR-006: Server-Authoritative Authentication, Session Revocation & Dynamic RBAC
- **Konteks**: Keamanan enterprise melarang mempercayai identitas pengguna dari klaim sepihak klien (misalnya manipulasi header `x-user-id` atau token palsu).
- **Keputusan saat ini**:
  1. Identitas request berasal dari opaque session token yang divalidasi terhadap registry sesi in-memory `db.sessions`. Browser menggunakan cookie `gabah_session` HttpOnly (SameSite=Strict, Secure pada production); klien non-browser dapat memakai Bearer token. Cookie mutation wajib lolos pemeriksaan Origin same-origin.
  2. Tabel legacy `user_sessions` yang dibuat migration 002 bukan sumber sesi aktif dan tidak dibaca/ditulis runtime. Payload PostgreSQL/JSON selalu mengecualikan sesi; boot mengosongkan registry dan mengharuskan pengguna login ulang.
  3. Token baru dibuat dengan CSPRNG. Sesi memuat security epoch global dan `authVersion` user; logout, reset password, perubahan privilege, deactivation, atau forced revoke membatalkan sesi terkait.
  4. Header `x-user-id` tidak dapat menetapkan identitas. Ketidaksesuaian dengan sesi aktif ditolak HTTP `403 Forbidden` (`spoofAttempt: true`); request tanpa sesi valid ditolak `401 Unauthorized`, tanpa fallback ke Super Admin.
  5. Backend authorization menggunakan Dynamic RBAC permission dan explicit data scope. Read-only ditegakkan sebagai capability/policy terpisah dari data visibility; jangan menyimpulkan akses global dari label role.
- **Status**: Diterapkan & Aktif pada source runtime (`server/auth.ts`, `server/persistence.ts`, `server/runtime-hardening.ts`). Inventarisasi residu baris pada database existing dan keputusan pembersihan tabel tetap tertunda pada issue #293; jangan drop tabel atau membaca/mengekspor nilai token sebelum backup/restore rehearsal dan persetujuan owner.

---

## ADR-007 (PARTIAL / POLICY PENDING): Format Teknis Penomoran Aset
- **Konteks**: Divisi akuntansi, logistik, dan IT membutuhkan format penomoran inventaris yang konsisten dan mencerminkan divisi pemilik serta tahun perolehan.
- **Keputusan saat itu**: Mengimplementasikan pola teknis default `{OWNER_DIVISION}-{ASSET_CODE}-{YEAR}-{SEQUENCE}` dan menyimpan nomor Accurate ERP terpisah pada `corporate_asset_number`.
- **Status saat ini**: **PARTIAL**. Format korporat final masih menunggu pengesahan perusahaan. Generator `AssetNumberingEngine` menggunakan counter `Map` in-memory yang disinkronkan saat boot; bukan alokasi atomik PostgreSQL dan belum aman untuk multi-instance. Lihat `docs/asset/ASSET-NUMBERING.md` dan `docs/IMPLEMENTATION-TRUTH-REGISTER.md`.

---

## ADR-008 (PARTIAL / ENVIRONMENT-SCOPED): PostgreSQL and Development File-Store Resilience
- **Konteks**: Dalam lingkungan pengembangan atau saat kontainer basis data host sedang restart, aplikasi tidak boleh crash atau kehilangan data operasional yang sedang diuji.
- **Keputusan saat itu**: PostgreSQL 17 adalah primary store; file snapshot `server/data/gabah_state.json` mendukung development/test saat PostgreSQL tidak tersedia pada startup.
- **Batasan saat ini**: Production menolak startup bila PostgreSQL yang dikonfigurasi tidak tersedia. Setelah PostgreSQL menjadi authoritative, kegagalan koneksi/write saat runtime dilatch dan operasi ditolak sampai layanan dipulihkan serta proses aplikasi direstart; tidak ada silent runtime fallback ke file store.
- **Status saat ini**: **PARTIAL / ENVIRONMENT-SCOPED** (`server/persistence.ts`, `server/runtime-hardening.ts`). Jangan menjelaskan file store sebagai production failover otomatis.

---

## ADR-009 (HISTORICAL / SUPERSEDED): Pemisahan Entitas Peran Login (9 Roles) dari Vendor dan Manajemen
- **Konteks**: Sebelumnya terdapat kerancuan mengenai peran `Management` dan `Vendor` dalam RBAC login.
- **Keputusan saat itu (historis)**:
  1. Menetapkan sembilan label login sebagai model awal: `Admin GABAH`, `IT`, `GA`, `Sekretaris Direksi`, `Humas`, `Supply Chain`, `PIBC`, `Karyawan`, dan `Auditor`.
  2. Peran `Management` dihapus dari autentikasi login pengguna.
  3. Entitas `Vendor` dikelola sebagai data master rekanan.
- **Status saat ini**: **SUPERSEDED untuk model role/profil pengguna** oleh keputusan pemilik proyek pada `docs/PROJECT-CONTEXT.md` dan model Dynamic RBAC. Sekretariat Direksi/Humas adalah capability tambahan pegawai; Supply Chain/SC dan PIBC bukan primary role baru. Bagian Vendor tetap merupakan catatan historis dan harus diverifikasi terpisah terhadap modul vendor/contract saat perubahan dilakukan.

---

## ADR-010: VIP Auto-Approval Reservasi Ruangan & Notifikasi Multi-Divisi
- **Konteks**: Ruang rapat representatif sering digunakan oleh jajaran Direksi secara mendesak, dan kebutuhan rapat memerlukan koordinasi paralel antara IT (vicon/layar), GA Sarpras (kursi/sound), Pantry (snack/makan), serta Humas (dokumentasi/liputan).
- **Keputusan**:
  1. Pemesanan oleh pegawai yang memiliki capability/permission Sekretariat Direksi yang sah (mewakili pimpinan BUMD) langsung disetujui secara otomatis (*auto-approved*) dengan prioritas High.
  2. Pemesanan oleh staf umum berstatus `pending_approval` menunggu verifikasi GA.
  3. Dispatching notifikasi multi-divisi otomatis: mengirim peringatan ke IT Support jika fasilitas IT dipilih, ke GA Sarpras jika kebutuhan fisik dipilih, ke GA Pantry jika konsumsi dipesan, dan ke Humas jika peliputan/dokumentasi dicentang.
- **Status**: Diterapkan & Aktif (`server/services.ts` baris 945-1065).
