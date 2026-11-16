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
