## [2026-10-15] — Dynamic RBAC Stage 12: User-to-Role Assignment

### Perubahan
- Endpoint baru `PUT /api/admin/rbac/users/:id/roles` (superadmin-only via `requireRbacSuperadmin`, PostgreSQL-only): Superadmin dapat menetapkan/mengganti sekaligus seluruh assignment role sebuah user, termasuk role custom. Body: `{ role_ids: number[] }` (set penuh, bukan delta).
- Validasi server-authoritative: user target harus ada di tabel `users` (`RBAC_USER_NOT_FOUND` → 404); semua `role_id` harus terdaftar dan aktif (`RBAC_ROLE_INVALID` → 400); duplikat id di-dedup anti masuk.
- Perubahan assignment dilakukan **atomik** dalam satu `withRbacTransaction` (DELETE set lama + INSERT set baru `ON CONFLICT DO NOTHING`) — tidak ada assignment parsial saat gagal; rollback otomatis.
- Perlindungan Superadmin terakhir: bila target satu-satunya pemegang role superadmin-capable dan set baru tidak memuatnya → ditolak `RBAC_LAST_SUPERADMIN` (409), konsisten dengan guard PATCH/DELETE `/api/users/:id`.
- Assignment membubuhkan `assigned_by_user_id` Superadmin pelaksana; audit event `RBAC_USER_ROLES_UPDATED` mencatat user target, email, dan daftar role baru setelah `refreshRbacPolicy()`.
- `rbacFailure` diperluas pesan 404/400/409 untuk `RBAC_USER_NOT_FOUND`, `RBAC_ROLE_INVALID`, `RBAC_LAST_SUPERADMIN`.
- `scripts/dynamic-rbac-foundation-verify.mjs` ditambah 8 pemeriksaan (65 → 73): keberadaan endpoint, guard superadmin, validasi user & role, atomicity, stamping assigned_by, last-superadmin guard, audit event + refresh.
- Implementasi tersimpan dalam commit **`2d87f4e`** (`2d87f4e18c890547e13f190fc6c2fb177dce96ff`, ter-push ke `main`; CI SUCCESS). Catatan progres permanen: `docs/progress/dynamic-rbac-progress.md` (baru).

### Yang dipertahankan
- Kolom `users.role` legacy tetap otoritatif untuk logic bisnis — assignment dinamis adalah layer RBAC paralel; backfill `gabah_user_roles` di `persistence.ts` tetap terjadi pada persist dan berperan sebagai bridge kompatibilitas untuk sembilan mapping legacy.
- Tidak ada perubahan pada modul loan/ticket/contract/maintenance/room, tidak ada migration baru, tidak ada perubahan skema.

### Hasil tes aktual (dijalankan)
| Check | Command | Hasil |
|---|---|---|
| Verify Dynamic RBAC | `node scripts/dynamic-rbac-foundation-verify.mjs` | 73/73 PASS |
| Typecheck | `npm run lint` | PASS, 0 error |
| Build | `npm run build` | PASS |
| P0 security file-store | `node scripts/p0-security-verify.mjs` | 37/37 PASS |

### Batas / keterbatasan
- Endpoint hanya aktif saat PostgreSQL aktif (pola konsisten dengan seluruh RBAC admin API); file-store tidak mensimulasikan assignment — verifikasi superadmin/gate/statik + P0 file-store; **uji runtime PostgreSQL live belum dijalankan** (CI tanpa instance PG), pengujian integrasi tetap direkomendasikan.
- Tes runtime terhadap endpoint ini belum tersedia (peru tes integrasi PG); pemeriksaan saat ini contract-statis.

---

## [2026-10-15] — Dynamic RBAC Stage 11: Dynamic Scope Enforcement & Movements Read Gate

### Perubahan
- `GET /api/movements` kini memeriksa permission dinamis `movements.read` via `requireRbacPermission` saat PostgreSQL aktif. Migration baru `017_dynamic_rbac_movements_read_permission_seed.sql` (additive, idempotent) memberi grant ke sembilan role legacy — mencerminkan perilaku aktual endpoint ini sebelumnya (GET tanpa pembatasan peran), sehingga tidak ada perubahan akses bagi pengguna legacy. Role custom tidak menerima grant otomatis.
- Visibilitas aset untuk role dinamis (non-legacy) saat PostgreSQL aktif kini di-resolve dari `gabah_role_division_scopes` di `GabahDomainService.getScopedAssets()`, bukan lagi fallback all-seeing: `all` (semua), `own` (aset yang ditugaskan ke user), `division` (owner_division), `unit` (managing_unit_id atau nama unit pengelola), dan `location` (asset_location_id, nama lokasi fisik, atau teks location). Role dinamis tanpa scope/assignment tidak melihat aset apa pun (deny-by-default). Menutup catatan risiko "fallback all-seeing untuk role tak-dikenal" dari Stage 10.
- Sembilan role legacy mempertahankan rule `getScopedAssets()` yang berjalan di atas permission gate — visibilitas Admin GABAH/Auditor/Humas/Karyawan/Sekdir/IT/GA/SC/PIBC tidak berubah sama sekali. Filter scope dinamis ini juga berlaku konsisten pada `GET /api/assets`, `GET /api/assets/:id`, dan lihat perhatian dashboard (`/api/dashboard/attention`) karena semuanya lewat fungsi yang sama.
- `scripts/dynamic-rbac-foundation-verify.mjs` ditambah 7 pemeriksaan (total 65): gate movements, seed 017 idempotent 9 role, resolusi scope dinamis deny-by-default, passthrough superadmin dinamis, coverage tipe scope, dan preservasi rule legacy.

### Batas tahap
- Enforcement dinamis tetap belum diterapkan pada modul lain (loan, ticket, contract, maintenance, dsb.) — sesuai batas tahap.
- Scope dinamis belum menyempitkan visibilitas role legacy (sengaja dipertahankan legacy); pemetaan penuh action→permission→scope per modul masih agenda tahap berikut.
- Test runtime enforcement PostgreSQL belum dapat dijalankan di CI saat ini (lihat catatan Stage 10). Pemeriksaan tetap contract-statis + P0 file-store.

---

## [2026-10-15] — Dynamic RBAC Stage 10: Asset Write Permissions

### Perubahan
- Enam endpoint tulis aset kini memeriksa permission dinamis via `requireRbacPermission` saat PostgreSQL aktif: `assets.create` (`POST /api/assets`), `assets.update` (`PATCH /api/assets/:id`), `assets.bulk_import` (bulk import), `assets.assign`, `assets.move`, dan `assets.lifecycle` (assign/move/lifecycle). Development file-store tetap memakai perilaku legacy (gate no-op) sehingga kompatibilitas tidak berubah.
- Migration baru `016_dynamic_rbac_asset_write_permissions_seed.sql` bersifat additive dan idempotent: memberikan enam permission tersebut **hanya** kepada role legacy yang memang berhak mengikuti guard aktual (superadmin, it, ga, supply_chain, pibc; join `gabah_permissions`, hanya yang aktif). Role Karyawan/Auditor/Humas/Sekretaris Direksi serta role custom **tidak menerima grant otomatis**.
- Jalur UPDATE pada bulk-import kini meniru authority divisi `PATCH /api/assets/:id` (IT/GA/SC/PIBC hanya memperbarui aset divisi miliknya; Admin GABAH bebas). Sebelumnya impor massal bisa memperbarui aset lintas divisi tanpa pemeriksaan — diperbaiki di tahap ini dan dicatat transparan di changelog (SEC-10).
- `scripts/dynamic-rbac-foundation-verify.mjs` ditambah 12 pemeriksaan (total 58): gate per endpoint, authority divisi bulk-update, seed idempotent sesuai daftar role, dan tanpa grant implisit untuk role tanpa hak.

### Yang dipertahankan (tidak berubah)
- Guard role legacy tetap berlaku di atas permission gate: pembatasan Auditor/Karyawan/Humas/Sekretaris Direksi, authority divisi di domain service (`createAsset`, `assignAsset`, `moveAsset`, `mutateLifecycle`), dan `approve_disposal` eksklusif Superadmin.
- Validasi duplikat serial number, nomor aset Accurate/ERP, allowlist field updates, validasi managing unit dan lokasi fisik, serta audit log semua jalur.

### Batas tahap
- Enforcement dinamis tetap belum diterapkan pada modul lain (loan, ticket, contract, maintenance, dsb.) — sesuai batas tahap.
- Test runtime enforcement PostgreSQL (termasuk negasi permission per role custom) belum dapat dijalankan di lingkungan CI saat ini; pekerjaan CI masih file-store + pemeriksaan statis + P0 file-store seperti saat ini, dan pengujian integrasi PostgreSQL direkomendasikan sebelum produksi.

---

## [2026-10-15] — Perbaikan Verifikasi CI, Kolisi Versi Migration, dan Typecheck

### Ringkasan
CI `main` gagal 70 run sekaligus sejak Dynamic RBAC Stage 2 karena dua cacat infrastruktur, ditambah satu error typecheck riil yang tertutup kegagalan tersebut. Ketiganya kini diperbaiki tanpa mengubah perilaku authorization sama sekali.

### Perbaikan
- **Skrip verifikasi Dynamic RBAC** (`scripts/dynamic-rbac-foundation-verify.mjs`): hapus tanda kurung ganda (`))` → `)]`) pada 39 baris di array `checks` sehingga skrip kembali eksekusi. Tidak ada assertion yang diubah, dilemahkan, atau dihapus — hasil run ulang: **47/47 PASS**.
- **Kolisi versi migration**: rename `010_room_reservations.sql` → `015_room_reservations.sql`. Migration runner menandai status versi dari angka depan nama file dan melewati versi yang sudah tercatat, sehingga dua file dengan prefix `010` membuat `CREATE TABLE room_reservations` + constraint anti-collision (EXCLUDE/tstzrange dari SEC-07) berisiko ter-skip permanen pada database baru.
- **Typecheck** (`npm run lint`): setelah lint CI kembali berjalan, muncul error riil `TS2339: Property 'map' does not exist on type 'unknown'` di `src/components/modals/AdministrationModal.tsx` (destructuring `Object.entries` pada hasil `reduce`). Diperbaiki dengan annotasi tipe eksplisit `Record<string, any[]>` pada variabel hasil `reduce` — tanpa `any`-cast pada panggilan maupun suppression.
- Referensi historic SEC-07 di changelog diperbarui mengikuti nama file baru.

### Hasil verifikasi lokal
| Check | Command | Hasil |
|---|---|---|
| Verify Dynamic RBAC | `node scripts/dynamic-rbac-foundation-verify.mjs` | 47/47 PASS |
| Typecheck | `npm run lint` | PASS, 0 error |
| Build | `npm run build` | PASS (frontend + `dist/server.cjs`) |
| P0 security | `node scripts/p0-security-verify.mjs` | 37/37 PASS |

### Batas / catatan
- Verify script tetap contract-statis; eksekusi integrasi PostgreSQL di CI belum termasuk tahap ini.
- Nomor `015` dipilih karena belum terpakai; tidak ada file migration yang dihapus atau isinya diubah.

---

## [2026-10-15] — Dynamic RBAC Stage 9: Asset Catalogue Read Access

### Perubahan
- Tambah migration idempoten `014_dynamic_rbac_assets_read_permission_seed.sql` untuk memberi `assets.read` ke role legacy yang sudah ada; role custom tidak memperoleh permission otomatis.
- Endpoint daftar aset dan detail aset memeriksa permission `assets.read` saat PostgreSQL aktif.
- Detail aset kini menggunakan filter `GabahDomainService.getScopedAssets(actor)` yang sama dengan daftar aset, sehingga akses langsung berdasarkan ID tidak melewati cakupan visibilitas lama.
- Tambah pemeriksaan statis untuk seed permission, guard daftar/detail, dan penerapan scope pada detail aset.

### Batas tahap
- Ini baru otorisasi baca aset. Operasi tambah/ubah/hapus, impor, tiket, peminjaman, dan modul lain belum sepenuhnya menggunakan permission dinamis.
- Role contoh tetap dapat diedit; penghapusan role harus ditolak selama masih ada assignment. Penetapan role custom ke user belum dibuka karena sebagian endpoint bisnis masih mengandalkan `users.role` legacy; membuka assignment sebelum migrasi otorisasi lengkap berisiko memberi akses yang tidak konsisten.
- Pemeriksaan belum dijalankan di runtime/CI pada commit ini; build dan integrasi PostgreSQL belum terkonfirmasi.

---

## [2026-10-15] — Dynamic RBAC Stage 8: Dashboard Read Permission

### Perubahan
- Tambah migration idempoten `013_dynamic_rbac_dashboard_permission_seed.sql` untuk memberi permission `dashboard.read` kepada sembilan role legacy yang sudah ada, tanpa memberi permission modul lain.
- Tambah guard `requireRbacPermission` untuk endpoint statistik dashboard dan pusat perhatian.
- Pada mode PostgreSQL, kedua endpoint sekarang memeriksa permission dari policy RBAC database; user tanpa permission menerima HTTP 403.
- Mode file-store tetap memakai perilaku lama selama migrasi otorisasi berlangsung.
- Tambah pemeriksaan statis untuk seed permission dan kedua endpoint yang dilindungi.

### Batas tahap
- Ini baru migrasi pertama pada modul dashboard. Permission/scope aset, tiket, peminjaman, kontrak, dan modul lain belum seluruhnya ditegakkan oleh policy dinamis.
- Pemeriksaan ini baru berupa kontrak statis; hasil build, integrasi PostgreSQL, dan uji regresi runtime tetap perlu dikonfirmasi melalui CI atau lingkungan aplikasi.

---

## [2026-10-15] — Dynamic RBAC Stage 7: Stable Superadmin Enforcement

### Perubahan
- Tambah helper `isSuperadminActor` yang menggunakan assignment Superadmin database ketika PostgreSQL aktif dan mempertahankan perilaku Admin GABAH pada file-store development.
- Ganti pemeriksaan Superadmin berbasis nama di `server.ts`, `server/services.ts`, dan `server/runtime-hardening.ts` dengan helper policy yang sama.
- Hapus fallback otorisasi berbasis string `(actor as any).role === 'Superadmin'` pada endpoint API agar tidak ada bypass tanpa assignment Superadmin aktif di database.
- Tambah penghitungan Superadmin aktif dari cache policy.
- Cegah penurunan role, penonaktifan, atau penghapusan Superadmin aktif terakhir melalui endpoint user.
- Perbaiki rekonsiliasi assignment legacy: assignment role milik user yang sudah dihapus dibersihkan, role legacy disinkronkan mengikuti role user saat ini, dan role custom tidak dihapus oleh bridge legacy.
- Segarkan policy cache setelah perubahan user dan konfigurasi RBAC.
- Tambah pemeriksaan kontrak untuk memastikan guard Superadmin menggunakan identitas database dan Superadmin terakhir dilindungi.

### Batas tahap
- Pemeriksaan role spesifik selain Superadmin masih banyak di domain service dan endpoint. Role baru belum otomatis memperoleh akses bisnis hanya karena permission dipilih di UI.
- Tahap berikutnya harus memigrasikan pemeriksaan per modul dan per aksi ke permission/scope, disertai pemetaan hak akses awal sembilan role dan pengujian regresi sebelum assignment dinamis user diaktifkan.

---

## [2026-10-15] — Dynamic RBAC Stage 6: Stable Superadmin Policy Cache

### Perubahan
- Tambah `server/rbac-policy.ts` sebagai cache baca-saja dari role assignment, permission, dan scope yang tersimpan di PostgreSQL.
- Tambah fungsi policy dasar: `isRbacSuperadmin`, `hasRbacPermission`, `getUserRbacPolicies`, dan `hasRbacScope`.
- Muat policy setelah persistence siap dan segarkan cache setelah perubahan konfigurasi role/permission/scope.
- Endpoint administrasi Dynamic RBAC sekarang memverifikasi assignment role yang memiliki `is_superadmin = TRUE`, bukan hanya membandingkan nama tampilan role.
- Tambah rekonsiliasi assignment role legacy idempoten setelah `backfillNormalizedTables()` agar instalasi PostgreSQL baru tidak kehilangan assignment dan user yang diturunkan dari Superadmin tidak menyimpan assignment Superadmin legacy yang usang. Role custom di luar sembilan role legacy tidak dihapus oleh bridge ini.
- Tambah pemeriksaan kontrak untuk policy cache dan urutan backfill tersebut.

### Batas tahap
- Cache policy belum menggantikan seluruh pemeriksaan role hardcoded pada endpoint bisnis dan domain service.
- Belum ada endpoint assignment role dinamis yang diaktifkan untuk pengguna akhir; tahap berikutnya harus memigrasikan otorisasi runtime secara bertahap agar role baru tidak mewarisi atau kehilangan akses secara tidak sengaja.

---

## [2026-10-15] — Dynamic RBAC Stage 5: Complete Permission Catalogue

### Perubahan
- Tambah migration `server/migrations/012_dynamic_rbac_permission_catalog_expansion.sql`.
- Memperluas katalog permission agar mencakup API yang sudah ada untuk user/auth, mutasi aset, maintenance, vendor, knowledge base, notifikasi, dashboard, rekonsiliasi, ruang/reservasi rapat, master data, penomoran, dan pengelolaan kontrak.
- Migration bersifat additive/idempotent dan tidak memberikan permission baru ke role secara otomatis.
- Menambah pemeriksaan kontrak untuk memastikan cakupan modul dan sifat idempotent migration.

### Batas tahap
- Katalog permission adalah daftar kemampuan yang tersedia, bukan bukti bahwa semua endpoint sudah menegakkan permission tersebut.
- Role assignment dan penggantian seluruh pemeriksaan role hardcoded masih harus diselesaikan sebelum Dynamic RBAC dianggap aktif penuh.

---

## [2026-10-15] — Dynamic RBAC Stage 4: Dynamic Role Management UI

### Perubahan
- Tambah metode client API Dynamic RBAC pada `src/services/gabahApi.ts`.
- Ganti tampilan Role & Permission Matrix berbasis `localStorage` pada layar aktif menjadi **Dynamic Role Management** yang membaca dan menyimpan konfigurasi melalui backend/PostgreSQL.
- UI menyediakan pembuatan role, edit nama/deskripsi, aktivasi/nonaktivasi, penghapusan role yang tidak digunakan, pemilihan permission per modul, dan pengaturan scope data.
- Kunci internal role ditampilkan tetapi tidak dapat diedit; nama tampilan dapat diubah tanpa mengubah identitas internal.
- UI menandai role Superadmin sebagai dilindungi dan tidak menyediakan kontrol untuk menghapus/menonaktifkan atau mengubah permission/scope Superadmin.
- Menampilkan peringatan bahwa permission baru belum menjadi otorisasi endpoint bisnis sampai tahap migrasi runtime selesai.
- Menambah pemeriksaan kontrak statis untuk memastikan UI dan API client terhubung ke endpoint Dynamic RBAC.

### Batas tahap
- UI memerlukan PostgreSQL aktif dan migration 010/011 sudah dijalankan; tidak ada fallback ke `localStorage` untuk konfigurasi role yang baru.
- Assignment role ke user dan migrasi otorisasi runtime belum selesai. Role baru belum boleh dianggap aktif untuk akses modul bisnis.
- Build TypeScript dan uji browser belum dapat diklaim berhasil sampai GitHub Actions selesai menjalankan CI.

---

## [2026-10-15] — Dynamic RBAC Stage 3: Superadmin Role Administration API

### Perubahan
- Tambah helper PostgreSQL `queryRbac` dan `withRbacTransaction` di `server/persistence.ts`. Operasi Dynamic RBAC gagal tertutup jika PostgreSQL tidak aktif; tidak ada fallback konfigurasi role ke browser atau file-store.
- Tambah endpoint Superadmin:
  - `GET /api/admin/rbac/roles` — daftar role, permission, scope, dan jumlah assignment.
  - `GET /api/admin/rbac/permissions` — katalog permission.
  - `POST /api/admin/rbac/roles` — membuat role baru.
  - `PATCH /api/admin/rbac/roles/:id` — mengubah nama/deskripsi atau menonaktifkan role.
  - `DELETE /api/admin/rbac/roles/:id` — menghapus role yang tidak digunakan.
  - `PUT /api/admin/rbac/roles/:id/permissions` — mengganti permission role secara transaksional.
  - `PUT /api/admin/rbac/roles/:id/scopes` — mengganti cakupan data secara transaksional.
- Kunci internal role dipertahankan ketika nama tampilan diubah.
- Role Superadmin dilindungi dari penghapusan, penonaktifan, dan pengubahan permission melalui endpoint ini.
- Role yang masih ditetapkan ke user tidak dapat dinonaktifkan atau dihapus.
- Perubahan role dan konfigurasi permission/scope dicatat ke audit log.
- Tambah pemeriksaan kontrak statis untuk route dan guard keamanan.

### Batas tahap
- Endpoint administrasi ini hanya mengizinkan akun legacy `Admin GABAH` sampai identitas Superadmin dinamis selesai dimigrasikan.
- API ini belum mengubah otorisasi endpoint bisnis yang masih memakai pemeriksaan role hardcoded.
- UI administrasi belum terhubung ke endpoint baru; assignment role-user dinamis juga belum diaktifkan.
- Build TypeScript, test suite, dan pengujian integrasi PostgreSQL perlu dijalankan pada checkout project sebelum fitur dianggap siap produksi.

---

## [2026-10-15] — Dynamic RBAC Stage 2: Permission Catalogue & Legacy Assignment Backfill

### Tujuan
Menyiapkan katalog permission dan relasi role-user dari data legacy tanpa mengaktifkan otorisasi baru sebelum pemetaan endpoint selesai.

### Perubahan
- Tambah migration `server/migrations/011_dynamic_rbac_legacy_backfill.sql`.
- Seed katalog permission untuk dashboard, user, role, aset, peminjaman, tiket, lisensi, kontrak, laporan, audit, organisasi, master data, notifikasi, dan pengaturan.
- Backfill relasi `gabah_user_roles` berdasarkan nilai `users.role` yang dikenal; assignment yang sudah ada tidak diduplikasi dan nilai role tak dikenal tidak dipetakan secara diam-diam.
- Pertahankan `users.role` dan seluruh otorisasi runtime legacy sebagai sumber perilaku sementara.
- Perluas pemeriksaan kontrak statis untuk memeriksa migrasi backfill.

### Verifikasi dan batas tahap
- Migration mengikuti transaksi yang dikelola oleh migration runner yang sudah ada.
- Katalog permission belum dihubungkan ke role melalui `gabah_role_permissions`; pemberian akses harus dilakukan setelah pemetaan endpoint dan matriks akses legacy diverifikasi.
- Tahap ini belum mengaktifkan CRUD role atau mengganti pemeriksaan role hardcoded di backend.
- Eksekusi migration dan pengujian PostgreSQL/CI tetap harus dikonfirmasi pada lingkungan yang menjalankan project.

---

# Changelog — GABAH

## [2026-10-15] — Dynamic RBAC Stage 1: Schema Foundation

### Tujuan
Memulai migrasi role statis ke Dynamic RBAC secara bertahap tanpa mengubah perilaku otorisasi aplikasi yang sedang berjalan.

### Perubahan
- Tambah migration additive dan idempotent `server/migrations/010_dynamic_rbac_foundation.sql`; transaksi dikelola oleh migration runner yang sudah ada (tanpa `BEGIN`/`COMMIT` bersarang).
- Tambah tabel `gabah_roles`, `gabah_permissions`, `gabah_role_permissions`, `gabah_role_division_scopes`, dan `gabah_user_roles`.
- Kapabilitas Superadmin disimpan pada `is_superadmin`, terpisah dari nama tampilan role. Sembilan role lama hanya menjadi data awal, bukan batas jumlah role.
- Assignment role memakai relasi terpisah dan penghapusan role yang masih di-assign ditolak oleh FK `ON DELETE RESTRICT`.
- Tidak menghapus atau mengubah kolom legacy `users.role`; otorisasi runtime masih menggunakan mekanisme lama sampai tahap migrasi berikutnya.
- Tambah `scripts/dynamic-rbac-foundation-verify.mjs`, npm script `test:dynamic-rbac-foundation`, dan pemeriksaan otomatis di GitHub Actions CI.

### Verifikasi dan batas tahap
- Pemeriksaan kontrak statis schema dimasukkan ke CI.
- Tahap ini **belum** mengaktifkan CRUD role, belum memindahkan assignment user, dan belum mengganti pemeriksaan role hardcoded di backend.
- Eksekusi migration terhadap PostgreSQL dan uji integrasi runtime harus dilakukan pada tahap lanjutan sebelum schema dipakai aplikasi.

---

# Changelog — GABAH

## [2026-10-09] — T2B-3 — Master Kategori & Aset Tetap

### Ringkasan
Master **`asset_categories`** kini menjadi **satu-satunya sumber kebenaran** untuk kategori aset tetap: resolusi kategori & penomoran aset di server, form aset, dan panel admin semuanya membaca `db.categories` (hasil CRUD Admin GABAH) — bukan lagi array hardcoded (`CANONICAL_TAXONOMY` di server / `FIXED_ASSET_TAXONOMY` statis di form). Domain `main_type` diseragamkan ke **9 jenis aset tetap kanonikal** (TNH, BGN, MSN, KDR, INV-F, INV-P, IT-H, IT-S, LNY); vocabulary legacy dropdown admin (EQUIPMENT/VEHICLE/...) dipetakan deterministik. Kategori yang sudah dipakai aset dikelola dengan **disable/enable, bukan hapus permanen**. Prinsip: Kategori ≠ Lokasi Fisik ≠ Managing Unit ≠ Owner Division.

### Schema/model
- **`AssetTaxonomyItem`** (`server/taxonomy.ts`): field baru opsional **`is_active?: boolean`** (default true — data lama tetap terbaca).
- Konstanta domain baru: `FIXED_ASSET_MAIN_TYPES` (9 kode), `ASSET_OWNER_DIVISIONS`, `ASSET_CATEGORY_TYPES` + guard `isFixedAssetMainType` / `isOwnerDivision` / `isGabahCategoryType`.
- **`normalizeCategoryMaster()`** — normalisasi idempoten master (default aktif, `main_type` legacy → kanonikal, dedupe kode, trim field) dipakai pada seed `server/db.ts` dan hydrate `server/persistence.ts`.
- **`resolveTaxonomyByHumanName(nameOrCode, requestedDivision, catalog)`** — kini menerima katalog master; kode yang hilang dari master jatuh ke `CANONICAL_TAXONOMY` (fail-safe) sehingga resolusi tidak pernah gagal.
- **`assertCategoryUsableForNewAsset()`** — kategori nonaktif ditolak sebagai nilai BARU (400).

### Migration
- **`server/migrations/009_asset_category_master.sql`** (additive & idempotent): `ALTER TABLE asset_categories ADD COLUMN IF NOT EXISTS main_type / description / updated_at`; backfill `main_type` deterministik (kode kanonikal → kelompoknya; vocabulary legacy dipetakan; selain itu `LNY`) **hanya baris yang belum valid**; seed 22 baris kanonikal `ON CONFLICT (code) DO NOTHING`; `RAISE NOTICE` total/aktif/nonaktif. Tidak menyentuh `owner_division`, `managing_unit_id`, `asset_location_id`, `asset_number`, maupun `location`. Kolom `is_active` sudah ada sejak migration 001.

### API
- **`GET /api/taxonomy/categories`**: respons selalu dinormalkan (`is_active` boolean, `main_type` pada domain kanonikal).
- **`POST`**: wajib `main_type` ∈ 9 kanonikal, `owner_division` ∈ IT/GA/SC/PIBC, `category_type` ∈ IT/General/License (di luar itu → 400); **duplikat kode & duplikat nama (case-insensitive) → 400**; `is_active` default true.
- **`PATCH /api/taxonomy/categories/:code`**: validasi enum yang sama; dukungan **toggle `is_active`** (enable/disable); audit `CATEGORY_UPDATED` mencatat aktivasi/nonaktifasi.
- **`DELETE`**: tetap ter-guard (400 bila kategori masih dipakai aset) — disable adalah jalur utama penghapusan.
- **`POST /api/taxonomy/resolve`**: resolusi terhadap master (opsional `owner_division`).
- **`POST /api/assets`, bulk-import, dan resolusi internal**: kategori di-resolve dari master; kategori **nonaktif ditolak (400)**; input kategori bebas legacy tetap jatuh ke fallback (aset tanpa kategori master tetap terbaca); `is_loanable_by_default` & `category_type` diambil dari master.

### UI
- **Administration Control Panel** (`AdministrationModal.tsx`): `ASSET_MAIN_TYPES` diseragamkan ke 9 kode kanonikal (label memuat istilah PSAK 16); kartu kategori kini memuat badge **"Nonaktif"** + tombol toggle (ikon Power) untuk mengaktifkan/menonaktifkan; fix payload edit: `loanable` → **`is_loanable_by_default`** (sebelumnya key salah dan tidak pernah terbaca server).
- **Form aset** (`CreateAssetModal.tsx`): memuat master via `GET /api/taxonomy/categories` — kategori nonaktif/dihapus admin hilang dari pilihan, **kategori baru buatan admin otomatis muncul** pada kelompok `main_type`-nya, dan `is_loanable_by_default`/`category_type` diambil dari master; fallback ke daftar statis bila API gagal (form tidak pernah kosong).
- Form edit aset tidak mengubah kategori (kategori ditentukan saat pembuatan; perubahan master tidak menulis ulang aset historis).

### Persistence
- **JSON**: `categories` ikut di-serialize (jalur yang sudah ada) + **normalisasi saat hydrate** — snapshot lama tanpa `is_active`/`main_type` kanonikal tetap terbaca, tidak ada kategori yang dihapus diam-diam.
- **PostgreSQL**: `backfillNormalizedTables` meng-sync master kategori ke `asset_categories` (code, name, category_type, main_type, description, owner_division, is_loanable_by_default, is_active — idempoten) **sebelum** aset agar FK aman; kode kategori legacy yang tidak ada di master tetap dibuat (`main_type='LNY'`) sehingga `assets.category_id` tidak pernah gagal.

### Kompatibilitas legacy
- `db.categories` lama (tanpa field baru) dinormalkan saat hydrate; hasil resolve untuk input tak dikenal tetap fail-safe ke kanonikal (tidak error).
- Aset existing: kategori, nomor aset, owner, unit, dan lokasi **tidak pernah diubah** oleh tahap ini (dibuktikan test 11b).
- Vocabulary legacy `main_type` (EQUIPMENT/VEHICLE/FURNITURE/BUILDING/LAND/LICENSE/OTHER) dipetakan deterministik — bukan dihapus.

### Tidak berubah (scope guard T2B-3)
`owner_division`, `managing_unit_id` (T2B-1), `asset_location_id` (T2B-2), `asset_number`/`corporate_asset_number`/numbering engine & sequence table (T2B-4), RBAC/authorization lintas divisi, `assets.location` (teks bebas), serta domain Maintenance, Contract, Loan/Assignment, Helpdesk, Meeting Room, Vendor, KB, Procurement, dan skema office location user.

### Tests / build / lint — hasil aktual
- `npm run lint` (`tsc --noEmit`): **PASS** (0 error)
- `npm run build` (vite + esbuild): **PASS**
- `npm run test:t2b3` (baru — `scripts/t2b3-category-master-verify.mjs`): **26/26 PASS** — migration additive/idempotent (inspeksi statis), master seed tervalidasi (22 kode, domain `main_type`), CRUD admin (create/rename/disable/enable, duplikat kode & nama ditolak, `main_type` legacy ditolak 400), non-admin 403, auditor read-only, kategori baru admin langsung bisa dipakai buat aset (kode & owner dari master, nomor `SC-DRN-2026-0001`), rename terlihat oleh resolve & create by nama baru, kategori nonaktif ditolak untuk aset baru namun tetap terbaca + aset historis utuh, re-enable kembali berfungsi, hapus kategori terpakai ditolak, input bebas legacy tetap fallback, edit `is_loanable_by_default` berlaku untuk aset baru, penomoran regresi `IT-HLT-<tahun>-<seq>`, aset existing tidak berubah, roundtrip master+aset lewat restart (termasuk status nonaktif).
- Regresi: `test:t2b1` **18/18**, `test:t2b2` **22/22**, `test:org-model` **14/14**, `test:loan-authz` **37/37**, `test:meeting-room` **18/18**, `p0-security-verify` **37/37**, `menu-connectivity-verify` **23/23**, `asset-import-verify` **20/20**, `bulk-import-verify` **14/14**, `p1-features-verify` **16/16** — semua PASS.

Catatan: T2B-4 (kompatibilitas numbering) serta redesign RBAC/Maintenance/Contract/Loan **belum** dikerjakan.

## [2026-10-09] — T2B-2 — Asset Location Master

### Ringkasan
Master baru **`asset_locations`**: lokasi fisik aset yang **terpisah** dari `org_office_locations` (lokasi kantor penempatan user) dan dari `managing_unit_id` (unit pengelola lifecycle, T2B-1). Mendukung **hierarki sederhana** (`parent_id` self-reference) dengan guard anti-siklus & anti-self-parent. Field relasi baru pada aset: **`asset_location_id`** (nullable). Prinsip: Lokasi Fisik ≠ Owner Division ≠ Managing Unit ≠ Custodian/PIC.

### Keputusan penamaan
Field relasi pada aset memakai **`asset_location_id`** (konsisten dengan pola `office_location_id` pada user); tabel memakai **`asset_locations`**. Master lama `org_office_locations` TIDAK diubah dan tetap khusus penempatan user.

### Schema/model
- **`AssetLocation`** (`server/db.ts`, `src/types.ts`): `id`, `name`, `parent_id?`, `is_active`. **`ServerAsset`/`Asset`**: field baru opsional `asset_location_id?: string | null`.
- **Seed hierarkis** (`DEFAULT_ASSET_LOCATIONS` di `server/db.ts` + seed SQL): root Head Office / Gudang Beras Cipinang / Pasar Induk Beras Cipinang / Cloud Tenant Microsoft Azure; lokasi anak per ruang/area (mis. Ruang IT & Server Lt. 2, Warehouse A, Kantor Pos 1). Seed **diturunkan dari teks `location` aktual pada seed aset** (bukan karangan) sehingga backfill exact-match memetakan seluruh aset seed secara deterministik; Admin GABAH bebas menambah/mengubah.
- **Modul baru `server/asset-location.ts`**: `resolveAssetLocationIdByText` (exact-match deterministik, ambigu → null), `getAssetLocationPath`, `validateAssetLocation` (harus terdaftar; nonaktif hanya untuk nilai historis yang sudah melekat), `assertValidLocationParent` (tolak self-parent & siklus), `normalizeAssetAssetLocations` (backfill idempoten).
- **Migration `server/migrations/008_asset_location_master.sql`** (additive & idempoten): `CREATE TABLE IF NOT EXISTS asset_locations` (self-FK `parent_id ON DELETE SET NULL`), seed `ON CONFLICT DO NOTHING`, `ALTER TABLE assets ADD COLUMN IF NOT EXISTS asset_location_id VARCHAR(64) REFERENCES asset_locations(id) ON DELETE SET NULL` + index `idx_assets_asset_location` + backfill + `RAISE NOTICE` total/mapped/unresolved. Tidak menyentuh `owner_division`, `managing_unit_id`, `location` (teks bebas tetap), maupun `asset_number`.
- **Backfill deterministik (identik SQL ↔ TS)**: teks legacy `location` dipetakan ke master HANYA bila cocok persis (normalisasi spasi/kapital) dengan path lengkap lokasi ("Induk - Anak") dan cocokan **unik**; ambigu/tidak dikenal → **NULL** (tidak ditebak, tidak membuat lokasi palsu). Nilai eksplisit tidak pernah ditimpa; referensi asing direset null. Aset lama tanpa field tetap terbaca (aman hydrate).

### API
- **Master (Admin GABAH only, ter-audit)**: `GET /api/master/asset-locations`, `POST /api/master/asset-locations` (validasi nama+induk unik per level; induk harus ada), `PATCH /api/master/asset-locations/:id` (rename/reparent/enable/disable; guard self-parent & siklus → 400). **Tidak ada hard-delete** — pola disable/nonaktif seperti master lain, sehingga relasi aset tidak pernah rusak.
- **Aset**: `POST /api/assets` & `PATCH /api/assets/:id` menerima `asset_location_id` (harus terdaftar; **nonaktif ditolak** untuk perubahan baru — kecuali mempertahankan nilai historis yang sudah melekat; tidak dikenal → 400 tanpa mengubah nilai lama). `POST /api/assets/:id/move` me-resolve ulang relasi secara deterministik dari teks baru (non-master → null). GET mengembalikan field-nya; UI menampilkan nama master bila ada, fallback teks `location` legacy.

### UI
- **Administration Control Panel** (`AdministrationModal.tsx`, section org_masters): blok baru "Master Lokasi Fisik Aset" — form tambah (nama + pilihan lokasi induk), daftar dengan indikator "← Induk", toggle aktif/nonaktif.
- **Form aset** (`CreateAssetModal`, `EditAssetModal`): pemilihan lokasi dari **master aktif** (label = path lengkap "Induk - Anak"); opsi "Di luar master" mempertahankan teks bebas legacy. Saat master dipilih, teks `location` legacy ikut disinkronkan ke path master (satu field, tanpa duplikasi membingungkan; edit form menampilkan nilai nonaktif yang sudah melekat dengan label "(nonaktif)").
- **Daftar/detail aset**: nama lokasi master tampil (teks legacy ikut sinkron); detail aset menambah badge "Master Lokasi" bila terpetakan; aset legacy tanpa relasi menampilkan teks `location` lama apa adanya.

### Persistence
- **PostgreSQL**: `backfillNormalizedTables` meng-upsert `assets_locations` (sebelum `assets`, agar FK aman) dan kolom `asset_location_id` ikut INSERT/UPSERT `assets`; migration runner CR-04 menjalankan 008.
- **JSON fallback**: hydrate merge seed default + state (idempoten), `assetLocations` ikut di-serialize, backfill berjalan di seluruh jalur boot dengan log total/mapped/unresolved/preserved.

### Kompatibilitas legacy
- `assets.location` (teks bebas) **tetap ada** dan tidak dihapus; aset lama tanpa `asset_location_id` tetap terbaca di semua tampilan/API.
- Lokasi yang sudah direferensikan aset **tidak bisa dihapus permanen** lewat API (hanya nonaktif) → FK `ON DELETE SET NULL` sebagai jaring pengaman ekstra.
- `org_office_locations` (kantor user) tidak berubah sama sekali.

### Tidak berubah (scope guard T2B-2)
`owner_division`, `managing_unit_id` & logika backfill T2B-1, `asset_number`/`corporate_asset_number`/numbering engine & sequence table, taxonomy kategori, RBAC/authorization lintas divisi, Maintenance, Contract, Loan/Assignment, Helpdesk, Meeting Room, Vendor, KB, Procurement, workflow PIBC/Supply Chain, skema office location user.

### Tests / build / lint — hasil aktual
- `npm run lint` (`tsc --noEmit`): **PASS** (0 error)
- `npm run build` (vite + esbuild): **PASS**
- `npm run test:t2b2` (baru — `scripts/t2b2-asset-location-verify.mjs`): **22/22 PASS** — migration additive/idempotent (inspeksi statis + guard), CRUD master (create/rename/disable/enable, duplikat ditolak, self-parent & siklus 400), non-admin 403, auditor read-only, referensi valid diterima, tidak dikenal ditolak tanpa mengubah nilai, lokasi nonaktif ditolak untuk perubahan baru namun nilai historis dipertahankan, backfill tidak menebak (teks non-master → null), aset legacy tetap terbaca, owner_division/managing_unit_id/asset_number/corporate_asset_number tidak berubah oleh lokasi, JSON roundtrip lewat restart, backfill idempoten.
- Regresi: `test:t2b1` **18/18**, `test:org-model` **14/14**, `test:loan-authz` **37/37**, `test:meeting-room` **18/18**, `p0-security-verify` **37/37** — semua PASS.

Catatan: T2B-3/T2B-4 (lanjutan roadmap) serta redesign RBAC/Maintenance/Contract/Loan **belum** dikerjakan.

## [2026-10-08] — T2B-1 — Asset Ownership Core Model

### Ringkasan
Field baru **`managing_unit_id`** pada aset: unit operasional yang mengelola lifecycle aset (ownership/management, maintenance responsibility, scope pengelolaan), berelasi ke master **`org_units`** (hasil org-model refactor — tidak ada master unit baru). **`owner_division` tetap** sebagai legacy/canonical ownership domain (RBAC + numbering). Prinsip: Owner/Managing Unit ≠ Asset Location ≠ Custodian/PIC ≠ Category.

### Schema/model
- **`ServerAsset`** (`server/db.ts`) & **`Asset`** (`src/types.ts`): field baru opsional `managing_unit_id?: string | null` (relasi ke `org_units.id`).
- **Modul baru `server/managing-unit.ts`**: resolusi ownership-based (`resolveManagingUnitForOwnerDivision`), validasi master (`validateManagingUnit`, unit harus ada & aktif), dan normalisasi backfill idempoten (`normalizeAssetManagingUnits`).
- **Migration `server/migrations/007_asset_managing_unit.sql`** (additive & idempoten): `ALTER TABLE assets ADD COLUMN IF NOT EXISTS managing_unit_id VARCHAR(64) REFERENCES org_units(id) ON DELETE SET NULL` + index `idx_assets_managing_unit` + backfill. Tidak mengubah kolom lama apa pun; `ON DELETE SET NULL` aman terhadap data aset existing.
- **Backfill aman, berbasis OWNERSHIP (bukan lokasi)**: aturan deterministik — unit dengan id persis `UNIT-{DIVISION}` (SC → `UNIT-SC`, PIBC → `UNIT-PIBC`), selanjutnya tepat satu unit dengan `division_code` sama (IT → `UNIT-IT-MIS`), selain itu **dibiarkan NULL** (contoh: GA punya dua kandidat unit → unresolved, tidak ditebak). Nilai eksplisit tidak pernah ditimpa saat hydrate ulang.

### API
- `POST /api/assets` & `PATCH /api/assets/:id` menerima `managing_unit_id` (validasi: unit terdaftar & aktif, selain itu `400`); `GET /api/assets` & `GET /api/assets/:id` mengembalikannya. `null` eksplisit diterima (nullable).

### Persistence
- **PostgreSQL**: kolom `managing_unit_id` ikut di-INSERT/UPSERT pada `backfillNormalizedTables`; migration runner CR-04 menjalankan 007.
- **JSON fallback**: hydrate/serialize mempertahankan field (aset lama tanpa field di-backfill saat boot, aset baru selalu tersimpan); normalisasi berjalan di seluruh jalur boot.

### Tidak berubah (scope guard T2B-1)
`owner_division` & artinya, `asset_number`/`corporate_asset_number`/sequence table (numbering tetap `{DIV}-{CODE}-{YEAR}-{SEQ}`), taxonomy, RBAC/asset scope/authorization, `assets.location` (masih teks bebas), serta domain Maintenance, Contract, Loan/Assignment, Meeting Room, Helpdesk, Notification, Vendor, KB, Procurement.

### Tests / build / lint — hasil aktual
- `npm run lint` (`tsc --noEmit`): **PASS** (0 error)
- `npm run build` (vite + esbuild): **PASS**
- `npm run test:t2b1` (baru — `scripts/t2b1-managing-unit-verify.mjs`): **18/18 PASS** — create/update `managing_unit_id`, validasi referensi (unit tak dikenal/nonaktif → 400), backfill ownership, aset IT di lokasi PIBC tetap IT, asset number identik setelah restart/backfill, JSON roundtrip.
- Regresi: `test:org-model` **14/14**, `test:loan-authz` **37/37**, `test:meeting-room` **18/18**, `p0-security-verify` **37/37** — semua PASS.

Catatan: T2B-2 (Asset Location Master), redesign RBAC/maintenance/contract/loan, dan kompatibilitas numbering (T2B-4) **belum** dikerjakan.

## [2026-10-08] — Rombak Struktur Master Organisasi: Role ≠ Jabatan/Level ≠ Unit ≠ Lokasi

### Ringkasan
Role, Jabatan/Level, Unit, dan Lokasi/Kantor kini **empat master terpisah yang configurable**. Kombinasi role+jabatan+unit+lokasi disimpan sebagai **atribut user** — tidak membuat role kombinasi baru (tidak ada IT-PIBC/Kasi-GA/dll).

### Schema/model yang berubah
- **`ServerUser`** (`server/db.ts`, `src/types.ts`): field baru `job_level_code?`, `unit_id?`, `office_location_id?` — atribut independen dari role/division.
- **Master baru** (`server/db.ts`): `db.jobLevels: OrgJobLevel[]` (kode+label+order+is_active), `db.orgUnits: OrgUnit[]` (id+name+division_code+is_active), `db.officeLocations: OrgOfficeLocation[]` (id+name+is_active).
- Tipe interface baru: `OrgJobLevel`, `OrgUnit`, `OrgOfficeLocation`.
- **Model aset TIDAK berubah**: `owner_division` tetap IT/GA/SC/PIBC; `location` bebas; asset numbering `{DIV}-{CODE}-{YEAR}-{SEQ}` tetap berbasis owner.

### Migration
- **JSON/file store (`server/persistence.ts`)**: hydrate merge master default (5 jabatan, 9 unit, 5 lokasi kantor) dengan state lama secara idempoten; backfill user lama tanpa `job_level_code` → `STAF` **tanpa mengubah role/divisi**; `unit_id`/`office_location_id` referensi invalid → `null`. Data existing tetap terbaca.
- **PostgreSQL (`server/migrations/006_org_model_masters.sql`)**: tabel `org_job_levels`, `org_units` (FK divisions), `org_office_locations`; kolom users `job_level_code`/`unit_id`/`office_location_id` (FK) dengan backfill STAF; idempoten (`IF NOT EXISTS`/`ON CONFLICT DO NOTHING`). Dijalankan otomatis oleh migration runner CR-04.
- Seed master default: Jabatan = Direksi, Kepala Divisi, Kepala Departemen, Kepala Seksi, Staf; Lokasi = Kantor Pusat, PIBC, Kantor Perawatan, Kantor Pangsub, RPC/Supply Chain. **Tanpa mapping permanen level→lokasi** (contoh kondisi organisasi, bukan aturan sistem).

### API baru (Admin GABAH only; perubahan ter-audit)
- `GET/POST /api/master/job-levels`, `PATCH /api/master/job-levels/:code` (tambah/edit/enable/disable).
- `GET/POST /api/master/org-units`, `PATCH /api/master/org-units/:id`.
- `GET/POST /api/master/office-locations`, `PATCH /api/master/office-locations/:id`.
- `POST /api/users` & `PATCH /api/users/:id` kini menerima `job_level_code`/`unit_id`/`office_location_id` — divalidasi terhadap master aktif; assignment **tidak mengubah role/permission**.

### UI Admin (`AdministrationModal.tsx`)
- Section baru **"Jabatan, Unit & Lokasi"**: form tambah + toggle aktif/nonaktif untuk ketiga master.
- Form Edit User: dropdown Jabatan/Unit/Lokasi dengan catatan eksplisit bahwa atribut ini tidak mengubah permission, owner aset, atau asset number.
- `gabahApi.ts`: method `getJobLevels/createJobLevel/updateJobLevel`, `getOrgUnits/createOrgUnit/updateOrgUnit`, `getOfficeLocations/createOfficeLocation/updateOfficeLocation`.

### Business rules yang ditegaskan (tidak berubah)
- Jabatan/level **tidak** memberikan permission — RBAC tetap per role (user Karyawan berjabatan DIREKSI tetap 403 mutasi).
- Jabatan nonaktif tidak dapat diassign ke user (400), riwayat tetap terbaca.
- Lokasi penempatan tidak mengubah asset number; asset IT di PIBC tetap owner IT; asset GA di PIBC tetap owner GA.
- GA tetap hanya melihat PC/Laptop IT (read-only) sesuai RBAC; server/network tetap 403.
- Auditor tetap read-only (403 semua mutasi, termasuk master org).
- 9 role kanonikal tetap ada, nama tidak berubah.

### Test khusus baru: `npm run test:org-model` (`scripts/org-model-verify.mjs`)
14 asersi: 12 kasus wajib + 2 regresi (disabled jabatan tidak assignable; non-admin tidak bisa kelola master) — **14/14 PASS**.

### Hasil test aktual (2026-10-08)
| Check | Hasil |
|---|---|
| `npm run lint` | PASS 0 error |
| `npm run build` | PASS |
| `npm run test:org-model` (baru) | **14/14 PASS** |
| `npm run test:loan-authz` | **37/37 PASS** |
| `npm run test:meeting-room` | **18/18 PASS** |
| `node scripts/menu-connectivity-verify.mjs` | **23/23 PASS** |
| `node scripts/p0-security-verify.mjs` (regresi keamanan) | **37/37 PASS** |

## [2026-10-08] — UAT/RBAC Matrix Audit (9 Role) — verifikasi & perbaikan gap

### Context
- Audit RBAC/UAT atas implementasi terbaru di `main`. Basis audit awal: `1f94cb7`; selama audit remote `main` bertambah commit paralel (refactor matriks RBAC, scope vendor/contract/maintenance/asset) yang diintegrasikan. Perbaikan di bawah hanya untuk gap yang masih FAIL setelah integrasi.
- Scope: sidebar/menu per role, API authorization aset, helpdesk, maintenance, vendor, contract, meeting room, dan larangan mutasi Auditor. Tidak ada fitur baru di luar itu.

### Fixed — API authorization (root cause RBAC)
- **Meeting room** (`server.ts`): `POST /api/room-reservations` kini meneruskan `err.statusCode` dari domain service — penolakan override/interupsi (GA, Sekretaris Direksi non-HIGH, role lain) kini **403** dan proteksi rapat `in_use` kini **409** (sebelumnya selalu 400). Verifikasi: override ditolak 403 untuk GA/IT/Humas/SC/PIBC/Karyawan/Sekdir-LOW; Sekdir HIGH & Admin GABAH tetap bisa interupsi (201).
- **Maintenance** (`server.ts`): management action kini dibatasi **Admin GABAH, IT, GA** (server-side allowlist di `POST`/`PATCH /api/maintenances`, tetap per-scope divisi pemilik aset). Sebelumnya deny-list hanya Auditor/Karyawan sehingga SC/PIBC/Sekdir/Humas masih bisa create/update jadwal via API — kini 403.
- **Contract** (`server/contracts.ts`): `canEditContract` kini mensyaratkan peran manajemen kontrak (Admin GABAH, IT, GA, SC, PIBC). Sebelumnya Sekretaris Direksi/Humas (divisi GA) masih bisa **edit kontrak** dan **memutus renewal** kontrak divisi GA; kini ditolak (request/read-only).
- **Aset — mutasi lintas scope** (`server/services.ts`): `moveAsset()` & `mutateLifecycle()` kini memiliki guard otoritas divisi eksplisit (mirror `assignAsset`/PATCH): setiap divisi hanya boleh memutasi aset miliknya sendiri; Admin GABAH bebas. Sebelumnya **IT bisa merelokasi & memutasi lifecycle aset GA** karena view scope IT mencakup aset GA — view kini tidak lagi memperluas hak mutasi.
- **Lint** (`server/services.ts`, `src/components/views/MaintenanceView.tsx`): memperbaiki error kompilasi (`asset.asset_code` tidak ada di tipe `ServerAsset`; referensi `isStaff` yang sudah dihapus). `npm run lint` kini 0 error.

### Fixed — Test fixture (bukan assertion)
- `scripts/meeting-room-stage3-verify.mjs`: booking `Stage3 running` dan `Stage3 running interrupt` dipindah ke slot 13:00-14:00. Slot 10:00-11:00 ROOM-01 sudah terisi booking VIP Direksi (approved), sehingga skenario rapat berjalan (`in_use`) tidak pernah dapat dicapai dan 6 assertion hilir (checkin/approve/checkout/409) gagal berantai. Semua assertion dan nilainya tidak diubah.

### Verification status — AKTUAL (2026-10-08)
- `npm ci` — OK.
- `npm run lint` (tsc --noEmit) — PASS, 0 error (sebelum perbaikan: FAIL 2 error).
- `npm run build` — PASS.
- `npm run test:loan-authz` — **37/37 PASS**.
- `npm run test:meeting-room` — **18/18 PASS** (sebelum perbaikan: 10/18).
- `node scripts/menu-connectivity-verify.mjs` — **23/23 PASS**.
- Probe RBAC lintas 9 role (sementara, tidak di-commit) — **60/60 sesuai matriks**: sidebar per role sesuai RBAC.md; aset (GA read-only PC/Laptop IT, mutasi lintas divisi ditolak, Auditor read-only semua); vendor (IT=IT/License, GA=non-IT, Admin full); kontrak (Admin/IT/GA/SC/PIBC sesuai owner; Sekdir/Humas/Karyawan/Auditor tidak bisa create/edit/renewal); maintenance (hanya Admin/IT/GA); meeting room (override hanya Admin GABAH & Sekdir HIGH); Auditor 403 untuk semua mutasi API; helpdesk kategori hanya IT/GA/SC/PIBC (400 untuk kategori lain).

---

## [2026-10-08] — RBAC Matrix Refactor: Role × Menu × Scope

### Changed
- Sidebar/menu structure aligned to the current 9-role business matrix:
  - Admin GABAH: full application + Administration Control Panel.
  - IT: Aset, Pinjam, Helpdesk, Maintenance, License/Software, Vendor IT/License, KB, Contract IT, Meeting Room IT facilities, Reports.
  - GA: Aset GA + read-only PC/Laptop IT, Pinjam, Helpdesk, Maintenance, Vendor non-IT, KB, Contract GA, Meeting Room Sarpras, Reports.
  - Sekretaris Direksi: Dashboard, Aset Saya, Pinjam, Helpdesk, Maintenance request flow, Knowledge Base read, Contract view, Meeting Room/VIP workflow.
  - Humas: Dashboard, Aset Saya hidden from catalog, Pinjam, Helpdesk, Knowledge Base read, Meeting Room + documentation/photo workflow.
  - Supply Chain / PIBC: operational asset scope, Pinjam request, Helpdesk category scope, Maintenance request, Knowledge Base read, Contract scope, Meeting Room request, scoped Reports.
  - Karyawan: self-service Dashboard, Aset Saya, Pinjam, Helpdesk, Knowledge Base, Meeting Room request; no executive override.
  - Auditor: read-only global access; no mutation/admin menu.
- Asset ownership vs location separated in access rules: physical location no longer determines ownership.
- IT asset visibility: IT manages IT assets; GA may only view IT workstation assets (PC/Laptop) read-only, not servers/network/firewall/other IT equipment.
- SC/PIBC asset visibility: scope now considers their operational owner and relevant physical location/department where available.
- Asset edit buttons: frontend now uses the same authoritative GabahService.canEditAsset() rule as the intended role/object scope; PIBC edit authority is represented consistently.
- Maintenance: menu renamed to Maintenance; schedule creation is limited to Admin GABAH, IT, and GA. Other operational/request roles do not receive the management action.
- Vendor: IT can manage IT/License vendors; GA can manage non-IT vendors; Admin GABAH full; Auditor read-only. API GET/POST/PATCH now enforce the same domain scope.
- Contract: management/create action is exposed only to Admin GABAH, IT, GA, Supply Chain, and PIBC; Auditor and request/read-only roles remain read-only.
- Helpdesk remains a single menu with categories/routing IT, GA, SC, PIBC. Contract is not a Helpdesk category; Software/License/SaaS remains IT.

### Verification
- Changes are committed directly to GitHub main in small atomic commits so Freebuff can test each scope without a large token-consuming task.
- Freebuff/UAT is required next to verify all 9 roles at both UI-menu and API authorization layers.
- Do not treat menu visibility alone as authorization proof; test representative API actions for each role.

---

## [2026-10-08] — Session Restore Fix & Stage 3 Test Follow-up

### Fixed
- **Session restore no longer waits for bulk data loading** (`src/App.tsx`): initial authentication now completes independently from the best-effort `refreshData()` call, so a slow/hung API endpoint cannot keep the UI trapped on **"Memulihkan sesi…"**.
- The existing `/api/auth/me` 10-second timeout remains in place for stale/hung session validation.

### Stage 3
- Latest regression fixture adjustment is recorded at commit `1f94cb7` (`test: align meeting room alternative fixture capacity`).
- Browser/UAT testing is still required after the latest meeting-room hardening; automated verification must be run locally and its actual PASS/FAIL result recorded.

## [2026-10-07] — Tahap 3: Meeting Room Hardening & Regression
- Server-side interruption: only Admin GABAH or Sekretaris Direksi with HIGH priority; GA cannot interrupt.
- Running (`in_use`) meetings cannot be interrupted; alternative-room capacity uses the new agenda's attendee count.
- VIP auto-approval is limited to Admin GABAH and Sekretaris Direksi; ordinary GA requests require approval.
- Added server-side lifecycle/authorization guards for approve, reject, check-in, check-out, and cancel.
- Meeting endpoints now preserve 403/409 status codes from the domain service.
- Added `ROOM_RESERVATION_OVERRIDE_DENIED` audit action.
- Added `scripts/meeting-room-stage3-verify.mjs` and `npm run test:meeting-room`.

### Verification status — AKTUAL
- Pre-change audit: GitHub `main` HEAD `2aaec09425bba27f270f9f2a77c1046618df9b9ad`.
- Build/test were **not executable from the ChatGPT runtime** because the private repository cannot be cloned/resolved there. No unexecuted PASS result is claimed.
- After `git pull` on the laptop run: `npm install`, `npm run lint`, `npm run build`, `npm run test:meeting-room`, `npm run test:loan-authz`, and `node scripts/menu-connectivity-verify.mjs`.


Portal Aset & Helpdesk PT Food Station Tjipinang Jaya (BUMD DKI Jakarta).

Format mengikuti [Keep a Changelog](https://keepachangelog.com/) — dicatat per tanggal kerja,
bukan per versi rilis. Catatan ini ditulis agar manusia maupun AI lain bisa memahami
apa yang sudah dikerjakan, di mana kodenya, dan bagaimana memverifikasinya.

> Cara membaca: setiap entri berisi ringkasan fitur, lokasi implementasi (file + endpoint),
> dan skrip verifikasi yang membuktikannya. Semua skrip verifikasi membutuhkan
> `npm run build` terlebih dahulu karena mereka men-boot `dist/server.cjs`.

---

## [2026-10-07] — P1: Self-service & CRUD Vendor/KB + Jejak Mutasi Aset

### Added
- **P1-3 — Ganti kata sandi mandiri** (semua peran):
  - Endpoint `POST /api/auth/change-password` (`server.ts`, setelah endpoint logout).
    Validasi: sandi lama harus cocok (`verifyPassword`, PBKDF2 via `server/crypto.ts`),
    sandi baru min. 8 karakter, tidak boleh sama dengan yang lama.
    Setelah sukses: `revokeUserSessions()` untuk semua sesi, lalu sesi baru dibuat
    khusus perangkat pemanggil → respons `{ user, token, expires_at }`.
    Audit: `USER_PASSWORD_SELF_CHANGED` via `GabahDomainService.recordAudit`.
  - `gabahApi.changePassword()` (`src/services/gabahApi.ts`) — otomatis `setToken`
    dari respons, jadi pengguna tidak perlu login ulang.
  - Modal baru `src/components/modals/ChangePasswordModal.tsx`: strength meter
    4 level, show/hide sandi, konfirmasi sandi kedua.
  - Tombol **"Ganti Kata Sandi"** di dropdown profil `HeaderNavbar.tsx`
    (prop `onChangePassword`, ikon `KeyRound`).
- **P1-1 — CRUD Vendor penuh** (peran: Admin GABAH, GA):
  - `src/components/views/VendorsView.tsx` ditulis ulang: tombol **Tambah Vendor**,
    tombol **Edit** per kartu, modal form (nama, kontak, email, telepon, kategori,
    rating, status, catatan). Role-gate via `canManage`.
  - Handler `handleCreateVendor` / `handleUpdateVendor` di `src/App.tsx`.
  - Endpoint sudah ada sebelumnya (`server.ts` ~1535–1585) dengan role-guard 403
    dan allowlist field PATCH (CR-06).
- **P1-2 — Penulisan artikel Knowledge Base** (peran: Admin GABAH, IT, GA):
  - `src/components/views/KnowledgeBaseView.tsx` ditulis ulang: tombol **Tulis Artikel**,
    **Edit** di tampilan detail, editor textarea dengan format ringan
    (`##` heading, `-` list, `**tebal**`, `` `kode` ``), tags dipisah koma,
    kategori Policy/IT/GA. Role-gate per kategori.
  - Handler di `App.tsx` dengan cast `as KnowledgeArticle['category']`.
  - Endpoint CRUD sudah ada (`server.ts` ~1587–1650) dgn role-guard & allowlist.
- **P1-4 — Riwayat mutasi aset terlihat di UI**:
  - `App.tsx`: state `movements` + fetch `gabahApi.getMovements()` di `refreshData`
    (Promise.all), diteruskan sebagai `assetMovements` ke `AssetDetailModal`.
  - `AssetDetailModal.tsx`: timeline tab *history* kini menampilkan entri `kind: 'movement'`
    (warna amber, ikon Truck) — mutasi lokasi/pengguna/status aset.
  - Endpoint `GET /api/movements` mendukung `?assetId=` untuk filter per aset.
- **Import massal aset via CSV** (peran IT, GA, Supply Chain, PIBC, Admin GABAH):
  - Endpoint `POST /api/assets/bulk-import` (`server.ts` ~1142) — setiap baris diproses
    individual via `GabahDomainService.createAsset` sehingga resolusi taxonomi kategori,
    authority divisi, deteksi duplikat SN/No. Accurate, dan **penomoran aset resmi**
    tetap server-authoritative. Maks 500 baris. Satu baris buruk tidak menggagalkan batch.
  - Upsert opsional `allow_update: true` → baris dengan Serial Number / Nomor Accurate
    yang sudah terdaftar DIPERBARUI (allowlist identik dengan PATCH /api/assets/:id,
    CR-06) — `asset_number` & `owner_division` tetap server-owned.
  - Perbaikan middleware `server/runtime-hardening.ts`: path `/api/assets/bulk-import`
    tidak lagi dianggap asset id oleh scope-guard (sebelumnya 403).
  - API client `gabahApi.bulkImportAssets(rows, allowUpdate)`.
  - Parser + template CSV di `gabahService.ts`: `parseAssetsImportCsv()` (header
    Indonesia, kondisi `baik/rusak/...` dipetakan ke `good/broken/...`) dan
    `downloadAssetsImportTemplate()`.
  - Modal baru `src/components/modals/AssetImportModal.tsx`: pilih file, unduh template,
    preview tabel, checkbox upsert, ringkasan hasil (Baru/Diperbarui/Gagal + daftar
    error/warning). Tombol **Import CSV** di toolbar `AssetsView.tsx` (prop
    `onOpenImportModal`) untuk peran yang berwenang.
  - Audit: `ASSET_BULK_CREATED` / `ASSET_BULK_UPDATED` via `recordAudit`.
- **Skrip verifikasi** `scripts/asset-import-verify.mjs` — 20 tes end-to-end:
  anonim 401, batch kosong/oversize 400, created=2 + failed=1 (baris tanpa nama),
  nomor aset `IT-HLT-*` & `GA-INV-F-*` otomatis, kondisi tak dikenal → warning,
  harga & is_loanable tersimpan, duplikat SN ditolak, `allow_update` memperbarui,
  duplikat SN dalam satu berkas ditolak, authority per baris (IT impor kendaraan SC
  → row error), Karyawan → 403.
- **Skrip verifikasi** `scripts/p1-features-verify.mjs` — 16 tes end-to-end:
  anonim 401, sandi lama salah 401, sandi baru pendek 400, sukses + token baru,
  token lama mati 401, token baru hidup 200, login sandi lama ditolak / baru berhasil,
  vendor role-guard 403 + create 201 + update rating, KB create/update,
  assign aset → entry movement tercatat.

### Fixed
- **Layar "Memulihkan sesi…" mengurung pengguna** (`src/App.tsx` `initAuth`): bila
  request `/api/auth/me` menggantung (mis. dev server restart via tsx watch di
  tengah request — koneksi yatim), pengguna terjebak di loading tanpa batas.
  Kini `getMe()` di-race dengan timeout 10 detik → token dibersihkan dan pengguna
  diantar ke halaman login; jalur exception juga kini dijamin mendarat di login.

### Changed
- `docs/ops/OFFICE-VM-RUNBOOK.md` — menghapus referensi hash commit basi `dbedf08`.

### Catatan penting untuk AI/skrip berikutnya
- Bug environment: `.env.local` (berisi `GABAH_TEST_PASSWORD`) ter-load otomatis ke
  semua proses terminal. Skrip verify **harus** menetralisir env saat spawn
  (`GABAH_TEST_PASSWORD: ''`) dan men-set `GABAH_INITIAL_ADMIN_PASSWORD` **dan**
  `GABAH_INITIAL_USER_PASSWORD` terpisah — user non-admin tidak ikut sandi boot admin.
  Patch ini sudah ada di `p1-features-verify.mjs`, `bulk-import-verify.mjs`,
  `menu-connectivity-verify.mjs`.
- Verifikasi: `tsc --noEmit` 0 error; `npm run build` pass; **16/16 PASS** (exit 0);
  asset-import **20/20 PASS**; regresi menu-connectivity **23/23**, bulk-import users
  **14/14** setelah perubahan middleware.
- Catatan domain: furniture INV-F **sengaja** dapat dibuat peran mana pun
  (otomatis jadi milik GA) — konsisten dengan alur create aset tunggal.

---

## [2026-10-05] — Import massal, laporan, kredensial UAT, runbook

### Added
- **Import massal pegawai via CSV**: endpoint `POST /api/users/bulk-import`
  (`server.ts` ~97–230) — maks 500 baris, upsert by email, password CSPRNG
  (tidak pernah di-echo ke respons), peran dibatasi ke whitelist.
  Skrip verifikasi `scripts/bulk-import-verify.mjs` — **14/14 PASS**.
- **Laporan dengan filter divisi/departemen + export** (`ReportsView.tsx`):
  filter divisi & departemen pada laporan, tab **Rekap Divisi**, tombol
  **Cetak PDF** (window.print). Export CSV untuk aset, peminjaman, tiket,
  dan pemeliharaan.
- **Skrip audit menu** `scripts/menu-connectivity-verify.mjs` — 23 cek koneksi
  menu ↔ data ↔ endpoint, RBAC 9 peran: **23/23 PASS**.
- **Runbook setup dev lokal** `docs/ops/LOCAL-DEV-RUNBOOK.md`: Node 20+ & Git
  wajib, Docker opsional, penjelasan `GABAH_TEST_PASSWORD`, `docker compose up -d
  database`, alur sinkronisasi via git push/pull.

### Changed
- Kredensial UAT: 10 akun kanonik `@foodstation.co.id` memakai satu sandi UAT
  yang diset via `GABAH_TEST_PASSWORD` (non-produksi saja). Urutan provisioning
  (`server/persistence.ts`): `GABAH_TEST_PASSWORD` > `GABAH_INITIAL_ADMIN_PASSWORD` /
  `GABAH_INITIAL_USER_PASSWORD` > CSPRNG acak. *Never clobber*: hash yang sudah ada
  tidak pernah ditimpa ulang saat boot. Dev lokal menulis
  `server/data/initial_credentials_dev.txt` (gitignored).
- Perbaikan alur login UAT (akun admin & non-admin).

### Security (dilanjutkan dari hardening 2026-09-22, tag `backup/security-hardening-20260922`)
- Rate limiting per-IP+route dengan header `X-RateLimit-*` (`server/auth.ts`,
  `server/runtime-hardening.ts`).
- Sesi in-memory 7 hari (`SESSION_DURATION_MS`); reboot server = semua sesi logout
  (disengaja, epoch security).
- `revokeUserSessions()` dipanggil saat reset sandi admin & ganti sandi mandiri.
- Audit log terpusat via `GabahDomainService.recordAudit(...)`.
- Allowlist field pada semua endpoint PATCH (CR-06).

---

## Roadmap / Keputusan tertunda

| Item | Prioritas | Status |
|---|---|---|
| PostgreSQL produksi (Tiger Cloud) — ganti fallback file-store | P0 | **Menunggu `DATABASE_URL` dari user** |
| Notifikasi email / Telegram (CR-05) | P2 | **Ditunda** sampai aplikasi ready 100% |
| Lampiran dokumen pada tiket/aset | P2 | Belum mulai |
| Custom fields aset | P2 | Belum mulai |

### Kredensial UAT (non-produksi)
Semua akun kanonik domain `@foodstation.co.id` memakai sandi yang sama, diset lewat
env `GABAH_TEST_PASSWORD` (lihat `.env.local` / mekanisme Keys milik platform).
Akun: `admin@`, `it.support@`, `ga@`, `sc.warehouse@`, `pibc.admin@`,
`sekretariat.direksi@`, `humas@`, `auditor@`, `karyawan@` (+ domain admin).
**Wajib** diganti di produksi via `GABAH_INITIAL_ADMIN_PASSWORD` /
`GABAH_INITIAL_USER_PASSWORD`.

## [2026-10-14]  Perbaikan Menu RBAC Sidebar

### Ringkasan
Perbaikan ketidaksesuaian menu Sidebar dengan RBAC matrix yang terdefinisi di server-side.
Menu kini sepenuhnya sinkron dengan izin akses yang dimiliki masing-masing role.

### Perubahan Menu

#### 1. Aset (Assets)  Tambah Sekretaris Direksi & Humas
- **Sebelum**: Hanya Admin GABAH, IT, GA, Supply Chain, PIBC, Auditor
- **Sesudah**: Tambah Sekretaris Direksi & Humas
- **Alasan**: Kedua role ini seharusnya bisa lihat aset assigned/loanable sesuai scope (read-only)

#### 2. Vendor Rekanan  Tambah Supply Chain & PIBC
- **Sebelum**: Hanya Admin GABAH, IT, GA, Auditor
- **Sesudah**: Tambah Supply Chain & PIBC
- **Alasan**: SC & PIBC perlu akses vendor untuk kontrak di divisinya

#### 3. Contract Management  Tetap tanpa Sekretaris Direksi & Humas
- **Keputusan**: Menu Contract Management **tidak ditampilkan** untuk Sekretaris Direksi & Humas
- **Alasan**: Kedua role ini **tidak punya izin** untuk manage kontrak (canManageContracts = false)
- **Catatan**: Jika diperlukan read-only, perlu penambahan logic server-side

### Server-Side RBAC Konsistensi
- `canManageContracts()`: Hanya Admin GABAH, IT, GA, Supply Chain, PIBC
- `canSeeContract()`: Admin, Auditor, PIC, owner division, atau non-restricted (org-wide)
- `canSeeAsset()`: Setiap role punya scope sesuai divisinya

### Tests / Verifikasi
- `npm run lint`: **PASS** (0 error)
- `npm run build`: **PASS**
- Menu connectivity: Semua menu yang ditampilkan kini punya backing RBAC di server

### Catatan
Perbaikan ini memastikan **konsistensi UI vs Server**: user tidak akan melihat menu
yang tidak bisa diakses di server-side. Menu yang muncul = menu yang berfungsi.

### Cara menjalankan verifikasi (lokal)
```bash
npm install
npm run build
node scripts/menu-connectivity-verify.mjs   # 23 cek menu & RBAC
node scripts/bulk-import-verify.mjs         # 14 tes import CSV
node scripts/p1-features-verify.mjs         # 16 tes fitur P1
node scripts/asset-import-verify.mjs        # 20 tes import aset
```
Skrip boot `dist/server.cjs` di port acak 39000+, backup/restore state file,
dan self-terminating (aman dijalankan berulang).

## [2026-10-15] \u0014 Vendor RBAC Fix: SC & PIBC Access + Contract Menu for Sekdir/Humas

### Ringkasan
Perbaikan ketidaksesuaian menu Vendor dengan server-side RBAC untuk Supply Chain dan PIBC, serta penambahan menu Contract Management untuk Sekretaris Direksi & Humas (read-only).

### Root Cause
- Sidebar menampilkan menu Vendor untuk SC & PIBC, tetapi GET /api/vendors hanya mengizinkan Admin GABAH, IT, GA, Auditor
- SC & PIBC mendapatkan 403 saat mengakses menu Vendor
- Sekretaris Direksi & Humas tidak bisa melihat menu Contract Management, padahal punya akses read-only

### Perubahan

#### 1. Vendor API RBAC (`server.ts`)
- **GET /api/vendors**: Tambah SC & PIBC ke allowed roles - kini dapat melihat semua vendor
- **POST /api/vendors**: Tambah SC & PIBC ke allowed roles - kini dapat membuat vendor
- **PATCH /api/vendors/:id**: Tambah SC & PIBC ke allowed roles - kini dapat update vendor

#### 2. Contract Management Menu (`Sidebar.tsx`)
- **Tambah**: Sekretaris Direksi & Humas ke roles
- **Alasan**: Kedua role punya akses read-only via `canSeeContract()` (non-restricted contracts visible org-wide)

### Server-Side RBAC Rules
- `canManageContracts()`: Admin GABAH, IT, GA, Supply Chain, PIBC
- `canSeeContract()`: Admin, Auditor, PIC, owner division, atau non-restricted (org-wide)
- `canSeeAsset()`: GA hanya bisa lihat aset IT yang merupakan workstation (Laptop/PC) via `isItWorkstation()`

### Dampak
- SC & PIBC **SEKARANG DAPAT** mengakses menu Vendor dan semua API vendor
- Sekretaris Direksi & Humas **SEKARANG DAPAT** melihat menu Contract Management (read-only)
- Menu visibility **SEKARANG KONSISTEN** dengan server-side RBAC

### Files Changed
- `server.ts`: Vendor endpoint RBAC (GET, POST, PATCH)
- `src/components/Sidebar.tsx`: Contract Management menu roles

---

## [2026-10-15] \u0014 CR-04: Fix PostgreSQL Contract Persistence

### Ringkasan
Perbaikan migrasi 001 dan 004 untuk memastikan skema `contracts` sepenuhnya kompatibel dengan Contract Management domain.
Migrasi 001 sekarang menggunakan `owner_division VARCHAR(50)` (bukan `owner_division_id BIGINT`), dan migrasi 004
menghapus referensi ke kolom legacy yang menyebabkan error "column owner_division does not exist".

### Root Cause CR-04
- Migrasi 001 membuat tabel `contracts` dengan kolom `owner_division_id BIGINT REFERENCES divisions(id)`
- Migrasi 004 mencoba membuat index `idx_contracts_owner ON contracts(owner_division, pic_user_id)`
- Kolom `owner_division` TIDAK ADA di migrasi 001 \u2192 error saat migrasi 004 \u2192 PostgreSQL gagal \u2192 fallback ke JSON

### Perubahan

#### 1. Migrasi 001 (`server/migrations/001_gabah_normalized_schema.sql`)
- **Sebelum**: `owner_division_id BIGINT REFERENCES divisions(id)`
- **Sesudah**: `owner_division VARCHAR(50) NOT NULL`
- **Alasan**: Contract Management domain menggunakan division code (VARCHAR), bukan FK BIGINT

#### 2. Migrasi 004 (`server/migrations/004_contract_management.sql`)
- **Dihapus**: `CREATE INDEX IF NOT EXISTS idx_contracts_legacy_owner_div ON contracts(owner_division_id)`
- **Dihapus**: Referensi ke `owner_division_id` yang menyebabkan conflict

#### 3. Index Tambahan di Migrasi 001
- **Ditambahkan**: `CREATE INDEX IF NOT EXISTS idx_contracts_owner ON contracts(owner_division)`
- **Tujuan**: Optimasi query filtering kontrak by division

### Dampak
- Migrasi 001 dan 004 kini **idempoten** dan **kompatibel**
- Tabel `contracts` punya kolom `owner_division VARCHAR(50)` yang benar
- Index `idx_contracts_owner` menggunakan kolom yang ada
- PostgreSQL persistence untuk kontrak **SEKARANG BISA BERJALAN**

### Testing
- Migrasi berjalan di fresh DB: \u2705 PASS
- Migrasi berjalan di legacy DB (dari 001 lama): \u2705 PASS (ALTER TABLE idempoten)
- Index contracts created: \u2705 PASS

### Catatan
Perbaikan ini memastikan bahwa:
1. Skema contracts di migrasi 001 sudah benar (VARCHAR owner_division)
2. Migrasi 004 tidak mencoba membuat index dengan kolom yang tidak ada
3. Data kontrak bisa disimpan di PostgreSQL, bukan hanya di JSON

## [2026-10-15] — SEC-07: Anti Double-Booking Room Reservations

### Ringkasan
Perbaikan race condition double-booking ruangan dengan menambahkan tabel PostgreSQL
untuk room_reservations dan constraint EXCLUDE dengan tstzrange.

### Root Cause SEC-07
- Collision check saat ini hanya **in-memory** di services.ts
- Pada concurrent requests, dua user bisa sama-sama lolos check dan melakukan double-booking
- Tidak ada constraint database level untuk mencegah overlapping reservations

### Perubahan

#### 1. Migrasi SEC-07 (awalnya `server/migrations/010_room_reservations.sql`; sekarang `015_room_reservations.sql` untuk menghindari kolisi versi dengan `010_dynamic_rbac_foundation.sql` pada migration runner)
- **Buat tabel room_reservations** di PostgreSQL (sebelumnya hanya di JSON)
- **Tambah EXCLUDE constraint** dengan tstzrange untuk mencegah overlapping
- **Tambah btree_gist extension** untuk support tstzrange
- **Tambah trigger** untuk validasi tambahan
- **Tambah indexes** untuk query performance

#### 2. Code Documentation (`server/services.ts`)
- Tambah komentar bahwa DB-level constraint menyediakan authoritative protection

### Dampak
- Double-booking **TIDAK LAGI MUNGKIN** meskipun ada concurrent requests
- Data reservasi ruangan **SEKARANG DI POSTGRESQL** (bukan hanya JSON)

## [2026-10-15] — SEC-08: Real Contract Document Upload

### Ringkasan
Implementasi file upload yang benar-benar menyimpan file (bukan hanya metadata string).

### Root Cause SEC-08
- Endpoint `/api/contracts/:id/documents` hanya menyimpan `file_name` + `file_ref` string
- Tidak ada validasi file yang benar
- Tidak ada batasan ukuran file
- Tidak ada penyimpanan file yang sesungguhnya

### Perubahan

#### 1. Dependency (`package.json`)
- **Tambah multer**: `multer@^1.4.5-lts.1` untuk multipart/form-data handling
- **Tambah @types/multer**: untuk TypeScript support

#### 2. New Endpoint (`server.ts`)
- **`POST /api/contracts/:id/documents/upload`**:
  - Gunakan multer middleware
  - File size limit: **10MB**
  - MIME type validation: **PDF, JPG, PNG, DOC, DOCX**
  - Filename sanitization
  - RBAC validation via `canEditContract()`

#### 3. Data Model (`server/db.ts`)
- **Extend ServerContractDocument**: tambah `file_size` dan `file_mime`

#### 4. Contract Service (`server/contracts.ts`)
- **Expose canEditContract**: untuk validasi RBAC

### Dampak
- Dokumen kontrak **SEKARANG BENAR-BENAR DIUPLOAD**
- Validasi file yang ketat mencegah upload file berbahaya

## [2026-10-14] — Perbaikan Menu RBAC Sidebar