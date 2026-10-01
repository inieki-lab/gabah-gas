# GABAH — User Acceptance Testing (UAT) & Verification Guide

**Dokumen:** `docs/testing/UAT.md`  
**Sistem:** GABAH (*General Asset, Business & Automated Helpdesk*)  
**Organisasi:** PT Food Station Tjipinang Jaya (Perseroda)  
**Status:** Authoritative Test Plan & Acceptance Criteria (100% Sesuai Source Code Aktual)  
**Terakhir Diperbarui:** 1 Oktober 2026

---

## 1. Lingkungan Pengujian (Test Environment)

- **Development Port**: `http://localhost:3000` (dijalankan via `npm run dev`)
- **Docker Production Port**: `http://localhost:80` (dijalankan via `docker compose up -d`)
- **Database Engine**: PostgreSQL 17 (driver `pg`)
- **Token Format**: Bearer Token pada header `Authorization`
- **Metode Pengujian**: Manual UI end-to-end melalui browser dan verifikasi otomatis via API client.

---

## 2. Matriks Persona Pengujian (9 Peran Kanonikal)

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
| **Sekretaris Direksi** | Dewi Anggraini, S.Sos | `sekretariat.direksi@foodstation.co.id`| `<INITIAL_USER_PASSWORD>`| Protokoler Direksi & VIP Booking |
| **Humas** | Rina Kartika, M.I.Kom | `humas@foodstation.co.id` | `<INITIAL_USER_PASSWORD>` | Liputan Dokumentasi & Publikasi |
| **Supply Chain** | Agus Pratama | `sc.warehouse@foodstation.co.id` | `<INITIAL_USER_PASSWORD>` | Logistik & Gudang Beras |
| **PIBC** | Bambang Hermawan | `pibc.admin@foodstation.co.id` | `<INITIAL_USER_PASSWORD>` | Pengawas Pasar Induk Cipinang |
| **Karyawan** | Hendra Wijaya | `hendra.w@foodstation.co.id` | `<INITIAL_USER_PASSWORD>` | Pegawai Biasa / Pemohon Layanan |
| **Auditor** | Maya Indriani, SE, Ak, CA | `auditor@foodstation.co.id` | `<INITIAL_USER_PASSWORD>` | Satuan Pengawas Internal (Read-Only) |

---

## 3. Skenario Pengujian UAT

### Skenario 1: Autentikasi, Token Sesi & Logout
- **Tujuan**: Memastikan sesi diterbitkan dengan aman dan dibersihkan saat logout.
- **Langkah Pengujian**:
  1. Buka halaman login. Masukkan email admin dan password kredensial resmi (lihat Seksi 2 — placeholder, bukan nilai nyata).
  2. Periksa apakah sistem berhasil masuk ke dashboard dan menyimpan `gabah_auth_token` di `localStorage`.
  3. Lakukan logout melalui menu avatar kanan atas.
  4. Verifikasi bahwa token di `localStorage` terhapus dan pengguna diarahkan kembali ke landing page.
- **Kriteria Lulus**: Status respon 200, sesi di server dihapus, akses endpoint privat tanpa token ditolak (401).

---

### Skenario 2: Matriks Lingkup Akses Aset (RBAC Scoping)
- **Tujuan**: Memastikan data aset terfilter secara ketat sesuai kewenangan divisi.
- **Langkah Pengujian**:
  1. Login sebagai `IT` $\to$ Buka menu *Katalog Aset* $\to$ Hanya aset divisi IT yang tampil.
  2. Login sebagai `GA` $\to$ Aset GA dan aset IT tampil (aset IT bersifat *read-only*).
  3. Login sebagai `Supply Chain` $\to$ Hanya truk beras dan mesin pabrik yang tampil.
  4. Login sebagai `PIBC` $\to$ Hanya jembatan timbang dan fasilitas PIBC yang tampil.
  5. Login sebagai `Humas` $\to$ Menu katalog aset disembunyikan dari sidebar.
  6. Login sebagai `Karyawan` $\to$ Hanya melihat aset miliknya di *Aset Saya* atau aset pool pinjaman.
  7. Login sebagai `Auditor` $\to$ Melihat seluruh aset semua divisi secara menyeluruh (*read-only*).
- **Kriteria Lulus**: Filter `GabahDomainService.getScopedAssets()` berjalan 100% konsisten.

---

### Skenario 3: Pendaftaran Aset & Validasi Duplikasi
- **Tujuan**: Memverifikasi nomor kanonikal dihasilkan secara atomik dan nomor duplikat ditolak.
- **Langkah Pengujian**:
  1. Login sebagai `IT`. Buka modal *Tambah Aset Baru*.
  2. Pilih kategori "Laptop / Notebook", masukkan nama "Lenovo ThinkPad P14s", serial number `SN-TEST-001`.
  3. Simpan aset. Verifikasi nomor yang terbentuk berformat `IT-HLT-2026-xxxx`.
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
  2. Login sebagai `GA` (Siti) $\to$ buka menu *Peminjaman* $\to$ klik *Setujui Pinjaman*. Status berubah `approved`.
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
  1. Login sebagai `PIBC` $\to$ buka tab *Servis & Maintenance*.
  2. Daftarkan jadwal kalibrasi tera untuk "Jembatan Timbang Truk 60 Ton".
  3. Masukkan nama vendor/balai metrologi, estimasi biaya, dan frekuensi tahunan.
  4. Selesaikan jadwal servis dengan mengisi biaya riil dan checklist teknis.
- **Kriteria Lulus**: Data tersimpan di modul maintenance dan log audit tercatat.

---

### Skenario 8: Reservasi Ruang Rapat VIP & Notifikasi Multi-Divisi
- **Tujuan**: Memverifikasi alur VIP auto-approval dan notifikasi otomatis lintas divisi.
- **Langkah Pengujian**:
  1. Login sebagai `Sekretaris Direksi`. Buka modul *Ruang Rapat* $\to$ buat reservasi di "Ruang Rapat VIP Direksi".
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
1. **Kategori tiket**: ajukan tiket software license (Accurate/M365/VPN) → tercatat kategori `IT`; hardware → `IT`; fasilitas → `GA`; SC → `SC`; PIBC → `PIBC`. Tidak ada opsi License/General/Contract di form.
2. **Create Contract** untuk GA (security), IT (maintenance firewall), SC (supplier beras), PIBC (layanan pasar) — masing-masing tersimpan dengan PIC divisi terkait.
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

### Skenario 10: Pengujian Keamanan Negatif (Negative / Security Testing)
- **Tujuan**: Menguji ketahanan terhadap percobaan bypass dan penolakan mutasi peran Auditor.
- **Langkah Pengujian**:
  1. **Uji ID Spoofing**: Kirim request API menggunakan token user biasa tetapi menambahkan header `x-user-id: USR-01`.
     - *Hasil Diharapkan*: Server merespon HTTP `403 Forbidden` (`Percobaan manipulasi identitas (ID spoofing) terdeteksi`).
  2. **Uji Auditor Read-Only**: Login sebagai `Auditor`. Coba lakukan request `POST /api/assets` atau `PATCH /api/tickets/1/status`.
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

### 4.5 Blocker Pengujian Eksternal (jujur)
- **Pengiriman email/Telegram nyata (status `sent` pada provider eksternal) belum dapat diuji end-to-end** — tidak ada SMTP relay maupun `TELEGRAM_BOT_TOKEN` di lingkungan verifikasi. Cakupan yang terverifikasi: jalur unconfigured→skipped, jalur gagal→failed dengan alasan jelas, dan pengiriman in-app→sent. Konfigurasi produksi: set env `GABAH_SMTP_*` dan `TELEGRAM_BOT_TOKEN` lalu ulangi verifikasi manual Seksi 3 Skenario 10 poin 4.
- **Docker build tidak dapat diverifikasi** (Docker tidak tersedia di lingkungan verifikasi).
