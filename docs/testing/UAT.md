# GABAH — User Acceptance Testing (UAT) & Verification Guide

**Dokumen:** `docs/testing/UAT.md`  
**Sistem:** GABAH (*General Asset, Business & Automated Helpdesk*)  
**Organisasi:** PT Food Station Tjipinang Jaya (Perseroda)  
**Status:** Rencana UAT; skenario harus dijalankan dan ditandatangani pemilik proses sebelum go-live. Dokumen ini bukan bukti seluruh skenario telah lulus. Ikuti [Documentation Authority & AI Handoff Guide](../GABAH-DOCUMENTATION-CONTROL.md) dan [Master Test Strategy](./MASTER-TEST-STRATEGY.md) untuk menjaga istilah, status, dan bukti tetap konsisten.  
**Terakhir Diperbarui:** 23 November 2026

> **Batas bukti:** Bagian hasil PASS/angka total pengujian yang tercatat dari siklus terdahulu adalah HISTORICAL dan hanya berlaku pada commit/run yang disebutkan di catatan asal. Jangan menganggapnya sebagai hasil UAT pada HEAD saat ini. Setiap siklus baru harus mengisi bukti dan SHA aktual.

---

## 1. Lingkungan Pengujian (Test Environment)

- **Runtime tunggal Development/UAT**: Docker Compose (app + PostgreSQL 17).
- **URL browser default**: `http://localhost` (host port 80; dapat diubah melalui `GABAH_WEB_PORT`).
- **Aplikasi**: container `gabah_app`, port internal 3000.
- **Database**: container `gabah_database`; aplikasi selalu menggunakan `PGHOST=database` dan `PGPORT=5432` pada jaringan Compose.
- **Token Format**: Bearer Token pada header `Authorization`.
- **Metode Pengujian**: UI end-to-end melalui browser, API assertions, regression scripts, serta CI. Jangan menjalankan server Node/TSX host bersamaan dengan database Docker.
- **Standar utama**: ikuti [MASTER-TEST-STRATEGY.md](./MASTER-TEST-STRATEGY.md). Jalankan `docker compose config --quiet`, `docker compose up -d --build`, periksa `docker compose ps` dan `docker compose logs --tail=200 app`, lalu akses `http://localhost`.
- **Peringatan data**: jangan gunakan `docker compose down -v` pada environment yang datanya ingin dipertahankan.

---

## 2. Matriks Persona Pengujian (Role, Capability, Unit, Jabatan, dan Lokasi)

> **SECURITY:** Jangan menulis password, token, atau kredensial aktual di dokumen, log, screenshot, atau commit. Gunakan akun uji yang dibuat melalui provisioning/reset resmi pada database UAT. Email dan nama dari seed lama bukan daftar pegawai resmi dan tidak boleh dipakai sebagai dasar mapping HR atau assignment produksi.

> **Penting:** Dynamic RBAC tidak memiliki daftar role bisnis tertutup. Baris di bawah adalah cakupan persona yang wajib diuji, bukan daftar role yang harus dikodekan permanen. Siapkan akun uji terpisah untuk setiap konteks dan catat ID/assignment aktual pada bukti UAT yang disanitasi.

| Persona uji | Konfigurasi yang harus disiapkan | Fokus pengujian |
|:---|:---|:---|
| Admin GABAH (Superadmin) | Profil utama Admin GABAH dengan grant administrasi global | Administration, user/role, permission, scope, master, konfigurasi, audit |
| Karyawan + role tambahan IT Support | Permission modul IT dan owner scope IT | Aset IT lintas lokasi, tiket IT, tugas/support, lifecycle yang diizinkan |
| Karyawan + role tambahan GA asset operator | Permission operasional GA dan owner scope GA | Aset GA, sarpras, peminjaman/approval sesuai kewenangan |
| Karyawan + role tambahan GA (read-only workstation) | Grant khusus `assets.read.it_workstations` tanpa permission mutasi IT | Hanya baca Laptop/PC owner IT; direct API mutation harus ditolak |
| Karyawan HO | Fungsi dasar karyawan dan office location HO | Aset pribadi/pool, tiket sendiri, reservasi dan layanan mandiri |
| Karyawan RPC | Fungsi dasar karyawan dan office location RPC/SC | Lokasi kerja tidak otomatis memberi role, owner scope, atau akses aset |
| Karyawan PIBC | Fungsi dasar karyawan dan office location PIBC | Lokasi kerja tidak otomatis memberi role, owner scope, atau akses aset |
| ME / Perawatan | Permission maintenance/tickets yang disetujui dan scope unit terkait | Routing dan penanganan tiket ME PIBC |
| Humas capability | Akun karyawan dengan capability/permission Humas yang eksplisit | Antrean dokumentasi dan notifikasi yang memang ditugaskan |
| Sekretariat Direksi capability | Akun karyawan dengan capability/permission sekretariat yang eksplisit | Reservasi VIP dan fungsi sekretariat sesuai grant |
| Karyawan + role tambahan Auditor | Grant baca audit yang eksplisit; tidak ada grant mutasi | Baca sesuai scope; semua operasi mutasi ditolak |
| Custom role | Role buatan Superadmin dengan permission/scope minimal | Verifikasi granularitas, persistensi, revoke, dan default-deny |

---

## 3. Skenario Pengujian UAT

> **Prinsip model organisasi:** Supply Chain dan PIBC adalah unit/lokasi, bukan role aplikasi permanen. Lokasi kantor aktif saat ini: HO, PIBC, RPC/SC, Pangsub, dan Kantor Perawatan. Subang tidak aktif. Owner aset berbeda dari lokasi fisik dan lokasi kerja pegawai. Pengujian akses dilakukan terhadap permission dan scope efektif di PostgreSQL.

### Skenario 1: Autentikasi, Token Sesi & Logout
- **Tujuan**: Memastikan sesi diterbitkan dengan aman dan dibersihkan saat logout.
- **Langkah Pengujian**:
  1. Buka halaman login. Masukkan email admin dan password kredensial resmi (lihat Seksi 2 — placeholder, bukan nilai nyata).
  2. Periksa apakah sistem berhasil masuk ke dashboard dan menyimpan `gabah_auth_token` di `localStorage`.
  3. Lakukan logout melalui menu avatar kanan atas.
  4. Verifikasi bahwa token di `localStorage` terhapus dan pengguna diarahkan kembali ke landing page.
- **Kriteria Lulus**: Status respon 200, sesi di server dihapus, akses endpoint privat tanpa token ditolak (401).

---

### Skenario 2: Matriks Permission dan Scope Aset
- **Tujuan**: Memastikan owner, lokasi, dan akses tidak tercampur.
- **Langkah Pengujian**:
  1. Login sebagai Karyawan dengan role tambahan IT. Pastikan aset owner IT terlihat di HO, PIBC, RPC/SC, Pangsub, dan lokasi lain yang terdaftar; aset owner lain tidak dapat dimutasi oleh IT.
  2. Login sebagai Karyawan dengan role tambahan GA. Pastikan aset owner GA terlihat lintas lokasi. Jika permission assets.read.it_workstations aktif, hanya Laptop/PC owner IT yang dapat dibaca; mutasi langsung via API harus ditolak.
  3. Login sebagai Karyawan di lokasi RPC dan PIBC. Pastikan fungsi dasar karyawan tersedia; lokasi kerja tidak otomatis membuka katalog aset unit/lokasi.
  4. Uji aset historis dengan owner SC/PIBC secara read/review sesuai grant sementara yang disahkan. Jangan menganggap RPC/SC atau PIBC sebagai owner domain baru. Aset owner ambigu tetap menunggu klasifikasi per aset; lokasi fisik tidak memberi hak mutasi.
  5. Login sebagai Karyawan dengan role tambahan Humas dan Sekretariat Direksi. Pastikan fungsi dasar karyawan tersedia serta kapabilitas tambahan muncul hanya bila role tambahan/permission diberikan.
  6. Login sebagai Karyawan dengan role tambahan Auditor. Pastikan data yang diberi scope audit dapat dibaca dan seluruh operasi mutasi ditolak.
  7. Uji user tanpa role, role nonaktif, dan role tanpa scope: akses harus gagal tertutup.
- **Kriteria Lulus**: API list dan detail-by-ID mengembalikan record sesuai permission + scope; endpoint mutasi menolak akses di luar scope. Verifikasi dilakukan langsung ke API, bukan hanya menu.

---

### Skenario 2A: Assignment Multi-Role dan Persistensi
- **Tujuan**: Memastikan role primer dan role tambahan berjalan bersama dan tidak hilang setelah persistensi/restart.
- **Langkah Pengujian**:
  1. Sebagai Super Admin, buka Administrasi → Pengguna → pilih satu akun uji.
  2. Catat role primer, lalu tambahkan satu role fungsi yang telah disetujui dan memiliki permission/scope terbatas.
  3. Simpan; verifikasi assignment melalui UI dan endpoint administrasi yang dilindungi Super Admin.
  4. Jalankan operasi bisnis normal yang memicu persistensi, lalu restart aplikasi.
  5. Muat ulang assignment dan uji menu, API read, dan API write sesuai permission/scope kedua role.
  6. Ubah role primer melalui alur resmi; pastikan role tambahan yang masih sah tetap ada.
- **Kriteria Lulus**: Role tambahan tetap tersimpan setelah persistensi dan restart; tidak ada assignment yang dipulihkan/dihapus tanpa tindakan administrator; perubahan tercatat pada audit log.

### Skenario 2B: Auditor sebagai Role Tambahan

- **Tujuan**: Memastikan Auditor tetap read-only walaupun diberikan sebagai role tambahan kepada pegawai yang sudah memiliki role lain.
- **Langkah Pengujian**:
  1. Buat akun uji Karyawan dengan satu role tambahan yang memiliki hak tulis terbatas.
  2. Sebagai Super Admin, tambahkan role Auditor tanpa menghapus role primer maupun role tambahan yang sudah ada.
  3. Coba akses endpoint GET yang memang diberi kewenangan audit.
  4. Coba POST/PATCH/DELETE langsung ke API modul yang sebelumnya dapat ditulis oleh role lain.
  5. Periksa audit log dan assignment role setelah restart aplikasi.
- **Kriteria Lulus**: Akses baca sesuai grant audit tetap berfungsi; semua operasi mutasi ditolak HTTP 403. Role Auditor tidak boleh kehilangan sifat read-only karena dikombinasikan dengan role lain.

---

### Skenario 2C: Pembuatan Pegawai dan Lokasi Kerja

- **Tujuan**: Memastikan akun baru dibuat dengan role primer pegawai dan lokasi kerja yang independen.
- **Langkah Pengujian**:
  1. Sebagai Super Admin, buat akun baru dengan role primer Karyawan.
  2. Pilih lokasi kantor dari master aktif (misalnya PIBC atau RPC/SC); jangan memilih Supply Chain/PIBC sebagai role aplikasi.
  3. Simpan akun dan pastikan lokasi kerja tersimpan pada atribut office location.
  4. Jika pegawai memiliki tugas khusus, tetapkan role tambahan melalui tombol Role; jangan mengubah role primer hanya karena unit/lokasi.
  5. Periksa daftar pengguna: role primer dan role tambahan harus terlihat terpisah.
- **Kriteria Lulus**: Akun tetap Karyawan dengan lokasi kerja yang dipilih; penambahan role fungsi tidak mengubah lokasi atau role primer.

---

### Skenario 3: Pendaftaran Aset & Validasi Duplikasi
- **Tujuan**: Memverifikasi nomor kanonikal dihasilkan secara atomik dan nomor duplikat ditolak.
- **Langkah Pengujian**:
  1. Login sebagai Karyawan dengan role tambahan IT. Buka modal *Tambah Aset Baru*.
  2. Pilih kategori "Laptop / Notebook", masukkan nama "Lenovo ThinkPad P14s", serial number `SN-TEST-001`.
  3. Simpan aset. Verifikasi nomor mengikuti aturan generator aktif yang dikonfigurasi Superadmin. Jangan mengasumsikan format contoh IT-HLT-2026-xxxx sebagai standar korporat final.
  4. Coba daftarkan aset kedua dengan serial number yang sama (`SN-TEST-001`).
- **Kriteria Lulus**: Aset pertama tersimpan, aset kedua ditolak dengan pesan error serial number duplikat.

---

### Skenario 4: Penugasan Aset (*Assignment*) & Mutasi Lokasi
- **Tujuan**: Memastikan penugasan dan relokasi fisik tercatat ke `asset_movements` dan `audit_logs`.
- **Langkah Pengujian**:
  1. Login sebagai `IT`. Pilih salah satu laptop IT yang berstatus `available`.
  2. Klik tombol *Tugaskan Karyawan* $\to$ pilih Hendra Wijaya (Karyawan) $\to$ Simpan.
  3. Verifikasi status aset berubah menjadi `assigned`.
  4. Login sebagai Hendra Wijaya $\to$ buka tab *Aset Saya* $\to$ verifikasi laptop tersebut muncul di daftar unit kerjanya.
  5. Kembali ke akun IT $\to$ klik *Kembalikan ke Gudang* (*Unassign*) $\to$ status kembali `available`.
- **Kriteria Lulus**: Riwayat perpindahan tersimpan di tabel `asset_movements`.

---

### Skenario 5: Peminjaman Barang & Deteksi Tabrakan Jadwal (Anti-Collision)
- **Tujuan**: Membuktikan server menolak tabrakan peminjaman aset yang sama pada tanggal tumpang tindih.
- **Langkah Pengujian (Happy Path & Collision Test)**:
  1. Login sebagai `Karyawan` (Hendra). Buka *Peminjaman Barang* $\to$ ajukan pinjaman mobil Toyota Avanza (`GA-KDR-2026-0001`) tanggal 1 s/d 5 Oktober 2026.
  2. Login sebagai Karyawan dengan role tambahan GA (Siti) $\to$ buka menu *Peminjaman* $\to$ klik *Setujui Pinjaman*. Status berubah `approved`.
  3. Login sebagai Karyawan lain (atau alih peran) $\to$ ajukan pinjaman untuk mobil Avanza yang sama pada tanggal 3 s/d 7 Oktober 2026 (periode bertabrakan).
- **Kriteria Lulus**: Permohonan kedua ditolak oleh server dengan pesan error: `Tabrakan Jadwal: Aset sudah direservasi atau dipinjam pada rentang tanggal tersebut.`

---

### Skenario 6: Helpdesk Tiket & Perhitungan SLA Otomatis
- **Tujuan**: Memastikan SLA dihitung otomatis berdasarkan prioritas kendala.
- **Langkah Pengujian**:
  1. Login sebagai `Karyawan` $\to$ buat tiket baru: Kategori `IT`, Prioritas `Urgent`, Judul "Server ERP Tidak Dapat Diakses".
  2. Verifikasi tiket memiliki `sla_hours: 4` dan deadline 4 jam dari waktu pembuatan.
  3. Login sebagai `IT` $\to$ terima tiket, perbarui status menjadi `in_progress`, lalu `resolved` dengan catatan solusi.
- **Kriteria Lulus**: SLA dihitung tepat, notifikasi terkirim ke divisi IT, dan audit log tercatat.

---

### Skenario 7: Preventive Maintenance & Uji Tera
- **Tujuan**: Memvalidasi pencatatan pemeliharaan berkala dan tera resmi PIBC.
- **Langkah Pengujian**:
  1. Login sebagai pegawai Karyawan unit/lokasi PIBC dengan permission dan scope maintenance yang disahkan $\to$ buka tab *Servis & Maintenance*.
  2. Daftarkan jadwal kalibrasi tera untuk "Jembatan Timbang Truk 60 Ton".
  3. Masukkan nama vendor/balai metrologi, estimasi biaya, dan frekuensi tahunan.
  4. Selesaikan jadwal servis dengan mengisi biaya riil dan checklist teknis.
- **Kriteria Lulus**: Data tersimpan di modul maintenance dan log audit tercatat.

---

### Skenario 8: Reservasi Ruang Rapat VIP & Notifikasi Multi-Divisi
- **Tujuan**: Memverifikasi alur VIP auto-approval dan notifikasi otomatis lintas divisi.
- **Langkah Pengujian**:
  1. Login sebagai Karyawan dengan capability tambahan Sekretaris Direksi yang telah disahkan. Buka modul *Ruang Rapat* $\to$ buat reservasi di "Ruang Rapat VIP Direksi".
  2. Centang:
     - Fasilitas IT: *Polycom Studio Video Conference* & *Smart TV 85" 4K*
     - Fasilitas GA: *Sound System & Wireless Mic*
     - Konsumsi: *VIP Buffet (15 Pax)*
     - Dokumentasi: *Dokumentasi Foto & Video Liputan*
  3. Submit reservasi.
  4. **Verifikasi Status**: Reservasi otomatis berstatus `approved` tanpa menunggu persetujuan GA.
  5. **Verifikasi Notifikasi**:
     - Login sebagai `IT` $\to$ Cek lonceng notifikasi: Muncul *"Permintaan Fasilitas IT Ruang Rapat"*.
     - Login sebagai `GA` $\to$ Cek lonceng: Muncul *"Kebutuhan Sarana GA"* dan *"Permintaan Konsumsi Pantry"*.
     - Login sebagai Karyawan dengan role tambahan Humas $\to$ Cek lonceng: Muncul *"Permintaan Dokumentasi Humas: VIP Buffet & Liputan"*.
- **Kriteria Lulus**: Keempat divisi menerima notifikasi sesuai tugas masing-masing secara akurat.

---

### Skenario 10: Contract Management (Domain Tersendiri) & Kategori Tiket
1. **Kategori tiket**: ajukan tiket software license (Accurate/M365/VPN) → tercatat kategori `IT`; hardware → `IT`; fasilitas → `GA`; SC → `SC`; PIBC → `PIBC`. Tidak ada opsi License/General/Contract di form.
2. **Create Contract** untuk GA (security), IT (maintenance firewall), SC (supplier beras), PIBC (layanan pasar) — masing-masing tersimpan dengan PIC divisi terkait.
3. **Dokumen kontrak**: unggah PDF/DOC/JPG yang sah, unduh kembali sebagai PIC/owner yang berwenang, dan pastikan user di luar scope menerima 404. Restart aplikasi; file harus tetap dapat diunduh. Backup database dan volume uploads harus diuji bersama.
3. **Reminder 60/35/7 hari**: kontrak dengan end_date mendekati threshold menampilkan status WARNING/URGENT/CRITICAL beserta sisa hari; `POST /api/contracts/reminders/run` mengantre notifikasi sekali per threshold per hari.
4. **Email & Telegram**: log pengiriman muncul di `GET /api/contracts/:id/notification-logs` dengan status JUJUR per channel: `sent` (terkirim nyata), `skipped` (provider belum dikonfigurasi — memerlukan `GABAH_SMTP_HOST`+`GABAH_SMTP_FROM` untuk email, `TELEGRAM_BOT_TOKEN` untuk Telegram; recipient divisi tanpa email/chat id juga `skipped`), atau `failed` (provider dikonfigurasi tapi gagal — host tak terjangkau, token invalid). **Tidak pernah ada status sukses palsu.** Scheduler otomatis berjalan tiap `GABAH_REMINDER_INTERVAL_MS` (default 1 jam, leader-lock `pg_try_advisory_lock(842201)` untuk multi-instance); status via `GET /api/contracts/reminders/scheduler-status` (Admin-only).
5. **Linked Ticket**: dari kartu kontrak, buat tiket terkait → tiket tersimpan dengan `contract_id` dan audit log tercatat.
6. **Renewal outcome & expired**: keputusan renewed/not_renewed tersimpan; kontrak lewat end_date berstatus expired.
7. **Restricted access**: kontrak restricted tidak terlihat oleh divisi lain; PIC/divisi/Admin tetap dapat mengakses; Auditor membaca.
8. **Audit trail**: created/updated/document/renewal/reminder tercatat pada audit log.

### Skenario 9: Administration Control Panel (Khusus Super Admin)
- **Tujuan**: Memastikan menu kontrol administrasi hanya dapat diakses oleh Super Admin.
- **Langkah Pengujian**:
  1. Login sebagai `IT` atau `GA` atau `Karyawan`. Periksa sidebar menu.
  2. Verifikasi tombol *Administration Control Panel* **tidak tampil**.
  3. Login sebagai profil `Admin GABAH`.
  4. Verifikasi tombol *Administration Control Panel* tampil di bagian bawah sidebar.
  5. Buka panel $\to$ uji tab *User Management*, *Organisasi*, *Master Data*, dan *Audit Trail*.
- **Kriteria Lulus**: Tombol dan modal administrasi terkunci eksklusif untuk profil `Admin GABAH`.

---

### Skenario 10: Pengujian Keamanan Negatif (Negative / Security Testing)
- **Tujuan**: Menguji ketahanan terhadap percobaan bypass dan penolakan mutasi peran Auditor.
- **Langkah Pengujian**:
  1. **Uji ID Spoofing**: Kirim request API menggunakan token user biasa tetapi menambahkan header `x-user-id: USR-01`.
     - *Hasil Diharapkan*: Server merespon HTTP `403 Forbidden` (`Percobaan manipulasi identitas (ID spoofing) terdeteksi`).
  2. **Uji Auditor Read-Only**: Login sebagai Karyawan dengan role tambahan Auditor. Coba lakukan request `POST /api/assets` atau `PATCH /api/tickets/1/status`.
     - *Hasil Diharapkan*: Server merespon HTTP `403 Forbidden` (`Akses ditolak: Peran Auditor memiliki hak akses Read-Only`).
  3. **Uji Unauthenticated Request**: Kirim request `GET /api/assets` tanpa menyertakan header Bearer token.
     - *Hasil Diharapkan*: Server merespon HTTP `401 Unauthorized` (tidak pernah auto-login sebagai Super Admin).
- **Kriteria Lulus**: Seluruh upaya pelanggaran keamanan ditolak dengan status HTTP yang tepat.

---

## 4. Hasil Verifikasi Otomatis (1 Oktober 2026)

### 4.1 Verifikasi Live CR-04/CR-05 — `node scripts/cr04-cr05-verify.mjs`
Dijalankan fresh terhadap DB PostgreSQL test terisolasi (dibuat & di-drop otomatis oleh skrip); server di-boot dalam mode **production** dengan `DATABASE_URL` menunjuk DB tersebut.

**TOTAL: 36 | PASS: 36 | FAIL: 0**

| Area | Bukti |
|---|---|
| Migration chain 001–005 di DB kosong | ledger `schema_migrations` terisi 5 baris via boot server |
| Health & persistence | `/api/health` melaporkan `persistence: "postgresql"` (tanpa fallback senyap) |
| Skema legacy terselaras | kolom `contracts.owner_division` varchar ada; UNIQUE index idempotensi `contract_notification_logs` terpasang (2) |
| CRUD kontrak via API | create 201 → read-back 200 → PATCH notes diterapkan |
| RBAC | kontrak restricted 404 untuk divisi lain; probe linkage via tiket ditolak; Auditor read-only ditolak; `reminders/run` & `scheduler-status` 403 non-admin |
| Reminder sweep | EXPIRY_60/35/7 terkirim (kontrak sisa 5 hari); status jujur: 9 sent (in-app), 18 skipped (email/telegram unconfigured), 0 failed; derived status `expiring` |
| Idempotensi | sweep kedua pada due-day sama: queued=0 |
| Persisten lintas restart | kontrak (dengan PATCH), tiket+`contract_id`, dan 27 notification log selamat restart proses (PostgreSQL authoritative) |
| Fail-fast production | `DATABASE_URL` mati + NODE_ENV=production → proses exit non-zero, tidak pernah melayani request, tanpa fallback file |

### 4.2 Regresi Keamanan P0 — `node scripts/p0-security-verify.mjs`

**TOTAL: 37 | PASS: 37 | FAIL: 0** (CR-01/02/03/06 tetap tertutup setelah perubahan CR-04/CR-05)

### 4.3 Kejujuran Provider (bukti jalur gagal, `scripts/provider-failpath-check.mts`)
- Email ke host tak terjangkau → `{"ok":false,"error":"connect ECONNREFUSED 127.0.0.1:59999"}` (bukan sukses palsu).
- Telegram token invalid → `{"ok":false,"error":"Telegram API HTTP 401: Unauthorized"}`.

### 4.4 Kualitas Statik
- `npx tsc --noEmit` — PASS (0 error).
- `npm run build` (Vite + esbuild) — PASS.

### 4.5 Verifikasi Panel Administrasi (audit superadmin, 1 Oktober 2026)
Audit seluruh 10 menu Administration Control Panel menghasilkan perbaikan berikut (commits `e2441eb`, `129a22b`, dan berikutnya), semua diverifikasi live:
- **Fake-success dihapus**: Reset Sandi kini endpoint nyata `POST /api/users/:id/reset-password` (CSPRNG, hash PBKDF2, revokasi sesi CR-03, tampil sekali); Rekonsiliasi = audit integritas data nyata + ekspor anomali; Notification Center pakai state tersimpan tanpa tombol uji palsu.
- **Tampilan mengikuti server**: System Health membaca `/api/health` riil (latency, persistence CR-04, scheduler CR-05); Asset Numbering menampilkan sequence live dari `/api/numbering/sequences`; Notification Center menampilkan overview CR-05 dari `/api/contracts/reminders/overview` (admin-only, live-tested 200 admin / 403 non-admin).
- **Data lengkap**: audit log kini membawa `ip_address` (request context ALS, live-tested terisi) + search/filter/pagination; seed divisi 6 kode (SC, PIBC, IT, GA, Audit, Umum); badge dinamis; field `telegram_chat_id` + badge Nonaktif di user management.

### 4.7 Green Enterprise Theme & Asset Numbering Rule Administration (16 November 2026)
- Periksa konsistensi tema pada Login, Dashboard, katalog aset, header, sidebar, form, tabel, dan Administration Control Panel; warna status warning/danger/info harus tetap berbeda.
- Superadmin dapat melihat aturan yang tersinkron dari kombinasi owner-divisi/kategori aset yang sudah ada.
- Tambah aturan untuk kombinasi yang belum terdaftar; validasi separator dan panjang sequence 3–8 digit.
- Edit aturan yang sudah dipakai: separator/panjang sequence boleh berubah untuk nomor berikutnya, tetapi nomor aset historis tidak boleh berubah. Identitas owner-divisi/kode aset tetap terkunci setelah penggunaan.
- Nonaktifkan aturan: pembuatan aset baru pada kombinasi tersebut harus ditolak; aset lama tetap tampil dan dapat dikelola.
- Hapus aturan tanpa aset/sequence: harus mengetik tepat `DIV/CODE` dan mengisi alasan minimal 20 karakter; audit log mencatat aksi.
- Hapus aturan yang sudah dipakai: server harus menolak dengan HTTP 409 meskipun UI dimanipulasi.
- Verifikasi generator melanjutkan sequence di atas nomor tersimpan dan preview tidak mengonsumsi sequence.
- **Release gate:** CI sekarang mencakup alokasi nomor aset dan kontrak lintas dua instance serta kelanjutan counter setelah restart. Sebelum horizontal scaling, lakukan UAT operasional pada lingkungan HTTPS production-like termasuk gangguan koneksi PostgreSQL dan pemulihan; jangan menganggap CI menggantikan validasi deployment.
 
### 4.6 Data Contoh UAT Multi-Modul & Perbaikan Sesi (1 Oktober 2026)
- **Seed kontrak sampel (5)**: `seedInitialData()` kini mengisi `db.contracts` dengan tanggal relatif terhadap hari seed sehingga threshold reminder selalu bermakna — CTR-2026-0001 (sisa ±5 hari → EXPIRY_7), CTR-2026-0002 (±28 hari → EXPIRY_35 + NOTICE_DATE lewat), CTR-2026-0003 (±75 hari → EXPIRY_60), CTR-2026-0004 (auto-renewal jangka panjang), CTR-2026-0005 (restricted — terverifikasi tersembunyi dari peran non-PIBC/non-owner, terlihat bagi Admin & Auditor). Live-tested di DB fresh: `GET /api/contracts` = 5 (admin), sweep boot mengantre 51 log `EXPIRY_60/35/7` dengan status jujur.
- **Seed peminjaman & tiket ke-3**: LOAN-003 (pending_approval, peminjam USR-04) dan TKT-003 (kategory GA, medium) melengkapi target ≥3 data per modul (aset 17, vendor, ruang 7, reservasi 4, maintenance 3, kontrak 5, pinjaman 3, tiket 3).
- **Nomor kontrak PostgreSQL**: alokasi `CTR-YYYY-NNNN` menggunakan counter database atomik bersama semua instance; startup merekonsiliasi nomor historis tanpa menurunkan reservasi. PR #261 menambahkan CI dua-instance dan restart continuation; lakukan UAT operasional pada lingkungan HTTPS/production sebelum horizontal scaling.
- **Password uji seragam (dev/UAT saja)**: env `GABAH_TEST_PASSWORD` (diabaikan di production) me-reprovision SEMUA akun kanonikal saat boot. Live-tested: login 6 peran (admin/IT/GA/SC/PIBC/auditor) dengan password uji seragam → semua HTTP 200.
- **Fix logout**: `onLogout` kini selalu membersihkan token/user/viewMode meski panggilan server gagal (best-effort), `initAuth` menangani token stale (401 → clear + kembali ke login), dan sesi di-restore menampilkan loading alih-alih crash. Logout endpoint `POST /api/auth/logout` tetap terverifikasi P0 (CR-03).

### 4.7 Blocker Pengujian Eksternal (jujur)
- **Pengiriman email/Telegram nyata (status `sent` pada provider eksternal) belum dapat diuji end-to-end** — tidak ada SMTP relay maupun `TELEGRAM_BOT_TOKEN` di lingkungan verifikasi. Cakupan yang terverifikasi: jalur unconfigured→skipped, jalur gagal→failed dengan alasan jelas, dan pengiriman in-app→sent. Konfigurasi produksi: set env `GABAH_SMTP_*` dan `TELEGRAM_BOT_TOKEN` lalu ulangi verifikasi manual Seksi 3 Skenario 10 poin 4.
- **Docker build tidak dapat diverifikasi** (Docker tidak tersedia di lingkungan verifikasi).
