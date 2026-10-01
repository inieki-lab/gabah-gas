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
7. **Role-Based Access Control (9 Peran Resmi)**: Admin GABAH, IT, GA, Sekretaris Direksi, Humas, Supply Chain, PIBC, Karyawan, dan Auditor (Satuan Pengawas Internal — Read Only).
8. **Label & Scanner QR Code**: Pembuatan label aset untuk inventaris fisik dan pemindai kamera web terintegrasi.
9. **Omnibox Quick Search (`Ctrl + K` / `Cmd + K`)**: Pencarian instan lintas aset, tiket kendala, peminjaman, dan nama pegawai.

---

## 🚀 Panduan Menjalankan Sistem

### 1. Prasyarat Lingkungan
- Node.js versi 20 atau lebih baru
- npm versi 10 atau lebih baru (atau Docker & Docker Compose)

### 2. Mode Pengembangan (Development)
```bash
# Salin konfigurasi environment
cp .env.example .env
```

#### Variabel Environment Utama (Ringkasan — lihat `.env.example` untuk daftar lengkap)

| Variabel | Fungsi |
|---|---|
| `DATABASE_URL` | PostgreSQL otoritatif (CR-04). Kosong = dev fallback file store; production fail-fast bila gagal. |
| `GABAH_INITIAL_ADMIN_PASSWORD` / `GABAH_INITIAL_USER_PASSWORD` | Password awal akun kanonikal (CR-02); tanpa ini dev memakai CSPRNG. |
| `GABAH_SMTP_HOST` + `GABAH_SMTP_FROM` (+ `GABAH_SMTP_PORT/SECURE/USER/PASSWORD/TLS_REJECT_UNAUTHORIZED`) | Relay SMTP pengiriman email reminder kontrak (CR-05); tanpa itu status email = `skipped`. |
| `TELEGRAM_BOT_TOKEN` (+ `GABAH_TELEGRAM_TIMEOUT_MS/API_BASE`) | Bot API Telegram pengiriman reminder (CR-05); tanpa itu status = `skipped`. |
| `GABAH_REMINDER_TIMEZONE` | Zona waktu due-day reminder (default `Asia/Jakarta`). |
| `GABAH_REMINDER_INTERVAL_MS` | Interval scheduler reminder (default 1 jam, min 60 detik). |
| `GABAH_REMINDER_SCHEDULER_DISABLED` | `true` = matikan scheduler internal. |
| `GABAH_REMINDER_RUN_ON_BOOT` | `false` = jangan sweep saat boot.

# Install dependensi
npm install

# Jalankan server fullstack development (port 3000)
npm run dev
```
Buka browser pada: `http://localhost:3000`.

### 3. Pengecekan Kualitas Kode (Lint & Typecheck)
```bash
npm run lint
```

### 4. Build untuk Lingkungan Produksi
```bash
# Kompilasi frontend (Vite) dan backend server (esbuild)
npm run build

# Menjalankan server hasil kompilasi (port 3000)
npm start
```

### 5. Menjalankan Menggunakan Docker Compose (Produksi)
```bash
# Menjalankan database PostgreSQL 17 dan aplikasi Node.js 20
docker compose up -d --build
```
Aplikasi akan aktif pada: `http://localhost` (Port 80).  
Tersedia juga skrip otomasi deployment:
```bash
chmod +x deploy.sh
./deploy.sh
```

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
*PT Food Station Tjipinang Jaya (Perseroda) — Ketahanan & Kedaulatan Pangan DKI Jakarta*
