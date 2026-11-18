# GABAH — User Acceptance Testing (UAT) & Verification Guide

**Dokumen:** `docs/testing/UAT.md`  
**Sistem:** GABAH (*General Asset, Business & Automated Helpdesk*)  
**Organisasi:** PT Food Station Tjipinang Jaya (Perseroda)  
**Status:** Rencana UAT; skenario harus dijalankan dan ditandatangani pemilik proses sebelum go-live. Dokumen ini bukan bukti seluruh skenario telah lulus. Implementasi routing IT/GA/ME dan scope unit ME telah melewati CI otomatis pada PR #121 (67/67 langkah pada commit yang diverifikasi); skenario tiket tetap berstatus belum lulus UAT sampai browser test per persona dijalankan dan bukti/sign-off dicatat.  
**Terakhir Diperbarui:** 18 November 2026

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

## 2. Matriks Persona Pengujian (Role Aplikasi + Unit + Lokasi)

> **SECURITY (CR-02):** Password tidak ditulis di dokumen ini. Gunakan kredensial
> yang diterbitkan melalui proses provisioning resmi
> (`<INITIAL_ADMIN_PASSWORD>` / `<INITIAL_USER_PASSWORD>` — placeholder, bukan
> nilai nyata) atau yang direset oleh Admin GABAH. Tombol *1-Click Login* telah
> dihapus dari halaman login.

| Peran (Role) | Nama Persona | Email Login | Password | Peran Operasional |
|:---|:---|:---|:---|:---|
| **Admin GABAH** | Budi Santoso | `admin@foodstation.co.id` | `<INITIAL_ADMIN_PASSWORD>` | Super Administrator (Full Control) |
| **IT** | Dani Setiawan | `it.support@foodstation.co.id` | `<INITIAL_USER_PASSWORD>` | IT Support & Aset Komputasi |
| **GA** | Siti Rahmawati | `ga@foodstation.co.id` | `<INITIAL_USER_PASSWORD>` | General Affairs & Sarana Prasarana |
| **Karyawan + capability Sekretaris Direksi** | Dewi Anggraini, S.Sos | `sekretariat.direksi@foodstation.co.id`| `<INITIAL_USER_PASSWORD>`| Pegawai; fungsi sekretariat Direksi dan VIP Booking melalui role tambahan |
| **Karyawan + capability Humas** | Rina Kartika, M.I.Kom | `humas@foodstation.co.id` | `<INITIAL_USER_PASSWORD>` | Pegawai; fungsi dokumentasi dan publikasi melalui role tambahan |
| **Karyawan** | Agus Pratama | `sc.warehouse@foodstation.co.id` | `<INITIAL_USER_PASSWORD>` | Unit Supply Chain / lokasi RPC/SC |
| **Karyawan** | Bambang Hermawan | `pibc.admin@foodstation.co.id` | `<INITIAL_USER_PASSWORD>` | Unit PIBC / lokasi PIBC |
| **Karyawan** | Hendra Wijaya | `hendra.w@foodstation.co.id` | `<INITIAL_USER_PASSWORD>` | Pegawai Biasa / Pemohon Layanan |
| **Auditor** | Maya Indriani, SE, Ak, CA | `auditor@foodstation.co.id` | `<INITIAL_USER_PASSWORD>` | Satuan Pengawas Internal (Read-Only) |

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
  1. Login sebagai IT. Pastikan aset owner IT terlihat di HO, PIBC, RPC/SC, Pangsub, dan lokasi lain yang terdaftar; aset owner lain tidak dapat dimutasi oleh IT.
  2. Login sebagai GA. Pastikan aset owner GA terlihat lintas lokasi. Jika permission assets.read.it_workstations aktif, hanya Laptop/PC owner IT yang dapat dibaca; mutasi langsung via API harus ditolak.
  3. Login sebagai Karyawan di unit Supply Chain dan PIBC. Pastikan fungsi dasar karyawan tersedia; lokasi kerja tidak otomatis membuka katalog aset unit/lokasi.
  4. Uji aset historis dengan owner legacy SC/PIBC yang ditempatkan di lokasi fisik berbeda. Record tersebut harus tetap terbaca hanya melalui scope legacy eksplisit atau Superadmin selama proses review; jangan menganggap RPC/SC atau PIBC sebagai owner aktif baru. Aset baru harus memakai owner domain aktif yang sah (misalnya IT atau GA), sedangkan lokasi fisik disimpan terpisah.
  5. Login sebagai Humas dan Sekretaris Direksi. Pastikan fungsi dasar karyawan tersedia serta kapabilitas tambahan muncul hanya bila role tambahan/permission diberikan.
  6. Login sebagai Auditor. Pastikan data yang diberi scope audit dapat dibaca dan seluruh operasi mutasi ditolak.
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
- **Tujuan**: Memverifikasi nomor aset mengikuti aturan aktif, preview tidak mengonsumsi sequence, dan serial number duplikat ditolak. Skenario ini tidak membuktikan atomicity sequence untuk multi-instance.
- **Langkah Pengujian**:
  1. Login sebagai `IT`. Buka modal *Tambah Aset Baru*.
  2. Pilih kategori "Laptop / Notebook", masukkan nama "Lenovo ThinkPad P14s", serial number `SN-TEST-001`.
  3. Simpan aset. Verifikasi nomor mengikuti aturan aktif yang ditampilkan pada Administration → Asset Numbering; jangan mengasumsikan prefix atau pola tertentu sebelum standar perusahaan disahkan.
  4. Sebagai Super Admin, ubah/aktifkan aturan penomoran UAT yang aman, lalu verifikasi preview tidak mengonsumsi sequence dan pembuatan aset berikutnya mengikuti aturan aktif. Pulihkan aturan setelah tes.
  5. Coba daftarkan aset kedua dengan serial number yang sama (`SN-TEST-001`).
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
  1. Login sebagai `Karyawan` (Hendra). Buka *Peminjaman Barang* $\to$ pilih aset kendaraan GA berstatus dapat dipinjam yang tersedia di database UAT; catat ID aset dan ajukan pinjaman pada rentang tanggal uji yang akan datang.
  2. Login sebagai `GA` (Siti) $\to$ buka menu *Peminjaman* $\to$ klik *Setujui Pinjaman*. Status berubah `approved`.
  3. Login sebagai Karyawan lain (atau akun uji kedua) $\to$ ajukan pinjaman untuk aset yang sama pada rentang tanggal yang tumpang tindih dengan permohonan pertama.
- **Kriteria Lulus**: Permohonan kedua ditolak oleh server dengan pesan error: `Tabrakan Jadwal: Aset sudah direservasi atau dipinjam pada rentang tanggal tersebut.`

---

### Skenario 6: Helpdesk IT, GA, ME, Dispatch, dan SLA
- **Tujuan**: Memastikan kategori tiket baru terpisah dari lokasi, antrean, owner aset, dan hak penangan.
- **Langkah Pengujian**:
  1. Login sebagai pegawai biasa; buat tiket IT prioritas Urgent. Verifikasi SLA 4 jam. Jika tepat satu petugas IT aktif memiliki `tickets.read`, `notifications.read`, `tickets.update` + exact scope IT, tiket otomatis ditugaskan kepadanya. Jika nol atau lebih dari satu kandidat, tiket tetap di antrean IT (tidak memilih acak).
  2. Login sebagai petugas IT yang ditugaskan; mulai pekerjaan dan selesaikan tiket dengan catatan. Pelapor hanya boleh membaca tiketnya, bukan mengubah status kecuali ia juga petugas berwenang.
  3. Login sebagai pemohon dengan capability `tickets.create.ga`; buat tiket GA. Login sebagai Petugas Helpdesk GA yang memiliki `tickets.read`, `notifications.read`, `tickets.assign` + exact scope GA; buka daftar petugas. Hanya user aktif dengan `tickets.read`, `notifications.read`, `tickets.update` + exact scope GA yang boleh dipilih. Uji bahwa user GA biasa/Kasi GA tanpa capability operator tidak dapat mengubah status atau mendelegasikan tiket.
  4. Login sebagai pemohon dengan capability `tickets.create.me`; buat tiket ME. Pastikan `assigned_unit_id=UNIT-PIBC-ME` dan lokasi unit adalah PIBC. Login sebagai Admin Tiket ME dengan unit dan scope ME; delegasikan hanya kepada petugas aktif yang berada pada unit ME serta memiliki `tickets.read`, `notifications.read`, `tickets.update` + exact scope unit.
  5. Login sebagai pegawai PIBC lain yang tidak memiliki scope unit ME. Pastikan ia tidak melihat antrean ME hanya karena `office_location_id=OFF-PIBC`. Ulangi untuk pegawai RPC/SC: lokasi kerja tidak memberikan akses antrean.
  6. Coba kirim kategori baru `SC` atau `PIBC` melalui API; server harus menolak. Tiket historis kategori SC/PIBC tetap tersimpan dan hanya terlihat melalui reporter, assignee, scope legacy eksplisit, atau Superadmin.
  7. Pilih aset terkait owner IT/GA dan pastikan kategori konsisten. Pilih aset owner legacy SC/PIBC; form/API harus menolak tautan tiket baru sampai klasifikasi aset direview, tanpa mengubah owner atau histori.
- **Kriteria Lulus**: Semua keputusan list, direct-ID, status mutation, assignee lookup, assignment, notifikasi, dan dashboard sesuai permission + scope; tidak ada grant dari label role/jabatan/lokasi; SLA dan audit log akurat.

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
     - Login sebagai `Humas` $\to$ Cek lonceng: Muncul *"Permintaan Dokumentasi Humas: VIP Buffet & Liputan"*.
- **Kriteria Lulus**: Keempat divisi menerima notifikasi sesuai tugas masing-masing secara akurat.

---

### Skenario 10: Contract Management (Domain Tersendiri) & Kategori Tiket
1. **Kategori / routing tiket baru**: hanya `IT`, `GA`, dan `ME`. IT menangani hardware/software/lisensi; GA menangani antrean GA melalui dispatcher berizin; ME adalah antrean unit `UNIT-PIBC-ME`. `SC`/`PIBC` tetap hanya nilai historis dan tidak boleh dipilih untuk tiket baru. Kontrak tetap domain terpisah; owner kontrak legacy tidak otomatis menentukan antrean tiket. Uji seluruh permission dan scope sesuai Skenario 6.
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
  3. Login sebagai `Admin GABAH`.
  4. Verifikasi tombol *Administration Control Panel* tampil di bagian bawah sidebar.
  5. Buka panel $\to$ uji tab *User Management*, *Organisasi*, *Master Data*, dan *Audit Trail*.
- **Kriteria Lulus**: Tombol dan modal administrasi terkunci eksklusif untuk peran `Admin GABAH`.

---

### Skenario 11: Pengujian Keamanan Negatif (Negative / Security Testing)
- **Tujuan**: Menguji ketahanan terhadap percobaan bypass dan penolakan mutasi peran Auditor.
- **Langkah Pengujian**:
  1. **Uji ID Spoofing**: Kirim request API menggunakan token user biasa tetapi menambahkan header `x-user-id` berisi ID akun uji lain yang valid (bukan ID pemilik token).
     - *Hasil Diharapkan*: Server merespon HTTP `403 Forbidden`; server tidak boleh menerima identitas dari header yang bertentangan dengan token.
  2. **Uji Auditor Read-Only**: Login sebagai `Auditor`. Coba lakukan request `POST /api/assets` atau `PATCH /api/tickets/1/status`.
     - *Hasil Diharapkan*: Server merespon HTTP `403 Forbidden` untuk mutasi yang tidak diberikan oleh permission efektif Auditor, termasuk bila Auditor digabung sebagai role tambahan.
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
- **Release gate:** sequence engine masih process-memory based. UAT satu instance tidak membuktikan atomicity multi-instance; penggantian generator ke PostgreSQL atomic UPSERT harus selesai sebelum horizontal scaling / multi-replica.
 
### 4.6 Data Contoh UAT Multi-Modul & Perbaikan Sesi (1 Oktober 2026)
- **Seed kontrak sampel (5)**: `seedInitialData()` kini mengisi `db.contracts` dengan tanggal relatif terhadap hari seed sehingga threshold reminder selalu bermakna — CTR-2026-0001 (sisa ±5 hari → EXPIRY_7), CTR-2026-0002 (±28 hari → EXPIRY_35 + NOTICE_DATE lewat), CTR-2026-0003 (±75 hari → EXPIRY_60), CTR-2026-0004 (auto-renewal jangka panjang), CTR-2026-0005 (restricted — terverifikasi tersembunyi dari peran non-PIBC/non-owner, terlihat bagi Admin & Auditor). Live-tested di DB fresh: `GET /api/contracts` = 5 (admin), sweep boot mengantre 51 log `EXPIRY_60/35/7` dengan status jujur.
- **Seed peminjaman & tiket ke-3**: LOAN-003 (pending_approval, peminjam USR-04) dan TKT-003 (kategory GA, medium) melengkapi target ≥3 data per modul (aset 17, vendor, ruang 7, reservasi 4, maintenance 3, kontrak 5, pinjaman 3, tiket 3).
- **Sinkronisasi nomor kontrak saat boot**: `AssetNumberingEngine.syncFromExistingRecords()` kini juga menerima `contracts` sehingga sequence `CTR-YYYY-NNNN` dilanjutkan dari store tersimpan (bukan reset ke 0001). Live-tested: kontrak pertama buatan user di DB ber-seed = `CTR-2026-0006` (bentrok nomor terhindar).
- **Password uji seragam (dev/UAT saja)**: env `GABAH_TEST_PASSWORD` (diabaikan di production) me-reprovision SEMUA akun kanonikal saat boot. Live-tested: login 6 peran (admin/IT/GA/SC/PIBC/auditor) dengan password uji seragam → semua HTTP 200.
- **Fix logout**: `onLogout` kini selalu membersihkan token/user/viewMode meski panggilan server gagal (best-effort), `initAuth` menangani token stale (401 → clear + kembali ke login), dan sesi di-restore menampilkan loading alih-alih crash. Logout endpoint `POST /api/auth/logout` tetap terverifikasi P0 (CR-03).

### 4.7 Blocker Pengujian Eksternal (jujur)
- **Pengiriman email/Telegram nyata (status `sent` pada provider eksternal) belum dapat diuji end-to-end** — tidak ada SMTP relay maupun `TELEGRAM_BOT_TOKEN` di lingkungan verifikasi. Cakupan yang terverifikasi: jalur unconfigured→skipped, jalur gagal→failed dengan alasan jelas, dan pengiriman in-app→sent. Konfigurasi produksi: set env `GABAH_SMTP_*` dan `TELEGRAM_BOT_TOKEN` lalu ulangi verifikasi manual Seksi 3 Skenario 10 poin 4.
- **Docker build tidak dapat diverifikasi** (Docker tidak tersedia di lingkungan verifikasi).


---

## 5. Browser UAT — Dynamic RBAC, ticket routing, and owner/location separation

**Status as of 18 November 2026: NOT EXECUTED / NOT SIGNED OFF.** Automated CI is not a substitute for this section. Run against an isolated UAT database and build, never against production. Record build SHA, browser/version, tester, timestamp, screenshots, and result for every row.

### 5.1 Preconditions

- [ ] UAT database is isolated and has a verified backup.
- [ ] Application health reports PostgreSQL persistence; no file-store fallback.
- [ ] Migration ledger contains migration 098 exactly once.
- [ ] Superadmin has reviewed role assignments, primary/additional roles, module activation, owner scopes, unit scopes, and location attributes.
- [ ] One dedicated test account exists for each persona below. Do not reuse a real employee's account.
- [ ] Dedicated GA operator, GA requester, ME requester, Admin Tiket ME, and ME technician assignments are explicitly configured. Migration 098 creates role templates; it does not assign users.
- [ ] Each account is logged out before its test begins; verify fresh login and session restore.

### 5.2 Persona and negative-access matrix

| Persona / test account | Positive test | Negative test that must be denied |
|---|---|---|
| Superadmin | Administration, user/role assignment, module configuration, all authorized asset/ticket views | No hidden API error; destructive actions must require confirmation and create audit records |
| IT Support | See IT queue; receive IT ticket notifications; assign/update tickets only with exact IT scope; manage IT assets across office locations | Cannot manage GA/ME queues or non-IT assets without explicit additional scope |
| GA asset operator | Create/update GA-owned assets; see and dispatch GA ticket queue only when ga_helpdesk_operator is explicitly assigned | Generic GA role alone cannot dispatch/manage GA tickets; cannot mutate IT assets |
| GA requester | Create GA ticket with tickets.create.ga; see own ticket and notifications | Cannot see all GA queue or assign/update other people's tickets |
| ME requester | Create ME ticket; ticket routes to UNIT-PIBC-ME | Being physically located at PIBC without ME capability does not grant ME queue access |
| Admin Tiket ME | See/manage/assign tickets in UNIT-PIBC-ME with exact tickets unit scope | Cannot manage IT/GA queues or other units |
| ME technician | See only tickets explicitly assigned to them if personal-assignment policy permits; update only with explicit operational permission/scope | Unit membership or location alone must not imply dispatcher rights |
| RPC/SC employee | Standard employee dashboard; create IT helpdesk ticket; view own requests | RPC/SC location must not create a Supply Chain role, division scope, or broad asset/ticket access |
| PIBC employee | Standard employee dashboard; create IT helpdesk ticket; view own requests | PIBC office location must not grant ME operator access, PIBC division authority, or asset mutation |
| Auditor | Read-only audit/reconciliation and explicitly permitted read views | Every create/update/delete/assign/approve/dispatch action must be denied server-side |

### 5.3 Cross-cutting authorization probes

For every persona, verify both UI and direct API behavior. Hiding a button is not sufficient evidence.

- [ ] Change only office_location_id from HO to PIBC; permissions and role grants must not increase.
- [ ] Change only unit_id; queue access changes only where an exact module unit scope and required permissions are both present.
- [ ] Change only job level (Direksi/Kadiv/Kadep/Kasi/Staf); no permission is added by title.
- [ ] Remove an additional role or its scope; access is revoked after policy refresh and a new request.
- [ ] Disable a module; its UI entry and API actions are denied, not merely hidden.
- [ ] Attempt direct object-ID access for an out-of-scope asset, ticket, contract, loan, and notification; no data leakage.
- [ ] Attempt state-changing requests as Auditor and as a custom read-only role; server returns 403/404 according to the endpoint's disclosure policy.
- [ ] Verify user-targeted notifications are private; role/unit notifications are visible only to eligible recipients.
- [ ] Verify all denied writes leave no changed row, notification, audit success record, or partial state.

### 5.4 Ticket routing scenarios

- [ ] New IT ticket routes to IT; automatic assignment occurs only when exactly one active operator meets all permission and exact-scope requirements.
- [ ] Zero or multiple eligible IT operators leaves the ticket in the IT queue; notifications go only to eligible users with notifications.read.
- [ ] New GA ticket requires explicit GA requester capability; it is visible to its reporter and explicitly scoped GA operator only.
- [ ] New ME ticket requires explicit ME requester capability and active UNIT-PIBC-ME; it stores assigned_unit_id='UNIT-PIBC-ME'.
- [ ] Disable UNIT-PIBC-ME; a new ME ticket is rejected with HTTP 409 and no ticket/notification/audit partial write.
- [ ] SC/PIBC are rejected as new ticket categories while historical SC/PIBC tickets remain unchanged.
- [ ] Reporter can read their own ticket but cannot change its status without tickets.update and matching scope.
- [ ] Dispatch to an inactive, unscoped, or insufficiently permissioned target is rejected.
- [ ] Failed persistence during dispatch restores ticket assignment, notification, audit, and state snapshot.

### 5.5 Asset owner and location scenarios

- [ ] IT user can create/manage IT assets at HO, PIBC, RPC, Pangsub, and Kantor Perawatan when location is valid; ownership remains IT.
- [ ] GA user can create/manage GA assets at those locations; physical location does not change owner.
- [ ] GA's IT workstation read-only grant (if enabled) exposes only approved IT workstation categories and does not permit create/update/assign/move/lifecycle.
- [ ] A custom role sees and mutates only owner domains explicitly granted by asset permission plus owner scope.
- [ ] A role with only unit/location scope cannot mutate assets in an owner domain.
- [ ] Unknown or inactive owner masters are rejected for new assets.
- [ ] Historical SC/PIBC owner records remain unchanged pending asset-by-asset review; UI labels identify them as legacy owner values, not current divisions.
- [ ] Movement and maintenance history are limited to the same visible asset set.

### 5.6 Result record

| Persona / scenario | PASS / FAIL / BLOCKED | Evidence reference | Tester / date |
|---|---|---|---|
| Superadmin | NOT RUN | | |
| IT Support | NOT RUN | | |
| GA operator + requester | NOT RUN | | |
| ME requester + Admin ME + technician | NOT RUN | | |
| RPC/SC employee | NOT RUN | | |
| PIBC employee | NOT RUN | | |
| Auditor | NOT RUN | | |
| Direct API / cross-cutting probes | NOT RUN | | |
| Ticket routing | NOT RUN | | |
| Asset owner/location separation | NOT RUN | | |

**Release gate:** no production go-live or merge-to-main recommendation until all applicable rows pass, evidence is attached, and business/IT owners sign off. Any BLOCKED row must have an owner and remediation date; it is not a pass.
