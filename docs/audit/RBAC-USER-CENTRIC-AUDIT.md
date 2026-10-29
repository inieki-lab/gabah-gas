# GABAH-GAS — Audit RBAC Berbasis Pengguna, Menu, dan Hak Akses

**Tanggal audit:** 2026-10-29
**Branch diperiksa:** `work/antigravity-sync`
**Commit diperiksa:** `7b02063` (`docs: record full sandbox verification results for UAT readiness`)
**PR terkait:** [#11](https://github.com/inieki-lab/gabah-gas/pull/11) — OPEN, tidak di-merge pada audit ini
**Sifat dokumen:** audit saja. Tidak ada kode, permission, role, konfigurasi, atau data produksi yang diubah.

---

## 1. Kondisi Repository dan Lingkungan yang Diperiksa

| Item | Kondisi aktual |
|---|---|
| Working tree | Bersih (`git status --porcelain` kosong) |
| Commit HEAD | `7b02063` |
| Stack | Express + Vite/React SPA (tanpa router), penyimpanan ganda: PostgreSQL **atau** file-store `server/data/gabah_state.json` |
| Mode runtime yang tersedia | **File-store** — `freebuff-env list` kosong, `DATABASE_URL` tidak ada, `psql`/`docker`/`pg_isready` tidak terpasang |
| Mode PostgreSQL | **TIDAK DAPAT DIUJI** di sandbox ini |
| Browser automation | **TIDAK TERSEDIA** — Playwright/Puppeteer tidak ada di `node_modules`, tidak ada browser headless |
| Pemeriksaan statis | `npm run lint` (tsc --noEmit) **PASS** exit 0 |
| Build produksi | `npm run build` **PASS** exit 0 → `dist/server.cjs` |

### 1.1 Batasan yang harus dibaca sebelum menilai temuan

1. Seluruh pengujian HTTP dijalankan terhadap server hasil build (`dist/server.cjs`) dengan **state file-store yang di-seed ulang dari nol**, bukan terhadap database PostgreSQL.
2. Di mode file-store, `requireRbacPermission()` selalu mengembalikan `true` (`server.ts:82`). Artinya, pengujian runtime ini **tidak menguji gerbang permission dinamis**; yang teruji adalah gerbang legacy berbasis string role dan middleware session/scope.
3. Karena tidak ada PostgreSQL, tabel `gabah_roles`, `gabah_permissions`, `gabah_role_permissions`, `gabah_user_roles` **tidak dapat dibaca**. Inventaris role dinamis di bawah diambil dari migrasi seed (sumber aktual yang tersedia), bukan dari query DB.
4. Pengujian UI per klik (menu benar-benar dirender untuk tiap role) **tidak dijalankan di browser**. Matriks menu disusun dari definisi navigasi aktual (`src/components/Sidebar.tsx`) dan guard di `src/App.tsx`; kolom API diisi hasil HTTP nyata.
5. Catatan integritas: harness pengujian pertama terhenti dan meninggalkan state file-store hasil seed ulang. Artefak probe (1 tiket uji, 1 nomor aset uji, 1 audit log) sudah dibersihkan. Selisih sisa: 3 aset dan 8 audit log yang sebelumnya hanya ada di state lokal dev tidak dapat dipulihkan. **Tidak ada database PostgreSQL/produksi yang tersentuh.**

---

## 2. Inventaris Role dan Pengguna

### 2.1 Pengguna aktual (state file-store, 10 akun, semua aktif)

| ID | Nama | Role (legacy `users.role`) | Divisi | Departemen |
|---|---|---|---|---|
| USR-01 | Budi Santoso | Admin GABAH | IT | Management Information System & TI |
| USR-02 | Siti Rahmawati | GA | GA | General Affairs & Rumah Tangga |
| USR-03 | Dani Setiawan | IT | IT | Management Information System & TI |
| USR-04 | Hendra Wijaya | Karyawan | SC | Divisi Perdagangan & Komersial |
| USR-05 | Anisa Putri, S.Ak | Karyawan | Umum | Divisi Keuangan & Akuntansi |
| USR-SC | Agus Pratama | Supply Chain | SC | Pergudangan Beras Induk & Distribusi |
| USR-PIBC | Bambang Hermawan | PIBC | PIBC | Pengelolaan Kios & Los Pasar Induk |
| USR-SEKDIR | Dewi Anggraini, S.Sos | Sekretaris Direksi | GA | Sekretariat Direksi & Dewan Komisaris |
| USR-HUMAS | Rina Kartika, M.I.Kom | Humas | GA | Humas & Protokoler Perusahaan |
| USR-AUDITOR | Maya Indriani, SE, Ak, CA | Auditor | Audit | Satuan Pengawas Internal (SPI) |

**Catatan:** dua akun berbagi role Karyawan. Tidak ada akun uji terpisah untuk role kustom (belum ada role kustom).

### 2.2 Katalog role dinamis (dari migrasi `010` + `011`)

Sembilan role canonical: `superadmin`, `it`, `ga`, `supply_chain`, `pibc`, `karyawan`, `auditor`, `sekretaris_direksi`, `humas`. Tidak ada role kustom yang di-seed. Role kustom dapat dibuat lewat API/UI, tetapi belum ada satu pun di data aktual.

### 2.3 Dua sumber identitas role yang hidup berdampingan

| Sumber | Dipakai oleh | Sifat |
|---|---|---|
| `users.role` (string: `'Admin GABAH'`, `'IT'`, …) | Semua menu frontend, hampir semua guard backend legacy, label UI | Satu role per user |
| `gabah_user_roles` + `gabah_role_permissions` | `hasRbacPermission()`, `isRbacSuperadmin()`, gerbang 16 endpoint | Multi-role, union permission |

Jembatan kompatibilitas `backfillDynamicRbacUserRoles()` (`server/persistence.ts:583`) menyinkronkan **hanya sembilan role canonical** dari `users.role`; role kustom tidak pernah dihapus/ditimpa oleh jembatan ini.

### 2.4 Permission katalog vs yang benar-benar ditegakkan

- Katalog: **90 permission** unik (`011` + `012`).
- Dipakai `requireRbacPermission()` / `hasRbacPermission()`: **16** — `dashboard.read`, `assets.read/create/update/bulk_import/assign/move/lifecycle`, `movements.read`, `maintenances.read/create/update`, `vendors.create/update`, `knowledge.create/update`.
- **74 permission tidak ditegakkan di mana pun** (tickets.*, loans.*, contracts.*, reports.*, licenses.*, users.*, roles.*, room_reservations.*, master data, settings, dll.). Memberikannya ke role tidak mengubah perilaku API. `assets.delete` bahkan tidak memiliki endpoint `DELETE /api/assets`.

### 2.5 Permission yang di-seed per role canonical

| Role | dashboard.read | assets.read | 6× assets write | movements.read | maintenance read | maintenance write | vendor write | knowledge write |
|---|---|---|---|---|---|---|---|---|
| superadmin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| IT | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| GA | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Supply Chain | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | — |
| PIBC | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | — |
| Sekretaris Direksi | ✓ | ✓ | — | ✓ | ✓ | — | — | — |
| Humas | ✓ | ✓ | — | ✓ | ✓ | — | — | — |
| Karyawan | ✓ | ✓ | — | ✓ | ✓ | — | — | — |
| Auditor | ✓ | ✓ | — | ✓ | ✓ | — | — | — |

Tidak ada role yang diberi permission `users.*`, `roles.*`, `tickets.*`, `loans.*`, `contracts.*`, `reports.*`, `licenses.*`, atau `room_reservations.*`.

---

## 3. Matriks Menu per Role (definisi navigasi aktual)

Sumber: `src/components/Sidebar.tsx` (setiap item punya array `roles` berisi string role legacy).
`Administration Control Panel` hanya dirender bila `activeRole === 'Admin GABAH'` **dan** modal di `App.tsx` juga mensyaratkan `currentUser.role === 'Admin GABAH'`.

| Role | Menu yang terlihat | Jumlah |
|---|---|---|
| Admin GABAH | Dashboard, Aset Saya, Ruang Rapat, Peminjaman, Tiket, Aset, Maintenance, Software & SaaS, Vendor, Contract, Knowledge, Laporan, **Administration** | 13 |
| IT | sama tanpa Administration | 12 |
| GA | sama tanpa Administration | 12 |
| Supply Chain | Dashboard, Aset Saya, Ruang Rapat, Peminjaman, Tiket, Aset, Maintenance, Vendor, Contract, Knowledge, Laporan | 11 |
| PIBC | sama dengan Supply Chain | 11 |
| Sekretaris Direksi | Dashboard, Aset Saya, Ruang Rapat, Peminjaman, Tiket, Aset, Maintenance, Contract, Knowledge | 9 |
| Humas | sama dengan Sekretaris Direksi — tetapi `Aset` dan `Aset Saya` **tidak dapat dibuka** (lihat RBAC-08) | 9 tampil / 7 berfungsi |
| Karyawan | Dashboard, Aset Saya, Ruang Rapat, Peminjaman, Tiket, Maintenance, Knowledge | 7 |
| Auditor | Dashboard, Aset Saya, Ruang Rapat, Peminjaman, Tiket, Aset, Maintenance, Software & SaaS, Vendor, Contract, Knowledge, Laporan | 12 |
| **Role kustom (dinamis)** | **tidak ada satu pun** — semua filter `roles.includes(activeRole)` gagal | **0** |

### 3.1 Matriks role × API (hasil HTTP nyata, file-store)

Angka dalam kurung = jumlah record yang dikembalikan; `403` = ditolak.

| Role | assets | loans | tickets | maint. | vendors | contracts | users | audit-logs | admin/rbac/roles | numbering |
|---|---|---|---|---|---|---|---|---|---|---|
| Admin GABAH | 200 (17) | 200 (3) | 200 (3) | 200 (3) | 200 (5) | 200 (5) | 200 (10) | 200 | 503 | 200 |
| IT | 200 (16) | 200 (2) | 200 (3) | 200 (1) | 200 (2) | 200 (4) | 200 (10) | 403 | 503 | 200 |
| GA | 200 (14) | 200 (1) | 200 (2) | 200 (2) | 200 (3) | 200 (5) | 200 (10) | 403 | 503 | 200 |
| Supply Chain | 200 (1) | 200 (0) | 200 (0) | 200 (1) | 200 (5) | 200 (4) | 200 (10) | 403 | 503 | 200 |
| PIBC | 200 (0) | **200 (3)** | 200 (0) | **200 (3)** | 200 (5) | 200 (4) | 200 (10) | 403 | 503 | 200 |
| Sekretaris Direksi | 200 (5) | **200 (3)** | 200 (0) | **200 (3)** | 403 | 200 (5) | 200 (10) | 403 | 503 | 200 |
| Humas | **200 (0)** | **200 (3)** | 200 (0) | **200 (3)** | 403 | 200 (5) | 200 (10) | 403 | 503 | 200 |
| Karyawan | 200 (5) | 200 (1) | 200 (0) | **200 (3)** | 403 | **200 (4)** | **200 (10)** | 403 | 503 | 200 |
| Auditor | 200 (17) | 200 (3) | 200 (3) | 200 (3) | 200 (5) | 200 (5) | 200 (10) | 200 | 503 | 200 |

Data seed: 3 loan (IT, GA, IT), 3 tiket (2 GA, 1 IT), 3 maintenance (GA, IT, SC), 5 vendor, 5 kontrak.
`admin/rbac/roles` → 503 untuk **semua** role karena mode file-store (bukan bug otorisasi; lihat RBAC-07).

---

## 4. Ekspektasi vs Aktual per Alur Pengguna

| Alur | Ekspektasi | Aktual | Status |
|---|---|---|---|
| Login 9 role | 200 + token | 200 untuk 9/9 | ✓ terverifikasi |
| `/api/auth/me` memuat hak akses | permission/role efektif | hanya profil + `role` string; **tanpa permission** | ✗ RBAC-02 |
| Logout | token lama mati | logout 200, token lama → 401 | ✓ terverifikasi |
| Alih role oleh non-admin | 403 | 403 | ✓ terverifikasi |
| Alih role oleh Admin | 200 + token baru | diizinkan kode + audit log; tidak dieksekusi di probe | statis |
| Karyawan membuat aset | 403 | 403 | ✓ terverifikasi |
| Karyawan mengubah aset di luar scope | 403 | 403 | ✓ terverifikasi |
| Karyawan mengubah nomor ERP aset di luar scope | 403 | **200 + tersimpan** | ✗ RBAC-01 |
| Karyawan mengubah/membuat maintenance | 403 | 403 | ✓ terverifikasi |
| Karyawan menulis knowledge | 403 | 403 | ✓ terverifikasi |
| GA membuat vendor domain IT | 403 | 403 | ✓ terverifikasi |
| Karyawan membuat tiket | 201 | 201 | ✓ terverifikasi |
| PIBC melihat peminjaman | hanya PIBC + milik sendiri | **semua 3 loan (IT & GA)** | ✗ RBAC-04 |
| Karyawan melihat maintenance | hanya milik/scope | **semua 3 jadwal** | ✗ RBAC-09 |
| Karyawan melihat direktori pengguna | 403 | **200, 10 user + email/telepon** | ✗ RBAC-05 |
| Sekretaris/Humas melihat tiket | hanya tiket sendiri | 0 (benar, belum punya tiket) | ✓ |
| Auditor menulis | 403 | 403 | ✓ terverifikasi |
| Menu kustom | mengikuti permission | kosong total (statis) | ✗ RBAC-02 |
| Assignment role kustom ke user | tersedia di UI admin | **tidak ada UI/klien API** | ✗ RBAC-03 |

---

## 5. Menu Duplikat, Konflik, dan Halaman Yatim

| # | Temuan | Bukti | Dampak |
|---|---|---|---|
| M-1 | **Humas melihat "Aset" & "Aset Saya" tetapi tidak bisa membukanya.** `App.tsx` memaksa `currentTab='meeting_rooms'` untuk Humas pada kedua tab. | Sidebar memasukkan Humas di kedua item; guard `useEffect` di `App.tsx` | Menu mati; pengguna merasa aplikasi rusak |
| M-2 | **"Aset" disembunyikan untuk Karyawan, tetapi tab itu tetap dapat dirender** lewat hasil Global Search (Ctrl+K) yang memanggil `setCurrentTab('assets')`; untuk role non-staf, kartu "Total Aset" juga menuju tab tersebut. Tidak ada route guard; aplikasi SPA tanpa router. | `App.tsx` (GlobalSearchModal `onSelectAsset`), `DashboardView` kartu navigasi | Menu bukan kontrol keamanan; kontrol sesungguhnya hanya backend |
| M-3 | **"Software & SaaS" menduplikasi data aset** — tidak ada endpoint lisensi; `LicensesView` membaca `/api/assets`. Assets juga menampilkan kategori lisensi. Dua halaman, dua daftar role berbeda (Aset: 8 role; Lisensi: Admin/IT/Auditor). | `LicensesView`, `AssetsView`, tidak ada `/api/licenses` | Auditor melihat lisensi tetapi tidak punya menu Aset; duplikasi & gate tidak konsisten |
| M-4 | **"Laporan & Audit" bukan halaman berbasis API** — dihitung di klien dari data yang sudah di-fetch; tidak ada `/api/reports`, permission `reports.*` tidak dipakai. | `ReportsView`, grep route | Menu bisa disembunyikan, tetapi tidak ada otorisasi laporan nyata |
| M-5 | **Karyawan tidak punya menu Contract, tetapi API mengembalikan 4 kontrak** non-restricted ke Karyawan. | probe `contracts` 200 (4) untuk Karyawan; Sidebar tidak memuat Karyawan | Data kontrak (nilai/vendor) terbaca walau menu disembunyikan |
| M-6 | **Aksi cepat dashboard tidak memeriksa permission.** Tombol "Registrasi Aset" tampil untuk semua principal non-staf non-Auditor (termasuk role kustom tanpa `assets.create`), dan kartu navigasi tidak memeriksa apakah menu tujuan ada di sidebar. | `DashboardView.tsx:142-378` | Tombol tampil lalu ditolak backend; navigasi tidak konsisten dengan sidebar |
| M-7 | **`Administration Control Panel` + modal Administrasi** adalah satu-satunya pintu RBAC; modal dirender hanya untuk role string `Admin GABAH`. | `App.tsx`, `Sidebar.tsx` | Superadmin dinamis non-legacy tidak bisa membuka panel |

---

## 6. Temuan Keamanan Backend/API (berurut risiko)

### RBAC-01 — CRITICAL — Tautan rekonsiliasi aset dapat ditulis lintas scope tanpa permission

- **Lokasi:** `server.ts:2699` (`POST /api/reconciliation/link`), middleware `server/runtime-hardening.ts` (hanya memblokir path tepat `/api/reconciliation`, bukan sub-path).
- **Fakta terverifikasi (HTTP live):** login sebagai **Karyawan** (USR-04), `POST /api/reconciliation/link` dengan `assetId` aset GA di luar scope → **200**, dan nomor `corporate_asset_number` aset tersebut **berubah permanen** (dibaca ulang oleh Admin = nilai probe).
- **Analisis:** tidak ada `assets.update`, tidak ada `canSeeAsset`, tidak ada validasi kepemilikan; hanya butuh sesi valid dan bukan Auditor.
- **Dampak:** siapa pun yang login dapat mengubah data integrasi ERP aset mana pun — termasuk aset IT/GA/PIBC — dan mencemari rekonsiliasi keuangan.
- **Berlaku juga di PostgreSQL:** rute ini tidak memiliki gerbang permission sama sekali.

### RBAC-02 — CRITICAL — Navigasi dan otorisasi memakai sumber aturan berbeda

- **Lokasi:** `src/components/Sidebar.tsx`, `src/App.tsx`, `server.ts:1055` (`/api/auth/me`).
- **Fakta terverifikasi:** respons `/api/auth/me` untuk 9 role identik strukturnya: `id,name,email,role,role_label,division,department,phone,avatar,is_active,authVersion` — **tidak ada `permissions`, `roles[]`, atau `is_superadmin`**. Frontend karena itu tidak mungkin menampilkan menu berdasarkan permission; seluruh menu memakai string role legacy yang di-hardcode.
- **Konsekuensi:** user yang `users.role`-nya berupa role kustom (fitur inti Dynamic RBAC) mendapat **nol menu**; user multi-role hanya melihat menu role legacy tunggalnya; permission yang diberikan ke role tidak pernah muncul sebagai tombol/halaman. Sebaliknya, halaman bisa tampil walau permission backend tidak ada (mis. tombol "Registrasi Aset" untuk role kustom) sehingga aksi berakhir 403.
- **Status:** terverifikasi runtime untuk payload `/me`; efek menu dinyatakan dari kode, belum diuji browser.

### RBAC-03 — HIGH — Role dinamis tidak dapat ditetapkan lewat produk; input role bebas

- **Lokasi:** `src/services/gabahApi.ts` (tidak ada metode `PUT /api/admin/rbac/users/:id/roles`), `src/components/modals/AdministrationModal.tsx` (hanya CRUD role, permission, scope), `server.ts:349` (`POST /api/users`) dan `server.ts:580` (`PATCH /api/users/:id`).
- **Fakta:** endpoint assignment ada di server (`server.ts:274`) tetapi **tidak pernah dipanggil frontend**. Satu-satunya cara mengubah akses user lewat UI adalah mengubah `users.role` (string legacy). `POST /api/users` menerima `role` apa pun tanpa allowlist; jembatan PostgreSQL hanya memetakan 9 nilai canonical, sehingga role seperti `"Management"` atau `"IT Support"` menghasilkan user tanpa baris `gabah_user_roles`, menu kosong, dan 403 di endpoint ber-permission.
- **Dampak:** fitur "custom role" tidak dapat dipakai end-to-end oleh admin; salah ketik role menghasilkan akun lumpuh tanpa error.

### RBAC-04 — HIGH — Peminjaman lintas divisi terbaca (PIBC, Humas, Sekretaris Direksi)

- **Lokasi:** `server.ts:2090` — fallback `res.json(db.loans)` untuk role di luar Admin/Auditor/Karyawan/IT/GA/SC.
- **Fakta terverifikasi:** PIBC melihat **3/3** loan (semuanya milik IT/GA, nol milik PIBC); Humas dan Sekretaris Direksi juga 3/3; Admin 3/3.
- **Dampak:** kebocoran data operasional antar divisi (nama peminjam, tujuan, jadwal, nomor BAST).

### RBAC-05 — HIGH — Direktori pengguna terbuka untuk semua role

- **Lokasi:** `server.ts:345` (`GET /api/users`) — hanya middleware sesi, tanpa cek role/permission.
- **Fakta terverifikasi:** Karyawan menerima **10 user** lengkap dengan `email`, `phone`, `role`, `division`, `department`, `is_active`.
- **Dampak:** enumerasi akun + PII internal; memperbesar permukaan phishing. Endpoint ini juga dipakai UI untuk dropdown penugasan, jadi pengetatan harus disertai endpoint direktori minimal.

### RBAC-06 — HIGH — Menu bukan batas akses; tidak ada route guard

- **Lokasi:** `src/App.tsx` (state `currentTab`, tanpa router), `src/components/modals/GlobalSearchModal.tsx`.
- **Fakta:** tidak ada `react-router` di dependensi; semua "halaman" berbagi URL `/`. Perpindahan tab dapat dipicu dari luar sidebar (kartu dashboard, hasil pencarian global, tombol "Lihat semua"). Untuk Karyawan, tab `assets` dapat dirender walau menu Aset tidak ada.
- **Catatan:** backend tetap memfilter data (assets.read + scope), jadi ini masalah konsistensi UI/otorisasi, bukan kebocoran data langsung.

### RBAC-07 — HIGH — Gerbang panel admin memakai string legacy, sementara backend memakai Superadmin dinamis

- **Lokasi:** `Sidebar.tsx` (`isSuperAdmin = activeRole === 'Admin GABAH'`), `App.tsx` (modal `isOpen && role === 'Admin GABAH'`), vs `server.ts:94` (`requireRbacSuperadmin` → `isRbacSuperadmin`).
- **Fakta:** user yang memiliki role dinamis `superadmin` tetapi `users.role` bukan `Admin GABAH` tidak melihat menu/modal administrasi; user non-superadmin dinamis tidak bisa memanggil API RBAC. Di file-store, API RBAC mengembalikan **503** (terverifikasi 9/9 role), termasuk untuk Admin — panel role di dev/preview tidak berfungsi.
- **Dampak:** tidak ada satu pun jalur UI yang konsisten untuk mengelola role pada deployment tanpa PostgreSQL, dan otorisasi UI/backend dapat berbeda.

### RBAC-08 — MEDIUM — Menu mati untuk Humas

Lihat M-1. Terverifikasi dari kode; belum diuji browser. Dampak langsung ke pengalaman pengguna role Humas.

### RBAC-09 — MEDIUM — Kebocoran scope baca pada maintenance, movements, dan statistik dashboard

- **Maintenance:** `server.ts:2315` — fallback akhir mengembalikan seluruh jadwal untuk role legacy yang tidak punya cabang khusus (Karyawan, Humas, Sekretaris). **Terverifikasi:** Karyawan 3/3 = Admin 3/3.
- **Movements:** `server.ts:2079` — hanya gerbang `movements.read` (dimiliki 9 role), lalu mengembalikan seluruh `db.movements` tanpa filter aset/scope.
- **Dashboard stats:** `server.ts:2658` — jumlah aset di-scope, tetapi `active_loans`, `pending_loans`, `open_tickets` dihitung dari seluruh database dan dikirim ke semua role (terverifikasi 200 untuk 9 role).

### RBAC-10 — MEDIUM — 74 dari 90 permission bersifat dekoratif

- **Fakta:** lihat §2.4. Endpoint tiket, loan, kontrak, reservasi ruangan, laporan, lisensi, master data, dan administrasi pengguna tidak memeriksa permission katalog; sebagian hanya memeriksa string role, sebagian hanya sesi.
- **Dampak:** admin dapat memberi `tickets.close`/`reports.read`/`loans.approve` dan mengira akses berubah, padahal tidak. Ini sumber utama salah paham konfigurasi role.

### RBAC-11 — MEDIUM — Aturan frontend dan backend berbeda untuk aksi yang sama

| Aksi | Frontend | Backend |
|---|---|---|
| Ubah status tiket milik sendiri (Karyawan) | tombol disembunyikan (`canManageTicket` frontend = false) | **diizinkan** (`canManageTicket` middleware: reporter boleh) |
| Edit aset (PIBC) | tombol Edit disembunyikan (`AssetsView` hanya Admin/IT/GA/SC) | **diizinkan** (`assets.update` + authority divisi) |
| Lihat Aset (Humas) | menu tampil lalu dipaksa pindah | **diizinkan** dengan scope assigned/loanable |
| Vendor SC/PIBC | UI mengelola vendor | backend melihat semua vendor (didokumentasikan) |

- **Lokasi:** `src/services/gabahService.ts:631-690`, `AssetsView.tsx:465`, `runtime-hardening.ts:53`, `server.ts:2269`.
- **Dampak:** pengguna kehilangan fungsi yang sebenarnya diizinkan, atau melihat tombol yang berakhir 403. Sulit diaudit karena aturan digandakan di 5 tempat.

### RBAC-12 — LOW — Snapshot penomoran terbuka untuk semua role

`GET /api/numbering/sequences` (`server.ts:823`) tidak memakai guard; probe mengembalikan **200 untuk 9 role**, padahal panelnya hanya ada di Administrasi. Dampak rendah (metadata urutan nomor), tetapi menunjukkan pola "endpoint admin tanpa guard".

### RBAC-13 — LOW — Alias login berbasis role

`server.ts:907-915` memetakan prefix email generik (`it@`, `ga@`, `karyawan@`, …) ke akun role pertama. Password tetap diverifikasi, tetapi identitas yang masuk menjadi ambigu (mis. `karyawan@` selalu masuk sebagai USR-04), menyulitkan audit "siapa melakukan apa".

### RBAC-14 — INFO — Tidak ada akun/role uji untuk role kustom dan tidak ada role kustom aktual

Tidak ada data untuk menguji jalur custom role, multi-role, atau scope `unit`/`location` secara runtime. Semua temuan terkait hal ini berstatus **statis/desain**, bukan hasil uji.

---

## 7. Ringkasan Risiko

| Tingkat | Jumlah | ID |
|---|---|---|
| Kritis | 2 | RBAC-01, RBAC-02 |
| Tinggi | 5 | RBAC-03, RBAC-04, RBAC-05, RBAC-06, RBAC-07 |
| Sedang | 4 | RBAC-08, RBAC-09, RBAC-10, RBAC-11 |
| Rendah | 2 | RBAC-12, RBAC-13 |
| Info | 1 | RBAC-14 |

**Fakta terverifikasi runtime:** RBAC-01, 02 (payload `/me`), 04, 05, 07 (503), 09 (maintenance & stats), 12, login/logout, seluruh penolakan tulis yang diuji.
**Terverifikasi statis saja:** RBAC-03, 06, 08, 10, 11, 13, 14.

---

## 8. Rencana Perbaikan Berurutan

Urutan ini dipilih agar tiap langkah kecil, dapat diuji, dan tidak menambah utang arsitektur.

### P0-1 — Tutup RBAC-01 (satu rute, dampak terbesar)

- **File:** `server.ts` (`POST /api/reconciliation/link`).
- **Perubahan:** wajibkan `assets.update` + `canSeeAsset(actor, assetId)` (atau scope dinamis), validasi `corporateAssetNumber` (format/panjang/unik), dan gunakan `GabahDomainService` agar audit + persistensi konsisten.
- **Kriteria penerimaan:** Karyawan/Humas/Sekdir → 403; Admin & IT (scope cocok) → 200; aset di luar scope → 403; nilai tidak berubah saat ditolak; tes regresi baru di `scripts/` (bukan manual).

### P0-2 — Perbaiki scope baca (RBAC-04, RBAC-09)

- **File:** `server.ts` (`GET /api/loans`, `GET /api/maintenances`, `GET /api/movements`, `GET /api/dashboard/stats`).
- **Perubahan:** ganti fallback "all" dengan cabang eksplisit: PIBC/Humas/Sekdir → peminjaman milik sendiri (atau divisi); Karyawan/Humas/Sekdir → maintenance hanya untuk aset yang terlihat; movements difilter berdasarkan aset yang terlihat; statistik loan/ticket difilter dengan scope aktor.
- **Kriteria penerimaan:** pada data seed, PIBC/Humas/Sekdir melihat 0 loan; Karyawan tidak lagi melihat ketiga jadwal maintenance (hanya jadwal aset yang terlihat); Admin tetap 3/3; angka dashboard role non-global sama dengan hasil endpoint ter-scope.

### P0-3 — Batasi direktori pengguna (RBAC-05)

- **File:** `server.ts` (`GET /api/users`), `src/services/gabahApi.ts`, pemakai dropdown (tiket/aset/kontrak).
- **Perubahan:** `GET /api/users` hanya untuk Superadmin; tambahkan endpoint direktori minimal (id, nama, divisi) untuk kebutuhan penugasan, atau kirim hanya user dalam scope.
- **Kriteria penerimaan:** Karyawan/Humas/Sekdir → 403; dropdown penugasan tetap berfungsi; tidak ada `phone/email` di endpoint direktori.

### P0-4 — Satukan sumber menu & permission (RBAC-02, 06, 08, 11)

- **File:** `server.ts` (`/api/auth/me`), `src/types.ts`, `src/components/Sidebar.tsx`, `src/App.tsx`, `src/components/views/*`, `src/services/gabahService.ts`.
- **Perubahan:**
  1. `/api/auth/me` mengembalikan `permissions: string[]`, `roles: [{key,name,is_superadmin}]`, `is_superadmin`.
  2. Satu registry navigasi (`{ id, label, requiredPermission, section }`) menggantikan array `roles: UserRole[]`.
  3. Sidebar, tombol aksi, dan guard render memakai `hasPermission()`; hapus guard string role dan guard redirect Humas (atau jadikan `requiredPermission` eksplisit).
  4. Tambahkan guard render untuk tab aktif (bukan hanya menyembunyikan menu), termasuk untuk deep-link/pencarian.
- **Kriteria penerimaan:** role kustom dengan `dashboard.read` + `assets.read` melihat Dashboard & Aset dan bisa membukanya; user dengan dua role melihat gabungan; role tanpa `assets.read` tidak melihat menu maupun halaman; tidak ada 403 dari tombol yang ditampilkan pada matriks uji 9 role.

### P0-5 — Lengkapi administrasi assignment role (RBAC-03, 07)

- **File:** `src/services/gabahApi.ts`, `src/components/modals/AdministrationModal.tsx`, `server.ts` (`POST/PATCH /api/users`), `Sidebar.tsx`/`App.tsx` (gerbang admin).
- **Perubahan:** tambah klien + UI `PUT /api/admin/rbac/users/:id/roles`; tampilkan role efektif per user (union); validasi `role` legacy terhadap 9 nilai canonical (atau hapus jalur string dan jadikan assignment dinamis satu-satunya); gerbang panel admin memakai `is_superadmin` dari `/me`; tangani 503 dengan pesan "butuh PostgreSQL".
- **Kriteria penerimaan:** admin dapat menetapkan role kustom ke user uji lewat UI; setelah re-login menu & API sesuai; input role tak dikenal → 400; superadmin dinamis selalu melihat panel; non-superadmin tidak pernah melihatnya.

### P1-1 — Tegakkan atau hapus permission dekoratif (RBAC-10)

Pilih salah satu: migrasikan endpoint tiket/loan/kontrak/reservasi/laporan ke permission katalog, **atau** tandai jelas di UI role admin bahwa permission tersebut belum berlaku. Jangan biarkan admin mengonfigurasi sesuatu yang tidak berefek.

**Kriteria:** setiap permission yang dapat dicentang di UI memiliki minimal satu endpoint yang menolak tanpa permission tersebut, dibuktikan tes.

### P1-2 — Tes matriks role otomatis

Perluas harness yang ada (bukan skrip baru terpisah): login 9 role + 1 role kustom, assert menu-permission-API untuk baca/tolak/tulis, termasuk logout dan percobaan akses langsung. Jalankan di CI dengan PostgreSQL service container agar jalur permission dinamis benar-benar teruji.

**Kriteria:** CI gagal jika salah satu sel matriks menyimpang.

---

## 9. Rekomendasi Arsitektur (tanpa refactor sekarang)

1. **Satu sumber kebenaran akses:** PostgreSQL `gabah_role_permissions` + `gabah_user_roles`. `users.role` hanya label tampilan/kompatibilitas, bukan otorisasi.
2. **Satu registry navigasi** di frontend: setiap entri wajib mendeklarasikan `requiredPermission` (bukan daftar role), sehingga menambah role tidak menyentuh Sidebar.
3. **Kontrak `/api/auth/me`** memuat permission efektif + daftar role + flag superadmin; frontend tidak pernah menyimpulkan akses dari nama role.
4. **Backend tetap otoritatif:** setiap endpoint terlindungi memanggil satu helper (`requirePermission(key)`) + satu helper scope objek; tidak ada fallback "all" implisit.
5. **Penugasan role lewat satu mekanisme:** `PUT /api/admin/rbac/users/:id/roles`; UI users hanya mengelola profil, bukan hak akses.
6. **Menu bukan kontrol keamanan:** tambahkan route guard/redirect untuk tab yang tidak diizinkan, atau adopsi router agar URL dapat diverifikasi.
7. **Uji otomatis** mencakup role × route × API × aksi, dijalankan pada PostgreSQL, bukan hanya file-store.
8. **Hapus duplikasi aturan** di `gabahService`/view; jika perlu, hasilkan helper dari definisi permission yang sama agar tidak menyimpang.

---

## 10. Bukti Pengujian dan Hal yang Belum Diuji

### 10.1 Dijalankan

| Pemeriksaan | Hasil |
|---|---|
| `npm run lint` | **PASS** (exit 0) |
| `npm run build` | **PASS** (exit 0), menghasilkan `dist/server.cjs` |
| Boot server terisolasi + seed bersih | PASS |
| Login 9 role canonical | 9/9 HTTP 200 + token |
| GET matriks 14 endpoint × 9 role | lihat §3.1 |
| Penolakan tulis (aset, maintenance, knowledge, vendor, switch-role, Auditor) | 9/9 sesuai harapan; 1 penyimpangan kritis (reconciliation link diizinkan) |
| Logout & reuse token | 200 / 401 |
| Audit log untuk non-observer | 403 (7 role non-observer) |

### 10.2 Tidak dapat diuji (BLOCKED)

| Item | Alasan |
|---|---|
| Query tabel role/user/permission PostgreSQL | Tidak ada PostgreSQL/DATABASE_URL di sandbox |
| Gerbang `requireRbacPermission` dinamis | Hanya aktif di PostgreSQL |
| Role kustom & multi-role end-to-end | Tidak ada role kustom di data; butuh PostgreSQL |
| Klik-through UI per role (browser) | Playwright/browser tidak tersedia |
| Deep-link per halaman | Aplikasi SPA tanpa router; semua halaman di `/` |
| Persistensi setelah restart container | Tidak dijalankan pada audit ini |
| UAT / staging / produksi | Di luar lingkungan ini; tidak diklaim |

---

## 11. Ringkasan Eksekutif

1. **Apakah aplikasi layak digunakan?** Untuk sembilan role legacy, alur inti (login, baca ter-scope, tulis dengan penolakan) berjalan. **Belum layak produksi**: ada satu celah tulis kritis lintas scope dan model menu/izin belum terhubung ke RBAC dinamis.
2. **Penghalang utama produksi:** (a) bypass otorisasi pada tautan rekonsiliasi aset; (b) navigasi berbasis string role yang tidak mengenal role kustom/multi-role; (c) assignment role dinamis tidak tersedia di UI; (d) kebocoran scope baca (loan/maintenance/direktori user); (e) 74 permission tidak berefek.
3. **Role yang sudah diuji:** Admin GABAH, IT, GA, Supply Chain, PIBC, Sekretaris Direksi, Humas, Karyawan, Auditor (login + matriks API). **Belum:** role kustom, multi-role, dan seluruh jalur PostgreSQL-only.
4. **Temuan:** 2 kritis, 5 tinggi, 4 sedang, 2 rendah, 1 info.
5. **Tiga perbaikan pertama:** tutup RBAC-01; kirim permission efektif di `/api/auth/me` dan ganti Sidebar ke registry permission; perbaiki scope `GET /api/loans` + `GET /api/users`.
6. **Yang bisa diperbaiki tanpa membangun ulang:** semua P0 di atas adalah patch terarah pada 6–8 file; tidak perlu mengganti Express/React/PostgreSQL atau skema inti.
7. **Bukti yang masih diperlukan sebelum klaim siap produksi:** uji PostgreSQL nyata dengan 9 role + role kustom, klik-through browser per role, uji assignment lewat UI, uji persistensi setelah restart, dan CI matriks role yang gagal saat ada penyimpangan.

**Setelah laporan ini: berhenti. Tidak ada perubahan kode yang diimplementasikan sampai hasil audit ditinjau.**
