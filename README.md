# GABAH - Enterprise Asset, Helpdesk & Maintenance Management Portal

> **GABAH** (Gerbang Aset & Bantuan Andal Terpadu - PT Food Station Tjipinang Jaya)  
> Portal internal modern untuk manajemen inventaris aset BUMD pangan, kendaraan dinas, perangkat IT, software & lisensi, peminjaman barang dinas (anti-bentrok jadwal), pemeliharaan berkala (*preventive maintenance*), cetak BAST digital & QR label, serta sistem tiket *helpdesk* terintegrasi.

---

## 🌾 Fitur Utama (Core Modules)

1. **Katalog Aset Komprehensif (Multi-Divisi)**
   - Mendukung pencatatan aset multi-kategori: **IT Hardware & Network** (Laptop, Server, Firewall, Access Point), **General Affairs / Kendaraan Dinas** (Avanza, Innova, Elf), dan **Supply Chain / PIBC** (Truk Tronton Beras, Jembatan Timbang Truk 60 Ton, Mesin Sortasi).
   - Penomoran aset standar korporat & internal (`IT-HLT-2026-0001`, `GA-VOP-2026-0001`, `SC-WGH-2026-0001`).
   - Riwayat pemegang (*custodian*), lokasi ruang/gudang, status ketersediaan, nilai perolehan, dan nilai buku depresiasi.
   - Filter cepat dengan *counter badge* dinamis untuk memantau status aset secara real-time.

2. **Servis & Maintenance Berkala (Preventive Maintenance & Calibration)**
   - Kalender dan pengingat servis rutin untuk armada logistik, AC ruang server *Data Center*, dan tera resmi jembatan timbang Pasar Induk Beras Cipinang (PIBC).
   - Pengelompokan frekuensi (Bulanan, Triwulan, Semester, Tahunan, Insidental).
   - Pencatatan teknisi/bengkel rekanan, estimasi biaya pemeliharaan, serta *checklist* pekerjaan teknis.

3. **Peminjaman Barang & Kendaraan Anti-Bentrok (Conflict-Free Loans)**
   - Validasi ketersediaan aset otomatis pada rentang tanggal yang dipilih.
   - Alur persetujuan (*Approval Workflow*) bertingkat: *Pending*, *Disetujui*, *Sedang Dipinjam*, dan *Dikembalikan*.
   - Pembuatan Dokumen Berita Acara Serah Terima (**BAST**) otomatis dengan nomor resmi siap cetak/unduh.

4. **Sistem Tiket Helpdesk & Gangguan (IT & GA Support)**
   - Pelaporan gangguan operasional cepat untuk seluruh karyawan.
   - Tingkat prioritas (*Low*, *Medium*, *High*, *Urgent*) dengan matriks penanganan SLA.
   - Penugasan teknisi (*Assignee*) dan *timeline log* penyelesaian masalah.

5. **Manajemen Software & Lisensi SaaS**
   - Pemantauan alokasi kursi (*seats usage*), masa berlaku lisensi (*expiry date*), dan kunci lisensi.

6. **Quick Search Omnibox (`Ctrl + K` / `Cmd + K`)**
   - Pencarian global instan di seluruh data aset, nomor tiket kendala, peminjaman barang, dan nama karyawan.

7. **Label QR Code & QR Scanner Terintegrasi**
   - Pembuatan label QR Code aset untuk ditempel pada unit inventaris.
   - Fitur kamera pemindai QR untuk audit cepat di lapangan (*Stock Opname*).

8. **Manajemen Pengguna & Multi-Role Access Control (RBAC)**
   - Dukungan peran: *Admin GABAH*, *IT Support*, *General Affairs (GA)*, *Supply Chain*, *Auditor*, *Management*, dan *Staff/Karyawan*.

---

## 🛠️ Tech Stack & Arsitektur

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Motion.
- **Backend / Dev Server**: Node.js, Express, TSX, Vite Middleware.
- **Blueprint Arsitektur Enterprise**: Tersedia spesifikasi arsitektur backend Laravel 11 (`/opt/gabah`) dengan migrasi database, model Eloquent, dan *Controller Resource*.

---

## 🚀 Panduan Menjalankan Project

### 1. Instalasi Dependensi
```bash
npm install
```

### 2. Menjalankan Server Development
```bash
npm run dev
```
Aplikasi dapat diakses pada port default: `http://localhost:3000`.

### 3. Pengecekan Tipe (Type Check / Lint)
```bash
npm run lint
```

### 4. Build untuk Lingkungan Produksi
```bash
npm run build
npm run start
```

---

## 📁 Struktur Direktori
```text
├── src/
│   ├── components/
│   │   ├── auth/          # Halaman login & otentikasi
│   │   ├── landing/       # Landing page profil sistem
│   │   ├── modals/        # Modal detail aset, BAST, scanner QR, global search
│   │   ├── views/         # Modul tampilan utama (Assets, Loans, Tickets, Maintenance, dll)
│   │   ├── HeaderNavbar.tsx
│   │   └── Sidebar.tsx
│   ├── data/              # Mock data & inisialisasi inventaris
│   ├── services/          # Abstraksi API service
│   ├── types.ts           # Definisi tipe data & antarmuka TypeScript
│   ├── App.tsx            # Komponen root aplikasi
│   └── main.tsx           # Entry point aplikasi
├── server.ts              # Server Express dengan integrasi Vite middleware
├── opt/gabah/             # Cetak biru arsitektur Laravel enterprise
└── package.json           # Konfigurasi dependensi dan skrip build
```

---
*Dikembangkan untuk PT Food Station Tjipinang Jaya (BUMD Pangan DKI Jakarta)*
