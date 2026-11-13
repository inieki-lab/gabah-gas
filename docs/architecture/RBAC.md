# GABAH — Role-Based Access Control (RBAC) Specification

**Dokumen:** `docs/architecture/RBAC.md`  
**Sistem:** GABAH (*General Asset, Business & Automated Helpdesk*)  
**Organisasi:** PT Food Station Tjipinang Jaya (Perseroda)  
**Status:** Spesifikasi target Dynamic RBAC; implementasi masih dalam audit dan UAT. Matriks role lama di bawah bukan sumber otorisasi aktif.  
**Terakhir Diperbarui:** 11 November 2026  

---

## 1. Model Otorisasi Target (Dynamic RBAC)

GABAH tidak menggunakan sembilan label role lama sebagai daftar role permanen. Role aplikasi adalah paket permission dan scope yang dapat dikelola Super Admin. Posisi/jabatan, unit organisasi, lokasi kerja, owner aset, lokasi fisik aset, dan custodian merupakan dimensi terpisah.

### 1.1 Entitas otorisasi

| Entitas | Fungsi | Tidak boleh disamakan dengan |
|---|---|---|
| User / employee | Identitas akun dan status aktif | Role, jabatan, lokasi |
| Primary application role | Fungsi utama pengguna | Jabatan atau unit |
| Additional application roles | Kapabilitas tambahan lintas fungsi | Pengganti identitas pegawai |
| Permission | Aksi pada modul (read/create/update/delete/approve/assign/administer) | Scope data |
| Data scope | Record yang dapat dijangkau per modul | Permission |
| Job level | Direksi/Kadiv/Kadep/Kasi/Staf dan level lain | Grant permission otomatis |
| Organizational unit | Fungsi/unit organisasi | Lokasi kantor |
| Office location | Penempatan kerja pegawai | Owner aset |
| Owner domain | Fungsi yang bertanggung jawab atas aset/vendor/kontrak sesuai modul | Lokasi fisik |
| Asset location | Tempat fisik aset | Owner atau lokasi kerja pegawai |
| Custodian/PIC | Pengguna yang memegang/bertanggung jawab atas record | Owner domain |

### 1.2 Prinsip enforcement

1. PostgreSQL Dynamic RBAC menjadi sumber permission dan scope ketika persistence PostgreSQL aktif.
2. Permission dan scope harus diperiksa pada backend untuk list, detail-by-ID, create, update, delete, approval, export, pencarian, dashboard, dan agregasi.
3. Frontend hanya menyajikan menu dan aksi sesuai permission efektif; menyembunyikan menu bukan kontrol keamanan.
4. Beberapa role dinamis dapat diberikan ke satu user. Role tambahan bersifat additive sesuai permission/scope yang ditetapkan, dan tidak boleh hilang akibat siklus persistensi normal.
5. Satu primary role tetap selaras dengan profil user selama masa transisi. Backfill kompatibilitas tidak boleh menghapus role tambahan yang sah.
6. Role tidak aktif, user nonaktif, scope tidak dikenal, dan role dinamis tanpa scope harus gagal tertutup (deny-by-default).
7. Jabatan dan lokasi kerja tidak memberikan permission secara implisit.
8. Auditor hanya memiliki akses baca yang diberikan secara eksplisit; operasi mutasi harus ditolak di backend.
9. Super Admin mengelola role template, permission, scope, master owner domain, master lokasi, dan assignment user. Assignment harus transaksional, tervalidasi, diaudit, dan melindungi Super Admin aktif terakhir.

### 1.3 Model lokasi dan owner

Lokasi kantor aktif saat ini: HO (OFF-KP), PIBC (OFF-PIBC), RPC (OFF-RPC), Pangsub (OFF-PANGSUB), dan Kantor Perawatan (OFF-PERAWATAN). Subang tidak aktif; data historis dipertahankan. Lokasi baru dapat ditambahkan melalui master tanpa perubahan kode.

Owner domain adalah master fleksibel (misalnya IT, GA, owner operasional legacy berkode SC, dan domain lain yang disahkan), bukan enum tetap. IT mengelola owner IT lintas lokasi; GA mengelola owner GA lintas lokasi. Super Admin dapat mengatur pola luas seperti GA = semua owner kecuali IT, tetapi konfigurasi tersebut tidak aktif otomatis. GA dapat diberi permission assets.read.it_workstations untuk melihat Laptop/PC milik IT secara read-only. Owner dan scope tidak ditentukan oleh lokasi kantor atau lokasi fisik.

### 1.4 Legacy role labels

Admin GABAH, IT, GA, Sekretaris Direksi, Humas, Karyawan, dan Auditor tetap menjadi profil/role primer transisi. RPC dan PIBC adalah lokasi kerja; akun lama berlabel Supply Chain/PIBC adalah data transisi, bukan role aplikasi permanen. Akun historis tidak boleh diubah massal berdasarkan lokasi saja. Mapping harus berdasarkan data HR, unit kerja, jabatan, dan persetujuan administrator.

Contract Management tetap domain tersendiri; scope kontrak menggunakan owner domain dan PIC. Vendor category tidak boleh dipakai sebagai pengganti owner domain.

---

## 2. Matriks Kebijakan Awal (Bukan Allowlist Role Permanen)

| Fungsi | Kebijakan dasar | Catatan enforcement |
|---|---|---|
| Super Admin | Global administration sesuai permission | Satu-satunya role dengan hak administrasi global; lindungi Super Admin aktif terakhir |
| IT | Owner IT lintas lokasi | Aksi per modul tetap memerlukan permission dan scope |
| GA | Owner GA lintas lokasi | IT workstation hanya read-only melalui permission khusus |
| Karyawan | Fungsi dasar pribadi: aset ditugaskan, permintaan pinjaman, tiket sendiri, reservasi | Role tambahan dapat memberi kapabilitas kerja yang disahkan |
| Sekretaris Direksi | Fungsi dasar karyawan + agenda/permintaan dukungan Direksi | Prioritas/override harus permission khusus dan audit |
| Humas | Fungsi dasar karyawan + antrean pekerjaan dokumentasi yang ditugaskan | Detail agenda disamarkan untuk pihak tanpa kewenangan |
| Auditor | Read-only sesuai grant audit | Tidak boleh create/update/delete/approve |
| RPC dan owner operasional lain | Kapabilitas sesuai owner domain dan scope yang diberikan | Nama unit/lokasi tidak otomatis menjadi role atau scope |

Matriks di atas adalah baseline kebijakan. Permission dan scope aktual harus dibaca dari database RBAC, bukan dari nama role atau tabel statis di frontend.

---

## 3. Titik Penegakan RBAC di Kode Sumber

Sumber implementasi yang harus ditinjau bersama sebelum perubahan RBAC:

- `server.ts`: route API, middleware autentikasi, `requireRbacPermission`, administrasi role, permission, scope, dan assignment user.
- `server/rbac-policy.ts`: policy loader, kombinasi role, permission, scope, serta default-deny.
- `server/services.ts`: domain authorization untuk aset, peminjaman, tiket, maintenance, reservasi, dan domain terkait.
- `server/runtime-hardening.ts`: pengamanan runtime dan pembatasan akses record.
- `server/persistence.ts`: migrasi, bootstrap role, sinkronisasi profil primer, dan persistensi PostgreSQL.
- `src/navigation/roleNavigation.ts`, `src/components/Sidebar.tsx`, dan `src/App.tsx`: navigasi/route frontend. Kode frontend bukan otoritas keamanan.
- `src/components/modals/AdministrationModal.tsx` dan `src/services/gabahApi.ts`: UI dan API client administrasi Dynamic RBAC.
- `server/migrations/*.sql`: katalog permission, grant role, scope, dan koreksi historis.

Setiap perubahan harus memeriksa route, domain service, policy, persistence/migration, API client, UI, dan test yang terdampak. Jangan mengandalkan nomor baris dokumentasi karena kode terus berubah.

## 4. Akun Kanonikal (Kredensial Tidak Dipublikasikan)

> **SECURITY (CR-02):** Tidak ada password default yang ditulis di dokumentasi.
> Kredensial awal diprovision dari environment secrets saat boot:
> `GABAH_INITIAL_ADMIN_PASSWORD` (akun Admin GABAH) dan
> `GABAH_INITIAL_USER_PASSWORD` (akun non-admin), atau di-generate acak CSPRNG
> per akun pada mode development (disimpan sekali di file yang di-gitignore).
> Placeholder dalam tabel di bawah hanyalah penanda, bukan nilai nyata.

| Peran | Nama Pegawai | Email Kanonikal | Password | Divisi & Jabatan |
|:---|:---|:---|:---|:---|
| **Admin GABAH** | Budi Santoso | `admin@foodstation.co.id` | `<INITIAL_ADMIN_PASSWORD>` | IT / Super Administrator |
| **IT** | Dani Setiawan | `it.support@foodstation.co.id` | `<INITIAL_USER_PASSWORD>` | IT / IT Technical Support |
| **GA** | Siti Rahmawati | `ga@foodstation.co.id` | `<INITIAL_USER_PASSWORD>` | GA / General Affairs & Sarpras |
| **Karyawan + capability Sekretaris Direksi** | Dewi Anggraini, S.Sos | `sekretariat.direksi@foodstation.co.id` | `<INITIAL_USER_PASSWORD>` | GA / Staf Sekretariat Direksi |
| **Karyawan + capability Humas** | Rina Kartika, M.I.Kom | `humas@foodstation.co.id` | `<INITIAL_USER_PASSWORD>` | GA / Staf Humas & Protokoler |
| **Karyawan** | Agus Pratama | `sc.warehouse@foodstation.co.id` | `<INITIAL_USER_PASSWORD>` | Unit operasional legacy / lokasi RPC |
| **Karyawan** | Bambang Hermawan | `pibc.admin@foodstation.co.id` | `<INITIAL_USER_PASSWORD>` | Unit PIBC / lokasi PIBC |
| **Karyawan** | Hendra Wijaya | `hendra.w@foodstation.co.id` | `<INITIAL_USER_PASSWORD>` | Komersial / Staf Komersial |
| **Auditor** | Maya Indriani, SE, Ak, CA | `auditor@foodstation.co.id` | `<INITIAL_USER_PASSWORD>` | Audit / Auditor Internal (SPI) |

---

## 5. Otorisasi Dinamis — Progres Enforcement Permission

> Enforcement dinamis memakai `requireRbacPermission` di `server.ts` dengan gate
> hanya aktif saat PostgreSQL aktif; development file-store tetap memakai
> perilaku legacy. Superadmin selalu lolos melalui mekanisme policy
> `is_superadmin` (bukan nama tampilan role).

### 5.1 Enforcement yang sudah aktif

| Permission | Endpoint | Migration grant | Status |
|:---|:---|:---|:---|
| `dashboard.read` | `GET /api/dashboard/stats` + `/api/dashboard/attention` | `013` (legacy compatibility seed; review before production mapping) | aktif di PostgreSQL |
| `assets.read` | `GET /api/assets` + `GET /api/assets/:id` | `014` (legacy compatibility seed; review before production mapping) | aktif di PostgreSQL |
| `assets.create` | `POST /api/assets` | `016` (superadmin/it/ga/supply_chain/pibc) | aktif |
| `assets.update` | `PATCH /api/assets/:id` | `016` | aktif |
| `assets.bulk_import` | `POST /api/assets/bulk-import` | `016` | aktif |
| `assets.assign` | `POST /api/assets/:id/assign` | `016` | aktif |
| `assets.move` | `POST /api/assets/:id/move` | `016` | aktif |
| `assets.lifecycle` | `POST /api/assets/:id/lifecycle` | `016` | aktif |
| `movements.read` | `GET /api/movements` | `017` (legacy compatibility seed; review before production mapping) | aktif di PostgreSQL |

### 5.2 Lapisan di atas permission (tetap berlaku, tidak digantikan)

1. **Owner-domain authority di domain service** (`server/services.ts`):
   `createAsset`, `assignAsset`, `moveAsset`, dan `mutateLifecycle` memakai
   permission serta scope owner dinamis (termasuk pengecualian owner). Owner
   tidak dibatasi enum IT/GA/SC/PIBC; scope eksplisit menentukan kewenangan.
   `approve_disposal` tetap memerlukan kapabilitas Super Admin yang sesuai.
2. **Jalur UPDATE bulk-import** kini meniru authority divisi `PATCH /api/assets/:id`
   (perbaikan SEC-10) — impor massal tidak lagi melewati pembatasan
   intradivisional saat memperbarui aset yang sudah ada.
3. **Validasi duplikat** serial number & nomor aset Accurate/ERP tetap
   server-authoritative di semua jalur tulis (create, patch, bulk import).
4. **Allowlist field** operator pada PATCH dan bulk import tetap berlaku;
   `owner_division` dan `asset_number` tetap server-owned.
5. **Validasi master** managing unit (`org_units`) dan lokasi fisik asset
   (`asset_locations`) pada PATCH tetap berjalan.
6. **Read-only Auditor** ditentukan dari role efektif yang terpasang pada user,
   termasuk role tambahan, dan ditegakkan middleware sebelum handler API.
   Role Auditor mengalahkan grant tulis dari role lain; Super Admin tetap
   merupakan kapabilitas administrasi terpisah.

### 5.3 Role kustom & scope

- Permission role kustom **tidak pernah otomatis**; hanya admin Superadmin yang
  dapat memberikan grant melalui API `/api/admin/rbac/roles/:id/permissions`.
- Assignment role ke user dikelola Superadmin via
  `PUT /api/admin/rbac/users/:id/roles` (set penuh `role_ids`, atomik,
  role-nonaktif/tak-dikenal ditolak, Superadmin aktif terakhir terlindungi,
  audit `RBAC_USER_ROLES_UPDATED`, policy cache di-refresh setelah tersimpan).
  Compatibility bridge: `users.role` identifies the primary profile role.
  The recurring persistence reconciliation may repair that primary assignment,
  but it must preserve explicitly assigned additional roles. The full assignment
  set is managed transactionally through the Super Admin API/UI and is audited.
- Scope per role (`gabah_role_division_scopes`) is module-scoped and enforced
  when PostgreSQL is active. Supported asset scope types include `all`,
  `own`, `division`, `division_except`, `unit`, and `location`.
  A `division_except` scope can express a broad owner grant with an explicit
  exclusion (for example, all owner domains except IT); an explicit owner grant
  is handled according to the policy resolver. Role without assignment/scope
  fails closed. File-store development fallback is compatibility-only and is
  not evidence of production PostgreSQL authorization.
- Role Karyawan, Auditor, Humas, dan Sekretaris Direksi sengaja tidak menerima
  grant tulis di migration `016`, mengikuti guard legacy yang menolak mereka.



## Helpdesk service queues and dispatch (keputusan 10 November 2026)

### Hak pemohon tiket (keputusan 11 November 2026)

- **IT:** kanal helpdesk umum perusahaan. Semua user aktif non-Auditor yang terautentikasi dapat mengajukan tiket IT tanpa assignment permission khusus. Auditor tetap read-only dan ditolak di backend, termasuk bila memiliki role tambahan lain.
- **GA:** pengajuan tiket memerlukan permission `tickets.create.ga`, yang diberikan melalui role tambahan `Pemohon Tiket GA`. Role template dibuat oleh migration `041` dan tidak ditetapkan otomatis ke user.
- **ME:** pengajuan tiket memerlukan permission `tickets.create.me`, yang diberikan melalui role tambahan `Pemohon Tiket ME`. Role template dibuat oleh migration `041` dan tidak ditetapkan otomatis ke user.
- Superadmin menetapkan atau mencabut role Pemohon GA/ME per user melalui Administration → User Management → Assignment Role. Role tersebut bersifat tambahan; primary role dan jabatan organisasi tidak perlu diubah.
- Hak pemohon (`tickets.create.*`) tidak memberikan hak membaca antrean tim, mengubah status, atau mendelegasikan tiket. Hak operator tetap terpisah melalui `tickets.read`, `tickets.update`, `tickets.assign` dan scope antrean yang sesuai.
- Pencabutan role hanya memengaruhi pengajuan tiket berikutnya; tiket historis tidak dihapus. Semua assignment role mengikuti audit log Dynamic RBAC.

- Kategori/tujuan tiket adalah **IT, GA, dan ME**. Kategori tidak diturunkan dari lokasi kantor.
- **IT:** tiket diarahkan langsung kepada satu petugas IT aktif apabila hanya ada satu user dengan permission `tickets.update` dan scope Tickets untuk divisi IT. Bila tidak ada atau kandidat lebih dari satu, tiket tetap berada di antrean IT; sistem tidak memilih petugas secara acak.
- **GA:** Kasi GA dan Admin/Staf GA tetap dapat menjalankan pekerjaan umum GA—misalnya input/perubahan aset, laporan, vendor, kontrak, dan fasilitas—sesuai permission serta scope GA yang diberikan. Hak umum tersebut tidak otomatis menjadikan keduanya petugas antrean tiket. Tiket GA merupakan pekerjaan operasional Admin/Staf GA atau pegawai lain yang secara khusus ditunjuk, bukan otomatis pekerjaan Kasi GA. Gunakan template `ga_helpdesk_operator` untuk petugas helpdesk yang ditunjuk; template ini memberi `tickets.update` dan `tickets.assign` dengan scope divisi GA. Role GA umum tidak otomatis mendapat hak update/delegasi tiket. Dengan satu kandidat helpdesk aktif, tiket langsung masuk ke petugas tersebut; jika kandidat tidak ada atau lebih dari satu, tiket tetap di antrean GA. Kasi GA tetap dapat diberi hak helpdesk/delegasi jika memang ditugaskan, tanpa kehilangan hak umum GA. Messenger tidak otomatis menjadi petugas teknis. Jika staf teknis ditambahkan, petugas GA yang ditunjuk dapat mendelegasikan kepada petugas yang memiliki `tickets.update` dan scope GA.
- **ME:** ME adalah unit Tim Perawatan (Mechanical & Electrical) di bawah PIBC, direpresentasikan oleh `UNIT-PIBC-ME`. Tiket ME disimpan dengan `assigned_unit_id=UNIT-PIBC-ME`; dispatcher dengan permission `tickets.assign` dan scope unit tersebut dapat mendelegasikan kepada petugas aktif yang menjadi anggota unit dan memiliki permission `tickets.update`.
- Lokasi RPC/PIBC tidak otomatis memberi akses antrean ME. Unit ME juga bukan lokasi kantor atau role aplikasi.
- Endpoint penugasan memvalidasi permission dispatcher, scope tiket, status aktif target, permission target, serta kecocokan unit/divisi. Daftar petugas yang ditampilkan ke dispatcher hanya berisi target yang lolos validasi tersebut.

### Role, jabatan, dan assignment pegawai

- Role aplikasi adalah **paket permission dan scope**, bukan nama jabatan. Super Admin dapat membuat role kustom, memilih permission, mengatur scope, dan menetapkan satu atau lebih role kepada pegawai mana pun.
- Jabatan/posisi (mis. Admin IT, Staf IT Support, Admin GA, Admin ME, Teknisi ME) tetap menjadi atribut organisasi/pekerjaan; jabatan tidak otomatis memberikan permission.
- `tickets.assign` adalah permission terpisah dari `tickets.update`. Dispatcher dapat mendelegasikan, sedangkan teknisi/petugas pelaksana cukup diberi `tickets.update` dan scope yang sesuai. Aksi perubahan status tiket di UI dan API mensyaratkan `tickets.update`; hak delegasi saja tidak memberi hak mengubah status.
- Scope yang dapat dikonfigurasi per modul meliputi `all`, `own`, `division`, `division_except`, `unit`, dan `location`. `division_except` mendukung pembatasan owner luas seperti semua owner kecuali IT; pengecualian harus diuji bersama scope positif agar tidak berubah menjadi akses global tanpa sengaja.
- Migration `037_admin_tiket_me_role_template.sql` dan `038_ticket_dispatch_permission.sql` menyediakan preset Admin Tiket ME. Preset bukan role jabatan permanen dan tidak otomatis ditetapkan kepada akun mana pun.
- Penambahan atau perubahan personel dilakukan melalui assignment role, scope, unit, dan konfigurasi routing; tidak perlu mengubah kode hanya karena nama jabatan atau struktur staf berubah.
