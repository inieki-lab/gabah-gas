# GABAH — User Acceptance Testing (UAT) & Verification Guide

**Dokumen:** `docs/testing/UAT.md`  
**Sistem:** GABAH (*General Asset, Business & Automated Helpdesk*)  
**Organisasi:** PT Food Station Tjipinang Jaya (Perseroda)  
**Status:** Authoritative Test Plan & Acceptance Criteria (100% Sesuai Source Code Aktual)  
**Terakhir Diperbarui:** 28 September 2026  

---

## 1. Lingkungan Pengujian (Test Environment)

- **Development Port**: `http://localhost:3000` (dijalankan via `npm run dev`)
- **Docker Production Port**: `http://localhost:80` (dijalankan via `docker compose up -d`)
- **Database Engine**: PostgreSQL 17 (driver `pg`)
- **Token Format**: Bearer Token pada header `Authorization`
- **Metode Pengujian**: Manual UI end-to-end melalui browser dan verifikasi otomatis via API client.

---

## 2. Matriks Persona Pengujian (9 Peran Kanonikal)

| Peran (Role) | Nama Persona | Email Login | Password Valid | Peran Operasional |
|:---|:---|:---|:---|:---|
| **Admin GABAH** | Budi Santoso | `admin@foodstation.co.id` | `AdminGabah#2026` | Super Administrator (Full Control) |
| **IT** | Dani Setiawan | `it.support@foodstation.co.id` | `ItStaff#2026` | IT Support & Aset Komputasi |
| **GA** | Siti Rahmawati | `ga@foodstation.co.id` | `GaStaff#2026` | General Affairs & Sarana Prasarana |
| **Sekretaris Direksi** | Dewi Anggraini, S.Sos | `sekretariat.direksi@foodstation.co.id`| `DireksiFoodStation#2026`| Protokoler Direksi & VIP Booking |
| **Humas** | Rina Kartika, M.I.Kom | `humas@foodstation.co.id` | `HumasFoodStation#2026` | Liputan Dokumentasi & Publikasi |
| **Supply Chain** | Agus Pratama | `sc.warehouse@foodstation.co.id` | `ScStaff#2026` | Logistik & Gudang Beras |
| **PIBC** | Bambang Hermawan | `pibc.admin@foodstation.co.id` | `PibcStaff#2026` | Pengawas Pasar Induk Cipinang |
| **Karyawan** | Hendra Wijaya | `hendra.w@foodstation.co.id` | `Karyawan#2026` | Pegawai Biasa / Pemohon Layanan |
| **Auditor** | Maya Indriani, SE, Ak, CA | `auditor@foodstation.co.id` | `Auditor#2026` | Satuan Pengawas Internal (Read-Only) |

> **Fitur 1-Click Login:** Pada halaman `LoginPage.tsx`, tombol *1-Click Login* tersedia di samping profil untuk pengujian cepat tanpa mengetik kata sandi secara manual.

---

## 3. Skenario Pengujian UAT

### Skenario 1: Autentikasi, Token Sesi & Logout
- **Tujuan**: Memastikan sesi diterbitkan dengan aman dan dibersihkan saat logout.
- **Langkah Pengujian**:
  1. Buka halaman login. Masukkan email `admin@foodstation.co.id` dan password `AdminGabah#2026`.
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
