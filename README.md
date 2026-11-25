# GABAH — General Asset, Business & Automated Helpdesk

> **GABAH** (*General Asset, Business & Automated Helpdesk*)  
> Portal internal enterprise terpadu PT Food Station Tjipinang Jaya (Perseroda) — BUMD Pangan DKI Jakarta.  
> Mengelola inventaris aset dengan owner fungsional IT/GA dan lokasi operasional HO, PIBC, RPC, Pangsub, serta Kantor Perawatan, peminjaman barang dinas anti-bentrok jadwal dengan Berita Acara Serah Terima (BAST), pelaporan helpdesk kendala operasional berbasis SLA otomatis, pemeliharaan berkala (*preventive maintenance* & tera timbangan 60 ton), reservasi ruang rapat VIP dengan koordinasi fasilitas multi-divisi (IT, GA, Pantry, Humas), serta audit trail kepatuhan BUMD.

---

## 🛠️ Current Tech Stack

- **Frontend**: React 19, TypeScript (~5.8), Vite 6, Tailwind CSS v4, Lucide React, Motion.
- **Backend / API**: Node.js 20, Express 4.21, TSX (development runtime), esbuild (production bundler).
- **Authoritative Database**: PostgreSQL 17 (driver `pg`), normalized relational schema (16 tabel/model) dengan migrasi SQL otomatis dan trigger anti-bentrok.
- **Resilience Layer**: PostgreSQL authoritative; snapshot `server/data/gabah_state.json` ditulis setelah commit sebagai recovery copy. File-store fallback hanya untuk development saat PostgreSQL tidak tersedia sejak startup.
- **Containerization**: Docker Compose (`gabah_database` + `gabah_app`).

---

## 🌾 Fitur Utama (Core Modules)

1. **Katalog Aset Multi-Divisi**: Pencatatan aset berdasarkan owner domain yang disahkan (antara lain IT dan GA), kategori PSAK 16, serta lokasi fisik operasional. RPC dan PIBC adalah konteks lokasi, bukan owner aset otomatis.
2. **Penomoran Aset Otomatis**: Nomor diterbitkan backend berdasarkan aturan aktif dan direkonsiliasi dengan Accurate ERP. Standar nomor aset korporat masih menunggu pengesahan.
3. **Peminjaman Barang Anti-Bentrok**: Validasi ketersediaan aset per tanggal berbasis server, alur persetujuan divisi pemilik, dan cetak BAST digital.
4. **Helpdesk & Tiket SLA**: Pelaporan kendala operasional dengan kalkulasi tenggat waktu SLA otomatis (Urgent 4h, High 8h, Medium 24h, Low 48h).
5. **Preventive Maintenance**: Penjadwalan servis rutin armada logistik, AC ruang server, serta kalibrasi tera berkala jembatan timbang 60 ton PIBC.
6. **Reservasi Ruang Rapat VIP**: Prioritas dan auto-approval mengikuti capability sekretariat yang dikonfigurasi; notifikasi diarahkan ke fungsi IT Support, GA Sarpras, GA Pantry, dan Humas sesuai jenis kebutuhan.
7. **Dynamic Role-Based Access Control**: hanya ada dua profil utama (Admin GABAH dan Karyawan); role fungsi dapat dibuat dan dikelola dinamis. Permission dan data scope terpisah dari jabatan, unit organisasi, dan lokasi. Backend PostgreSQL menjadi otoritas permission dan scope.
8. **Label & Scanner QR Code**: Pembuatan label aset untuk inventaris fisik dan pemindai kamera web terintegrasi.
9. **Omnibox Quick Search (`Ctrl + K` / `Cmd + K`)**: Pencarian instan lintas aset, tiket kendala, peminjaman, dan nama pegawai.

---

## 🚀 Panduan Menjalankan Sistem

### 1. Prasyarat Lingkungan
- Docker Engine / Docker Desktop dan Docker Compose v2.
- Port host 80 (web) dan 5432 (PostgreSQL admin lokal); keduanya dapat diubah di `.env`.

### 2. Runtime tunggal: Docker Compose
Development, UAT, dan deployment menggunakan arsitektur yang sama: app + PostgreSQL berjalan di Docker Compose. Jangan menjalankan server TSX/Node langsung di host; `npm run dev` dan `npm start` juga diarahkan ke Docker Compose agar tidak ada dua instance dengan konfigurasi database berbeda.

```bash
cp .env.example .env
# Isi PGADMIN_PASSWORD (akun admin DB), PGPASSWORD (akun aplikasi DB), dan kredensial bootstrap aplikasi. Keduanya harus berbeda. Untuk UAT lokal saja, set GABAH_APP_MODE=uat dan GABAH_TEST_PASSWORD yang sama untuk semua akun kanonik; jangan gunakan mode/password UAT pada deployment live.
docker compose config
docker compose up -d --build
docker compose ps
docker compose logs -f --tail=200 app
```

Buka `http://localhost` (host port default 80).

Kontrak koneksi internal:
- Browser → host port `GABAH_WEB_PORT` (default 80) → app container port 3000.
- App → PostgreSQL melalui hostname service `database:5432` memakai role aplikasi non-superuser (`PGUSER`).
- Akun bootstrap PostgreSQL (`PGADMIN_USER`) hanya dipakai service database, backup/administrasi, dan one-shot `database-provisioner`; password admin tidak diteruskan ke container aplikasi.
- Rate limit API/login disimpan bersama di PostgreSQL; `GABAH_RATE_LIMIT_SECRET` sebaiknya diisi dengan secret acak yang sama pada seluruh replika agar hash bucket stabil dan tidak bisa ditebak dari dump database. Jika kosong, app memakai `PGPASSWORD`.
- Untuk volume lama, set `PGADMIN_USER` dan `PGADMIN_PASSWORD` sesuai akun bootstrap yang sudah ada; `PGUSER`/`PGPASSWORD` menjadi login aplikasi baru. Provisioner memindahkan ownership objek database sebelum app dinyalakan.
- PostgreSQL host port `127.0.0.1:GABAH_DB_PORT` (default 5432) hanya untuk administrasi; app tidak menggunakannya.
- App menunggu healthcheck PostgreSQL dan berjalan fail-fast jika database/migrasi gagal. Tidak ada file-store fallback pada runtime Compose.
- Container aplikasi berjalan sebagai user non-root, root filesystem read-only, seluruh Linux capabilities dibuang, `no-new-privileges` aktif, PID dibatasi, dan hanya `/tmp` serta volume upload yang writable.
- Jika port host bentrok, ubah `GABAH_WEB_PORT` atau `GABAH_DB_PORT`; jangan ubah `PGHOST=database` / `PGPORT=5432` internal.

### 3. Operasional Harian
```bash
npm run docker:up     # start / rebuild
npm run docker:ps     # status container
npm run docker:logs   # log app + database
npm run docker:down   # stop; named volumes tetap tersimpan
```

**Jangan** gunakan `docker compose down -v` untuk operasional normal karena menghapus volume database dan uploads.

### 4. Pengecekan Kualitas Kode
```bash
npm run lint
npm run build
```

### 5. Deployment
Server Linux menggunakan Docker Compose yang sama. Jalankan `chmod +x deploy.sh && ./deploy.sh` setelah `.env` production disiapkan.

---
## 📁 Struktur Direktori Utama

```text
/
├── server.ts                    # Server Express terpadu (Vite middleware dev / Static prod)
├── server/                      # Modul backend & business logic
│   ├── auth.ts                  # Autentikasi sesi cookie/Bearer, rate limiting, hashing
│   ├── crypto.ts                # SHA-256 + salt password hashing & token generation
│   ├── db.ts                    # In-memory store, seeder, legacy-compatible users normalized by Dynamic RBAC
│   ├── migrations/              # Skema SQL PostgreSQL (DDL, Auth, Trigger)
│   ├── numbering.ts             # Generator nomor aset server-side berdasarkan aturan aktif
│   ├── persistence.ts           # PostgreSQL authoritative, recovery snapshot, dev file-store
│   ├── runtime-hardening.ts     # Middleware keamanan API, anti-spoofing, legacy Auditor deny-write guard
│   ├── services.ts              # GabahDomainService (logika aset, pinjam, tiket, ruang rapat)
│   └── taxonomy.ts              # Master taksonomi aset PSAK 16 BUMD
├── src/                         # Frontend React 19 SPA
│   ├── components/
│   │   ├── auth/                # Halaman autentikasi dan pemulihan sesi
│   │   ├── landing/             # Halaman publik profil sistem
│   │   ├── modals/              # 14 modal dialog (CreateAsset, BAST, Reservation, dll)
│   │   ├── views/               # 11 tampilan modul utama
│   │   ├── HeaderNavbar.tsx     # Top bar, menu profil pengguna, notifikasi
│   │   └── Sidebar.tsx          # Navigasi tab & Administration Control Panel
│   ├── data/mockData.ts         # Data inisial sinkron
│   ├── services/gabahApi.ts     # Klien API browser dengan cookie same-origin; Bearer untuk API clients
│   ├── types.ts                 # Definisi tipe data & antarmuka TypeScript
│   ├── App.tsx                  # Root controller aplikasi
│   └── main.tsx                 # Bootstrap entry point React DOM
├── scripts/
│   ├── build-server.cjs         # Script kompilasi server ke dist/server.cjs
│   └── reset-temporary-users.mjs# Script utility database seeder
├── docs/                        # Dokumentasi teknis terpusat (Source of Truth)
├── docker-compose.yml           # Konfigurasi container produksi
├── deploy.sh                    # Skrip deploy otomatis server Linux
└── package.json                 # Dependensi & script eksekusi
```

---

## 📚 Dokumentasi Utama & Peta Acuan

Mulai dari [Documentation Authority & AI Handoff Guide](./docs/GABAH-DOCUMENTATION-CONTROL.md). Dokumentasi GABAH dikelola sebagai spesifikasi hidup. Tidak ada satu file yang sendirian menjadi sumber kebenaran untuk seluruh aspek: keputusan bisnis, implementasi, dan bukti tes memiliki fungsi serta otoritas berbeda. **Jangan menganggap semua dokumen otomatis sinkron**; status implementasi harus dibuktikan dari kode, migrasi, dan pengujian pada commit yang disebutkan.

- **Produk & Kebutuhan**:
  - [docs/PROJECT-CONTEXT.md](./docs/PROJECT-CONTEXT.md) — keputusan dan batasan bisnis yang disetujui pemilik produk; bukan bukti implementasi
  - [docs/IMPLEMENTATION-TRUTH-REGISTER.md](./docs/IMPLEMENTATION-TRUTH-REGISTER.md) — perilaku yang ditemukan pada source baseline, status parsial, dan gap implementasi; bukan bukti tes
  - [PRD.md](./PRD.md) — Product Requirements Document lengkap
  - [PROJECT-RULES.md](./PROJECT-RULES.md) — Aturan proyek, standar kode, dan kebijakan zero-Laravel
  - [docs/product/REQUIREMENTS.md](./docs/product/REQUIREMENTS.md) — Spesifikasi kebutuhan fungsional & non-fungsional
  - [docs/product/BUSINESS-RULES.md](./docs/product/BUSINESS-RULES.md) — Matriks aturan bisnis otoritatif
- **Arsitektur & Keamanan**:
  - [docs/architecture/ARCHITECTURE.md](./docs/architecture/ARCHITECTURE.md) — Arsitektur sistem fullstack & alur data
  - [docs/architecture/RBAC.md](./docs/architecture/RBAC.md) — model Dynamic RBAC, permission, data scope, dan titik penegakan kode
  - [docs/architecture/DATABASE-DESIGN.md](./docs/architecture/DATABASE-DESIGN.md) — Skema tabel PostgreSQL, relasi, indeks, & trigger
  - [docs/architecture/API-DESIGN.md](./docs/architecture/API-DESIGN.md) — baseline kontrak API; endpoint dan auth wajib diverifikasi ke exact commit
  - [docs/architecture/DECISIONS.md](./docs/architecture/DECISIONS.md) — Architectural Decision Records (ADRs) yang telah diterapkan
- **Desain, Aset & Pengujian**:
  - [docs/design/DESIGN-SYSTEM.md](./docs/design/DESIGN-SYSTEM.md) — Tipografi, palet warna korporat, tombol, form, dan modal
  - [docs/asset/ASSET-NUMBERING.md](./docs/asset/ASSET-NUMBERING.md) — catatan implementasi generator dan kebijakan penomoran yang masih menunggu standar korporat
  - [docs/testing/UAT.md](./docs/testing/UAT.md) — Skenario pengujian penerimaan pengguna (UAT) dan uji keamanan negatif
- **Catatan Audit Sebelumnya**:
  - [AUDIT_NOTES.md](./AUDIT_NOTES.md) — Catatan rekam jejak pembaruan dan changelog audit

---
