# GABAH Core Functionality Recovery Plan

**Tanggal:** 27 November 2026  
**Status:** Rencana kerja aktif; audit dan implementasi berjalan bertahap/paralel.  
**Branch dokumentasi:** `audit/core-functionality-recovery-plan-2026-11-27`  
**Baseline:** `main` at `4f10d7a3aada9f41cd9e6cd2abe980b52054839e`

## Tujuan

Memulihkan fungsi inti aplikasi berdasarkan keluhan UAT terbaru: sejumlah menu terlihat tetapi tidak bekerja, halaman tidak terbuka/blank, atau proses berhenti pada status loading. Keberhasilan CI saja tidak dianggap bukti bahwa alur browser telah berfungsi.

## Urutan prioritas dan kriteria selesai

| Tahap | Area | Pemeriksaan wajib | Kriteria selesai |
|---|---|---|---|
| 0 | Inventaris & baseline | Petakan seluruh menu/sidebar, NavTab, route/render switch, module key, role, API, serta status implementasi dan tes | Matriks menu-ke-halaman-ke-permission tersedia; setiap menu punya pemilik dan status |
| 1 | Bootstrap aplikasi | Login, restore session, current user, fetch module status, initial data, error/loading state | Login berakhir pada dashboard; tidak ada loading permanen; kegagalan API menampilkan error/retry yang jelas |
| 2 | Navigasi & render halaman | Klik semua menu, perubahan currentTab, fallback route, active module gating, modal administrasi | Setiap menu yang diizinkan membuka halaman yang benar; tidak ada tab dead-end, blank screen, atau redirect tak terduga |
| 3 | RBAC & module lifecycle | Role assignments, effective permissions, location/data scopes, active modules, sidebar visibility, backend guards | Menu dan tindakan cocok dengan permission/scope; UI dan API konsisten; deny-by-default tetap berlaku |
| 4 | Operasi & formulir | Create/read/update/delete yang relevan, validasi, loading/success/error, approval/rejection, refresh data | Aksi utama berfungsi end-to-end; tidak ada tombol inert atau sukses palsu |
| 5 | API & integritas data | Endpoint yang dipanggil tiap halaman, status/error mapping, schema/migration, transaksi, konflik data | Kontrak frontend-backend cocok; kegagalan ditangani eksplisit; data tidak hilang/terduplikasi |
| 6 | Uji lintas persona | Superadmin, Admin GABAH, staf IT, GA, staf biasa, dan pengguna lokasi RPC/PIBC/HO sesuai akun uji yang tersedia | Skenario positif dan negatif lulus per role; akses lintas owner/lokasi tidak bocor |
| 7 | Stabilitas & rilis | Build, lint, unit/integration/regression CI, smoke test browser/UAT, dokumentasi blocker | Tidak ada blocker kritis; bukti tes terikat ke exact commit; PR siap direview, tidak merge ke main tanpa persetujuan |

## Strategi paralel

Pekerjaan dibagi ke jalur independen dan tidak menunggu CI jalur lain:

1. **Jalur A — Bootstrap dan navigasi:** App root, Sidebar, roleNavigation, module loading, tab-to-view rendering.
2. **Jalur B — RBAC dan module access:** permission metadata, active modules, scope, menu visibility, backend enforcement.
3. **Jalur C — Halaman dan operasi:** view/modal/form handlers, API client, data refresh, error/loading state.
4. **Jalur D — Uji dan dokumentasi:** matriks menu/role/API, regression tests, hasil CI, catatan blocker dan keputusan.

Sebelum dua jalur mengubah file yang sama, perubahan dikoordinasikan atau ditumpuk berdasarkan dependency. Tidak membuat klaim bahwa jalur selesai hanya karena CI belum merah atau test source-level lulus.

## Aturan perubahan dan bukti

- Perbaiki aplikasi yang ada; jangan rebuild atau mengganti arsitektur tanpa alasan yang terbukti.
- Setiap kelompok perubahan memakai branch khusus, regression test yang relevan, dan worklog.
- Jalankan pemeriksaan/CI tiap branch segera; pekerjaan independen tetap berjalan tanpa menunggu CI branch lain.
- Catat exact branch, HEAD SHA, file berubah, tes yang benar-benar dijalankan, hasil, dan blocker.
- Bedakan source inspection, automated tests, CI, dan browser/UAT. Jangan menyamakan satu dengan lainnya.
- Jangan menghapus data, volume, branch, atau mengubah database pengguna.
- Jangan merge ke `main` tanpa persetujuan eksplisit pemilik proyek.
- Standar penomoran aset masih menunggu keputusan perusahaan; tidak menjadi bagian pemulihan ini.

## Kondisi awal dan batas bukti

- Pengguna melaporkan pada UAT 27 November 2026 bahwa beberapa menu tidak berfungsi. Rincian menu/akun/aksi yang gagal belum seluruhnya terinventarisasi.
- Sebelumnya ada laporan layar kosong dan teks `Memuat status modul…` yang menetap setelah login.
- PR/CI sebelumnya hanya menjadi bukti pemeriksaan otomatis pada commit masing-masing; bukan bukti bahwa seluruh menu telah lolos UAT.
- Pemeriksaan kode awal pada baseline main menunjukkan `App.tsx` mengelola state navigasi dan render view, sedangkan `Sidebar.tsx` menyusun menu berbasis permission. Ini titik awal audit, bukan kesimpulan penyebab.

## Status pekerjaan

| Jalur | Status | Catatan |
|---|---|---|
| A — Bootstrap & navigasi | MENUNGGU AUDIT TERINSTRUMEN | Prioritas pertama |
| B — RBAC & module access | MENUNGGU AUDIT MATRIKS | Dikerjakan paralel |
| C — Halaman & operasi | MENUNGGU INVENTARIS MENU/API | Dikerjakan paralel setelah pemetaan titik integrasi |
| D — Tes & dokumentasi | AKTIF | Dokumen rencana ini menjadi acuan; hasil audit berikutnya ditambahkan di worklog terpisah |

## Next actions

1. Buat matriks semua item Sidebar → NavTab → komponen halaman → permission/module key → endpoint.
2. Audit semua kondisi yang dapat membuat konten tidak dirender atau menu tidak merespons.
3. Audit error/loading handling untuk setiap initial fetch dan perubahan tab.
4. Tambahkan regression test pada setiap penyebab yang terbukti.
5. Pecah perbaikan menjadi PR kecil/terukur; jalankan CI per branch tanpa menghentikan jalur paralel.


## Temuan audit awal — 27 November 2026

### Jalur A — Bootstrap & navigasi
- **Terkonfirmasi pada baseline `main` `4f10d7a`:** `src/App.tsx` belum memiliki generation guard untuk membatalkan `initAuth()` yang terlambat setelah login interaktif. Kode dapat menjalankan `clearRoleScopedData()` dan mengembalikan `activeModuleKeys` ke `null` setelah login, sementara effect pemuatan modul bergantung pada `currentUser?.id`. Ini cocok dengan gejala `Memuat status modul…` yang pernah dilaporkan.
- **Perbaikan sudah ada di PR #345**, branch `fix/login-module-status-init-race`, HEAD `91418ab330321f9ee459deb4a3b188e57ab6c1e3`. PR masih Draft dan base-nya `fix/postgres-skip-readonly-state-snapshot`, bukan `main`; karena itu perbaikan tersebut belum menjadi bukti bahwa branch lokal pengguna sudah memuatnya atau sudah lolos UAT.
- **Hipotesis mismatch module key ditolak untuk baseline ini:** 12 key pada `042_module_lifecycle_registry.sql` selaras dengan `AppNavTab` dan daftar tab di `roleNavigation.ts`. Script `module-lifecycle-registry-verify.mjs` memeriksa sebagian kontrak tersebut. Tetap perlu uji runtime bahwa registry benar-benar ter-migrasi dan seluruh status aktif.
- Sidebar membentuk daftar menu hanya dari gabungan permission dan `activeModuleKeys`; App juga menolak navigasi ke modul yang tidak aktif. Saat status modul belum tersedia, tidak ada menu yang dianggap tersedia. Ini perilaku fail-closed yang harus disertai status error/retry yang dapat dipahami pengguna.

### Jalur C — Data halaman & API
- **Temuan source-level:** `refreshData()` di `src/App.tsx` mengubah kegagalan masing-masing API menjadi array kosong (`catch(() => [])`), sehingga kegagalan jaringan/otorisasi sulit dibedakan dari data yang memang kosong.
- **Temuan source-level:** ketika API mengembalikan array kosong, data awal `maintenanceSchedules`, `vendors`, dan `knowledgeBase` tidak selalu diganti; kode mempertahankan seed/demo lama. Ini bertentangan dengan prinsip PostgreSQL sebagai sumber data authoritative pada runtime Compose dan dapat menampilkan data yang tidak berasal dari server.
- Temuan ini perlu diperbaiki dengan pola status per data (loading/success/empty/error) atau setidaknya mengosongkan state ketika server secara sah mengembalikan array kosong. Jangan menampilkan data seed seolah-olah data produksi.

### Batas bukti
Semua temuan di atas berasal dari inspeksi source GitHub pada baseline yang disebutkan. Belum ada browser UAT pada sesi ini. Belum dapat disimpulkan bahwa temuan tersebut menjelaskan semua menu yang gagal dilaporkan pengguna.


## Update pelaksanaan — 27 November 2026

### Branch/PR aktif
| Jalur | Branch / PR | HEAD terakhir yang diketahui | Status |
|---|---|---|---|
| Login/bootstrap race | `fix/login-module-status-init-race` / PR #345 | `91418ab330321f9ee459deb4a3b188e57ab6c1e3` | Exact-head CI sebelumnya SUCCESS; Draft; browser UAT belum dilakukan |
| Sinkronisasi data halaman | `fix/authoritative-empty-list-refresh-2026-11-27` / PR #352 | Worklog commit `d1f3e70263cbd0443a038b22517c189cf9af539c` | CI pada head sebelumnya sempat berjalan; head terbaru perlu CI ulang; Draft |
| Kontrak menu-ke-halaman | `test/menu-to-view-contract-2026-11-27` / PR #353 | `63baac46738825a422c80764db028123aba779b0` | CI belum terlihat pada pemeriksaan terakhir; Draft |
| Rencana pemulihan | `audit/core-functionality-recovery-plan-2026-11-27` | `32c7173c864abcdf6490195faddad32cd5ed6baa` | Dokumen acuan sudah dipush |

### Perkembangan jalur
- Jalur A mengidentifikasi race condition auth pada baseline main dan mengonfirmasi perbaikan tersedia di PR #345, tetapi PR masih berada di branch bertingkat dan belum diuji browser.
- Jalur C mengubah refresh data menjadi `Promise.allSettled`, membedakan respons kosong dari request gagal, dan menampilkan banner error plus tombol retry. PR #352.
- Jalur D menambahkan regression contract bahwa seluruh 12 item Sidebar memiliki cabang render pada App dan jalur klik melewati guard permission/module. PR #353.
- Mismatch nama module key vs NavTab tidak ditemukan pada migration seed baseline; hipotesis awal tersebut tidak terbukti.
- Jalur B (audit matriks permission/scope per role dan backend endpoint) masih berjalan independen; belum ada klaim selesai.

### Hal yang belum boleh dianggap selesai
- Belum ada browser UAT seluruh menu.
- Belum ada verifikasi semua tombol/form pada tiap halaman.
- Belum ada uji akun IT, GA, staf biasa, dan pengguna lokasi untuk seluruh alur.
- CI untuk PR #352/#353 harus dinilai berdasarkan exact latest head, bukan commit sebelumnya.


## Audit lanjutan — komponen halaman dan error boundary

- Seluruh 12 file view utama ditemukan: Dashboard, Aset, Aset Saya, Ruang Meeting, Maintenance, Peminjaman, Tiket, Lisensi, Kontrak, Vendor, Knowledge Base, dan Laporan.
- Pemeriksaan source awal tidak menemukan handler tombol inline kosong (`onClick={() => {}}`) atau penanda TODO/FIXME umum pada 11 view. `ReportsView` memiliki dua pesan metrik yang memang belum tersedia (timestamp respons pertama dan durasi penyelesaian); ini bukan bukti tombol/menu rusak.
- Tombol pada komponen-komponen tersebut memiliki wiring `onClick` yang terlihat secara statis. Ini belum memverifikasi callback parent, permission backend, atau hasil transaksi.
- `src/main.tsx` tidak memasang Error Boundary. PR #354 menambahkan boundary pada content pane agar exception satu view tidak menjatuhkan sidebar; CI awal menemukan masalah tipe, sudah dikoreksi, menunggu CI exact-head baru.
- Pemeriksaan ini tidak menggantikan UAT klik per menu dan uji aksi per persona.

### Status CI terbaru saat pembaruan
| PR | Status yang diketahui | Catatan |
|---|---|---|
| #345 | SUCCESS | Exact-head CI pada PR login race; browser UAT belum |
| #351 | SUCCESS | Exact-head CI sebelumnya; re-login setelah role assignment perlu UAT |
| #352 | QUEUED | Dua CI sebelumnya gagal pada assertion lama/salah-scope; test diperbaiki dan run #3897 antre |
| #353 | SUCCESS | Run #3882 lulus; structural menu-to-view contract |
| #354 | PENDING | Run awal #3888 gagal typecheck; tipe boundary dan assertion parent diperbaiki, menunggu run baru |
| #355 | Draft | Dokumen rencana pemulihan |



## Peta operasional menu

Matriks 12 menu → komponen → data → aksi sudah dicatat di:
`docs/progress/GABAH-MENU-PAGE-API-MATRIX-2026-11-27.md`.

Dokumen tersebut menjadi checklist UAT per menu, termasuk pemisahan bukti wiring source, API permission, scope data, dan transaksi backend.


## Update CI dan implementasi — 27 November 2026

- PR #352 pada branch data refresh: run #3905 SUCCESS untuk commit `1ed08c6`; run #3906 dan #3907 berjalan untuk commit berikutnya sampai head terbaru `9561f12`. Perubahan lanjutan mencakup penanganan 403 yang diharapkan serta penghapusan data demo awal untuk vendor/knowledge/maintenance.
- PR #353 menu-to-view contract: run #3882 SUCCESS.
- PR #355 rencana pemulihan: run #3901 SUCCESS.
- PR #356 Error Boundary: run #3902 gagal typecheck pada implementasi awal; setelah koreksi props/resetKey, PR dibuka ulang untuk memicu exact-head CI #3908 (QUEUED) pada head `97ad1d2`.
- PR #345 login race: run sebelumnya SUCCESS.
- PR #351 notifikasi re-login role assignment: run sebelumnya SUCCESS.
- PR #354 ditutup sebagai superseded oleh PR #356; tidak ada merge.

### Catatan desain tambahan
- Karena `refreshData()` memanggil endpoint lintas modul saat login, 403 untuk modul yang tidak ditugaskan atau dinonaktifkan adalah penolakan yang diharapkan. API client sekarang menyimpan HTTP status/error code; 403 tidak menimbulkan banner outage palsu.
- Collection vendor, knowledge, dan maintenance sekarang dimulai dari array kosong, bukan data demo. Hanya respons backend sukses yang boleh mengisi data awal.
- Kegagalan selain 403 tetap ditampilkan sebagai banner dengan daftar koleksi dan tombol retry.


## Status terkini setelah pemeriksaan CI

- **PR #352:** implementasi/test commit `9561f12495c0b1bf765bd1a820eb5647743554fc` lulus CI lengkap pada run #3907. Commit `f1a40dc88b6edc3fb1ceac393f26d69240478248` sesudahnya hanya worklog. Browser UAT belum.
- **PR #353:** menu-to-view + menu-to-backend-read-permission regression ditambahkan; run #3910/#3911 sedang berjalan.
- **PR #355:** dokumen tahapan dan matriks menu; run #3909 sedang berjalan.
- **PR #356:** Error Boundary dengan `resetKey`; run #3908 melewati typecheck/build dan sedang menjalankan integrasi PostgreSQL saat pemeriksaan terakhir.
- **PR #354:** closed, superseded by #356.
- Tidak ada PR yang di-merge ke `main`.



## Update terakhir — 27 November 2026

- PR #352: CI #3907 **SUCCESS** pada implementation/test head `9561f124`; run #3912 berjalan pada commit worklog setelahnya.
- PR #353: run #3910 dan #3911 berjalan setelah penambahan kontrak backend read permission.
- PR #355: run #3909 **SUCCESS** pada versi dokumen sebelumnya; run #3913 berjalan pada update dokumen terakhir.
- PR #356: run #3908 gagal hanya pada assertion lama yang masih menyebut `key` setelah implementasi beralih ke `resetKey`; assertion sudah dikoreksi. Run #3914 berjalan pada implementation/test head `5df4a259`; commit sesudahnya hanya worklog.
- Tidak ada merge ke `main`; semua PR tetap Draft dan menunggu review/UAT.



## Jalur paralel tambahan — sinkronisasi toggle menu role

- PR #357 menemukan ketidaksamaan antara editor role dan syarat menu aktual:
  - Licenses membutuhkan `licenses.read + assets.read`, tetapi editor hanya memeriksa `licenses.read`.
  - Reports membutuhkan `reports.read` dan setidaknya satu permission baca sumber data, tetapi editor hanya memeriksa `reports.read`.
- Dampaknya, editor bisa menampilkan menu sebagai aktif padahal Sidebar menyembunyikannya.
- Perbaikan juga menjaga agar mematikan menu Licenses tidak mencabut `assets.read` yang dipakai Aset Saya; mematikan Reports hanya mencabut `reports.read`.
- PR #357 menambahkan helper murni dan regression test, exact-head CI sedang berjalan setelah satu koreksi TypeScript.
- Link: https://github.com/inieki-lab/gabah-gas/pull/357


## Update paralel terbaru — 27 November 2026

- **PR #357 sidebar permission dependencies:** CI #3920 dan #3921 SUCCESS. Editor role sekarang menyamakan syarat menu Licenses/Reports dengan navigasi aktual dan tidak mencabut grant bersama saat satu menu dimatikan. UAT browser belum.
- **PR #353 menu-to-view:** regression baru memastikan seluruh callback wajib dari 12 view dipasang oleh App. Run #3929/#3930 berjalan.
- **PR #356 Error Boundary:** run #3927 menemukan deklarasi props React perlu eksplisit; implementasi sekarang memakai constructor untuk resetKey state, `getDerivedStateFromProps` untuk reset saat pindah tab, dan props declaration eksplisit. Run #3931/#3932 berjalan pada perbaikan terbaru.
- **PR #352 data refresh:** CI #3907, #3906, #3905 SUCCESS; run #3912 juga SUCCESS.
- **PR #355 rencana pemulihan:** CI #3909, #3913, #3916, #3922 SUCCESS.
- Semua perubahan masih Draft; tidak ada merge ke `main`.



## Status audit ulang — 28 November 2026 (permintaan UAT: menu per pengguna)

### Kesimpulan
Pemulihan fondasi belum sama dengan penyelesaian menu per pengguna. Matriks 12 menu sudah ada pada level source, tetapi belum ada matriks efektif per akun yang menggabungkan seluruh role, permission, module status, dan scope lokasi/divisi. Browser UAT lintas persona juga belum dijalankan. Karena itu status keseluruhan tetap **BELUM SELESAI**.

### Status tahapan 0–7

| Tahap | Status saat ini | Bukti yang tersedia | Sisa pekerjaan wajib |
|---|---|---|---|
| 0 Inventaris menu | **PARTIAL** | Matriks 12 menu → view → data → aksi di `GABAH-MENU-PAGE-API-MATRIX-2026-11-27.md`; source contract PR #353 | Lengkapi matriks efektif per persona/akun, termasuk header actions, Administration submenus, dan tombol per halaman |
| 1 Bootstrap/login | **CODE + CI PARTIAL** | PR #345 auth restore race; PR #352 data refresh/error handling; PR #356 Error Boundary | Uji browser reload/login/logout, session expiry, failed module status, dan retry pada akun nyata |
| 2 Navigasi/render | **CODE + CI PARTIAL** | PR #353 menu-to-view/callback contract; PR #357 composite menu grants; PR #358 persona alignment | Uji semua 12 menu dengan akun yang punya/tidak punya permission dan modul aktif/nonaktif; cek active highlight dan default landing |
| 3 RBAC/module/scope | **INCOMPLETE — PRIORITY** | `server/rbac-policy.ts` menggabungkan permission dari semua role yang ditugaskan per user; menu memakai `permission_keys`; backend memakai permission/scope guards | Belum ada hasil audit per-user yang membandingkan assigned roles vs effective permissions vs Sidebar vs API 403/200; audit seluruh endpoint dan scope owner/lokasi/divisi; verifikasi module toggles |
| 4 Operasi/form | **PARTIAL** | PR #359 perbaikan retensi isian/error; PR #360 assignment PIC awal aset; PR #336/#338 loan collision | Audit semua aksi per view: edit/delete, approval, handover, return, ticket assign/close, room workflow, contract/vendor/knowledge; pastikan tiap aksi sesuai permission backend |
| 5 API/integritas data | **PARTIAL** | PR #352 empty/error refresh; PR #336/#338 loan locking/collision; sejumlah owner-scope audit PR | Cocokkan semua tombol dengan endpoint, permission, scope, response, dan refresh; lakukan PostgreSQL 17 upgrade/rehearsal untuk migration yang belum terintegrasi |
| 6 UAT lintas persona | **NOT STARTED / NO EVIDENCE** | Daftar persona dan skenario ada pada worklog/PR | Jalankan akun Superadmin, Admin GABAH, IT, GA, staf biasa, Humas/Sekdir, ME, serta staf HO/PIBC/RPC; uji allow/deny dan data scope |
| 7 Stabilitas/rilis | **NOT READY** | Beberapa exact-head CI PR lulus | Rekonsiliasi dependency stack, browser UAT, exact-head CI final, review; belum ada persetujuan merge ke main |

### Temuan baru: satu sumber klasifikasi persona belum dipakai bersama
- PR #358 telah memperbaiki salah klasifikasi `loans.return`: hak pengembalian pinjaman milik sendiri bukan hak operator peminjaman.
- Audit berikutnya menemukan Sidebar memasukkan `room_reservations.checkin` dan `room_reservations.checkout` sebagai kemampuan operasional, sedangkan Dashboard mempunyai daftar permission terpisah dan tidak memasukkan dua kemampuan itu.
- Ini dapat membuat custom room operator mendapat label/persona berbeda antara Sidebar dan Dashboard.
- Perbaikan lanjutan sudah dibuat pada branch PR #358: daftar `OPERATIONAL_NAVIGATION_PERMISSIONS` diekspor dari navigation policy dan dipakai Dashboard serta Sidebar; regression assertions ditambahkan. Exact-head CI untuk tambahan ini belum terkonfirmasi.

### Aturan audit per pengguna yang akan dipakai
Untuk setiap akun uji, audit harus merekam:
1. primary profile dan seluruh role/capability yang ditugaskan;
2. effective permission keys hasil union role (serta efek read-only policy);
3. effective scope per module: owner/division, unit, dan lokasi;
4. module status aktif/nonaktif;
5. menu yang seharusnya terlihat dan landing page yang seharusnya dibuka;
6. API read dan mutation yang seharusnya 200/403, termasuk object-level scope;
7. hasil aktual browser setelah login ulang (perubahan assignment mencabut sesi lama).

Tidak boleh menyimpulkan role dari nama lokasi seperti RPC/SC atau PIBC. Lokasi adalah scope/master data; role adalah capability. Tidak boleh mengubah grant massal hanya untuk membuat menu tampak muncul.

### PR yang relevan dan status UAT
- #345 bootstrap/login race — exact-head CI terdahulu lulus; browser UAT pending.
- #352 data refresh — exact implementation CI lulus; browser UAT pending.
- #353 menu-to-view contract — exact-head CI lulus; hanya structural coverage.
- #356 Error Boundary — exact-head CI lulus; browser UAT pending.
- #357 role editor/menu dependency — exact-head CI lulus; browser UAT pending.
- #358 Sidebar/Dashboard persona — CI lulus untuk head sebelumnya; tambahan shared capability Dashboard baru menunggu CI.
- #359 form error retention — exact-head CI lulus; browser UAT pending.
- #360 asset initial custodian — integrated CI lulus pada stack head sebelumnya; browser UAT pending.
- #339–#351 sebagian merupakan stack Administration/master-data/RBAC lama. Sebelum dianggap siap, dependency base/HEAD dan exact-head CI masing-masing harus direkonsiliasi; jangan cherry-pick/merge sebagian secara acak.

### Next work (lanjut paralel)
1. **Jalur B:** bangun permission/scope matrix per role dari migrations + backend route guards; tandai permission yang tidak punya menu/action atau sebaliknya.
2. **Jalur A:** audit active module state, default landing, currentTab, Sidebar, dan menu header saat user switch/login.
3. **Jalur C:** audit aksi mutation seluruh view dan endpoint, mulai dari meeting rooms, tickets, loans, dan asset edit/assignment.
4. **Jalur D:** tambah regression checks dan catat exact-head CI; UAT tetap diberi status pending sampai benar-benar dijalankan.

**Batas:** Source/CI bukan browser UAT. Tidak ada data produksi, user assignment, permission grant, atau database yang diubah. Tidak merge ke `main` tanpa persetujuan eksplisit.


## Update pelaksanaan — 28 November 2026, sore

### Temuan tambahan pada bootstrap/menu
- Audit `GabahApiClient.getModules()` menemukan request `GET /api/modules` tidak memiliki timeout. `App.refreshModuleStatuses()` hanya menampilkan state gagal bila Promise reject; request yang menggantung membuat `activeModuleKeys` tetap `null` dan Sidebar terus tersembunyi.
- PR #361 menambahkan AbortController timeout 12 detik, pesan error yang jelas, cleanup timer, dan regression test/CI. CI #3993 (run ID `46128456441`) **SUCCESS 121/121** pada code head `56f0338ccd964e0fa024ba2870392d95867eb9e7`; update worklog sesudahnya memicu CI #3999 yang berjalan. Browser UAT hang/retry tetap pending.
- Ini jalur berbeda dari race `initAuth()` PR #345; kedua proteksi dibutuhkan.

### Temuan tambahan persona pengguna
- PR #358 diperluas: Sidebar dan Dashboard sekarang berbagi satu daftar capability operasional, termasuk `room_reservations.checkin/checkout`; `loans.return` tetap self-service.
- Migration 048 menormalisasi primary profile Auditor menjadi Karyawan dengan secondary role `auditor`. Sidebar sebelumnya tidak membaca role sekunder Auditor, sehingga label “Staf” berbeda dari Dashboard Auditor. PR #358 sekarang membedakan “Audit & Pemantauan”, “Dashboard Auditor”, dan menyembunyikan badge antrean operasional.
- CI #3991 gagal pada matcher Dashboard lama yang mengharapkan array duplikat; matcher diperbarui. CI #3998 berjalan pada latest head setelah tambahan Auditor; belum ada hasil final.

### Status bukti setelah update
- PR #361: code-head CI lulus; latest docs-head CI #3999 berjalan.
- PR #358: latest integrated CI #3998 berjalan; UAT lintas persona belum.
- Tahap 3 RBAC per-user masih belum selesai karena belum ada snapshot database akun/role assignment aktual yang bisa dibandingkan dengan menu dan endpoint; source migration saja tidak membuktikan assignment akun tertentu.
- Tahap 6 UAT browser tetap belum dilakukan.


## Temuan tambahan — snapshot permission frontend setelah perubahan role

- UI menyimpan `currentUser.permission_keys` sebagai snapshot ketika login.
- Endpoint update permission role dan scope role sebelumnya hanya memperbarui cache RBAC backend; berbeda dengan endpoint assignment role user yang sudah memanggil `revokeUserSessions(userId)`.
- Akibatnya, pegawai yang sedang login dapat tetap melihat menu lama setelah Superadmin mengubah permission/scope role. Backend sudah memakai policy baru sehingga klik/aksi dari menu lama dapat ditolak 403; grant baru juga belum muncul sampai sesi dimuat ulang.
- PR #362 memperbaiki kedua route: identifikasi user yang assigned ke role, cabut sesi mereka setelah transaksi commit, refresh cache policy, dan beri tahu Superadmin jumlah pegawai yang harus login ulang. Exact-head CI sedang berjalan.
- Ini merupakan temuan langsung yang menjelaskan sebagian gejala “menu berbeda/tidak sesuai per user”; tidak mengubah grant atau scope yang sudah ada.

