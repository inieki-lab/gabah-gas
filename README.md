# GABAH — General Asset, Business & Automated Helpdesk

> **GABAH** (*General Asset, Business & Automated Helpdesk*)  
> Portal internal enterprise terpadu PT Food Station Tjipinang Jaya (Perseroda) — BUMD Pangan DKI Jakarta.  
> Mengelola inventaris aset multi-divisi (IT, GA, Supply Chain, PIBC), peminjaman barang dinas anti-bentrok jadwal dengan Berita Acara Serah Terima (BAST), pelaporan helpdesk kendala operasional berbasis SLA otomatis, pemeliharaan berkala (*preventive maintenance* & tera timbangan 60 ton), reservasi ruang rapat VIP dengan koordinasi fasilitas multi-divisi (IT, GA, Pantry, Humas), serta audit trail kepatuhan BUMD.

---

## 🛠️ Current Tech Stack

- **Frontend**: React 19, TypeScript (~5.8), Vite 6, Tailwind CSS v4, Lucide React, Motion.
- **Backend / API**: Node.js 20, Express 4.21, TSX (development runtime), esbuild (production bundler).
- **Authoritative Database**: PostgreSQL 17 (driver `pg`), normalized relational schema (16 tabel/model) dengan migrasi SQL otomatis dan trigger anti-bentrok.
- **Resilience Layer**: Dual-persistence engine dengan fail-safe snapshot store (`server/data/gabah_state.json`).
- **Containerization**: Docker Compose (`gabah_database` + `gabah_app`).

---

## 🌾 Fitur Utama (Core Modules)

1. **Katalog Aset Multi-Divisi**: Pencatatan hardware IT, lisensi SaaS, furniture GA, kendaraan dinas, mesin pabrik beras SC, dan jembatan timbang PIBC dengan standar akuntansi PSAK 16 BUMD.
2. **Penomoran Aset Otomatis**: Generator kanonikal `{OWNER_DIVISION}-{ASSET_CODE}-{YEAR}-{SEQUENCE}` dan rekonsiliasi Accurate ERP.
3. **Peminjaman Barang Anti-Bentrok**: Validasi ketersediaan aset per tanggal berbasis server, alur persetujuan divisi pemilik, dan cetak BAST digital.
4. **Helpdesk & Tiket SLA**: Pelaporan kendala operasional dengan kalkulasi tenggat waktu SLA otomatis (Urgent 4h, High 8h, Medium 24h, Low 48h).
5. **Preventive Maintenance**: Penjadwalan servis rutin armada logistik, AC ruang server, serta kalibrasi tera berkala jembatan timbang 60 ton PIBC.
6. **Reservasi Ruang Rapat VIP**: Reservasi representatif dengan prioritas VIP auto-approval untuk Sekretariat Direksi, serta notifikasi otomatis ke IT Support (alat vicon/proyektor), GA Sarpras (sarana fisik), GA Pantry (konsumsi), dan Humas (dokumentasi liputan).
7. **Dynamic Role-Based Access Control**: role aplikasi, permission, dan data scope dikelola terpisah; pegawai dapat memiliki role primer dan role tambahan. Supply Chain/PIBC adalah unit atau lokasi kerja, bukan role aplikasi permanen. Backend PostgreSQL menjadi otoritas permission dan scope.
8. **Label & Scanner QR Code**: Pembuatan label aset untuk inventaris fisik dan pemindai kamera web terintegrasi.
9. **Omnibox Quick Search (`Ctrl + K` / `Cmd + K`)**: Pencarian instan lintas aset, tiket kendala, peminjaman, dan nama pegawai.

---

## 🚀 Panduan Menjalankan Sistem

### 1. Prasyarat Lingkungan
- Docker Engine dengan Docker Compose v2
- Port TCP 80 dan 5432 tersedia pada laptop/server (keduanya dapat diubah melalui `.env`)

**Aturan runtime tunggal:** development, UAT, dan deployment menjalankan aplikasi dan PostgreSQL melalui Docker Compose. Jangan menjalankan server TSX atau Node lokal; perintah `npm run dev` dan `npm start` diarahkan ke Docker Compose agar tidak tercipta dua instance dengan konfigurasi database berbeda.

### 2. Konfigurasi dan Menjalankan GABAH
```bash
# Siapkan konfigurasi satu kali
cp .env.example .env
```

Edit `.env` dan isi sekurang-kurangnya `PGPASSWORD`, `GABAH_INITIAL_ADMIN_PASSWORD`, serta `GABAH_INITIAL_USER_PASSWORD` dengan secret kuat dan unik. Jangan commit atau membagikan file ini.

Konfigurasi koneksi internal sudah baku dan tidak perlu diubah:
- App → PostgreSQL: hostname `database`, port container `5432`.
- Browser → App: `http://localhost:80`.
- Port database host hanya bind ke `127.0.0.1:5432` untuk administrasi lokal; aplikasi **tidak** menggunakan port host tersebut.
- PostgreSQL adalah authoritative store. App menunggu healthcheck database sebelum start dan berjalan dalam mode production fail-fast, bukan file-store fallback.

Jalankan:
```bash
docker compose config
docker compose up -d --build
docker compose ps
docker compose logs -f --tail=200 app
```

Buka `http://localhost`. Jika port host 80 atau 5432 sudah dipakai, ubah hanya `GABAH_WEB_PORT` atau `GABAH_DB_PORT` di `.env`; jangan mengubah `PGHOST=database` dan `PGPORT=5432` pada konfigurasi container.

### 3. Operasional Harian
```bash
# Start / rebuild
npm run docker:up

# Lihat status container
npm run docker:ps

# Lihat log aplikasi dan database
npm run docker:logs

# Stop tanpa menghapus data
npm run docker:down
```

**Penting:** jangan gunakan `docker compose down -v` untuk operasional normal karena opsi tersebut menghapus volume database dan upload.

### 4. Pengecekan Kualitas Kode
Pengecekan statis dan test tetap dijalankan melalui script npm yang tersedia:
```bash
npm run lint
npm run build
```
Build image runtime dilakukan dengan `docker compose up -d --build`. Migrasi SQL berjalan otomatis saat boot aplikasi, setelah PostgreSQL sehat.

### 5. Deployment
Deployment server Linux menggunakan konfigurasi Docker Compose yang sama:
```bash
chmod +x deploy.sh
./deploy.sh
```
Pastikan file `.env` server berisi secret production dan port publik diproteksi firewall/reverse proxy sesuai kebijakan jaringan.

---

## 📁 Struktur Direktori Utama

```text
/
├── server.ts                    # Server Express terpadu (Vite middleware dev / Static prod)
├── server/                      # Modul backend & business logic
│   ├── auth.ts                  # Autentikasi sesi token Bearer, rate limiting, hashing
│   ├── crypto.ts                # SHA-256 + salt password hashing & token generation
│   ├── db.ts                    # In-memory store, seeder, canonical users (9 roles)
│   ├── migrations/              # Skema SQL PostgreSQL (DDL, Auth, Trigger)
│   ├── numbering.ts             # Generator nomor kanonikal aset, tiket, pinjaman
│   ├── persistence.ts           # PostgreSQL pool & dual-persistence resilience
│   ├── runtime-hardening.ts     # Middleware keamanan API, anti-spoofing, auditor guard
│   ├── services.ts              # GabahDomainService (logika aset, pinjam, tiket, ruang rapat)
│   └── taxonomy.ts              # Master taksonomi aset PSAK 16 BUMD
├── src/                         # Frontend React 19 SPA
│   ├── components/
│   │   ├── auth/                # Halaman login & 1-click persona switch
│   │   ├── landing/             # Halaman publik profil sistem
│   │   ├── modals/              # 14 modal dialog (CreateAsset, BAST, Reservation, dll)
│   │   ├── views/               # 11 tampilan modul utama
│   │   ├── HeaderNavbar.tsx     # Top bar, switcher persona, notifikasi
│   │   └── Sidebar.tsx          # Navigasi tab & Administration Control Panel
│   ├── data/mockData.ts         # Data inisial sinkron
│   ├── services/gabahApi.ts     # Klien API fetch dengan Bearer token
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

## 📚 Dokumentasi Utama (Single Source of Truth)

Seluruh dokumentasi telah disinkronkan secara presisi dengan source code aktual:

- **Produk & Kebutuhan**:
  - [PRD.md](./PRD.md) — Product Requirements Document lengkap
  - [PROJECT-RULES.md](./PROJECT-RULES.md) — Aturan proyek, standar kode, dan kebijakan zero-Laravel
  - [docs/product/REQUIREMENTS.md](./docs/product/REQUIREMENTS.md) — Spesifikasi kebutuhan fungsional & non-fungsional
  - [docs/product/BUSINESS-RULES.md](./docs/product/BUSINESS-RULES.md) — Matriks aturan bisnis otoritatif
- **Arsitektur & Keamanan**:
  - [docs/architecture/ARCHITECTURE.md](./docs/architecture/ARCHITECTURE.md) — Arsitektur sistem fullstack & alur data
  - [docs/architecture/RBAC.md](./docs/architecture/RBAC.md) — Matriks izin akses 9 peran resmi & titik penegakan kode
  - [docs/architecture/DATABASE-DESIGN.md](./docs/architecture/DATABASE-DESIGN.md) — Skema tabel PostgreSQL, relasi, indeks, & trigger
  - [docs/architecture/API-DESIGN.md](./docs/architecture/API-DESIGN.md) — Spesifikasi 46 endpoint REST API aktual
  - [docs/architecture/DECISIONS.md](./docs/architecture/DECISIONS.md) — Architectural Decision Records (ADRs) yang telah diterapkan
- **Desain, Aset & Pengujian**:
  - [docs/design/DESIGN-SYSTEM.md](./docs/design/DESIGN-SYSTEM.md) — Tipografi, palet warna korporat, tombol, form, dan modal
  - [docs/asset/ASSET-NUMBERING.md](./docs/asset/ASSET-NUMBERING.md) — Standar penomoran aset kanonikal & rekonsiliasi Accurate ERP
  - [docs/testing/UAT.md](./docs/testing/UAT.md) — Skenario pengujian penerimaan pengguna (UAT) dan uji keamanan negatif
- **Catatan Audit Sebelumnya**:
  - [AUDIT_NOTES.md](./AUDIT_NOTES.md) — Catatan rekam jejak pembaruan dan changelog audit

---
