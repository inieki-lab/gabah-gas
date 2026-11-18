# GABAH — Audit Baseline Dynamic RBAC & UI Synchronization

Tanggal: 16 November 2026
Basis audit: `preview/green-enterprise-theme-laptop`
Branch tindak lanjut: `audit/dynamic-rbac-full-sync`
Status: audit awal terverifikasi; bukan sertifikasi keamanan final.

## Keputusan arsitektur yang wajib dipertahankan

GABAH memakai Dynamic RBAC sebagai satu-satunya sumber otorisasi produksi. Permission tidak diturunkan otomatis dari jabatan, unit organisasi, divisi, atau lokasi kerja. Role adalah paket permission dan scope yang dapat dibuat/diubah/dinonaktifkan Super Admin. User dapat menerima beberapa role/capability. Jabatan, unit, office location, owner domain, lokasi fisik aset, dan custodian adalah atribut terpisah.

Lokasi RPC/SC dan PIBC bukan role. Nama jabatan seperti Direksi/Kadiv/Kadep/Kasi/Staf bukan role. Sekretariat Direksi, Humas, Admin ME, IT Support, GA Helpdesk, Asset Operator, Approver, dan Ticket Dispatcher harus dimodelkan sebagai role/capability dinamis yang dapat diberikan sesuai kebutuhan—bukan hard-coded sebagai persona wajib.

Role Super Admin adalah pengecualian tata kelola yang dilindungi: akses administrasi global hanya berasal dari role yang ditandai `is_superadmin` di database dan harus tetap melindungi Super Admin aktif terakhir. Auditor read-only merupakan kebijakan deny-write eksplisit yang harus diuji pada semua endpoint mutasi.

## Temuan kode terverifikasi

### P0 — Frontend masih terikat pada label role lama

- `src/types.ts`: `UserRole` masih union statis sembilan label. Ini membuat identitas user dan katalog role dinamis tidak sepenuhnya terpisah di tipe frontend.
- `src/navigation/roleNavigation.ts`: masih ada `ROLE_NAVIGATION` statis dan fungsi navigasi mensyaratkan `role` tidak null sebelum memeriksa `permissionKeys`. Pada PostgreSQL, permission seharusnya menjadi penentu menu; label role tidak boleh menjadi prasyarat.
- `src/components/Sidebar.tsx`: pengelompokan menu, label dashboard, status staf, dan badge masih memakai `activeRole === 'IT'/'GA'/'Humas'/'Sekretaris Direksi'` serta daftar label legacy. Ini perlu diganti dengan metadata menu dan permission/capability efektif.
- `src/App.tsx`: tab awal dan validasi tab aktif harus sepenuhnya diturunkan dari permission efektif dan modul aktif; tidak boleh mengandalkan role primer untuk memilih landing page.
- `src/components/modals/AdministrationModal.tsx`: masih memiliki `SYSTEM_ROLES`, `DEFAULT_PERMISSIONS`, dan `PRIMARY_PROFILE_ROLES` statis. UI administrasi role harus mengambil katalog role, permission, scope, dan assignment dari API PostgreSQL; tidak boleh menawarkan matriks otorisasi hard-coded sebagai sumber kebenaran.

### P0 — Backend masih membawa jalur kompatibilitas berbasis role

- `server/services.ts`: `LEGACY_SCOPED_ROLES` dan beberapa cabang `actor.role === ...` masih ada. Setiap jalur tersebut harus dipastikan hanya aktif pada mode file-store non-produksi; PostgreSQL harus menolak akses tanpa permission dan scope eksplisit.
- `server/runtime-hardening.ts`: sebagian policy sudah memakai Dynamic RBAC untuk tiket/aset/attention, tetapi seluruh endpoint dan resolver detail harus diaudit agar list, detail-by-ID, pencarian, export, dashboard, agregasi, dan mutasi menggunakan policy resolver yang sama.
- `server/rbac-policy.ts`: policy cache memuat role, permission, dan scope dari PostgreSQL. Perlu pengujian cache invalidation, assignment multi-role, role nonaktif, user nonaktif, permission nonaktif, scope module-specific, dan restart.
- `server.ts`: seluruh route perlu inventory endpoint-by-endpoint; middleware global saja tidak membuktikan semua operasi domain telah memakai permission + scope yang tepat.

### P1 — Tema saat ini hanya lapisan override parsial

- `src/index.css` sudah memuat token hijau, tetapi pendekatannya banyak meng-override utility Tailwind tertentu (`bg-slate-50`, `text-slate-900`, `bg-emerald-600`, dan lainnya). Itu tidak menjamin konsistensi untuk seluruh komponen yang memakai warna hard-coded lain.
- Tema tidak boleh dibangun dengan mengganti seluruh aplikasi atau menambahkan dependensi besar. Pertahankan modul, alur, tabel padat, form, modal, dan perilaku GABAH; bangun design tokens dan komponen shell konsisten lalu migrasikan halaman secara bertahap.

## Target sinkronisasi yang harus dicapai

1. Database PostgreSQL adalah sumber tunggal role templates, permissions, scopes, user-role assignments, dan module lifecycle.
2. Jabatan/unit/lokasi hanya atribut organisasi; tidak ada grant implisit atau fallback berdasarkan atribut tersebut.
3. Sidebar dan submenu hanya tampil berdasarkan permission efektif, scope yang relevan, dan status modul aktif.
4. Route/halaman langsung tanpa menu tetap harus memeriksa izin; akses ditolak jika tidak ada permission.
5. Tombol, aksi, form create/edit/approve/delete/export mengikuti permission masing-masing, tetapi enforcement tetap di backend.
6. Landing page ditentukan dari halaman aktif pertama yang diizinkan; user tanpa permission mendapat halaman akses terbatas yang informatif, bukan Dashboard default.
7. Label dashboard dan kelompok menu tidak boleh menebak jabatan/role. Gunakan label produk netral atau metadata capability.
8. Assignment multi-role bersifat additive, transaksional, diaudit, dan tidak hilang saat rekonsiliasi/restart.
9. Scope data konsisten antara list, detail, relasi, pencarian, export, dashboard, KPI, notifikasi, dan laporan.
10. Uji positif dan negatif untuk setiap modul: tanpa permission, permission tanpa scope, scope tanpa permission, scope lintas modul, role nonaktif, user nonaktif, multi-role, Auditor, dan Super Admin.

## Matriks audit wajib per modul

Untuk setiap modul yang ditemukan di `App.tsx`, Sidebar, API client, dan backend:
- Menu dan submenu
- Route/page direct access
- Dashboard/widget/count/notification
- List/search/filter/sort/export
- Detail dan relasi record
- Create/update/delete
- Approve/reject/assign/close/handover
- Attachment/upload/download
- Scope per record dan owner domain
- Module lifecycle active/inactive
- Audit log dan regression tests

Modul awal yang harus dicakup: Dashboard, Aset Saya, Inventaris, Mutasi, Peminjaman, Helpdesk/Tiket, Maintenance, Lisensi, Vendor, Kontrak, Ruang Rapat/Reservasi, Knowledge Base, Laporan, User Administration, Dynamic RBAC, Organization Masters, Master Data, Numbering, Notification Rules, Audit Log, Settings, Data Administration, Health, dan Module Lifecycle.

## Tema visual yang dipilih untuk evaluasi

Evaluasi pola visual Shadcn Dashboard / Tailwind Admin yang berlisensi MIT sebagai referensi layout dan komponen, bukan mengganti aplikasi GABAH. Pilihan awal: enterprise workspace modern, hijau Food Station yang lebih matang, sidebar collapsible, header ringkas, typography tegas, tabel profesional, status badges semantik, form konsisten, dan dukungan layar laptop. Semua data dan aksi tetap menggunakan API GABAH yang ada.

## Gate sebelum UAT/merge

- Tidak ada akses produksi yang bergantung pada label role lama.
- Tidak ada grant implisit dari jabatan, unit, divisi, atau lokasi.
- Semua menu dan halaman sinkron dengan permission efektif dan module lifecycle.
- Endpoint list/detail/mutasi/export diuji dengan akun per capability.
- Uji regresi multi-role, Auditor deny-write, Super Admin terakhir, scope exclusion, dan role/module inactive lulus.
- Build, typecheck, seluruh suite test relevan, Docker fresh DB, upgrade DB existing, dan runtime smoke lulus.
- Backup/restore dan UAT browser per persona selesai.
- Jangan merge ke main sebelum semua gate lulus.

## Catatan CI yang diketahui pada saat audit

GitHub Actions run 1509 pada commit `ecf0ccc56b6ec74084ec4828eb962882501c0222` gagal pada langkah `Asset numbering rule integrity and deletion safeguards`. Langkah-langkah sebelumnya, termasuk typecheck, Dynamic RBAC foundation, role navigation, dashboard scope, build, Docker smoke, PostgreSQL integration, P0 security, dan sebagian regression checks, lulus. Run 1508 sebelumnya sukses. Run 1509 perlu diperbaiki sebelum branch dijadikan basis rilis.

## Progress implementasi branch audit/dynamic-rbac-full-sync

Pembaruan terakhir: 16 November 2026. Bagian ini mencatat perubahan yang sudah dibuat pada branch audit; statusnya belum lulus CI/UAT.

### Perbaikan fixture antrean dokumentasi Humas (16 November 2026)

- Tes HTTP menemukan antrean Humas kosong pada mode PostgreSQL karena akun fixture memiliki label profil `Humas` tetapi belum memiliki assignment RBAC eksplisit. Ini adalah hasil yang benar dari kebijakan produksi: label profil tidak boleh memberikan hak akses.
- Fixture integrasi diperbaiki agar, pada mode PostgreSQL, membaca katalog role dan assignment user melalui API Superadmin lalu menambahkan role `humas` secara eksplisit sebelum memeriksa antrean. Assignment yang sudah ada dipertahankan. Pada file-store, tes tetap menggunakan jalur kompatibilitas label lama.
- Pengujian berikutnya harus memastikan antrean hanya mengembalikan permintaan dokumentasi dan tetap menyamarkan data privat. CI untuk perubahan fixture terbaru masih berjalan; belum dinyatakan lulus.

### Perbaikan CI TypeScript (16 November 2026)

- CI menemukan JSX tidak valid pada conditional render daftar user di `HeaderNavbar.tsx`; conditional tersebut kini membungkus elemen dan komentar dengan fragment JSX yang valid.
- CI berikutnya mengungkap dua referensi usang: callback `handleSwitchRoleSimulation` yang tidak lagi tersedia pada `App.tsx`, dan variabel `permissions` lama pada backup Administration. Referensi callback dihapus karena HeaderNavbar tidak mendeklarasikan prop tersebut; backup kini menyertakan `rbac_roles` dan `rbac_permissions` dari state katalog Dynamic RBAC.
- Perbaikan sudah dikomit ke branch. Belum ada hasil CI untuk commit paling baru pada saat catatan ini dibuat; typecheck/build dan seluruh suite tetap menunggu verifikasi ulang.

### Penguatan deny-write Auditor (16 November 2026)

- Ditemukan bahwa pemeriksaan Auditor sebelumnya hanya berada pada beberapa jalur aset, tiket, dan reservasi. Endpoint mutasi lain berpotensi belum memiliki pemeriksaan read-only yang konsisten.
- Pemeriksaan lanjutan menemukan bahwa deny-write global sebenarnya sudah diterapkan lebih awal pada `gabahSecurityMiddleware` di `server/runtime-hardening.ts`. Middleware tersebut memeriksa seluruh metode non-GET untuk user yang memiliki assignment Auditor melalui `isAuditorActor`; ada pengecualian terbatas untuk logout dan penandaan notifikasi telah dibaca.
- Middleware tambahan sempat dibuat pada `server.ts`, tetapi kemudian dibatalkan agar tidak menggandakan kontrol keamanan dan tidak memblokir pengecualian notifikasi yang memang sudah disediakan.
- `isAuditorActor` memeriksa seluruh effective role keys di PostgreSQL, sehingga Auditor sebagai role tambahan tetap memicu kebijakan read-only.
- Batasan yang masih ada: read-only masih hard-coded pada stable key `auditor`, belum menjadi access-mode/deny-write yang dapat dipasang pada role kustom lain. Pengujian HTTP langsung tetap diperlukan untuk memastikan seluruh pengecualian dan mutasi terlindungi.

### Perbaikan yang sudah diterapkan

- UserRole frontend dan ServerUser.role sekarang menerima label profil bebas; katalog role statis di Administration dihapus.
- Navigasi dan Sidebar memakai permission efektif ketika berjalan dengan PostgreSQL; label role bukan prasyarat untuk menu.
- Form tambah/edit pegawai dan parser CSV menerima label profil dinamis.
- Pembuatan, edit, dan impor pegawai tidak lagi otomatis membuat/mengubah assignment RBAC.
- API assignment user menerima himpunan role eksplisit nol atau lebih; tidak memaksa role primer berdasarkan profil.
- UI assignment mengizinkan seluruh role aktif dipilih/dilepas, termasuk mengosongkan assignment (kecuali perlindungan Super Admin aktif terakhir).
- Proses penyimpanan PostgreSQL tidak lagi menjalankan rekonsiliasi role dari users.role pada setiap save.
- Proses startup tidak lagi mengubah profil Humas/Sekretariat/RPC/PIBC atau menebak lokasi kantor berdasarkan label profil.
- Policy cache hanya memuat assignment dari akun aktif.
- Penghapusan akun mencabut assignment gabah_user_roles dan menonaktifkan row users untuk mempertahankan referensi historis/audit.
- Resolusi penerima notifikasi role menggunakan role key/nama dari assignment dinamis pada PostgreSQL; fallback label legacy hanya berlaku untuk file-store.
- Skrip regresi import, user administration, notification RBAC, profile/RBAC separation, dan Dynamic RBAC foundation diperbarui mengikuti kontrak baru.
- CI workflow diperluas agar PR yang menargetkan preview/green-enterprise-theme-laptop juga dapat menjalankan suite yang sama.

### Sidebar: capability Humas dan Sekretariat Direksi (16 November 2026)

- CI berikutnya telah lulus P0 **45/45**, integrasi PostgreSQL **84/84**, dan bulk import **22/22**. Tes primary-role/profile separation juga sudah lulus setelah UI menjelaskan bahwa label profil bukan role akses.
- Satu kontrak UI module lifecycle menemukan Sidebar mengenali Humas melalui helper role-key, tetapi belum menampilkan konteks khusus Sekretariat Direksi. Sidebar kini mengenali `sekretaris_direksi` dari effective assigned role keys dan memberi label workspace/agenda yang sesuai; menu tetap disaring oleh permission dan module status, bukan oleh label profil.
- Tes UI diperbarui agar memeriksa helper role-key bersama, bukan mengharuskan akses langsung ke array role keys.

### Pemisahan label profil dari role assignment pada UI (16 November 2026)

- Tes bulk-import terbaru lulus **22/22** setelah assertion dibetulkan untuk membedakan email invalid dari kesalahan label profil.
- Tes kebijakan primary-role kemudian menemukan teks UI lama yang menyebut role profil sebagai role utama. Ini bertentangan dengan keputusan bahwa `users.role` adalah label profil, bukan sumber otorisasi.
- Teks bantuan dan komentar UI sekarang menyatakan dengan tegas bahwa label profil hanya metadata dan user dapat diberi nol atau beberapa role dinamis sesuai tanggung jawab aktual. Endpoint assignment sudah mendukung assignment set kosong dan banyak role tanpa mengubah label profil.
- Assertion UI diperbarui untuk memeriksa perilaku tersebut; menunggu CI terbaru.

### P0 path guard dan regresi impor profil (16 November 2026)

- P0 security live HTTP pada commit `61b91904` lulus **45/45**, termasuk variasi kapitalisasi dan trailing slash untuk audit log serta rekonsiliasi.
- Uji fresh PostgreSQL pada commit yang sama lulus **84/84**.
- Satu tes bulk-import kemudian gagal karena assertion menghitung semua baris `errors` sebagai kesalahan label profil, padahal batch sengaja menyertakan satu email invalid yang memang harus ditolak. Assertion diperbaiki agar hanya menghitung error yang berkaitan dengan role/peran/label profil; validasi email invalid tetap diuji terpisah.
- Menunggu CI penuh terbaru setelah koreksi assertion ini.

### Integrasi PostgreSQL dan P0 security (16 November 2026)

- Fresh PostgreSQL CR-04/CR-05 kini lulus **84/84** setelah post-seed assignment dan audit scope Auditor diperbaiki. Login, role assignments, lifecycle modul, kontrak/dokumen, vendor scope, reminder, dan restart persistence berhasil diverifikasi.
- P0 security live HTTP lulus **43/45**. Dua kegagalan tersisa terkait endpoint rekonsiliasi yang masih melewatkan pembatasan read pada mode file-store ketika dipanggil dengan variasi huruf besar/trailing slash.
- Ditambahkan guard rekonsiliasi di middleware keamanan menggunakan path yang sudah dinormalisasi. PostgreSQL mensyaratkan `reconciliation.read`; mode file-store membatasi ke Superadmin/Auditor. Perubahan sedang diuji ulang.

### Auditor: audit scope lintas domain untuk baca kontrak (16 November 2026)

- Setelah urutan post-seed diperbaiki, integrasi PostgreSQL naik menjadi 82/84. Dua kegagalan tersisa menunjukkan Auditor dengan assignment tambahan sudah read-only, tetapi belum dapat membaca kontrak/dokumen untuk pekerjaan audit.
- Ditambahkan scope eksplisit `module=audit, scope_type=all` untuk role Auditor melalui migration 091.
- `canSeeContract()` kini mengizinkan pembacaan lintas kontrak hanya jika principal memiliki role Auditor, permission `audit.read`, dan scope global `audit` sekaligus. Tidak ada akses tulis yang diberikan; middleware deny-write tetap berlaku.
- Menunggu pengujian fresh-database terbaru untuk memastikan akses baca Auditor dan seluruh regresi lain lulus.

### Root cause integrasi PostgreSQL: urutan seed user dan migrasi RBAC (16 November 2026)

- Uji PostgreSQL fresh database menunjukkan migration 010/011/031 dijalankan sebelum `backfillNormalizedTables()` membuat baris user. Akibatnya backfill role yang membaca tabel `users` tidak menemukan akun; migration tercatat selesai, tetapi assignment Superadmin/IT/GA/Karyawan/Auditor tidak terbentuk. Ini menjelaskan gelombang HTTP 403, termasuk Superadmin, pada uji integrasi.
- Ditambahkan fase migrasi `post_seed` yang hanya menjalankan berkas dengan penanda `_post_seed_` setelah user canonical dimaterialisasi.
- Migration `090_post_seed_dynamic_rbac_assignment_backfill.sql` menambahkan assignment awal canonical berdasarkan kolom profil legacy yang tersimpan, tanpa menghapus assignment kustom. Humas dan Sekretariat Direksi dipertahankan sebagai role fungsi sekunder dengan Karyawan sebagai role baseline primer; label profil lain tidak diubah menjadi otorisasi baru.
- Hasil normalisasi role dari PostgreSQL disalin kembali ke state runtime sebelum snapshot disimpan, sehingga sinkronisasi berikutnya tidak mengembalikan label profil lama.
- Perbaikan type annotation pada sinkronisasi profil juga sudah dilakukan. CI terbaru sedang menguji ulang typecheck, migrasi post-seed, dan integrasi HTTP. Belum dinyatakan lulus sampai pengujian fresh-database selesai.

### Konsistensi pembacaan aset dan lisensi (16 November 2026)

- Ditemukan perbedaan antara endpoint koleksi `GET /api/assets` dan detail `GET /api/assets/:id`: koleksi mengizinkan pembaca dengan `licenses.read` saja untuk melihat aset kategori License, sedangkan detail sebelumnya mensyaratkan `assets.read`.
- Detail kini menerapkan permission yang konsisten dengan koleksi: `assets.read` untuk katalog aset, atau `licenses.read` untuk pembaca lisensi saja; pembaca lisensi tidak dapat mengambil aset non-lisensi dengan menebak ID. Data tetap difilter oleh resolver scope aset yang sama.
- Kontrak tes diperbarui agar menguji implementasi permission-first dan scope dinamis yang sekarang berlaku, bukan pola kode lama. Perubahan tes bukan penghapusan validasi; pemeriksaan memastikan pemisahan scope `assets` dan `licenses`, deny-by-default, dan role lama hanya digunakan pada file-store.
- CI commit sebelumnya masih tertahan oleh sintaks pada skrip verifikasi (literal `\\n` yang tidak sengaja tertulis); sudah diperbaiki. Menunggu hasil CI commit terbaru.

### Hasil inventaris route API (review statis awal)

- Inventaris statis menemukan beberapa endpoint GET yang belum memperlihatkan guard permission eksplisit di dalam handler, antara lain `/api/taxonomy/categories`, master locations/divisions/job-levels/org-units/office-locations, serta `/api/modules`. Sebagian endpoint memang memerlukan autentikasi atau mungkin merupakan master data referensi; tetapi perlu keputusan permission baca yang eksplisit dan uji direct API agar tidak bergantung hanya pada visibilitas menu.
- `/api/health`, login, logout, dan endpoint autentikasi memiliki alasan khusus dan tidak diperlakukan sebagai endpoint data bisnis biasa.
- Inventaris ini berbasis pencarian pola statis pada deklarasi route, bukan bukti bahwa endpoint pasti rentan. Perlu inspeksi handler, middleware global, klasifikasi sensitivitas data, dan tes akses tanpa permission sebelum perubahan.
- Middleware deny-write Auditor kini melindungi seluruh metode mutasi API pada mode PostgreSQL, dengan pengecualian login/logout/perubahan password sendiri. Ini menjadi lapisan pertahanan tambahan, bukan pengganti guard permission per endpoint.

### Risiko/pekerjaan yang masih terbuka

1. Validasi typecheck/build dan seluruh test suite belum dapat dinyatakan lulus; Actions belum mengembalikan run untuk head branch terbaru.
2. Perlu review migrasi historis 011/030/031 dan role katalog lama (supply_chain, pibc) sebelum memutuskan migrasi assignment lama. Jangan hapus/mass-reassign role lama tanpa audit dampak permission/scope dan daftar user terdampak.
3. Audit endpoint per modul belum selesai; masih ada cabang actor.role yang memang fallback file-store dan perlu dibuktikan seluruhnya berada di jalur non-PostgreSQL.
4. Scope data list/detail/export/report/dashboard dan module lifecycle perlu regression matrix lengkap.
5. Theme redesign belum diterapkan; masih perlu design tokens dan komponen shell konsisten setelah kontrak RBAC stabil.

### Keputusan keselamatan data

Tidak ada penghapusan massal assignment lama, perubahan owner aset, atau konversi data pegawai massal pada tahap ini. Assignment lama yang berasal dari migrasi historis dipertahankan sampai dampaknya dipetakan dan diuji.

### Perbaikan fresh-database grant capability ruang rapat (16 November 2026)

- CI run #1594 mengungkap tiga kegagalan pada antrean dokumentasi Humas: item tidak terlihat dan tiga pemeriksaan redaksi data privat ikut gagal karena fixture tidak menerima data antrean.
- Root cause ditelusuri ke urutan migrasi: migration `034_dynamic_rbac_room_reservation_capabilities.sql` dapat berjalan sebelum role canonical dibuat pada fresh database. Permission berhasil tercatat, tetapi INSERT grant ke role IT/Humas/Sekretariat Direksi tidak menemukan baris role dan tidak pernah diulang.
- Migration post-seed `090_post_seed_dynamic_rbac_assignment_backfill.sql` kini mengulang grant secara additive/idempotent setelah role tersedia: IT facility queue, Humas documentation queue, dan Sekretariat Direksi priority override. Tidak ada grant berdasarkan jabatan/lokasi dan tidak mengubah assignment kustom.
- Skrip numbering di branch preview juga diselaraskan ke migration aset `043_asset_numbering_rules.sql`; commit perbaikan: `dd93eaa`. Perbaikan grant post-seed pada branch audit: `fb8ed91`.
- Status verifikasi: perbaikan sudah dikomit dan isi file diverifikasi dari GitHub; CI fresh-database/meeting-room setelah commit terbaru masih menunggu. PR #115 tetap draft dan tidak boleh merge sampai CI penuh serta audit endpoint/scope selesai.

### Upgrade-path correction (16 November 2026)

- A second review identified that editing migration `090` does not repair databases where version `090` is already recorded in `schema_migrations`; the runner correctly skips already-applied versions.
- Added new additive/idempotent post-seed migration `092_post_seed_room_reservation_capability_grants.sql` so existing PostgreSQL installations also receive the IT, Humas, and Sekretariat Direksi room-queue capability grants.
- Avoided a migration-ledger collision: `091_dynamic_rbac_auditor_audit_scope.sql` already owns version `091`, so the upgrade migration uses `092`.
- Added static regression assertions to `scripts/dynamic-rbac-foundation-verify.mjs` for all three grants and the migration version separation.
- Commits: `52e7fd2` (initial draft 091, subsequently removed), `41109d9` (remove duplicate 091), `aee547a` (create migration 092), `13b91ff` and `91d56d7` (test coverage). The migration runner applies `_post_seed_` migrations after normalized users and canonical roles are materialized.
- Verification status: source and test changes are committed; CI execution on the latest head remains pending.

### CI run #1602 — temuan lanjutan pada Humas fixture (16 November 2026)

- Setelah grant permission diperbaiki, CI #1602 masih gagal pada tiga assertion antrean dokumentasi Humas. Log menunjukkan profil Humas berhasil login (`role=Humas`) tetapi `role_keys` kosong; karena itu antrean operasional tetap tidak terbuka.
- Root cause kedua: database/fixture yang sudah mencatat migration 090 sebelum akun canonical dimaterialisasi tidak hanya kehilangan role-permission grant, tetapi juga dapat kehilangan backfill assignment Humas/Sekretariat Direksi. Migration 092 sebelumnya hanya mengulang grant capability, belum mengulang assignment pengguna.
- Migration 092 diperluas untuk mengulang backfill canonical role dari label profil legacy secara additive/idempotent, memastikan Humas/Sekretariat Direksi menjadi role sekunder dan Karyawan menjadi role primer, lalu mengulang tiga role-permission grant ruang rapat. Assignment custom tidak dihapus.
- Regression static check diperluas untuk memverifikasi backfill Humas/Sekdir pada migration upgrade dan diperbaiki regex whitespace-nya.
- Commit migration: `04f305b`; test: `b5fd42e`, `bb6945a`.
- Status: akar masalah dan perbaikan sudah dikomit; CI baru setelah commit `bb6945a` masih harus diverifikasi. CI #1602 tetap FAIL dan tidak boleh dianggap lulus.

### CI run #1606 — fallback Humas queue path (16 November 2026)

- PostgreSQL 17 integration, P0 security, migration checks, build, Docker image/runtime smoke, user/role/import, notification RBAC, user-directory scope, ticket ownership, and loan authorization all passed in CI #1606.
- The run still failed the same three Humas documentation-queue assertions. The meeting-room fixture's `/api/auth/me` payload contained the legacy profile label `Humas` but no `role_keys`, indicating the isolated test server was exercising file-store compatibility rather than PostgreSQL role assignments.
- The Humas queue fallback was unnecessarily routed through the generic application-role normalizer. Changed only the file-store fallback to the explicit legacy profile check `actor.role === 'Humas'`. PostgreSQL remains strictly gated by `room_reservations.documentation.read`; no profile-label authorization was added to PostgreSQL mode.
- Commit: `b274e4e`. New CI on this exact head is pending; CI #1606 remains failed and must not be reported as green.

### Auditor asset catalogue scope correction (16 November 2026)

- A further code-path review found that PostgreSQL Auditor had `assets.audit.read` and `assets.read` but `getScopedAssets()` still returned only ordinary dynamic `assets`/`licenses` scopes. Migration 091 grants the `audit` module scope, not the `assets` module scope, so Auditor's direct asset catalogue could be empty despite the explicit audit permission.
- Added an explicit read-only exception in the canonical asset resolver: an active PostgreSQL Auditor assignment plus `assets.audit.read` exposes the full asset catalogue. The global Auditor middleware continues to deny all non-GET operations, so this does not grant asset mutation authority.
- Added static regression coverage tying the explicit audit permission to the canonical resolver and the global read-only guard.
- Commits: `6da79c4` (fix), `ead2952` (test). CI on the latest branch head is pending.

### CI run #1607 — Humas queue fixed; stale UI assertion exposed (16 November 2026)

- The explicit file-store Humas fallback correction worked: meeting-room reservation regression passed **38/38**, including Humas queue visibility, privacy redaction, and documentation brief retention.
- CI #1607 then stopped at `Meeting room additional-role UI regression`. Its static assertions expected an older inline `currentUser.role`/`role_keys` expression and an obsolete GA override fallback, while the current UI correctly uses a shared `hasRoleKey` resolver and the explicit `room_reservations.override_priority` permission.
- Updated `scripts/room-capability-ui-verify.mjs` to assert the current permission-first implementation and the narrow file-store fallback, rather than reverting working UI code to satisfy stale assertions.
- Commit: `5e5ce49`. CI #1607 remains failed because it ran before this test correction; new CI on the updated head is pending.

### CI run #1612 — complete regression suite PASS (16 November 2026)

- CI run #1612 completed with **SUCCESS** on code commit `5e5ce49`.
- Passed TypeScript, Dynamic RBAC contract, employee-role normalization, migration safety, asset scope (including the new Auditor `assets.audit.read` path), asset integrity, movement scope, navigation/dashboard scope, production build, Docker image/runtime smoke, PostgreSQL 17 fresh-database and persistence integration, P0 live HTTP security, user administration/import, notification multi-role RBAC, user-directory scope, ticket reporter/related-asset scope, loan authorization/state transitions, meeting-room reservation regression, meeting-room additional-role UI regression, KPI integrity, contract/vendor/org/asset master regressions, sidebar connectivity, and maintenance authorization/dynamic scope/vendor/input checks.
- Meeting-room regression passed `38/38`, including Humas queue visibility, private-field redaction, and documentation brief retention. The UI static test now validates the permission-first `hasRoleKey`/`override_priority` implementation.
- CI #1613 was triggered by the subsequent audit-documentation-only commit `c9bc6f9`; it is separate from the code validation above.
- Release remains gated by browser UAT, complete endpoint/scope review, and integration with the stacked theme/numbering PR #114. Neither PR is merged.

### Permission-driven dashboard workspace correction (16 November 2026)

- CI #1612 passed the full workflow, including meeting-room regression `38/38` and the updated room-capability UI assertions. CI #1613 also passed on the subsequent documentation-only commit.
- A final UI review found DashboardView still classified the employee-vs-operational workspace using the presence of the `karyawan`/IT/GA role keys. A custom role with operational permissions but without those canonical role keys could receive the wrong landing/dashboard composition.
- Dashboard classification now derives operational workspace access from effective permissions (`assets.*`, loan approval/handover, ticket assignment/update, maintenance management, room operations, contract/vendor creation). Superadmin and Auditor remain separate global/read-only dashboards. IT/GA labels are presentation hints only; they no longer determine workspace access.
- Added regression assertions to `scripts/dashboard-scope-verify.ts` for permission-driven classification.
- Commits: `b1e3750` (dashboard fix), `9a25f75` (regression test). CI on this latest code change is pending.

### Dashboard workspace follows effective permissions (16 November 2026)

- CI #1612 and #1613 passed before this change. A follow-up review found custom roles with operational permissions but without canonical `karyawan`, `it`, or `ga` role keys could still receive the employee dashboard composition because `isEmployee`/`isDivisionDashboard` were role-key based.
- Reworked DashboardView classification to derive employee-vs-operational workspace from effective operational permissions across assets, loans, tickets, maintenance, room operations, licenses, knowledge, contracts, vendors, organization, and master data. Superadmin and Auditor global/read-only dashboards are explicitly excluded from the operational division dashboard.
- IT/GA labels are now presentation hints only; custom and multi-scope roles receive a generic Operasional label rather than being misrepresented as one division.
- Added static regression assertions in `scripts/dashboard-scope-verify.ts` for custom permission-driven roles, management capabilities, and global dashboard separation.
- Commits: `b1e3750`, `6914c1e`, `0bb20f8` (dashboard implementation); `9a25f75`, `05a49ff`, `abf34ff` (tests).
- CI on this final dashboard refinement is pending; do not treat CI #1612/#1613 as validating these later commits.


### Final dashboard CI and meeting administration permission audit (16 November 2026)

- CI #1621 and #1622 completed with **SUCCESS**. Both validate the final permission-driven dashboard refinement; #1622 also validates the audit-documentation follow-up.
- Continued endpoint/service review found meeting-type and meeting-facility service methods still repeated primary-role checks after the HTTP routes had already checked the dynamic permission keys. In PostgreSQL mode this incorrectly denied custom roles that were explicitly granted `meeting_types.manage` or `meeting_facilities.manage`.
- Updated all three meeting-type mutation methods to enforce `meeting_types.manage` through the shared effective-permission helper. Updated all three meeting-facility mutation methods to enforce `meeting_facilities.manage` in PostgreSQL mode; legacy GA/IT fallback remains limited to file-store mode.
- Added static regression checks for all six service methods to `scripts/dynamic-rbac-foundation-verify.mjs`.
- Commits: `e9aebc0` (service authorization correction), `e14393f` (regression checks). CI for the latest head must complete before this change is considered validated.
- This closes one identified custom-role authorization mismatch; it does not certify the entire endpoint matrix. Remaining work includes reviewing every mutation/read/export/attachment path, the Administration UI against PostgreSQL, and laptop browser UAT. PR #115 remains draft and unmerged.


### Contract capability separation and service-layer RBAC audit (16 November 2026)

- CI #1626 completed with **SUCCESS** on commit `4f09a47`, validating the meeting administration permission correction and the full existing workflow.
- Further review of contract mutations found a service-layer mismatch: API routes required dedicated permissions for milestone management, renewal decisions, and document uploads, but the domain service reused `contracts.update`. Users granted only the dedicated capability were incorrectly denied.
- Added `canManageContractCapability`: each sub-resource now requires its own permission plus record-level authority (PIC or matching contracts division scope); Superadmin remains global. Applied to milestone creation, renewal decision, and document metadata/upload checks at both route and service layers.
- Tightened contract creation so the service requires `contracts.create` only; `contracts.update` no longer implicitly grants create authority.
- Added static regression assertions covering dedicated milestone, renewal, document upload, and create permissions.
- Commits: `3c2bad1`, `b4bd170`, `c7047b2`, `0c02687`, `9b5efd8`, `eec4b3b`.
- CI #1631 validates the dedicated contract sub-resource capabilities; CI #1633 validates the create-only permission tightening. Both were still running when this note was written. Do not mark these latest contract changes validated until both jobs complete successfully.
- Remaining audit areas: exhaustive API matrix (including exports, search, notification reads, and all attachment/download paths), Administration UI with PostgreSQL, legacy taxonomy cleanup (Supply Chain → RPC; SC/PIBC are locations, not roles/divisions), and laptop browser UAT. PR #115 remains draft and unmerged.


### Follow-up regression correction and reminder administration audit (16 November 2026)

- CI #1631 completed with **SUCCESS** for contract milestone, renewal, and document upload capability separation.
- CI #1633 and #1634 failed at one newly added static assertion: the assertion scanned beyond the `canManageContracts` function and incorrectly matched `contracts.update` in the next function. Runtime code and typecheck were not the failure. The assertion now extracts only the target function body before checking its permission. CI #1635 validates this corrected assertion.
- Another endpoint review found manual contract reminder execution and scheduler-status routes checked `contracts.reminders.manage` and then redundantly required the Superadmin role. Removed the redundant role check: explicit permission is now authoritative for these administrative endpoints. Added a regression assertion. CI #1637 validates this latest reminder permission correction.
- Taxonomy review confirmed the remaining legacy mismatch is broader than a label rename: `server/taxonomy.ts` still models SC/PIBC as asset owner divisions; `server/db.ts` still seeds SC/PIBC divisions and org units, while office locations already include RPC/SC and PIBC. Migration 026 is intentionally a no-op compatibility marker and warns against rewriting user roles or ownership from branch labels. Do not apply a blanket data migration. A separately reviewed ownership/location reconciliation is required before removing SC/PIBC owner values.
- Latest CI runs #1635 and #1637 were still running when this note was written. Confirm exact-head success before treating these changes as validated.


### 2026-11-17 — deeper taxonomy and seed reconciliation (read-only)

The repository contains a direct architecture/seed contradiction that must be resolved before a data migration:

- `docs/architecture/RBAC.md` states that Supply Chain and PIBC are not permanent application roles, and describes owner domains as flexible (examples include IT, GA, RPC/SC).
- `docs/PRIMARY-ROLE-AND-LOCATION-MAPPING.md` maps legacy Supply Chain and PIBC accounts to primary role `Karyawan` and office locations `OFF-RPC` / `OFF-PIBC`.
- `server/migrations/006_org_model_masters.sql` nevertheless creates `UNIT-SC` and `UNIT-PIBC` as org units linked to `divisions`; its comments explicitly distinguish asset ownership from physical location.
- `server/migrations/007_asset_managing_unit.sql` backfills managing units from `owner_division`, including SC and PIBC.
- `server/migrations/009_asset_category_master.sql` seeds categories `KDR-SC`, `MSN`, and `MSN-PIBC` with owner divisions SC/PIBC.
- `server/migrations/033_current_office_location_master.sql` normalizes office labels to RPC/SC and PIBC, while `server/taxonomy.ts` and `server/db.ts` still carry SC/PIBC as ownership/division concepts.
- The demo seed includes assets owned by SC and PIBC, while also including examples where GA remains owner at PIBC location. This confirms that physical location cannot be used to infer owner.

**Conclusion:** account role/location backfill is already partly normalized, but the asset owner/org-unit model is not. Do not drop SC/PIBC division rows or mass-rewrite `assets.owner_division`, `managing_unit_id`, category owner mappings, or historical asset numbers yet. A safe follow-up requires an approved owner-domain mapping for each asset class and a compatibility plan for existing foreign keys, reports, imports, loan approvals, and category filters. Preserve the established rule that IT and GA ownership follows the owning function across all locations.

**Safe next implementation boundary:** first make the code and database schema consistently treat office location, employee org assignment, and asset owner domain as separate dimensions; then provide an explicit, reviewable mapping for legacy owner values. No destructive taxonomy migration is included in this PR.


## Pemeriksaan lanjutan dan readiness produksi — 17 November 2026

### Status CI head yang diperiksa
- Head PR #115: `11f559b258d724329d32cee8cc3cd2c36cee865f`.
- GitHub Actions CI run #1639 (`43921705489`) berstatus **SUCCESS**.
- Job `verify` menyelesaikan 59 langkah, termasuk typecheck, Dynamic RBAC contract, migration safety, asset scope/assignment, navigation/dashboard, production build, Docker runtime smoke, PostgreSQL 17 fresh database/persistence integration, P0 live-HTTP security checks, loan authorization, meeting-room regression, maintenance authorization, dan regression master data.
- Hasil ini membuktikan rangkaian pemeriksaan CI yang terdaftar lulus pada head tersebut; bukan bukti bahwa seluruh endpoint, browser workflow, backup/restore, atau kesiapan operasional sudah diuji.

### Temuan tambahan yang diverifikasi langsung di source
1. **Seed akun belum disederhanakan.** `server/db.ts` masih mendefinisikan sepuluh canonical users: Superadmin, GA, Sekretariat Direksi, Humas, IT, beberapa Karyawan lokasi/unit, dan Auditor. Pembersihan belum dilakukan karena aset, kontrak, reservasi, loan, notifikasi, dan histori dapat merujuk ID tersebut. Jangan menghapus hanya dari daftar seed sebelum semua referensi direkonsiliasi.
2. **Akun staf GA dan persona Karyawan UAT belum difinalkan.** Akun GA yang ada belum membuktikan pemisahan pengelola GA dan staf GA. Penetapan persona staf GA dan satu Karyawan dengan PC assignment perlu diputuskan sebelum fixture UAT dirapikan.
3. **Taxonomy organisasi/aset belum selesai.** `server/taxonomy.ts` masih menyatakan SC dan PIBC sebagai owner divisions; `server/db.ts` masih memiliki union division yang memuat SC/PIBC. Ini bertentangan dengan target bisnis terbaru bahwa RPC/SC dan PIBC adalah lokasi, bukan divisi/role. Migrasi data historis tidak boleh dilakukan secara massal sebelum owner domain dan mapping aset disepakati.
4. **Kejelasan label User Management diperbaiki pada commit `3425c536`.** Header kolom kini menyebut “Profil (metadata) & Role Akses” dan label profil ditampilkan dengan awalan “Profil:”; assignment role dinamis tetap ditampilkan terpisah. CI #1641 masih menunggu hasil.
5. **Kebijakan Auditor masih memiliki stable key khusus.** `isAuditorActor()` menerapkan deny-write ketika effective role key `auditor` terpasang. Ini aman sebagai kebijakan sistem yang eksplisit dan sudah diuji di CI, tetapi belum menjadi access-mode/deny-write generik yang dapat dikonfigurasi untuk role kustom lain. Pertahankan Auditor read-only sampai desain policy generik tersedia.
6. **Fallback label role tetap ada pada mode file-store.** Beberapa cabang `actor.role` di service/runtime masih dipertahankan untuk kompatibilitas file-store. PostgreSQL adalah mode produksi yang harus menjadi satu-satunya mode live; deployment tidak boleh diam-diam jatuh ke file-store bila koneksi database gagal.
7. **Konteks sidebar memakai role keys untuk label/badge tertentu.** Permission tetap menyaring menu, sehingga ini bukan sumber otorisasi. Namun label workspace dan indikator Humas/Sekdir/IT/GA masih mengenali role key khusus; perlu dievaluasi apakah diganti metadata/capability agar UI sepenuhnya generik.

### Penilaian readiness saat ini
- **CI/build:** lulus untuk head yang diperiksa.
- **Fondasi Dynamic RBAC:** sebagian besar kontrak inti sudah diuji, tetapi audit seluruh endpoint dan scope belum ditutup.
- **Data organisasi dan aset:** belum siap dibekukan untuk produksi karena SC/PIBC dan owner-domain historis belum direkonsiliasi.
- **Administration UI + browser UAT:** belum ada bukti UAT menyeluruh pada PostgreSQL dengan persona final.
- **Operasional produksi:** backup/restore drill, observability/alerting, kebijakan secret, TLS/reverse proxy, retensi audit, dan prosedur rollback masih harus diverifikasi pada lingkungan target.

**Kesimpulan:** status saat ini adalah *pre-UAT / kandidat staging*, bukan production-ready. CI hijau tidak boleh ditafsirkan sebagai izin live. PR #115 tetap draft dan tidak boleh digabung ke `main` sebelum seluruh release gate, UAT, dan operasi produksi diverifikasi.

### Urutan tindak lanjut
1. Tutup audit permission + scope per endpoint, termasuk direct-ID, export, attachment/download, dashboard, notifikasi, dan pencarian.
2. Rapikan UI User Management agar profil pegawai dan role akses dinamis terlihat terpisah.
3. Finalkan lima persona UAT tanpa merusak referensi transaksi dan assignment aset.
4. Rekonsiliasi owner domain SC/PIBC dan lokasi RPC/PIBC secara non-destruktif.
5. Jalankan UAT browser, Docker fresh install + upgrade DB existing, backup/restore, dan deployment rehearsal.


---

## Update audit 17 November 2026 — continued endpoint/UI synchronization

### Verified changes on `audit/dynamic-rbac-full-sync`
- Ticket and loan workspaces, dashboard classification, room queues, header notifications, and sidebar indicators are progressively driven by effective permissions/capabilities rather than employee profile labels.
- Auditor remains deny-write at the server middleware. UI checks now use `role_keys` as authoritative whenever supplied; the legacy profile-label fallback is used only when role keys are absent (file-store compatibility).
- Asset catalogue navigation now accepts `assets.audit.read` directly, matching the API's Auditor read path; it no longer incorrectly requires `assets.read` as an additional prerequisite for that audit-only path.
- Loan return API now allows the borrower to return their own loan without the separate owner-side `loans.return` permission. Other actors still require `loans.return` and matching owner scope in the domain service.
- Dashboard loan/ticket metrics and attention items now require the corresponding `loans.read` / `tickets.read` permission in PostgreSQL mode, in addition to dashboard access and applicable data scopes.
- Contract document upload now checks `contracts.documents.upload` consistently at middleware and handler level; it no longer accidentally imposes the unrelated `contracts.update` capability.
- Administration role-scope editor's TypeScript state now includes `division_except` explicitly rather than narrowing it away with a cast.
- Static regression assertions were added/updated for the above boundaries.

### CI observations
- CI run #1678 passed on commit `dda972e` (63/63 workflow steps).
- CI run #1682 passed on commit `fa07904` (63/63 workflow steps).
- CI run #1698 was started for commit `dea651f`; its final result must be checked before treating the latest audit changes as green. Later commits may have their own CI run.

### Findings still open — do not silently normalize
1. Ticket categories are still hard-coded as `IT`, `GA`, `SC`, and `PIBC`. The current organizational decision treats RPC/SC and PIBC as physical locations, not permanent roles/divisions. Ticket service ownership/queue taxonomy and the planned ME facility queue need an approved mapping before changing historical categories or notification routing.
2. SC/PIBC remain in historical owner/category masters and transaction records. Do not bulk rewrite asset owners, category codes, loan approvals, or contracts until an owner-domain migration map and FK/report compatibility plan are approved.
3. RBAC policy cache is process-local. `refreshRbacPolicy()` runs at startup and after mutations handled by that process; multi-instance deployments need cross-instance invalidation (e.g. PostgreSQL notification/version strategy). Current single-container topology reduces immediate exposure but does not prove multi-node safety.
4. Canonical/demo users and GA staff/Karyawan UAT personas remain unresolved. Preserve transaction references and assigned PC assets; do not delete canonical users by name alone.
5. Browser UAT on PostgreSQL, fresh-install/upgrade rehearsal, backup/restore drill, and target-environment TLS/secret/monitoring checks remain outstanding.

**Readiness remains pre-UAT / staging candidate, not production-ready.** Keep PR #115 Draft and do not merge to `main` until the latest CI, full browser UAT, data mapping, and operational release gates pass.


### CI follow-up and additional UI audit — 17 November 2026
- CI #1698/#1699 exposed a regression assertion that did not allow a multiline asset-navigation condition. The assertion was corrected; the implementation matched the intended Auditor path.
- CI #1700 then exposed an outdated navigation test expecting audit-only asset access to be false. The expected result was corrected to true because the API explicitly permits `assets.audit.read`.
- CI #1704 passed (63/63 steps) on commit `3737dd5`.
- Further source audit found shared frontend helpers still had three remaining Auditor checks that combined `role_keys` with a profile-label fallback using OR. All four shared helper guards now use effective `role_keys` whenever supplied.
- `CreateTicketModal` now follows the same effective-role rule. Asset issue-report action now also requires `tickets.create` when dynamic permissions are available.
- Latest observed head before this note: `80cb358`; CI #1707 was running. Check the latest head's workflow result before treating these additional changes as green.


### Asset permissions and lifecycle follow-up — 17 November 2026
- Asset editor now separates `assets.update`, `assets.assign`, and `assets.lifecycle`. A user with assignment-only authority can assign/unassign without receiving general asset-edit controls; lifecycle-only authority exposes the dedicated lifecycle action panel.
- Asset detail/list actions distinguish Assign PIC from general edit/lifecycle management.
- Generic `PATCH /api/assets/:id` no longer changes asset status. Status transitions are delegated to assignment, loan, or the dedicated lifecycle state machine.
- Bulk-import UPDATE no longer accepts status changes, closing the CSV path that could otherwise bypass lifecycle authorization.
- The asset editor invokes `POST /api/assets/:id/lifecycle` through the API client for repair/damaged/cannibalize/disposal/auction actions. Generic asset edits and assignments remain separate submissions.
- Loan authorization regression fixtures now use lifecycle/assignment workflows to change status rather than relying on direct PATCH.
- CI #1736 passed 63/63 steps on commit `5781ab3`. CI #1738 was running for the subsequent bulk-import status boundary and regression assertion changes; verify its final conclusion on the latest head.

### Lifecycle business rules still require completion
- The current lifecycle action set has initiation actions (repair, damaged, cannibalize, propose disposal, auction) and Superadmin disposal approval, but no explicit repair-completion or auction-finalization transition.
- Destructive actions such as cannibalization/disposal/auction should be reviewed for assigned-custodian handling; active-loan checks exist, but assignment/custody preconditions need explicit business approval.
- Do not invent a completion workflow or silently unassign assets. Keep these as release-gate findings until the business process is confirmed.


### Route inventory follow-up — 17 November 2026

- Rechecked the exact branch head `493a9edd1c9b8352f4908eec31a92511159a3ae6`: GitHub Actions CI run #1685 (`43956715855`) completed with conclusion **SUCCESS**. The `verify` job completed successfully.
- Performed a static inventory of 122 Express route declarations in `server.ts`. This is a source review, not a live HTTP penetration test. The inventory confirms the RBAC administration read endpoints call the Superadmin guard even though a simple lexical scan does not see the guard name in the route declaration itself. User create/import/update/delete/reset-password and numbering administration also remain Superadmin-only by explicit handler checks; these are governance controls, not grants derived from job title, division, or office location.
- The module registry GET endpoint is used to discover active modules for authenticated clients; module mutation and module audit history remain Superadmin-controlled. It must not be mistaken for a permission grant to module data.
- No blanket rewrite of these governance boundaries was made: delegating user administration or module administration to custom roles needs an explicit business/security decision and scope model first. Do not infer that every permission-catalogue entry is already enforced merely because it exists.
- Static route inventory cannot prove record-level scope, attachment authorization, or behavior under malformed/direct-ID requests. Those still require live HTTP tests against PostgreSQL for each module.

**Exact-head status:** CI green on `493a9edd`; product readiness remains **pre-UAT / staging candidate**, not production-ready. Open gates remain taxonomy/owner reconciliation, ticket category and ME routing design, browser UAT, lifecycle completion/asset custody rules, backup/restore, and deployment security/operations checks. PR #115 stays Draft; `main` remains untouched.


### Notification routing follows dynamic capability — 17 November 2026

- A further API review found that photo/documentation notifications were filtered by the literal `humas` role key and by title/message keyword heuristics. That contradicted the requirement that any custom role may receive the Humas/documentation function through explicit permissions.
- In PostgreSQL mode, notification recipient resolution for the legacy Humas recipient role now uses the existing `room_reservations.documentation.read` capability. The photo/documentation queue filter uses the same effective permission. File-store compatibility retains the legacy Humas role fallback; Superadmin retains global notification visibility.
- Added a static regression assertion to `scripts/dynamic-rbac-foundation-verify.mjs` for capability-driven routing.
- Commits: `fa1d5f9` (server authorization), `66e4ac8` (regression assertion).
- CI for commit `66e4ac8` had not yet been reported when this note was written. Do not treat this change as validated until the exact-head workflow completes successfully.



### Dashboard analytics and responsive modal hardening — 17 November 2026

- Added a management analytics section to `DashboardView`: asset-condition distribution, loan-status distribution, and helpdesk-ticket status distribution, including counts and asset book-value summary.
- The charts are derived only from the dashboard collections already supplied by the server. The dashboard API remains responsible for permission and scope filtering; the UI does not issue a separate global analytics request or widen the user's data scope.
- Added a responsive modal safety layer in `src/index.css`: safe-area-aware vertical spacing, viewport-bounded dialog content, scroll containment, and narrow-screen width constraints for legacy forms and administration dialogs.
- This is a layout safety net, not a substitute for visual UAT. Each modal/form still needs browser verification at desktop and mobile viewport sizes, especially nested Administration dialogs.
- Commit sequence: `297c737` (dashboard analytics), `0770636` and `72e470d` (responsive modal hardening). Verify CI on the final branch head before treating these changes as green.


### Follow-up validation — 17 November 2026

- CI run #1763 (`43991651002`) completed **SUCCESS, 64/64 steps** for dashboard analytics commit `297c737`. This included dependency audit, TypeScript/lint, production build, Docker image/runtime smoke, PostgreSQL integration, and the existing authorization/security regression suite.
- Subsequent UI hardening commits `0770636` and `72e470d` and condition-chart correction `1a693d1` were added after that CI run. Static regression assertions for condition-field usage, scope-preserving dashboard aggregation, and modal viewport/scroll safety were added in `539ffcc`.
- **Important:** CI #1763 does not validate commits added after `297c737`. The final branch head must receive a fresh complete CI run; no claim is made that those later commits are green yet.
- The asset chart now uses the canonical `Asset.condition` field (excellent/new/good/fair/poor/broken/damaged) and explicitly counts records with missing/unrecognized condition as “Belum dinilai”; operational `Asset.status` is not misrepresented as physical condition.
- Browser UAT remains outstanding for modal/form clipping, nested Administration dialogs, mobile viewports, and chart rendering with real role-scoped PostgreSQL data.

- Additional dashboard correctness fix: rejected loan requests now have their own chart segment so the circulation chart accounts for every canonical `LoanStatus` value; a static regression assertion was added. Commits: `ae6c3ee` and `3e57926`. These commits are also after CI #1763 and require exact-head CI validation.


### Managing-unit backfill diagnostics — 17 November 2026

- Laptop PostgreSQL startup reported `total=17, backfilled=0, unresolved=3, preserved=14`. The source review confirms that `managing_unit_id` is a nullable relation to `org_units.id`; it is not a `managing_units` table.
- The previous counter treated every explicit `NULL` as `unresolved`. That is misleading: explicit `NULL` values are intentionally preserved when ownership-to-unit mapping is ambiguous or has not been assigned. In particular, GA has two seeded managing-unit candidates (`UNIT-GA-SARPRAS` and `UNIT-GA-UMUM`), so code must not guess which unit manages an asset.
- Updated the backfill statistics to distinguish `explicitlyUnassigned` from genuinely unresolved mapping/invalid-reference cases. Startup logs now emit `explicitly_unassigned` separately. Existing owner division, asset number, physical location, and assignments remain untouched.
- This is an observability/diagnostic correction, not a bulk data reassignment. Any remaining genuinely unresolved owner mapping requires an approved business mapping before data is changed.
- Commits: `6056628` (normalizer stats), `f184d98` (startup diagnostics).
- Exact-head CI has not yet been confirmed. PR #115 remains Draft; do not treat this change as production-ready until CI and browser UAT pass.


### Analitik Operasional dikendalikan oleh permission role (17 November 2026)

- Grafik Analitik Operasional pada dashboard tidak lagi ditampilkan berdasarkan klasifikasi karyawan/non-karyawan atau nama jabatan/role.
- Migration `093_dynamic_rbac_operational_analytics_permission.sql` menambahkan katalog permission `analytics.operational.read` tanpa grant default ke role mana pun.
- Superadmin mengatur akses melalui Administration → Role & Hak Akses dengan mencentang permission pada role yang dituju. Seluruh user dengan role tersebut mengikuti grant role; tidak ada override per-user pada tahap ini.
- Komponen grafik hanya dirender bila permission efektif tersedia. Kumpulan aset, pinjaman, dan tiket tetap mengikuti permission baca serta scope data masing-masing; permission analitik tidak memperluas akses data.
- Regression check pada `scripts/dashboard-scope-verify.ts` memverifikasi gate UI, pendaftaran permission, dan tidak adanya grant otomatis.
- Perlu verifikasi CI pada exact head dan UAT browser: role tanpa permission tidak melihat bagian analitik; role yang diberi permission melihat hanya agregat dari data dalam scope. Tidak ada perubahan data operasional.


### Koreksi menu baseline Karyawan — 17 November 2026
- Menu **Manajemen Inventaris → Maintenance / Jadwal Servis & Maintenance Berkala** dan **Reservasi Ruang Rapat** tidak lagi diberikan otomatis kepada role Karyawan.
- Migration `094_employee_self_service_menu_cleanup.sql` mencabut grant `maintenances.read`, `meeting_rooms.read`, dan `room_reservations.read` dari role `karyawan`. Endpoint tetap memeriksa permission backend; menyembunyikan menu bukan satu-satunya kontrol.
- Legacy file-store navigation juga menghapus `meeting_rooms` dari role Karyawan. Menu Aset/Manajemen Inventaris memang tidak termasuk baseline Karyawan.
- Akses kedua modul tetap dapat diaktifkan secara eksplisit melalui Administration → Role & Hak Akses pada role yang membutuhkan fungsi tersebut. Tidak ada override per-user.
- Tidak ada data jadwal, aset, ruang, atau reservasi yang dihapus; migration hanya mengubah assignment permission role Karyawan.


### Baseline menu Auditor — 17 November 2026

- Sidebar baseline role Auditor dibatasi menjadi lima menu: Dashboard, Aset, Vendor, Contract Management, dan Laporan & Audit.
- Menu operasional Maintenance, Peminjaman, Helpdesk/Tiket, Reservasi Ruang, Lisensi, dan Knowledge Base tidak lagi diberikan secara default kepada role Auditor.
- Migration `095_auditor_menu_baseline.sql` mencabut permission baca yang sebelumnya diwariskan dari seed lama. Data transaksi tidak dihapus.
- File-store fallback `ROLE_NAVIGATION.Auditor` dan regression test navigasi diselaraskan dengan lima menu tersebut.
- Kebijakan Auditor read-only tetap ditegakkan di middleware backend; perubahan menu bukan pengganti kontrol API.
- Scope lintas lokasi dan kelengkapan Audit Trail tetap perlu diuji melalui UAT. Permission tambahan yang diberikan Superadmin melalui role lain tetap bersifat additive, sehingga akun multi-role dapat melihat menu tambahan sesuai assignment-nya.
- Perubahan sudah dikomit pada branch audit; belum dinyatakan lulus CI atau UAT sampai workflow untuk commit terbaru selesai.


### Rekonsiliasi temuan Helpdesk ME lintas branch — 18 November 2026

Pemeriksaan lanjutan menemukan bahwa implementasi IT/GA/ME sebenarnya pernah dikembangkan pada branch terpisah `fix/helpdesk-it-ga-me-queue-mainline` (head `dc2dc71dc2380ee7d0ef72e85060987425f12a23`), bukan pada head PR #115. Karena itu, catatan ME sebagai blocker di atas perlu dibaca sebagai blocker pada branch audit utama saat ini, bukan berarti tidak ada implementasi kandidat di repository.

**Komponen kandidat yang ditemukan:**
- Kategori tiket baru IT/GA/ME; SC dan PIBC dipertahankan hanya untuk histori.
- Unit operasional ME `UNIT-PIBC-ME`, assignment tiket melalui `assigned_unit_id`, dan notifikasi unit melalui `recipient_unit_id`.
- Role template dispatcher `admin_tiket_me`, requester GA/ME, permission dispatch `tickets.assign`, serta template operator GA.
- Aturan IT auto-assignment hanya jika tepat satu petugas aktif memiliki `tickets.update` dan scope IT; jika nol/ambigu, tiket tetap di antrean.
- Endpoint lookup assignee dan delegasi; validasi ulang status aktif, permission, scope unit/divisi, serta audit/notification.
- Dokumen routing dan checklist UAT khusus IT/GA/ME.
- Script `scripts/helpdesk-routing-verify.mjs` berisi 45 assertion kontrak sumber.

**Risiko integrasi yang terverifikasi:**
1. Branch kandidat tidak sama dengan branch PR #115. Perbandingan `main...fix/helpdesk-it-ga-me-queue-mainline` menunjukkan 56 commit ahead dan 1 behind; tidak boleh cherry-pick atau merge seluruh branch tanpa rekonsiliasi migration dan perubahan domain.
2. Branch kandidat membawa migration 035 dan 037–041 serta perubahan pada `server.ts`, `server/services.ts`, `server/db.ts`, `server/persistence.ts`, dan UI tiket. Mainline audit kini telah bergerak sampai migration 097. Nomor migration, asumsi schema, seed, dan kontrak persistence harus direview terhadap mainline sebelum port.
3. Pemeriksaan commit terakhir kandidat menemukan fallback otorisasi berbasis `actor.role_label`/label role untuk status tiket dan kategori GA/ME. Ini bertentangan dengan prinsip Dynamic RBAC produksi. Port hanya boleh mempertahankan permission + scope PostgreSQL sebagai sumber otorisasi; fallback label hanya boleh hidup pada file-store non-production jika memang masih diperlukan.
4. Workflow CI untuk exact head kandidat `dc2dc71...` tidak ditemukan. PR lama #36 pada head `2a83eae...` memiliki workflow gagal pada Docker runtime smoke. Dengan demikian 45 assertion statis bukan bukti bahwa integrasi PostgreSQL, migrasi fresh/upgrade, atau runtime kandidat telah lulus.
5. Tidak ada perubahan data produksi yang dilakukan dan tidak ada PR/merge kandidat yang dibuat dalam pemeriksaan ini.

**Keputusan tindak lanjut:**
- Port secara selektif model unit ME, routing, permissions, endpoint, UI, dan tes ke branch audit terbaru; jangan merge branch lama secara utuh.
- Sebelum port, bandingkan setiap migration 035/037–041 dengan schema/migration aktif dan buat migration baru dengan nomor berikutnya yang tersedia pada mainline, tanpa mengubah histori tiket SC/PIBC.
- Hilangkan fallback label role pada jalur PostgreSQL; tambahkan tes negatif bahwa label profil/unit/lokasi tanpa permission + scope tidak dapat membaca, mengubah, atau mendelegasikan tiket.
- Jalankan CI exact-head, fresh PostgreSQL, upgrade database existing, dan UAT semua persona sebelum menutup blocker ME.

**Status:** kandidat implementasi ME ditemukan; integrasi ke branch rilis belum dilakukan dan belum tervalidasi. PR #115 tetap Draft; jangan merge ke `main`.


### Deep review kandidat Helpdesk IT/GA/ME — 18 November 2026

Pemeriksaan source dan migration kandidat dilakukan lebih rinci sebelum port ke branch audit utama. Hasilnya menambah beberapa blocker teknis yang harus diselesaikan, bukan sekadar konflik nomor migration.

**Temuan schema/domain:**
- Migration kandidat 035 membuat `UNIT-PIBC-ME` dengan `division_code = 'PIBC'`. Ini masih mencampur lokasi PIBC dengan kode divisi/owner domain. Keputusan organisasi GABAH menyatakan PIBC adalah lokasi, bukan divisi atau role. Unit ME harus direlasikan ke owner domain operasional yang sah; jangan memakai kode lokasi PIBC sebagai pengganti divisi.
- `getTicketOwnerDivision()` pada kandidat memetakan kategori ME ke PIBC. Ini berisiko membuat otorisasi, dashboard, laporan, dan notifikasi menganggap PIBC sebagai divisi pemilik tiket. Model owner domain ME harus dipisahkan dari office location.
- Migration 036 kandidat berbenturan nomor dengan migration 036 yang sudah ada di branch audit utama (`036_dynamic_rbac_auditor_ticket_create_deny.sql)). Tidak boleh menimpa atau mengganti migration yang sudah pernah diterapkan. Kandidat 035 serta 037–041 perlu direvisi/diurutkan ulang sebagai migration baru setelah 097, setelah kontrak skema disetujui.
- Migration 039 menghapus `tickets.update`, `tickets.assign`, dan `tickets.close` dari role `ga`. Ini dapat mengubah hak GA yang sudah berjalan. Perubahan tersebut harus diuji terhadap assignment role dan pekerjaan GA yang aktual; jangan mengasumsikan semua user GA bukan operator.

**Temuan authorization/UI:**
- Kandidat menyediakan permission `tickets.assign`, `tickets.create.ga`, dan `tickets.create.me`, serta role template operator/requester. Ini pemisahan capability yang lebih tepat daripada menjadikan label jabatan sebagai role.
- Namun beberapa jalur handler kandidat masih menggunakan regex `actor.role_label` untuk otorisasi unit ME/GA pada fallback non-PostgreSQL. Pastikan jalur itu benar-benar tidak dapat aktif di deployment produksi dan tidak menjadi fallback ketika PostgreSQL gagal.
- Endpoint assignment harus selalu mensyaratkan permission dispatch, scope unit/divisi pada tiket, target aktif, permission update, serta scope target. Daftar assignee tidak boleh membocorkan user lintas unit.
- Kategori tiket ME tidak boleh otomatis membuka seluruh tiket PIBC. Reporter dan assignee tetap dapat melihat tiket miliknya sesuai kebijakan, sedangkan antrean ME memerlukan permission dan scope ME eksplisit.

**Keputusan:** belum aman melakukan port kode kandidat apa adanya. Langkah yang benar adalah mendefinisikan owner domain ME sebagai domain operasional terpisah dari lokasi PIBC, mempertahankan histori SC/PIBC tanpa rewrite, merancang migration baru non-destructive di atas 097, lalu mengadaptasi resolver list/detail/status/assignment/notifikasi/dashboard ke domain tersebut. Uji fresh DB dan upgrade DB existing wajib dilakukan sebelum fitur dinyatakan selesai.
