# GABAH — Product Requirements Specification

**Dokumen:** `docs/product/REQUIREMENTS.md`  
**Sistem:** GABAH (*General Asset, Business & Automated Helpdesk*)  
**Organisasi:** PT Food Station Tjipinang Jaya (Perseroda)  
**Status:** Authoritative Requirement Specification (Tervalidasi dengan Source Code Aktual)  

---

## 1. Kebutuhan Fungsional (Functional Requirements)

### FR-01: Autentikasi Pengguna & Manajemen Sesi
- **FR-01.1**: Sistem harus menyediakan mekanisme login berbasis email/alias dan kata sandi dengan verifikasi hash PBKDF2/SHA-256 dan salt kriptografis.
- **FR-01.2**: Sistem harus menerbitkan token sesi unik (`token`) dengan masa aktif 7 hari yang disimpan pada tabel `user_sessions`.
- **FR-01.3**: Sistem harus menyediakan endpoint `/api/auth/me` untuk memverifikasi profil akun aktif berdasarkan Bearer token.
- **FR-01.4**: Sistem harus menyediakan fasilitas alih peran / simulasi persona (`/api/auth/switch-role`) untuk mempermudah evaluasi multi-peran pada lingkungan pengujian/pengembangan.
- **FR-01.5**: Sistem harus menerapkan rate limiting login (maksimal 5 kali percobaan gagal sebelum lockout 5 menit pada lingkungan produksi) dan API rate limiting (maksimal 200 req/menit per client IP).

### FR-02: Katalog Aset & Klasifikasi Akuntansi PSAK 16
- **FR-02.1**: Sistem harus mencatat aset dengan atribut identitas: nomor aset kanonikal, nomor ERP Accurate (`corporate_asset_number`), nama aset, kode kategori, tipe taksonomi (`IT`, `General`, `License`), divisi pemilik (`IT`, `GA`, `SC`, `PIBC`), merek, model, nomor seri, spesifikasi teknis, tanggal pembelian, harga perolehan, masa garansi, status, kondisi, lokasi fisik, status loanable, dan catatan.
- **FR-02.2**: Sistem harus membatasi akses melihat katalog aset berdasarkan peran pengguna (`GabahDomainService.getScopedAssets()`):
  - `Admin GABAH` & `Auditor`: Seluruh aset semua divisi.
  - `IT`: Aset milik Divisi IT.
  - `GA`: Aset milik Divisi GA dan aset IT (khusus aset IT bersifat *read-only*).
  - `Supply Chain`: Aset milik Divisi SC (mesin pabrik, truk beras).
  - `PIBC`: Aset milik Divisi PIBC atau berlokasi di kawasan PIBC.
  - `Karyawan` & `Sekretaris Direksi`: Hanya aset yang ditugaskan kepada dirinya atau aset dalam pool peminjaman (`is_loanable`).
  - `Humas`: Akses menu aset disembunyikan / dikosongkan sesuai tugas fungsional.
- **FR-02.3**: Sistem harus mendukung filter cepat berdasarkan kategori dan counter badge dinamis.
- **FR-02.4**: Sistem harus mendukung pembuatan dan pencetakan label QR Code aset standar inventaris BUMD serta pemindaian QR menggunakan kamera web.

### FR-03: Mesin Penomoran Kanonikal & Integritas Duplikasi
- **FR-03.1**: Sistem harus meng-generate nomor aset otomatis dengan format `{OWNER_DIVISION}-{ASSET_CODE}-{YEAR}-{SEQUENCE}` (Contoh: `IT-HLT-2026-0001`).
- **FR-03.2**: Sequence nomor aset harus mereset setiap pergantian tahun per kombinasi divisi pemilik dan kode aset.
- **FR-03.3**: Sistem harus menolak pendaftaran aset jika nomor seri (`serial_number`) sudah terdaftar pada aset lain.
- **FR-03.4**: Sistem harus menolak pendaftaran aset jika nomor Accurate ERP (`corporate_asset_number`) sudah terdaftar pada aset lain.

### FR-04: Penugasan (*Assignment*) & Mutasi Lokasi Fisik
- **FR-04.1**: Sistem harus mendukung penugasan aset ke karyawan tertentu (`POST /api/assets/:id/assign`), mengubah status aset menjadi `assigned`, dan mencatat riwayat pergerakan pada tabel `asset_movements`.
- **FR-04.2**: Sistem harus mendukung pelepasan penugasan (*unassign*) ke gudang penampungan (`available`), mencatat riwayat pengembalian ke gudang.
- **FR-04.3**: Sistem harus mendukung mutasi perpindahan lokasi aset (`POST /api/assets/:id/move`), mencatat lokasi asal, lokasi tujuan, dan alasan mutasi.
- **FR-04.4**: Hanya personel divisi pemilik yang berwenang menugaskan atau merelokasi aset miliknya (personel GA dilarang memutasi atau menugaskan aset milik IT).

### FR-05: Siklus Hidup Aset (*Lifecycle Management*)
- **FR-05.1**: Sistem harus menyediakan fungsi mutasi siklus hidup: servis/reparasi (`repair` → `in_repair`), rusak (`damaged` → `broken`), kanibalisasi suku cadang (`cannibalize` → `cannibalized`), usulan penghapusan (`propose_disposal` → `pending_disposal`), lelang (`auction` → `pending_auction`), dan penghapusan aset final (`approve_disposal` → `disposed`).
- **FR-05.2**: Persetujuan penghapusan aset final (`approve_disposal`) hanya dapat dilakukan secara eksklusif oleh peran `Admin GABAH`.

### FR-06: Sirkulasi Peminjaman Aset (*Loans*) & BAST
- **FR-06.1**: Sistem harus menyediakan alur pengajuan peminjaman barang dinas untuk aset berkategori `is_loanable`.
- **FR-06.2**: Sistem harus mencegah tabrakan jadwal (*anti-collision*): menolak pengajuan atau persetujuan pinjaman jika aset yang sama telah disetujui atau sedang dipinjam pada rentang waktu yang bertabrakan.
- **FR-06.3**: Persetujuan peminjaman (*approve*) hanya dapat dilakukan oleh divisi pemilik aset (IT untuk laptop/proyektor, GA untuk kendaraan, SC untuk alat logistik).
- **FR-06.4**: Sistem harus mencatat serah terima fisik barang (*handover*) dan pengembalian (*return*) dengan pencatatan kondisi fisik (`good`, `fair`, `poor`, `broken`).
- **FR-06.5**: Sistem harus menyediakan dokumen Berita Acara Serah Terima (BAST) resmi siap cetak/unduh.

### FR-07: Helpdesk Tiket & Perhitungan SLA
- **FR-07.1**: Karyawan dapat membuat laporan gangguan operasional dengan prioritas: `urgent`, `high`, `medium`, `low`.
- **FR-07.2**: Sistem harus secara otomatis menetapkan batas waktu penyelesaian (*SLA deadline*) berdasarkan prioritas:
  - `urgent`: 4 jam kerja
  - `high`: 8 jam kerja
  - `medium`: 24 jam kerja
  - `low`: 48 jam kerja
- **FR-07.3**: Tiket secara otomatis diteruskan ke antrean divisi terkait (kategori IT/License ke IT Support, kategori GA ke Tim GA).
- **FR-07.4**: Agen teknisi dapat memperbarui status tiket (`open` → `in_progress` → `resolved` → `closed`), menambahkan catatan solusi teknis, dan pengguna dapat memberikan rating kepuasan.

### FR-08: Preventive Maintenance & Uji Tera
- **FR-08.1**: Sistem harus mencatat jadwal pemeliharaan berkala untuk armada logistik, AC ruang server, genset, dan uji tera jembatan timbang 60 ton PIBC.
- **FR-08.2**: Sistem harus mencatat teknisi/bengkel pelaksana, estimasi biaya, biaya aktual, checklist teknis, serta tanggal pelaksanaan selesai.

### FR-09: Reservasi Ruang Rapat VIP & Integrasi Notifikasi
- **FR-09.1**: Sistem harus menyediakan jadwal kalender dan pemesanan ruang rapat representatif.
- **FR-09.2**: Pemesanan oleh `Sekretaris Direksi` berstatus VIP dan otomatis disetujui (*auto-approved*); pemesanan oleh staf umum berstatus `pending_approval` menunggu verifikasi GA.
- **FR-09.3**: Sistem harus mendeteksi tabrakan jadwal ruangan pada tanggal dan rentang jam yang sama.
- **FR-09.4**: Sistem harus mendistribusikan notifikasi otomatis secara granular:
  - Notifikasi ke Tim IT jika terdapat kebutuhan perangkat IT (Polycom, Smart TV, Proyektor, HDMI, WiFi).
  - Notifikasi ke GA Sarpras jika terdapat kebutuhan sarana fisik (Sound system, mic, whiteboard).
  - Notifikasi ke GA Pantry jika terdapat pesanan konsumsi rapat.
  - Notifikasi ke Humas & Protokoler jika terdapat permintaan dokumentasi foto/video.
- **FR-09.5**: Sistem menyediakan fungsi Check-In, Check-Out, dan pembatalan reservasi.

### FR-10: Attention Center & Audit Logging
- **FR-10.1**: Dashboard harus menampilkan ringkasan Attention Center dinamis yang disaring berdasarkan peran (tiket SLA yang mendekati batas waktu, permohonan pinjaman pending, aset dalam masa garansi kritis).
- **FR-10.2**: Sistem harus mencatat seluruh mutasi data ke tabel `audit_logs` secara tidak dapat diubah (*immutable*).

---

## 2. Kebutuhan Non-Fungsional (Non-Functional Requirements)

1. **NFR-01: Keamanan (Security)**
   - Proteksi otentikasi via HTTP Bearer token.
   - Deteksi dan blokir ID spoofing via manipulasi header `x-user-id` (HTTP 403).
   - Password hashing menggunakan algoritma aman dengan per-user salt.
   - Proteksi read-only mutlak untuk akun Auditor.
2. **NFR-02: Integritas Data & Persistensi (Data Integrity)**
   - Database PostgreSQL 17 dengan skema ternormalisasi, foreign key cascade/restrict, unique constraints, dan trigger PL/pgSQL.
   - Dual-persistence bridge: sinkronisasi asinkron ke database relasional dengan fail-safe persistent file store.
3. **NFR-03: Kinerja & Skalabilitas (Performance)**
   - Respons API di bawah 200ms untuk query katalog aset dan dashboard.
   - Dukungan koneksi pool hingga 5 concurrent pool clients dengan idle timeout 10 detik.
4. **NFR-04: Antarmuka & Aksesibilitas (UI/UX)**
   - Responsif pada resolusi desktop, tablet, dan smartphone (min. 375px width).
   - Akses navigasi cepat dengan Omnibox keyboard shortcut `Ctrl+K` / `Cmd+K`.
   - Palet warna korporat yang konsisten dan kontras sesuai standar BUMD DKI Jakarta.
5. **NFR-05: Kesiapan Operasional Kontainer (Containerization)**
   - Siap dijalankan menggunakan Docker Compose dengan image standar `node:20-alpine` dan `postgres:17-alpine`.
