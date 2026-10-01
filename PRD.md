# GABAH — Product Requirements Document (PRD)

**Nama Produk:** GABAH (*General Asset, Business & Automated Helpdesk*)  
**Organisasi Pemilik:** PT Food Station Tjipinang Jaya (Perseroda) — BUMD Pangan DKI Jakarta  
**Versi Sistem:** 2026.1.0-enterprise  
**Status Dokumen:** Authoritative Source of Truth (Tersinkronisasi Penuh dengan Source Code Aktual)  
**Terakhir Diperbarui:** 28 September 2026  

---

## 1. Latar Belakang & Visi Produk

PT Food Station Tjipinang Jaya (Perseroda) mengelola aset bernilai tinggi yang tersebar di berbagai unit operasional strategis:
- Kantor Pusat Cipinang
- Komplek Pergudangan Pasar Induk Beras Cipinang (PIBC)
- Depo Logistik & Transportasi Truk Distribusi Pangan
- Data Center & Server Room
- Sentra Pengolahan Beras (Rice Milling Plant) di daerah mitra

Sebelum adanya GABAH, pencatatan aset inventaris, penjadwalan pemeliharaan armada/mesin, peminjaman barang dinas, pelaporan tiket kendala operasional, dan reservasi fasilitas ruang rapat VIP masih terfragmentasi.

**GABAH** hadir sebagai portal internal perusahaan terpadu (*single pane of glass*) untuk:
1. **Manajemen Inventaris Multi-Divisi**: Pencatatan aset komprehensif (IT Hardware, Software & Lisensi SaaS, Sarana/Prasarana General Affairs, Mesin Pengolahan Beras Supply Chain, dan Timbangan Pasar PIBC) dengan klasifikasi akuntansi PSAK 16 BUMD.
2. **Penomoran Aset Standar Korporat**: Generator nomor otomatis terpusat `{OWNER_DIVISION}-{ASSET_CODE}-{YEAR}-{SEQUENCE}` dan rekonsiliasi nomor ERP Accurate BUMD.
3. **Peminjaman Aset Anti-Bentrok Jadwal (*Conflict-Free Loans*)**: Validasi tumpang tindih tanggal berbasis server untuk aset pool, alur persetujuan divisi pemilik, dan cetak Berita Acara Serah Terima (BAST).
4. **Helpdesk & Gangguan Layanan (SLA-Driven)**: Pelaporan kendala operasional dengan matriks SLA otomatis (Urgent 4 jam, High 8 jam, Medium 24 jam, Low 48 jam) dan eskalasi teknisi.
5. **Pemeliharaan Berkala (*Preventive Maintenance & Calibration*)**: Kalender servis berkala armada logistik, AC data center, genset, serta uji tera resmi jembatan timbang PIBC.
6. **Reservasi Ruang Rapat VIP & Otomatisasi Fasilitas**: Pemesanan ruang rapat dengan penanganan prioritas Direksi, deteksi tabrakan jadwal, serta perutean notifikasi otomatis multi-divisi (IT Support untuk alat vicon/proyektor, GA Sarpras untuk fisik, GA Pantry untuk konsumsi, dan Humas untuk peliputan/dokumentasi).
7. **Kepatuhan & Audit Trail BUMD**: Pencatatan log mutasi dan aktivitas administratif yang tidak dapat diubah (*immutable audit logs*), inspeksi kepatuhan Satuan Pengawas Internal (SPI/Auditor).
8. **Contract Management (Domain Tersendiri)**: Register kontrak lintas divisi (security → GA, maintenance firewall → IT, supplier beras → SC, layanan pasar → PIBC, kontrak divisi lain sesuai pemilik) dengan PIC, dokumen append-only (original/amendment/renewal/supporting), nilai kontrak, notice period + notice date, reminder kedaluwarsa configurable (default 60/35/7 hari) via in-app, email, dan Telegram dengan log pengiriman per channel berstatus jujur (sent/failed/skipped — tanpa sukses palsu), scheduler otomatis idempoten per hari, keputusan renewal (outcome + notes), dashboard kedaluwarsa berfilter, dan audit trail. **Contract Management adalah domain tersendiri; Contract bukan kategori Helpdesk.** Ticket dapat ditautkan ke Contract (`contract_id`) apabila terdapat pekerjaan yang perlu ditindaklanjuti.

---

## 2. Persona & Pengguna Sasaran (9 Peran Resmi)

Sistem GABAH mengimplementasikan **9 peran pengguna aktif** dengan kredensial kanonikal yang terdaftar pada sistem:

| No | Peran (Role) | Persona Uji | Divisi Utama | Lingkup Tanggung Jawab & Hak Akses |
|:---|:---|:---|:---|:---|
| 1 | **Admin GABAH** | Budi Santoso | IT (MIS & TI) | Super Administrator. Kontrol penuh seluruh modul, Master Data, Manajemen Pengguna, Persetujuan Penghapusan Aset (*Disposal*), Override Reservasi, dan Akses Administration Control Panel. |
| 2 | **IT** | Dani Setiawan | IT (MIS & TI) | Pengelola seluruh aset komputasi, hardware jaringan, server, lisensi software, penanganan tiket kategori IT/License, persetujuan pinjaman laptop/proyektor, serta penyiapan fasilitas IT ruang rapat. |
| 3 | **GA** | Siti Rahmawati | General Affairs | Pengelola aset umum (furniture, peralatan kantor, kendaraan dinas, gedung), persetujuan pinjaman kendaraan kantor, pengelolaan tiket GA, persetujuan reservasi ruang rapat, dan koordinasi konsumsi pantry. |
| 4 | **Sekretaris Direksi** | Dewi Anggraini, S.Sos | GA (Sekretariat Direksi) | Pemesanan ruang rapat prioritas tinggi untuk jajaran Direksi & Dewan Komisaris (otomatis disetujui / auto-approved), peminjaman perlengkapan rapat, dan pelaporan kendala eksekutif. |
| 5 | **Humas** | Rina Kartika, M.I.Kom | GA (Humas & Protokoler) | Menerima notifikasi khusus permintaan peliputan dan dokumentasi acara/rapat VIP (foto, video, press release). Akses menu aset disembunyikan sesuai SOP protokoler. |
| 6 | **Supply Chain** | Agus Pratama | Supply Chain | Pengelola aset mesin pabrik beras, conveyor packaging, forklift gudang, armada truk tronton beras, tiket operasional pergudangan, dan pemeliharaan mesin produksi. |
| 7 | **PIBC** | Bambang Hermawan | PIBC (Pasar Induk) | Pengawas sarana prasarana Pasar Induk Beras Cipinang, mesin jembatan timbang truk 60 ton, kalibrasi tera resmi, dan penanganan kendala fasilitas los/kios pedagang. |
| 8 | **Karyawan** | Hendra Wijaya | Komersial / Operasional | Staf umum perusahaan. Melihat aset kerja yang ditugaskan (*Aset Saya*), mengajukan peminjaman barang dinas, membuat tiket bantuan IT/GA, dan mereservasi ruang rapat. |
| 9 | **Auditor** | Maya Indriani, SE, Ak, CA | Audit (SPI) | Pengawas kepatuhan internal. Hak akses **Read-Only** ke seluruh modul katalog aset, log sirkulasi, log audit, rekonsiliasi Accurate, dan riwayat helpdesk. Dilarang melakukan mutasi data (403 Forbidden). |

---

## 3. Fitur Utama Sistem (Core Capabilities)

### 3.1 Manajemen Aset Multi-Divisi & Taksonomi PSAK 16
- Pencatatan spesifikasi lengkap: Merek, Model, Nomor Seri, Tanggal Perolehan, Nilai Pembelian, Masa Garansi, Lokasi Fisik, dan Penanggung Jawab (*Custodian*).
- Klasifikasi Aset Tetap PSAK 16:
  - `TNH`: Tanah & Lahan
  - `BGN`: Bangunan Fisik & Gudang
  - `MSN`: Mesin Produksi & Timbangan PIBC
  - `KDR`: Kendaraan Dinas & Truk Logistik
  - `INV-F`: Inventaris Furniture (Wajib Milik Divisi GA secara sentral)
  - `INV-P`: Inventaris Peralatan Kantor (Dispenser, AC, APAR)
  - `IT-H`: Hardware Komputer (Wajib Milik Divisi IT)
  - `IT-S`: Lisensi Software & SaaS (Wajib Milik Divisi IT)
  - `LNY`: Aset Tetap Lainnya
- Siklus Hidup Aset (*Lifecycle*): `active`, `assigned`, `available`, `reserved`, `in_repair`, `damaged`, `cannibalized`, `pending_disposal`, `pending_auction`, `auctioned`, `disposed`, `lost`, `inactive`.
- Integrasi QR Code: Pembuatan kode QR individual, cetak batch label QR standar barcode label, dan pemindai kamera terintegrasi untuk stock opname.

### 3.2 Penomoran Otomatis & Rekonsiliasi ERP
- Generator nomor kanonikal: `{OWNER_DIVISION}-{ASSET_CODE}-{YEAR}-{SEQUENCE}`.
- Pemisahan tegas antara nomor sistem kanonikal dan nomor Accurate ERP (`corporate_asset_number`).
- Fitur pencocokan dan penautan nomor Accurate pada modul Rekonsiliasi.

### 3.3 Sirkulasi Peminjaman Barang & BAST
- Katalog barang pinjaman (*loanable assets pool*).
- Validasi pencegahan tabrakan jadwal (*schedule anti-collision*) di backend: mencegah peminjaman aset yang sama pada rentang waktu yang saling bersinggungan.
- Alur 4 tahap: Pengajuan (*Pending*) → Persetujuan Divisi Pemilik (*Approved*) → Serah Terima Fisik (*Borrowed*) → Pengembalian & Inspeksi Kondisi Fisik (*Returned*).
- Generator Berita Acara Serah Terima (BAST) otomatis dengan nomor dokumen resmi, data peminjam, inspeksi fisik, dan klausul tanggung jawab dinas.

### 3.4 Helpdesk Tiket SLA & Eskalasi
- Pelaporan gangguan oleh seluruh karyawan.
- Perhitungan SLA otomatis berbasis jam kerja dan prioritas masalah:
  - `urgent`: SLA 4 jam
  - `high`: SLA 8 jam
  - `medium`: SLA 24 jam
  - `low`: SLA 48 jam
- Penugasan teknisi (*Assignee*), pelacakan status (`open`, `in_progress`, `pending_vendor`, `resolved`, `closed`), catatan solusi (*resolution notes*), dan rating kepuasan.

### 3.5 Kategori Helpdesk Ticket (Strict Divisional)
Kategori tiket helpdesk bersifat divisial dan **terbatas**: `IT`, `GA`, `SC`, `PIBC`.
- Software/License/SaaS (Accurate, Microsoft 365, VPN, aktivasi lisensi) → kategori `IT` (License adalah domain aset, bukan kategori tiket).
- Hardware, jaringan, server, akun → `IT`. Fasilitas gedung → `GA`. Permintaan pergudangan → `SC`. Kendaraan Pasar Induk → `PIBC`.
- **Contract Management adalah domain tersendiri dan BUKAN kategori Helpdesk.** Ticket dapat ditautkan ke Contract apabila terdapat pekerjaan/action yang perlu ditindaklanjuti (`contract_id` pada tiket).

### 3.6 Preventive Maintenance & Kalibrasi Tera
- Penjadwalan perawatan berkala: Mingguan, Bulanan, Triwulan, Semester, Tahunan, atau Insidental.
- Pencatatan teknisi, vendor rekanan, estimasi biaya, realisasi biaya, dan checklist pekerjaan teknis.
- Pengawasan kalibrasi tera berkala jembatan timbang 60 ton PIBC.

### 3.6 Reservasi Ruang Rapat VIP & Integrasi Lintas Divisi
- Manajemen ruang rapat representatif (Ruang Rapat VIP Direksi, Ruang Rapat Cipinang Utama, Ruang Rapat Distribusi SPHP, Ruang Rapat IT Center).
- Alur reservasi:
  - Reservasi oleh Sekretaris Direksi: Otomatis disetujui (*auto-approved*) dengan prioritas High.
  - Reservasi oleh Karyawan/Divisi lain: Menunggu persetujuan GA (*pending_approval*).
- Notifikasi Terpadu Otomatis:
  - Notifikasi ke IT Support jika fasilitas IT dipilih (Polycom Studio, Smart TV 85", Laser Projector, Kabel HDMI, Audio Visual).
  - Notifikasi ke GA Sarpras untuk fasilitas fisik (Sound System, Mic Wireless, Whiteboard, Podium).
  - Notifikasi ke GA Pantry untuk pesanan konsumsi (Snack Box, Lunch Box, Coffee/Tea Break, VIP Buffet).
  - Notifikasi ke Humas untuk permintaan peliputan media dan dokumentasi foto/video.
- Fitur Check-In dan Check-Out ruangan secara real-time.

### 3.7 Administration Control Panel (Khusus Super Admin)
- Disediakan secara eksklusif untuk peran `Admin GABAH`:
  1. Manajemen Pengguna (Tambah, Edit, Nonaktifkan Akun, Reset Password).
  2. Matriks Peran & Izin Akses (RBAC Viewer).
  3. Struktur Organisasi (Kelola Divisi & Departemen dinamis).
  4. Master Taksonomi Aset (Kategori, Kode, Masa Depresiasi).
  5. Master Lokasi Fasilitas Gudang & Kantor.
  6. Master Tipe & Fasilitas Ruang Rapat.
  7. Log Audit Trail Komprehensif dengan filter entitas.
  8. Konfigurasi SLA & Kebijakan Sistem.

---

## 4. Kriteria Keberhasilan & Batasan Teknis

1. **Keandalan Data (Persistence)**: Seluruh data operasional tersimpan secara relasional pada PostgreSQL 17 dengan fail-safe backup file store lokal (`server/data/gabah_state.json`).
2. **Kepatuhan RBAC**: Tidak ada akses ilegal lintas divisi. Penugasan, mutasi, dan approval aset IT hanya dapat dilakukan oleh IT; kendaraan dan furniture hanya oleh GA. Auditor terkunci read-only.
3. **Kinerja UI**: Render antarmuka responsif tanpa lag, Tailwind CSS v4, dynamic counter badges, dan navigasi instan via Quick Search Omnibox (`Ctrl+K`).
4. **Verifikasi Teknis**: 0 lint error (`tsc --noEmit`), build produksi sukses (`vite build && node scripts/build-server.cjs`), dan berjalan stabil pada Docker container.
