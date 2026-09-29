# GABAH — Authoritative REST API Design Specification

**Dokumen:** `docs/architecture/API-DESIGN.md`  
**Sistem:** GABAH (*General Asset, Business & Automated Helpdesk*)  
**Server Platform:** Node.js + Express 4.21  
**Base URL:** `/api`  
**Status:** Authoritative API Specification (100% Sesuai Endpoint Aktual di `server.ts`)  
**Terakhir Diperbarui:** 28 September 2026  

---

## 1. Konvensi Umum API

### 1.1 Header Permintaan & Autentikasi
Kecuali untuk endpoint publik (`PUBLIC_API_PATHS`), setiap request wajib menyertakan header otentikasi Bearer token:
```http
Authorization: Bearer <session_token>
Content-Type: application/json
```

### 1.2 Format Respon Standar
- **Respon Berhasil (HTTP 200 / 201)**:
  ```json
  {
    "success": true,
    "data": { ... }
  }
  ```
- **Respon Gagal / Validasi (HTTP 400)**:
  ```json
  {
    "success": false,
    "message": "Pesan deskripsi kesalahan"
  }
  ```
- **Respon Tidak Terautentikasi (HTTP 401)**:
  ```json
  {
    "success": false,
    "message": "Sesi pengguna tidak valid atau telah kedaluwarsa. Silakan login kembali."
  }
  ```
- **Respon Akses Ditolak (HTTP 403)**:
  ```json
  {
    "success": false,
    "message": "Akses ditolak: [Alasan penolakan / RBAC constraint]"
  }
  ```
- **Respon Rate Limit Exceeded (HTTP 429)**:
  ```json
  {
    "success": false,
    "message": "Terlalu banyak permintaan API. Harap tunggu 60 detik sebelum mencoba kembali.",
    "retry_after_seconds": 60
  }
  ```

---

## 2. Katalog Endpoint Aktual

### 2.1 Sistem & Kesehatan (System & Health)
| Endpoint | Method | Autentikasi | Hak Akses | Deskripsi |
|:---|:---:|:---:|:---:|:---|
| `/api/health` | `GET` | Publik | Semua | Memeriksa status kesehatan server dan info versi aplikasi |

---

### 2.2 Autentikasi & Sesi (Authentication & Sessions)
| Endpoint | Method | Autentikasi | Hak Akses | Deskripsi |
|:---|:---:|:---:|:---:|:---|
| `/api/auth/login` | `POST` | Publik | Semua | Otentikasi email/alias & password. Mengembalikan user profile & Bearer token |
| `/api/auth/logout` | `POST` | Bearer Token | Semua (termasuk Auditor) | Menghancurkan sesi aktif pada tabel `user_sessions` |
| `/api/auth/me` | `GET` | Bearer Token | Semua | Mengembalikan data profil akun aktif berdasarkan token sesi |
| `/api/auth/switch-role` | `POST` | Bearer Token / Publik (Dev) | Semua | Beralih persona/peran aktif untuk pengujian end-to-end multi-role |

---

### 2.3 Manajemen Pengguna (User Management)
| Endpoint | Method | Autentikasi | Hak Akses | Deskripsi |
|:---|:---:|:---:|:---:|:---|
| `/api/users` | `GET` | Bearer Token | Semua | Mengambil seluruh daftar pengguna aktif (password hash disanitasi) |
| `/api/users` | `POST` | Bearer Token | `Admin GABAH` | Mendaftarkan pengguna baru dengan initial password |
| `/api/users/:id` | `PATCH` | Bearer Token | `Admin GABAH` | Memperbarui profil, peran, divisi, atau status aktif pengguna |
| `/api/users/:id` | `DELETE`| Bearer Token | `Admin GABAH` | Menghapus atau menonaktifkan akun pengguna |

---

### 2.4 Master Data: Taksonomi & Kategori Aset
| Endpoint | Method | Autentikasi | Hak Akses | Deskripsi |
|:---|:---:|:---:|:---:|:---|
| `/api/taxonomy/categories` | `GET` | Bearer Token | Semua | Mengambil daftar seluruh kategori aset kanonikal BUMD |
| `/api/taxonomy/categories` | `POST` | Bearer Token | `Admin GABAH` | Menambahkan kategori aset baru ke master taksonomi |
| `/api/taxonomy/categories/:code` | `PATCH` | Bearer Token | `Admin GABAH` | Memperbarui informasi nama atau parameter kategori aset |
| `/api/taxonomy/categories/:code` | `DELETE`| Bearer Token | `Admin GABAH` | Menghapus kategori aset (terproteksi: tidak boleh jika ada aset aktif) |
| `/api/taxonomy/resolve` | `POST` | Bearer Token | Semua | Menentukan taksonomi kanonikal dan owner division dari string nama |

---

### 2.5 Master Data: Fasilitas Gudang & Lokasi Fisik
| Endpoint | Method | Autentikasi | Hak Akses | Deskripsi |
|:---|:---:|:---:|:---:|:---|
| `/api/master/locations` | `GET` | Bearer Token | Semua | Mengambil daftar fasilitas gudang dan lokasi operasional |
| `/api/master/locations` | `POST` | Bearer Token | `Admin GABAH` | Menambahkan lokasi fasilitas baru |
| `/api/master/locations/:id` | `PATCH` | Bearer Token | `Admin GABAH` | Memperbarui nama, alamat, atau kapasitas lokasi |
| `/api/master/locations/:id` | `DELETE`| Bearer Token | `Admin GABAH` | Menghapus lokasi operasional |

---

### 2.6 Master Data: Organisasi (Divisi & Departemen)
| Endpoint | Method | Autentikasi | Hak Akses | Deskripsi |
|:---|:---:|:---:|:---:|:---|
| `/api/master/divisions` | `GET` | Bearer Token | Semua | Mengambil struktur divisi dan departemen operasional |
| `/api/master/divisions` | `POST` | Bearer Token | `Admin GABAH` | Menambahkan divisi korporat baru |
| `/api/master/divisions/:code` | `PATCH` | Bearer Token | `Admin GABAH` | Memperbarui nama pimpinan, nama divisi, atau susunan departemen |
| `/api/master/divisions/:code` | `DELETE`| Bearer Token | `Admin GABAH` | Menghapus divisi (terproteksi jika masih menaungi aset terdaftar) |

---

### 2.7 Manajemen Aset Tetap (Assets)
| Endpoint | Method | Autentikasi | Hak Akses | Deskripsi |
|:---|:---:|:---:|:---:|:---|
| `/api/assets` | `GET` | Bearer Token | Terfilter Scope | Mengambil katalog aset sesuai batasan divisi aktor (`getScopedAssets`) |
| `/api/assets` | `POST` | Bearer Token | Divisi Pemilik / Admin | Mendaftarkan aset baru. Nomor kanonikal di-generate otomatis oleh server |
| `/api/assets/:id` | `GET` | Bearer Token | Terfilter Scope | Mengambil detail lengkap aset |
| `/api/assets/:id` | `PATCH` | Bearer Token | Divisi Pemilik / Admin | Memperbarui informasi aset (termasuk nomor Accurate ERP) |
| `/api/assets/:id/assign` | `POST` | Bearer Token | Divisi Pemilik / Admin | Menugaskan unit aset ke karyawan atau unassign kembali ke gudang |
| `/api/assets/:id/move` | `POST` | Bearer Token | Divisi Pemilik / Admin | Merelokasi fisik aset ke lokasi baru dan mencatat pergerakan |
| `/api/assets/:id/lifecycle` | `POST` | Bearer Token | Divisi Pemilik / Admin | Mutasi siklus hidup (repair, damaged, cannibalize, disposal, auction) |
| `/api/movements` | `GET` | Bearer Token | Semua | Mengambil riwayat mutasi perpindahan seluruh aset |

---

### 2.8 Sirkulasi Peminjaman Aset (Loans)
| Endpoint | Method | Autentikasi | Hak Akses | Deskripsi |
|:---|:---:|:---:|:---:|:---|
| `/api/loans` | `GET` | Bearer Token | Semua | Mengambil daftar riwayat permohonan peminjaman aset |
| `/api/loans` | `POST` | Bearer Token | Semua Karyawan | Mengajukan pinjaman baru (divalidasi anti-bentrok jadwal di server) |
| `/api/loans/:id/approve` | `POST` | Bearer Token | Divisi Pemilik / Admin | Menyetujui pinjaman (aset berubah status menjadi `reserved`) |
| `/api/loans/:id/handover` | `POST` | Bearer Token | Divisi Pemilik / Admin | Serah terima fisik barang (aset berubah status menjadi `assigned`) |
| `/api/loans/:id/return` | `POST` | Bearer Token | Divisi Pemilik / Admin | Pengembalian barang dan inspeksi kondisi fisik unit |

---

### 2.9b Contract Management API (Domain Tersendiri)
- `GET /api/contracts` — daftar kontrak ter-scope (divisi pemilik/PIC; Admin & Auditor seluruh; `restricted` difilter)
- `GET /api/contracts/:id`, `POST /api/contracts`, `PATCH /api/contracts/:id`
- `POST /api/contracts/:id/documents` (append-only), `POST /api/contracts/:id/milestones`
- `POST /api/contracts/:id/renewal-decision` — body `{ outcome, notes, replacement_contract_id }`
- `POST /api/contracts/reminders/run` — evaluasi threshold (idempoten per hari; Admin only; siap dijadwalkan cron)
- `GET /api/contracts/:id/notification-logs` — log pengiriman per channel (in_app/email/telegram)
- `POST /api/tickets` menerima `contract_id` opsional — Ticket = pekerjaan atas Contract; Contract bukan kategori tiket
- Kategori tiket helpdesk resmi: `IT` | `GA` | `SC` | `PIBC` (license/software → IT)

### 2.9 Tiket Helpdesk & Gangguan (Tickets)
| Endpoint | Method | Autentikasi | Hak Akses | Deskripsi |
|:---|:---:|:---:|:---:|:---|
| `/api/tickets` | `GET` | Bearer Token | Semua | Mengambil daftar tiket (karyawan melihat tiketnya, agen melihat antreannya) |
| `/api/tickets` | `POST` | Bearer Token | Semua Karyawan | Membuat tiket kendala operasional (SLA deadline dihitung otomatis) |
| `/api/tickets/:id/status`| `PATCH` | Bearer Token | Agen Terkait / Admin | Memperbarui status tiket (`in_progress`, `resolved`, `closed`) dan solusi |

---

### 2.10 Pemeliharaan Berkala & Servis (Maintenance)
| Endpoint | Method | Autentikasi | Hak Akses | Deskripsi |
|:---|:---:|:---:|:---:|:---|
| `/api/maintenances` | `GET` | Bearer Token | Semua | Mengambil jadwal servis berkala & kalibrasi tera PIBC |
| `/api/maintenances` | `POST` | Bearer Token | Divisi Terkait / Admin | Mendaftarkan jadwal servis baru dengan checklist teknis |
| `/api/maintenances/:id` | `PATCH` | Bearer Token | Divisi Terkait / Admin | Menyelesaikan jadwal servis, memperbarui biaya riil, dan catatan teknis |

---

### 2.11 Notifikasi Sistem (Notifications)
| Endpoint | Method | Autentikasi | Hak Akses | Deskripsi |
|:---|:---:|:---:|:---:|:---|
| `/api/notifications` | `GET` | Bearer Token | Terfilter Scope | Mengambil notifikasi yang dialokasikan untuk user/peran aktif |
| `/api/notifications/:id/read` | `PATCH` | Bearer Token | Semua (termasuk Auditor) | Menandai satu notifikasi telah dibaca (`is_read: true`) |
| `/api/notifications/read-all` | `POST` | Bearer Token | Semua (termasuk Auditor) | Menandai seluruh notifikasi relevan telah dibaca |

---

### 2.12 Dashboard & Attention Center
| Endpoint | Method | Autentikasi | Hak Akses | Deskripsi |
|:---|:---:|:---:|:---:|:---|
| `/api/dashboard/stats` | `GET` | Bearer Token | Semua | Mengambil statistik agregat aset, nilai buku, tiket terbuka, dan pinjaman |
| `/api/dashboard/attention`| `GET` | Bearer Token | Terfilter Scope | Mengambil item darurat / action required sesuai batasan peran |

---

### 2.13 Rekonsiliasi Accurate ERP & Audit Logs
| Endpoint | Method | Autentikasi | Hak Akses | Deskripsi |
|:---|:---:|:---:|:---:|:---|
| `/api/reconciliation` | `GET` | Bearer Token | `Admin GABAH` & `Auditor` | Mengambil data pemetaan nomor aset GABAH vs Accurate ERP |
| `/api/reconciliation/link` | `POST` | Bearer Token | `Admin GABAH` | Menautkan nomor aset Accurate (`corporate_asset_number`) ke aset GABAH |
| `/api/audit-logs` | `GET` | Bearer Token | `Admin GABAH` & `Auditor` | Mengambil seluruh log audit mutasi sistem |

---

### 2.14 Ruang Rapat & Reservasi VIP (Meeting Rooms)
| Endpoint | Method | Autentikasi | Hak Akses | Deskripsi |
|:---|:---:|:---:|:---:|:---|
| `/api/meeting-rooms` | `GET` | Bearer Token | Semua | Mengambil daftar seluruh ruang rapat representatif |
| `/api/meeting-rooms/:id` | `PATCH` | Bearer Token | `Admin GABAH` & `GA` | Memperbarui fasilitas atau kapasitas ruang rapat |
| `/api/room-reservations` | `GET` | Bearer Token | Semua | Mengambil jadwal reservasi ruang rapat |
| `/api/room-reservations` | `POST` | Bearer Token | Semua | Membuat reservasi ruang (VIP auto-approval untuk Sekdir, notifikasi IT/GA/Pantry/Humas) |
| `/api/room-reservations/:id/approve` | `POST` | Bearer Token | `Admin GABAH` & `GA` | Menyetujui permohonan reservasi ruang rapat |
| `/api/room-reservations/:id/reject` | `POST` | Bearer Token | `Admin GABAH` & `GA` | Menolak reservasi dengan alasan tertulis |
| `/api/room-reservations/:id/checkin` | `POST` | Bearer Token | Pemohon / GA / Admin | Check-in penggunaan ruangan rapat |
| `/api/room-reservations/:id/checkout`| `POST` | Bearer Token | Pemohon / GA / Admin | Check-out dan melepaskan ruangan kembali tersedia |
| `/api/room-reservations/:id/cancel` | `POST` | Bearer Token | Pemohon / GA / Admin | Membatalkan reservasi ruang |

---

### 2.15 Master Tipe Rapat & Fasilitas (Meeting Master Settings)
| Endpoint | Method | Autentikasi | Hak Akses | Deskripsi |
|:---|:---:|:---:|:---:|:---|
| `/api/meeting-types` | `GET` | Bearer Token | Semua | Mengambil master tipe agenda rapat |
| `/api/meeting-types` | `POST` | Bearer Token | `Admin GABAH` & `GA` | Menambah tipe rapat baru |
| `/api/meeting-types/:id` | `PATCH` | Bearer Token | `Admin GABAH` & `GA` | Memperbarui tipe rapat |
| `/api/meeting-types/:id` | `DELETE`| Bearer Token | `Admin GABAH` & `GA` | Menghapus tipe rapat |
| `/api/meeting-facilities` | `GET` | Bearer Token | Semua | Mengambil katalog master fasilitas ruangan (GA & IT) |
| `/api/meeting-facilities` | `POST` | Bearer Token | `Admin GABAH` & `GA` | Menambah fasilitas baru ke katalog |
| `/api/meeting-facilities/:id` | `PATCH`| Bearer Token | `Admin GABAH` & `GA` | Memperbarui fasilitas |
| `/api/meeting-facilities/:id` | `DELETE`| Bearer Token | `Admin GABAH` & `GA` | Menghapus fasilitas |
