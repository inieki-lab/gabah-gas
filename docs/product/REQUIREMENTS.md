# GABAH — Product Requirements Specification

**Dokumen:** `docs/product/REQUIREMENTS.md`  
**Sistem:** GABAH (*General Asset, Business & Automated Helpdesk*)  
**Organisasi:** PT Food Station Tjipinang Jaya (Perseroda)  
**Status:** Baseline requirement; implementation and role-based UAT are being reconciled. Do not interpret this document as proof that every requirement is already implemented.  

---

## 1. Kebutuhan Fungsional (Functional Requirements)

### FR-01: Autentikasi Pengguna & Manajemen Sesi
- **FR-01.1**: Sistem harus menyediakan mekanisme login berbasis email/alias dan kata sandi dengan verifikasi hash PBKDF2/SHA-256 dan salt kriptografis.
- **FR-01.2**: Sistem harus menerbitkan token sesi unik (`token`) dengan masa aktif 7 hari yang disimpan pada tabel `user_sessions`.
- **FR-01.3**: Sistem harus menyediakan endpoint `/api/auth/me` untuk memverifikasi profil akun aktif berdasarkan Bearer token.
- **FR-01.4**: Sistem harus menyediakan fasilitas alih peran / simulasi persona (`/api/auth/switch-role`) untuk mempermudah evaluasi multi-peran pada lingkungan pengujian/pengembangan.
- **FR-01.5**: Sistem harus menerapkan rate limiting login (maksimal 5 kali percobaan gagal sebelum lockout 5 menit pada lingkungan produksi) dan API rate limiting (maksimal 200 req/menit per client IP).

### FR-02: Katalog Aset & Klasifikasi Akuntansi PSAK 16
- **FR-02.1**: Sistem harus mencatat aset dengan atribut identitas: nomor aset kanonikal, nomor ERP Accurate (`corporate_asset_number`), nama aset, kategori, tipe taksonomi, owner domain dari master dinamis, unit pengelola, lokasi fisik dari master lokasi aset, custodian/PIC, merek, model, nomor seri, spesifikasi teknis, tanggal pembelian, harga perolehan, masa garansi, status, kondisi, status loanable, dan catatan. Owner domain tidak boleh dibatasi enum IT/GA/SC/PIBC atau disimpulkan dari lokasi kantor, lokasi fisik, unit, kategori, maupun pegawai pemegang aset.
- **FR-02.2**: Sistem membatasi akses katalog aset berdasarkan permission efektif dan data scope per modul, bukan label role atau lokasi kerja semata. Super Admin memiliki akses global; IT mengelola owner IT lintas lokasi; GA mengelola owner GA lintas lokasi. GA hanya dapat memperoleh akses baca tambahan ke Laptop/PC owner IT melalui permission khusus `assets.read.it_workstations`. Owner operasional lain dapat ditambahkan melalui master dan diberi scope eksplisit. Karyawan melihat aset pribadi/pool sesuai permission; Auditor hanya membaca data yang secara eksplisit diotorisasi. Backend wajib menerapkan scope untuk list dan detail-by-ID.
- **FR-02.3**: Sistem harus mendukung filter cepat berdasarkan kategori dan counter badge dinamis.
- **FR-02.4**: Sistem harus mendukung pembuatan dan pencetakan label QR Code aset standar inventaris BUMD serta pemindaian QR menggunakan kamera web.
- **FR-02.5**: Master lokasi kantor mendukung lokasi aktif HO, PIBC, RPC/SC, Pangsub, dan Kantor Perawatan; lokasi masa depan dapat ditambahkan tanpa perubahan kode. Lokasi yang tutup dinonaktifkan, bukan dihapus. Subang tidak aktif.
- **FR-02.6**: Lokasi kerja pegawai, lokasi fisik aset, unit organisasi, owner domain, dan custodian adalah dimensi terpisah. Perpindahan lokasi fisik tidak mengubah owner atau kewenangan.
- **FR-02.7**: Super Admin dapat mengatur scope owner dinamis, termasuk pola pengecualian seperti semua owner kecuali IT. Kebijakan luas tidak boleh diaktifkan otomatis tanpa persetujuan bisnis.
- **FR-02.8**: Data historis dengan owner ambigu tidak boleh dimigrasikan massal berdasarkan lokasi atau kategori. Sistem harus menyediakan proses review dan audit untuk klasifikasi ulang.

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
- **FR-09.2**: Pemesanan oleh pegawai dengan capability Dynamic RBAC `sekretaris_direksi` berstatus VIP dan otomatis disetujui (*auto-approved*); role primer tetap Karyawan. Pemesanan pegawai tanpa capability tersebut berstatus `pending_approval` menunggu verifikasi GA.
- **FR-09.3**: Sistem harus mendeteksi tabrakan jadwal ruangan pada tanggal dan rentang jam yang sama.
- **FR-09.4**: Sistem harus mendistribusikan notifikasi otomatis secara granular:
  - Notifikasi ke Tim IT jika terdapat kebutuhan perangkat IT (Polycom, Smart TV, Proyektor, HDMI, WiFi).
  - Notifikasi ke GA Sarpras jika terdapat kebutuhan sarana fisik (Sound system, mic, whiteboard).
  - Notifikasi ke GA Pantry jika terdapat pesanan konsumsi rapat.
  - Notifikasi ke Humas & Protokoler jika terdapat permintaan dokumentasi foto/video.
- **FR-09.5**: Sistem menyediakan fungsi Check-In, Check-Out, dan pembatalan reservasi.

### FR-12: Direktori Vendor dan Owner Domain
- **FR-12.1**: Vendor memiliki kategori layanan dan owner domain yang terpisah. Kategori seperti IT Hardware, License, Maintenance, dan General tidak boleh otomatis menentukan owner.
- **FR-12.2**: Owner vendor harus direferensikan ke master owner domain dinamis yang dikelola Super Admin. Owner baru dapat ditambahkan tanpa perubahan kode.
- **FR-12.3**: List, detail, create, dan update vendor wajib memeriksa permission modul vendors serta scope owner pada backend. Update owner memerlukan kewenangan pada owner asal dan owner tujuan.
- **FR-12.4**: Vendor legacy tanpa owner tidak boleh terlihat sebagai milik GA/IT secara default. Hanya Super Admin yang boleh mengklasifikasikan record tanpa owner.
- **FR-12.5**: Owner domain tidak boleh dihapus selama masih direferensikan vendor, kontrak, aset, maintenance, peminjaman, kategori, pegawai, atau unit organisasi.
- **FR-12.6**: UI hanya menampilkan tombol tambah/ubah sesuai permission efektif yang relevan; metrik SLA/kontrak harus berasal dari data aktual, bukan nilai tetap.

### FR-11: Contract Management (Domain Tersendiri)
- Register kontrak sebagai **domain bisnis tersendiri** — Contract bukan kategori Helpdesk; tiket dapat ditautkan (`contract_id`) untuk tindak lanjut pekerjaan.
- Atribut: contract number (`CTR-YYYY-NNNN`), tipe, judul, vendor/counterparty, divisi pemilik (bebas per departemen), PIC, start/end date, notice period + notice date (dihitung otomatis), nilai, auto-renewal, status, dokumen (append-only: original/amendment/renewal/supporting), notes, metadata.
- Reminder kedaluwarsa configurable (default 60/35/7 hari) ke PIC + divisi pemilik (+ eskalasi pada 35/7 hari), dikirim via in-app, email, dan Telegram — setiap pengiriman tercatat pada `contract_notification_logs` (status SENT/FAILED/SKIPPED + alasan; penerima di-resolve server-side; idempoten per kontrak/tipe/kanal/penerima/hari; scheduler internal otomatis dengan leader-lock). Status SENT hanya bila pengiriman eksternal benar-benar berhasil — tidak ada sukses palsu.
- Renewal outcome: pending/renewed/not_renewed/terminated/replaced_by_new_contract + notes; kontrak lama tidak dihapus (rantai `parent_contract_id`).
- Access control: Super Admin global; PIC dan owner domain sesuai permission + scope; Auditor hanya baca sesuai grant audit; kontrak `restricted` tetap dibatasi PIC/owner/Super Admin.
- Dokumen kontrak harus benar-benar disimpan sebagai byte file pada persistent volume terpisah dari database, dengan metadata dan file reference yang konsisten. Upload dibatasi ke PDF/JPG/PNG/DOC/DOCX maksimal 10 MB, MIME dan signature diverifikasi, nama/path file dibuat server-side, dan file tidak boleh diekspos sebagai static public directory.
- Download dokumen harus melalui API terautentikasi dengan `contracts.read` dan pemeriksaan visibility contract per record; path file harus terisolasi per contract agar metadata tidak dapat menunjuk file milik contract lain. File dan database wajib dicadangkan serta dipulihkan bersama.

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
   - Siap dijalankan menggunakan Docker Compose dengan multi-stage image Node.js 22 Alpine dan PostgreSQL 17 Alpine. Build menggunakan `npm ci` dari lockfile; runtime hanya memasang dependency produksi, berjalan sebagai user non-root, dan tidak meng-install/build dependency setiap container start.
   - Source code dan node_modules tidak di-bind-mount ke container produksi. Image release diberi tag commit yang tercatat.
   - Healthcheck aplikasi memverifikasi API dan PostgreSQL. Deployment mengganti app container tanpa menghapus database atau named volume.
   - Dokumen kontrak disimpan pada named volume `uploads_data`; backup/restore harus mencakup database PostgreSQL dan volume file.
