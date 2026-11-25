# GABAH — REST API Contract Baseline & Route Inventory

**Dokumen:** `docs/architecture/API-DESIGN.md`  
**Sistem:** GABAH (*General Asset, Business & Automated Helpdesk*)  
**Server Platform:** Node.js + Express 4.21  
**Base URL:** `/api`  
**Status:** Kontrak API baseline; endpoint, autentikasi, validasi, dan otorisasi harus diverifikasi terhadap implementasi pada exact commit.  
**Terakhir Ditinjau:** 23 November 2026 (baseline source SHA tercatat di atas; handler-level reconciliation masih terbuka)  

---

> Transport autentikasi browser dapat berubah. Jangan menganggap Bearer token, cookie session, header, endpoint, atau response shape masih berlaku tanpa memeriksa middleware auth, route handlers, API client, dan integration tests. Dokumentasikan perbedaan browser vs machine/API clients bila keduanya didukung.

## 1. Konvensi Umum API

> **Baseline contract, not a verified live endpoint catalogue.** Tabel endpoint dan hak akses di bawah masih harus dicocokkan route-by-route dengan server.ts, middleware, domain services, API client, dan integration tests. Dynamic RBAC permission/scope mengungguli label role statis pada tabel. Jangan gunakan daftar ini sebagai bukti bahwa endpoint aktif atau authorization-nya telah diuji.

### 1.1 Header Permintaan & Autentikasi
**Kondisi source yang diperiksa pada `main` 25 November 2026:**
- **Browser SPA:** `src/services/gabahApi.ts` memakai `credentials: 'same-origin'`. Login menerbitkan cookie `gabah_session` dengan atribut HttpOnly, SameSite=Strict, Path=/, Secure pada production, dan masa berlaku 7 hari. Token tidak dikembalikan dalam JSON atau disimpan di localStorage/sessionStorage.
- **Klien API non-browser:** middleware juga menerima `Authorization: Bearer <session_token>`. Header `x-auth-token` masih diterima oleh resolver sebagai jalur kompatibilitas; jangan gunakan untuk integrasi baru tanpa keputusan keamanan.
- **CSRF:** mutasi yang memakai cookie sesi wajib memiliki Origin yang sama dengan origin request; SameSite=Strict menjadi pertahanan tambahan.
- **Session storage:** registry sesi aktif hanya berada di memori proses. Tabel legacy `user_sessions` yang dibuat migration 002 tidak dipakai runtime; sesi tidak dipersist ke PostgreSQL atau JSON snapshot.
- **Authorization:** identitas hanya berasal dari sesi valid. Header `x-user-id` tidak dapat memalsukan identitas. Setiap route tetap harus memeriksa permission dan data scope Dynamic RBAC di backend.
```http
# Browser: cookie dikirim otomatis oleh fetch credentials: 'same-origin'
Cookie: gabah_session=<opaque session token>  # HttpOnly is a Set-Cookie attribute, not a request-cookie attribute

# API client non-browser:
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
| `/api/auth/login` | `POST` | Publik | Semua | Otentikasi email/alias & password; mengatur cookie HttpOnly dan mengembalikan user profile serta masa berlaku sesi |
| `/api/auth/logout` | `POST` | Sesi terautentikasi | Semua (termasuk Auditor) | Menghapus sesi aktif dari registry memori dan membersihkan cookie; bukan operasi pada tabel `user_sessions` |
| `/api/auth/me` | `GET` | Sesi terautentikasi | Semua | Mengembalikan data profil akun aktif berdasarkan sesi cookie atau Bearer yang valid |
| `/api/auth/switch-role` | `POST` | Sesi terautentikasi | Superadmin saja | Alih identitas yang diotorisasi; sesi lama dirotasi dan aksi diaudit. Tidak boleh public atau menjadi bypass Auditor |

---

### 2.3 Manajemen Pengguna (User Management)
| Endpoint | Method | Autentikasi | Hak Akses | Deskripsi |
|:---|:---:|:---:|:---:|:---|
| `/api/users` | `GET` | Sesi terautentikasi | Semua | Mengambil seluruh daftar pengguna aktif (password hash disanitasi) |
| `/api/users` | `POST` | Sesi terautentikasi | `Admin GABAH` | Mendaftarkan pengguna baru dengan initial password |
| `/api/users/:id` | `PATCH` | Sesi terautentikasi | `Admin GABAH` | Memperbarui profil, peran, divisi, atau status aktif pengguna |
| `/api/users/:id` | `DELETE`| Sesi terautentikasi | `Admin GABAH` | Menghapus atau menonaktifkan akun pengguna |

---

### 2.4 Master Data: Taksonomi & Kategori Aset
| Endpoint | Method | Autentikasi | Hak Akses | Deskripsi |
|:---|:---:|:---:|:---:|:---|
| `/api/taxonomy/categories` | `GET` | Sesi terautentikasi | Semua | Mengambil daftar seluruh kategori aset kanonikal BUMD |
| `/api/taxonomy/categories` | `POST` | Sesi terautentikasi | `Admin GABAH` | Menambahkan kategori aset baru ke master taksonomi |
| `/api/taxonomy/categories/:code` | `PATCH` | Sesi terautentikasi | `Admin GABAH` | Memperbarui informasi nama atau parameter kategori aset |
| `/api/taxonomy/categories/:code` | `DELETE`| Sesi terautentikasi | `Admin GABAH` | Menghapus kategori aset (terproteksi: tidak boleh jika ada aset aktif) |
| `/api/taxonomy/resolve` | `POST` | Sesi terautentikasi | Semua | Menentukan taksonomi kanonikal dan owner division dari string nama |

---

### 2.5 Master Data: Fasilitas Gudang & Lokasi Fisik
| Endpoint | Method | Autentikasi | Hak Akses | Deskripsi |
|:---|:---:|:---:|:---:|:---|
| `/api/master/locations` | `GET` | Sesi terautentikasi | Semua | Mengambil daftar fasilitas gudang dan lokasi operasional |
| `/api/master/locations` | `POST` | Sesi terautentikasi | `Admin GABAH` | Menambahkan lokasi fasilitas baru |
| `/api/master/locations/:id` | `PATCH` | Sesi terautentikasi | `Admin GABAH` | Memperbarui nama, alamat, atau kapasitas lokasi |
| `/api/master/locations/:id` | `DELETE`| Sesi terautentikasi | `Admin GABAH` | Menghapus lokasi operasional |

---

### 2.6 Master Data: Organisasi (Divisi & Departemen)
| Endpoint | Method | Autentikasi | Hak Akses | Deskripsi |
|:---|:---:|:---:|:---:|:---|
| `/api/master/divisions` | `GET` | Sesi terautentikasi | Semua | Mengambil struktur divisi dan departemen operasional |
| `/api/master/divisions` | `POST` | Sesi terautentikasi | `Admin GABAH` | Menambahkan divisi korporat baru |
| `/api/master/divisions/:code` | `PATCH` | Sesi terautentikasi | `Admin GABAH` | Memperbarui nama pimpinan, nama divisi, atau susunan departemen |
| `/api/master/divisions/:code` | `DELETE`| Sesi terautentikasi | `Admin GABAH` | Menghapus divisi (terproteksi jika masih menaungi aset terdaftar) |

---

### 2.7 Manajemen Aset Tetap (Assets)
| Endpoint | Method | Autentikasi | Hak Akses | Deskripsi |
|:---|:---:|:---:|:---:|:---|
| `/api/assets` | `GET` | Sesi terautentikasi | Terfilter Scope | Mengambil katalog aset sesuai batasan divisi aktor (`getScopedAssets`) |
| `/api/assets` | `POST` | Sesi terautentikasi | Divisi Pemilik / Admin | Mendaftarkan aset baru. Nomor kanonikal di-generate otomatis oleh server |
| `/api/assets/:id` | `GET` | Sesi terautentikasi | Terfilter Scope | Mengambil detail lengkap aset |
| `/api/assets/:id` | `PATCH` | Sesi terautentikasi | Divisi Pemilik / Admin | Memperbarui informasi aset (termasuk nomor Accurate ERP) |
| `/api/assets/:id/assign` | `POST` | Sesi terautentikasi | Divisi Pemilik / Admin | Menugaskan unit aset ke karyawan atau unassign kembali ke gudang |
| `/api/assets/:id/move` | `POST` | Sesi terautentikasi | Divisi Pemilik / Admin | Merelokasi fisik aset ke lokasi baru dan mencatat pergerakan |
| `/api/assets/:id/lifecycle` | `POST` | Sesi terautentikasi | Divisi Pemilik / Admin | Mutasi siklus hidup (repair, damaged, cannibalize, disposal, auction) |
| `/api/movements` | `GET` | Sesi terautentikasi | Semua | Mengambil riwayat mutasi perpindahan seluruh aset |

---

### 2.8 Sirkulasi Peminjaman Aset (Loans)
| Endpoint | Method | Autentikasi | Hak Akses | Deskripsi |
|:---|:---:|:---:|:---:|:---|
| `/api/loans` | `GET` | Sesi terautentikasi | Semua | Mengambil daftar riwayat permohonan peminjaman aset |
| `/api/loans` | `POST` | Sesi terautentikasi | Semua Karyawan | Mengajukan pinjaman baru (divalidasi anti-bentrok jadwal di server) |
| `/api/loans/:id/approve` | `POST` | Sesi terautentikasi | Divisi Pemilik / Admin | Menyetujui pinjaman (aset berubah status menjadi `reserved`) |
| `/api/loans/:id/handover` | `POST` | Sesi terautentikasi | Divisi Pemilik / Admin | Serah terima fisik barang (aset berubah status menjadi `assigned`) |
| `/api/loans/:id/return` | `POST` | Sesi terautentikasi | Divisi Pemilik / Admin | Pengembalian barang dan inspeksi kondisi fisik unit |

---

### 2.9b Contract Management API (Domain Tersendiri)
- `GET /api/contracts` — daftar kontrak ter-scope (divisi pemilik/PIC; Admin & Auditor seluruh; `restricted` difilter)
- `GET /api/contracts/:id`, `POST /api/contracts`, `PATCH /api/contracts/:id`
- `POST /api/contracts/:id/documents` (append-only), `POST /api/contracts/:id/milestones`
- `POST /api/contracts/:id/renewal-decision` — body `{ outcome, notes, replacement_contract_id }`
- `POST /api/contracts/reminders/run` — evaluasi threshold 60/35/7 + NOTICE_DATE (idempoten per hari; Admin only; scheduler internal juga memanggil engine yang sama)
- `GET /api/contracts/reminders/scheduler-status` — status scheduler internal (enabled/running/interval/timezone/lastRun; Admin only)
- `GET /api/contracts/:id/notification-logs` — log pengiriman per channel (in_app/email/telegram) dengan status JUJUR `sent`/`failed`/`skipped` (+ alasan); tanpa konfigurasi provider → `skipped`, bukan sukses palsu
- `POST /api/tickets` menerima `contract_id` opsional — hanya di-honor bila aktor boleh melihat kontrak (`canSeeContract`); input klien tidak dapat mem probing kontrak restricted. Ticket = pekerjaan atas Contract; Contract bukan kategori tiket
- Kategori tiket baru: `IT` | `GA` | `ME` (license/software → IT; ME → unit `UNIT-PIBC-ME`). SC/PIBC hanya untuk histori tiket lama, bukan kategori baru.

### 2.9 Tiket Helpdesk & Gangguan (Tickets)
| Endpoint | Method | Autentikasi | Hak Akses | Deskripsi |
|:---|:---:|:---:|:---:|:---|
| `/api/tickets` | `GET` | Sesi terautentikasi | Semua | Mengambil daftar tiket (karyawan melihat tiketnya, agen melihat antreannya) |
| `/api/tickets` | `POST` | Sesi terautentikasi | Semua Karyawan | Membuat tiket kendala operasional (SLA deadline dihitung otomatis) |
| `/api/tickets/:id/status`| `PATCH` | Sesi terautentikasi | Agen Terkait / Admin | Memperbarui status tiket (`in_progress`, `resolved`, `closed`) dan solusi |

---

### 2.10 Pemeliharaan Berkala & Servis (Maintenance)
| Endpoint | Method | Autentikasi | Hak Akses | Deskripsi |
|:---|:---:|:---:|:---:|:---|
| `/api/maintenances` | `GET` | Sesi terautentikasi | Semua | Mengambil jadwal servis berkala & kalibrasi tera PIBC |
| `/api/maintenances` | `POST` | Sesi terautentikasi | Divisi Terkait / Admin | Mendaftarkan jadwal servis baru dengan checklist teknis |
| `/api/maintenances/:id` | `PATCH` | Sesi terautentikasi | Divisi Terkait / Admin | Menyelesaikan jadwal servis, memperbarui biaya riil, dan catatan teknis |

---

### 2.11 Notifikasi Sistem (Notifications)
| Endpoint | Method | Autentikasi | Hak Akses | Deskripsi |
|:---|:---:|:---:|:---:|:---|
| `/api/notifications` | `GET` | Sesi terautentikasi | Terfilter Scope | Mengambil notifikasi yang dialokasikan untuk user/peran aktif |
| `/api/notifications/:id/read` | `PATCH` | Sesi terautentikasi + `notifications.read` | Penerima notifikasi | Menandai satu notifikasi milik penerima; ID milik orang lain menghasilkan 404 |
| `/api/notifications/read-all` | `POST` | Sesi terautentikasi + `notifications.read_all` | Scope penerima | Menandai seluruh notifikasi relevan yang ditujukan kepada aktor |

---

### 2.12 Dashboard & Attention Center
| Endpoint | Method | Autentikasi | Hak Akses | Deskripsi |
|:---|:---:|:---:|:---:|:---|
| `/api/dashboard/stats` | `GET` | Sesi terautentikasi | Semua | Mengambil statistik agregat aset, nilai buku, tiket terbuka, dan pinjaman |
| `/api/dashboard/attention`| `GET` | Sesi terautentikasi | Terfilter Scope | Mengambil item darurat / action required sesuai batasan peran |

---

### 2.13 Rekonsiliasi Accurate ERP & Audit Logs
| Endpoint | Method | Autentikasi | Hak Akses | Deskripsi |
|:---|:---:|:---:|:---:|:---|
| `/api/reconciliation` | `GET` | Sesi terautentikasi | `Admin GABAH` & `Auditor` | Mengambil data pemetaan nomor aset GABAH vs Accurate ERP |
| `/api/reconciliation/link` | `POST` | Sesi terautentikasi | `Admin GABAH` | Menautkan nomor aset Accurate (`corporate_asset_number`) ke aset GABAH |
| `/api/audit-logs` | `GET` | Sesi terautentikasi | `Admin GABAH` & `Auditor` | Mengambil seluruh log audit mutasi sistem |

---

### 2.14 Ruang Rapat & Reservasi VIP (Meeting Rooms)
| Endpoint | Method | Autentikasi | Hak Akses | Deskripsi |
|:---|:---:|:---:|:---:|:---|
| `/api/meeting-rooms` | `GET` | Sesi terautentikasi | Semua | Mengambil daftar seluruh ruang rapat representatif |
| `/api/meeting-rooms/:id` | `PATCH` | Sesi terautentikasi | `Admin GABAH` & `GA` | Memperbarui fasilitas atau kapasitas ruang rapat |
| `/api/room-reservations` | `GET` | Sesi terautentikasi | Semua | Mengambil jadwal reservasi ruang rapat |
| `/api/room-reservations` | `POST` | Sesi terautentikasi | Semua | Membuat reservasi ruang (VIP auto-approval untuk Sekdir, notifikasi IT/GA/Pantry/Humas) |
| `/api/room-reservations/:id/approve` | `POST` | Sesi terautentikasi | `Admin GABAH` & `GA` | Menyetujui permohonan reservasi ruang rapat |
| `/api/room-reservations/:id/reject` | `POST` | Sesi terautentikasi | `Admin GABAH` & `GA` | Menolak reservasi dengan alasan tertulis |
| `/api/room-reservations/:id/checkin` | `POST` | Sesi terautentikasi | Pemohon / GA / Admin | Check-in penggunaan ruangan rapat |
| `/api/room-reservations/:id/checkout`| `POST` | Sesi terautentikasi | Pemohon / GA / Admin | Check-out dan melepaskan ruangan kembali tersedia |
| `/api/room-reservations/:id/cancel` | `POST` | Sesi terautentikasi | Pemohon / GA / Admin | Membatalkan reservasi ruang |

---

### 2.15 Master Tipe Rapat & Fasilitas (Meeting Master Settings)
| Endpoint | Method | Autentikasi | Hak Akses | Deskripsi |
|:---|:---:|:---:|:---:|:---|
| `/api/meeting-types` | `GET` | Sesi terautentikasi | Semua | Mengambil master tipe agenda rapat |
| `/api/meeting-types` | `POST` | Sesi terautentikasi | `Admin GABAH` & `GA` | Menambah tipe rapat baru |
| `/api/meeting-types/:id` | `PATCH` | Sesi terautentikasi | `Admin GABAH` & `GA` | Memperbarui tipe rapat |
| `/api/meeting-types/:id` | `DELETE`| Sesi terautentikasi | `Admin GABAH` & `GA` | Menghapus tipe rapat |
| `/api/meeting-facilities` | `GET` | Sesi terautentikasi | Semua | Mengambil katalog master fasilitas ruangan (GA & IT) |
| `/api/meeting-facilities` | `POST` | Sesi terautentikasi | `Admin GABAH` & `GA` | Menambah fasilitas baru ke katalog |
| `/api/meeting-facilities/:id` | `PATCH`| Sesi terautentikasi | `Admin GABAH` & `GA` | Memperbarui fasilitas |
| `/api/meeting-facilities/:id` | `DELETE`| Sesi terautentikasi | `Admin GABAH` & `GA` | Menghapus fasilitas |


## 3. Source route inventory supplement — main snapshot 23 November 2026

> Static extraction from route registrations in `server.ts` at main SHA `f39db6b8fd819d301f49815c7a33a04c80b2a6c0`. The existing endpoint tables above covered only a subset of registered routes. The following routes were present in source but absent from those tables at that SHA. This is a path inventory only: it does **not** prove route reachability, authorization correctness, request/response schema, or UAT. Verify middleware and handler behavior before relying on any route.

Additional source routes found (64):

- `DELETE /api/admin/rbac/roles/:id`
- `DELETE /api/numbering/rules/:id`
- `GET /api/admin/notification-rules`
- `GET /api/admin/rbac/permissions`
- `GET /api/admin/rbac/roles`
- `GET /api/admin/rbac/user-assignments`
- `GET /api/admin/system-settings`
- `GET /api/assets/create-options`
- `GET /api/contracts`
- `GET /api/contracts/:id`
- `GET /api/contracts/:id/documents/:documentId/download`
- `GET /api/contracts/:id/notification-logs`
- `GET /api/contracts/reminders/overview`
- `GET /api/contracts/reminders/scheduler-status`
- `GET /api/knowledge`
- `GET /api/master/asset-locations`
- `GET /api/master/job-levels`
- `GET /api/master/office-locations`
- `GET /api/master/org-units`
- `GET /api/modules`
- `GET /api/modules/:moduleKey/audit`
- `GET /api/numbering/rules`
- `GET /api/numbering/sequences`
- `GET /api/tickets/:id/assignees`
- `GET /api/tickets/:id/comments`
- `GET /api/vendors`
- `PATCH /api/admin/notification-rules/:ruleId`
- `PATCH /api/admin/rbac/roles/:id`
- `PATCH /api/admin/system-settings`
- `PATCH /api/contracts/:id`
- `PATCH /api/knowledge/:id`
- `PATCH /api/master/asset-locations/:id`
- `PATCH /api/master/job-levels/:code`
- `PATCH /api/master/office-locations/:id`
- `PATCH /api/master/org-units/:id`
- `PATCH /api/modules/:moduleKey`
- `PATCH /api/numbering/rules/:id`
- `PATCH /api/tickets/:id/assignment`
- `PATCH /api/vendors/:id`
- `POST /api/admin/rbac/roles`
- `POST /api/assets/bulk-import`
- `POST /api/auth/change-password`
- `POST /api/contracts`
- `POST /api/contracts/:id/documents`
- `POST /api/contracts/:id/documents/upload`
- `POST /api/contracts/:id/milestones`
- `POST /api/contracts/:id/renewal-decision`
- `POST /api/contracts/reminders/run`
- `POST /api/knowledge`
- `POST /api/knowledge/:id/view`
- `POST /api/knowledge/:id/vote`
- `POST /api/loans/:id/reject`
- `POST /api/master/asset-locations`
- `POST /api/master/job-levels`
- `POST /api/master/office-locations`
- `POST /api/master/org-units`
- `POST /api/numbering/rules`
- `POST /api/tickets/:id/comments`
- `POST /api/users/:id/reset-password`
- `POST /api/users/bulk-import`
- `POST /api/vendors`
- `PUT /api/admin/rbac/roles/:id/permissions`
- `PUT /api/admin/rbac/roles/:id/scopes`
- `PUT /api/admin/rbac/users/:id/roles`

The source inventory is a dated snapshot. Re-run extraction after route changes and update this document together with API tests and UAT.