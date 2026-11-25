
### Loan request error recovery and borrower contact — 2026-11-25

- `CreateLoanModal` previously closed immediately after starting its asynchronous callback. It now awaits the parent callback and leaves close ownership with `App.tsx`, which closes the modal only after successful API response.
- The form collected `borrower_phone` and the domain service validated/persisted it, but `App.tsx` omitted it from single and batch request payloads. Added the optional field to both API client payload types and forwarded it in both paths.
- Added in-flight submit protection (disabled button + progress label) to prevent duplicate requests from repeated taps.
- Extended `test:loanable-pool-ui` to guard phone forwarding, modal close ownership, and duplicate-submit prevention. No schema, permission, approval, or collision policy changes.


### Dynamic RBAC role-assignment session revocation regression — 2026-11-25

- Rechecked `PUT /api/admin/rbac/users/:id/roles` on current `main`: it atomically replaces the full role set, enforces the last-active-Superadmin invariant, then calls `revokeUserSessions(userId)`, refreshes the local RBAC policy cache, and writes the audit event.
- The implementation already invalidates the target account's active sessions after a successful role-set change. The gap was regression coverage: the Dynamic RBAC foundation verifier asserted transaction/audit/cache behavior but did not guard the session-revocation call.
- Added a static regression assertion that the successful assignment path revokes target sessions before policy refresh. This is a test-only hardening change; no runtime behavior or database schema changed.

> **Historical-progress note:** This file is a chronological log of work at the PR/commit stated in each entry. Older recommendations and role/owner assumptions may have been superseded. Do not use an old PASS or old status as current-head evidence. Current owner intent and source behavior are summarized in `docs/PROJECT-CONTEXT.md` and `docs/IMPLEMENTATION-TRUTH-REGISTER.md`.

### Production dependency vulnerability gate — 2026-11-23 (PR #244; CI pending)

- Added `npm audit --omit=dev --audit-level=high` immediately after dependency installation in CI. The first run found three High and one Moderate advisory: body-parser 1.20.8, multer 2.4.0, qs 6.16.0, and Vite 6.4.3.
- Updated the lockfile to body-parser 1.20.9, multer 2.5.0, and qs 6.16.2; moved Vite 6.4.6 plus Vite build plugins into devDependencies. The server now dynamically imports Vite only in development, so production startup does not require a build dependency.
- Documented remediation policy: prefer compatible patched releases, avoid unreviewed `--force` upgrades, and require scoped/expiring exceptions rather than blanket suppressions.
- Added a production dependency boundary verifier to ensure package-lock/package.json agreement, development-only Vite imports, and Docker `npm ci --omit=dev`. Exact-head CI must verify the patched graph, production audit, and runtime smoke before merge.

### CSP report-only rollout — 2026-11-23 (PR #243; CI pending)

- Added a non-enforcing `Content-Security-Policy-Report-Only` header to API, HTML, and static asset responses.
- Scripts are restricted to same-origin in the initial policy; no `unsafe-inline` or `unsafe-eval` script allowance is present. Inline styles and Google Fonts remain explicit temporary allowances pending browser compatibility inventory.
- External HTTPS images/connections remain broad in report-only mode so current integrations can be observed before tightening.
- Added a P0 HTTP header regression and a rollout note. No claim of enforced CSP or active TLS/HSTS; enforcing CSP remains gated on browser UAT and violation review.

### Dynamic RBAC live HTTP authorization coverage — 2026-11-23 (PR #242; CI pending)

- Extended the fresh PostgreSQL integration to exercise all nine Dynamic RBAC administration endpoints as a Karyawan: permissions, roles, assignments, role create/update/delete, permission updates, scope updates, and user-role assignment.
- Each non-Superadmin request must receive HTTP 403; anonymous role reads must receive HTTP 401.
- The integration also compares role and target-user assignment counts before/after the denied requests to detect unauthorized mutation.
- This complements PR #238's source-level route guard regression with live HTTP enforcement coverage. Exact-head CI is pending.

### Company profile settings persistence — 2026-11-23 (PR #241; CI pending)

- Added migration `103_system_settings_company_profile.sql` for company name, accounting standard, base currency, and fiscal year. Defaults are seeded idempotently.
- Added authenticated reads and Superadmin-only writes. The API rejects extra fields, non-string values, invalid lengths, and invalid fiscal years; updates lock the singleton row and append audit history in the same transaction.
- Company profile audit history is protected from UPDATE, DELETE, and TRUNCATE. No-op saves do not create audit entries.
- Administration now loads the company profile from PostgreSQL, saves through the API, and disables editing when loading fails. Operational SLA values remain read-only server policy and are excluded from this endpoint.
- Added `test:system-settings-persistence` and PostgreSQL integration coverage for anonymous/staff/Superadmin access, validation, save/no-op/restore audit counts, and immutable audit history. Exact-head CI is pending.

### Company profile settings persistence — 2026-11-23 (PR #241; CI pending)

- Added migration `103_system_settings_company_profile.sql` for the company profile fields: company name, accounting standard, base currency, and fiscal year. Defaults are seeded idempotently.
- Added authenticated reads and Superadmin-only writes. The API rejects extra fields, non-string values, invalid lengths, and invalid fiscal years; updates lock the singleton row and append audit history in the same transaction.
- Company profile audit history is protected from UPDATE, DELETE, and TRUNCATE. No-op saves do not create audit entries.
- Administration now loads the company profile from PostgreSQL, saves through the API, and disables editing when loading fails. Operational SLA values remain read-only server policy and are not included in this endpoint.
- Added `test:system-settings-persistence` and PostgreSQL integration coverage for anonymous/staff/Superadmin access, validation, save/no-op/restore audit counts, and immutable audit history. Exact-head CI is pending.

### Notification rule persistence and enforcement — 2026-11-23 (PR #240; CI pending)

- Added migration `102_notification_rule_settings.sql` for four code-owned notification rules. Defaults are inserted idempotently; existing operator choices are preserved on subsequent migrations.
- Added authenticated read and Superadmin-only update endpoints. Updates accept strict booleans, lock the current row, and write immutable audit history in the same PostgreSQL transaction; no-op updates do not create audit events.
- Administration now loads actual rule states from PostgreSQL. It shows no assumed Active defaults when the server configuration is unavailable and disables controls during load, errors, and saves. UI state changes only after API success.
- Dashboard attention now applies persisted warranty, loan, and SLA switches. The BAST switch is read before handover, and resulting borrower/owner notifications are created inside the atomic loan mutation.
- Added `test:notification-rule-persistence` and registered it in CI. Exact-head workflow is running; this change is not yet eligible for merge.

### Dynamic observer route permission alignment — 2026-11-21

- Replaced the stale global middleware role-name gate on `GET /api/audit-logs` and `GET /api/reconciliation` with explicit dynamic permission checks (`audit.read` / `reconciliation.read`) when PostgreSQL RBAC is active. Custom roles with those grants are no longer blocked.
- Preserved canonical-path protection for uppercase and trailing-slash variants; unauthorized users still receive 403 before Express route matching. The route handlers repeat the permission checks for defense in depth.
- Reconciliation continues to return only assets from the caller's scoped-asset policy unless the caller is Superadmin/Auditor. Dashboard attention-card global-observer behavior is unchanged.
- Added `test:observer-route-rbac` and registered it in CI. The first CI run caught that removing the middleware guard weakened canonical-path protection; the guard was restored with dynamic permission evaluation.

# Pembaruan operasional — 21 November 2026 (Helpdesk assignment final verification)

- **CI run #2829 / 44903031303 SUCCESS — 91/91 steps** pada code SHA `033b2a18ba243e9e64105b5cfa671e2a9a426cd2`. Termasuk typecheck, Dynamic RBAC foundation, production build, Docker runtime, PostgreSQL 17, P0 security, ticket comments API/UI, dan ticket assignment API/UI.
- Manual assignment tiket kini memiliki endpoint `GET /api/tickets/:id/assignees` dan `PATCH /api/tickets/:id/assignment`. Kandidat dibatasi ke user aktif dengan `tickets.update` serta scope divisi/unit yang sesuai; Auditor dan Superadmin tidak menjadi petugas operasional.
- Penugasan hanya dapat diganti saat tiket `open` atau `assigned`; setelah pekerjaan dimulai API mengembalikan 409. Setiap perubahan dicatat ke audit log dan petugas baru menerima notifikasi akun dengan tautan ke tiket.
- Regression `test:ticket-assignment-api` memeriksa policy eligibility, route authorization, status lock, audit, persistence, notifikasi, API client, dan UI.
- Komentar tiket tetap menggunakan tabel PostgreSQL `ticket_comments`; regresi API/UI komentar lulus pada run yang sama.
- Batasan yang masih terbuka: lampiran tiket belum tersedia. Browser UAT per persona/lokasi, backup/restore DB + volume uploads, staging deploy/rollback, dan sign-off pemilik proses tetap wajib.
- PR #177 tetap Draft/Open dan belum di-merge. Tidak ada perubahan langsung ke `main`.

---

# Pembaruan operasional — 21 November 2026 (PR #177)

## Helpdesk: diskusi tiket dan hasil verifikasi

- Branch kerja: `fix/rbac-superadmin-admin-entry-2026-11-20`; PR #177 tetap Draft/Open, belum di-merge.
- API `GET /api/tickets/:id/comments` dan `POST /api/tickets/:id/comments` menggunakan tabel PostgreSQL `ticket_comments` yang sudah ada pada migration 001.
- Hak baca komentar mengikuti cakupan objek tiket (pelapor, petugas, scope divisi/unit, Superadmin; Auditor read-only). Penulisan dibatasi pada pelapor atau petugas yang memiliki `tickets.update` dan scope yang sesuai. Identitas penulis diambil dari sesi terautentikasi, bukan body request.
- Komentar dibatasi 4.000 karakter dan disimpan melalui transaksi PostgreSQL. Response menandai transaksi telah committed agar persistence middleware tidak melakukan snapshot kedua yang tidak diperlukan.
- UI daftar tiket menampilkan diskusi, penulis, waktu, dan input komentar; Auditor tidak diberi kontrol kirim.
- Regression `test:ticket-comments-api` mencakup tabel, route guard, object-level scope, Auditor read-only, validasi panjang, transaksi, API client, dan UI.
- **CI run #2815 / 44902087918 SUCCESS — 90/90 steps pada code SHA `0d53a814e307622031492f545dade3c19c99d11f`.** Typecheck, production build, Docker runtime smoke, PostgreSQL 17 fresh-database/persistence, P0 security, dan ticket-comments regression lulus. Setelah verifikasi ini, hanya dokumentasi progres yang diperbarui; tidak ada perubahan kode fungsional pada catatan ini.
- Penugasan ulang manual petugas kini tersedia melalui `GET /api/tickets/:id/assignees` dan `PATCH /api/tickets/:id/assignment`; kandidat harus aktif serta memiliki `tickets.update` dan scope antrean yang cocok. Auditor tidak dapat mengubah penugasan, perubahan setelah pekerjaan dimulai ditolak, semua perubahan diaudit, dan petugas baru menerima notifikasi langsung pada akun beserta tautan tiket. Regression `test:ticket-assignment-api` mencakup authorization, scope, status, persistence, notifikasi, API client, dan UI.\n- Batasan yang masih terbuka: lampiran tiket belum tersedia (upload yang ada hanya untuk dokumen kontrak).
- Status kesiapan: **belum GO produksi**. Browser UAT tiap persona/lokasi, uji backup/restore DB + volume uploads, staging deployment/rollback, dan sign-off pemilik proses tetap wajib.

---

# Pembaruan operasional — 20 November 2026 (setelah PR #172)

## Verifikasi terbaru di main

- **Main HEAD:** `12c6d6830039e4effbd18125effead97b91983ef`.
- **PR #165 — validasi relasi kontrak:** MERGED; CI exact-head lulus **76/76**.
- **PR #167 — integritas seed maintenance:** MERGED; CI exact-head lulus **77/77**. Jadwal maintenance kini menunjuk master aset/vendor yang tepat. Catatan lama tentang SC sebagai domain owner adalah snapshot saat itu dan tidak boleh digunakan untuk membuat owner baru; keputusan pemilik proyek saat ini memperlakukan RPC/SC sebagai lokasi/operasional context dan owner legacy SC/PIBC menunggu review per aset.
- **PR #169 — kepemilikan data berbasis immutable user ID:** MERGED; CI exact-head lulus **78/78**. Kepemilikan tiket, pinjaman, dan aset pribadi tidak lagi diperoleh dari kecocokan nama/email.
- **PR #170 — ID akun collision-resistant:** MERGED; CI exact-head lulus **78/78**. Create tunggal dan bulk import memakai `crypto.randomUUID()`; regression HTTP menguji dua create paralel.
- **PR #172 — session revocation pada perubahan dynamic RBAC:** MERGED; CI exact-head lulus **78/78**. Setiap perubahan assignment role mencabut sesi target; integrasi PostgreSQL membuktikan token lama ditolak (401), kemudian user dapat login ulang dan hak baru diterapkan.
- Smoke test direktori user memakai port ephemeral untuk mengurangi benturan port antar-run CI. Pengujian PostgreSQL menguji ulang alur autentikasi setelah role assignment berubah.
- **PR #164** memperbarui catatan readiness sebelumnya. Dokumen ini menyegarkan status tersebut setelah perubahan #165–#172.

## Fokus kerja berikutnya

1. Audit sisa PR/branch lama; port hanya perubahan unik yang sudah dibandingkan dengan main.
2. Lengkapi browser UAT per persona dan lokasi: Karyawan, IT, GA, ME/PIBC, Humas, Sekdir, Auditor, dan Superadmin.
3. Verifikasi user-role assignment tetap benar setelah restart dan upgrade dari snapshot legacy.
4. Uji alur lengkap aset, pinjaman, tiket, maintenance, reservasi, kontrak/vendor, lisensi, laporan, dan notifikasi dengan akun peran nyata.
5. Rehearsal backup/restore PostgreSQL **bersama** volume uploads, lalu staging deploy dan rollback.
6. Tetap **NO-GO untuk produksi** sampai bukti UAT, backup/restore, staging, dan sign-off pemilik proses lengkap. CI hijau bukan bukti deployment atau browser UAT.

---

# Pembaruan operasional — 20 November 2026

## Verifikasi terbaru

- **PR #163** `fix/ui: derive sidebar queue indicators from dynamic permissions` telah **MERGED** ke `main`.
- Merge commit/main HEAD: `a5838bae7b2e2faf854d605420f0e39b330d144f`.
- CI exact-head PR #163: **SUCCESS** pada SHA `59f1dbfd59af0436fbe4b8a6fb92f57a3afa8c34`; seluruh 71 langkah pemeriksaan substantif lulus, termasuk typecheck, regression RBAC/UI, production build, Docker runtime, PostgreSQL 17 integration, P0 security, loan, room reservation, ticket, asset, maintenance, dan persistence.
- Perubahan sidebar memakai effective permission keys untuk indikator antrean Humas, Sekdir, IT, dan GA. Nama role hanya fallback kompatibilitas file-store jika metadata permission tidak tersedia. Tidak mengubah API, grant permission, scope data, atau transaksi.
- **Tidak ada klaim UAT browser atau production deployment** dari hasil CI tersebut.

## Fokus kerja berikutnya

1. Audit sisa PR/branch lama sebelum mengambil perubahan unik; jangan merge branch yang base-nya sudah tertinggal atau bukan `main`.
2. Lengkapi pemeriksaan end-to-end semua workflow aset, pinjaman, tiket, maintenance, reservasi, kontrak, vendor, lisensi, laporan, dan notifikasi.
3. Jalankan UAT browser dengan akun per persona dan lokasi terhadap PostgreSQL.
4. Buktikan role assignment bertahan setelah write normal dan restart; uji upgrade dari snapshot legacy.
5. Rehearsal backup/restore PostgreSQL **bersama** volume uploads, lalu staging deploy/rollback.
6. Tetap NO-GO untuk produksi sampai bukti G3/G4 dan persetujuan pemilik proses tersedia.

---

# Status terkini — Stabilisasi GABAH (2026-11-09)

> Bagian ini adalah status operasional terbaru. Catatan Stage lama di bawah dipertahankan sebagai histori, bukan status branch/PR saat ini.

- **Branch utama:** `main`; perubahan masuk melalui PR terverifikasi langsung ke `main`.
- **Main terakhir:** `7abcfa54ec75037337fb44af8675208848a226c9` (PR #28 — custom role permission selection + Knowledge Base permission split).
- **PR #26:** konsolidasi Dynamic RBAC backend/scope dan protokol UAT; merged.
- **PR #27:** frontend permission guards untuk aset, peminjaman, dan helpdesk; merged. CI #605 SUCCESS (33/33).
- **PR #28:** custom role form kini menampilkan permission checkbox per modul sebelum dibuat; role dan permission disimpan atomik; tampilan mempertahankan checkbox terpilih setelah simpan; API menolak role tanpa permission dan menolak permission sistem inti. Knowledge Base memisahkan `knowledge.create` dan `knowledge.update`. PR merged.
- **CI PR #28:** #616 SUCCESS pada perubahan final PR (typecheck, regression checks, production build, Docker runtime smoke, PostgreSQL 17 integration, P0 security, directory, loan, meeting, contract, organization, asset, sidebar, maintenance).
- **CI main #618:** berjalan pada merge commit `7abcfa5`; periksa hasil akhir sebelum menyatakan main pasca-merge lulus.
- **Model organisasi:** role dasar pegawai adalah Karyawan; unit dan lokasi kerja merupakan atribut terpisah. Supply Chain/PIBC tidak otomatis menjadi role atau owner aset. Owner/pengelola aset terpisah dari lokasi fisik.
- **Lokasi aktif yang disepakati:** HO, PIBC, RPC/SC, Pangsub, Kantor Perawatan. Subang nonaktif untuk transaksi baru; riwayat lama tidak dihapus.
- **Preview/UAT:** checklist lengkap berada di `docs/testing/gabah-uat-checklist.md`, termasuk 12 smoke test sesi preview kantor. Seluruh kasus preview tetap NOT RUN sampai diuji langsung.
- **Belum production-ready:** browser UAT tiap jenis akun, rehearsal upgrade dari snapshot database legacy, backup/restore DB + uploads, staging deployment, TLS/reverse proxy, monitoring, dan sign-off pemilik proses belum dibuktikan.
- **Larangan operasional:** belum ada migrasi akun/data produksi atau deployment produksi. Gunakan database uji untuk preview; jangan menganggap CI sebagai pengganti UAT.


## Status final — Stage 13F merged (2026-10-21)

- PR #9 **MERGED**; main commit `921d3bb5bcdc32874a556260865e047a0af10868`.
- CI PR #9 **SUCCESS**: lint PASS, dynamic RBAC foundation verify PASS, build PASS, P0 security 37 HTTP assertions PASS, maintenance authorization HTTP assertions PASS. Hasil ini berlaku untuk CI yang dijalankan pada head PR #9.
- PR #7 lama ditutup sebagai superseded oleh PR #9.
- Checklist UAT: `docs/testing/gabah-uat-checklist.md`; status awal sebagian besar `NOT RUN`, PostgreSQL live / restore / deployment masih `BLOCKED`.
- Status aplikasi: **READY FOR UAT PREPARATION**, bukan production-ready. Perlu uji PostgreSQL live, UAT pengguna, deployment/rollback, dan backup/restore sebelum go-live.

---

## Tahap 13F — Maintenance Authorization, rekonsiliasi setelah merge Stage 13E (2026-10-21)

### Status
- Stage 13E / PR #6 merged ke `main`: `c769420e6b65afbfcca5ac6acbc839eff3b41f64`.
- Karena branch lama Stage 13F dibuat dari tip PR #6 sebelum squash-merge, metadata GitHub menandai PR #7 `mergeable=false`. Untuk menghindari force-push atau merge berisiko, implementasi Stage 13F direkonsiliasi ke branch baru `work/stage-13f-reconciled-main` yang berangkat dari main terkini.
- Branch rekonsiliasi membawa perubahan kode Stage 13F (server/services, server routes, migration 020, package script, static verifier, HTTP verifier, CI step). Dokumentasi progres disinkronkan terpisah dari kode agar status tidak tertinggal.
- **CI branch rekonsiliasi belum diverifikasi** pada saat catatan ini ditulis. Jangan merge sebelum CI terbaru sukses dan diff final ditinjau.

### Verifikasi dan batasan
- CI sebelumnya pada head PR #7: SUCCESS, termasuk lint/build, dynamic RBAC foundation 97/97, P0 37/37, maintenance HTTP file-store 33/33. Ini adalah hasil branch lama, bukan bukti bahwa branch rekonsiliasi sudah lulus.
- PostgreSQL live integration belum dijalankan; permission/scope mode PostgreSQL masih perlu uji runtime.
- Checklist UAT tersedia di `docs/testing/gabah-uat-checklist.md`; seluruh kasus masih perlu dijalankan oleh penguji yang punya akses lingkungan. Backup/restore dan deployment juga belum diverifikasi.

### Langkah berikutnya
1. Periksa diff branch rekonsiliasi terhadap main, khususnya tidak ada kehilangan Stage 13E.
2. Tunggu CI terbaru branch/PR baru.
3. Bila CI gagal, perbaiki dan rerun; bila lulus, tutup PR #7 lama setelah PR pengganti dibuat, bukan sebelum.
4. Setelah merge, lanjutkan UAT termasuk PostgreSQL live integration.

---

## Status handoff — 2026-10-21 (verifikasi GitHub)

- **Main**: `c769420e6b65afbfcca5ac6acbc839eff3b41f64`.
- **Stage 13E / PR #6**: merged. Scope perubahan adalah dynamic asset write authority untuk PATCH dan bulk-import UPDATE; hasil CI PR #6 SUCCESS sebelum merge.
- **Stage 13F / PR #7**: masih OPEN dan belum merged. CI pada head yang diperiksa SUCCESS, tetapi setelah PR #6 merged, metadata GitHub menunjukkan `mergeable=false`. Jangan merge sampai branch konflik/out-of-date diselesaikan dan CI terbaru terverifikasi.
- **Tes yang belum dibuktikan**: PostgreSQL live integration; UAT pengguna; deployment produksi; backup/restore recovery.
- **Next step**: rekonsiliasi PR #7 dengan `main`, jalankan ulang CI, review diff final, lalu merge hanya jika clean dan checks pass. Setelah itu jalankan UAT checklist di `docs/testing/gabah-uat-checklist.md`.

---

# Progres Dynamic RBAC — GABAH-GAS

Catatan progres permanen per tahap. Pemeriksa berikutnya dapat melanjutkan pekerjaan hanya dari file ini + `CHANGELOG.md`.

---

## Tahap 13E — Audit dan Perbaikan Authority Divisi Aset (2026-10-21)

### Kondisi awal
- Branch kerja `work/stage-13e-asset-division-authority` dari `main` @ `d30315d3a9df4242f98685866df55c97b2d81683` (Stage 13D); working tree bersih, tidak ada perubahan lokal asing yang tersentuh.

### Hasil audit terarah (kode HEAD `d30315d`, klaim lama diperiksa ulang)
Klaim Tahap 13A bahwa pemegang permission `assets.update`/`assets.bulk_import` via role kustom "menembus authority divisi" **diperiksa ulang dan TIDAK terbukti** pada kode aktual:

| Skenario actor | Perilaku PATCH & bulk import UPDATE (sesudah Stage 13C, sebelum 13E) |
|---|---|
| Role legacy sembilan role | Rule legacy string utuh; aset divisi lain ditolak (mis. aset IT hanya bisa diubah oleh string `IT`), aset tanpa owner divisi boleh |
| Superadmin (dinamis atau legacy `Admin GABAH`) | Bypass authority (bypass sah, authoritative) |
| Role kustom + permission operasi, string legacy NON-divisi | Ditolak pada aset IT/GA/SC/PIBC (deny; klaim bypass tidak tampak) tetapi boleh pada aset tanpa owner divisi |
| Role kustom + permission + scope dinamis `division:X` / `all` | Scope TETAP DIABAIKAN di jalur tulis → asimetri vs baca (Stage 11): yang bisa dibaca tak bisa diperbarui |
| Role kustom yang memakai alias string legacy (mis. string `IT`) | Authority itu berasal dari `users.role` compat bridge, bukan assignment dinamis; tidak bisa dicabut via Stage 12 |

Kesimpulan: masalah sebenarnya adalah **kebijakan tulis buta terhadap scope dinamis yang sudah bermakna di jalur baca**, bukan bypass.

### Keputusan kebijakan (terdokumentasi)
- Authority tulis dinamis hanya berasal dari scope `all` (semua aset) dan `division:X` (aset owner_division sama dengan X, case-insensitive) — mengikuti semantik baca Stage 11.
- Scope `own`, `unit`, `location` TETAP BACA SAJA: visibilitas tidak sama dengan mutabilitas. Superadmin yang ingin wewenang tulis perlu scope `division`/`all`. Bila nanti dianggap perlu oleh produk, penambahan wewenang tulis `own`/`unit`/`location` harus melewati tahap kebijakan tersendiri.
- Rule legacy sembilan role DAN bridge `users.role` tidak diubah pada tahap ini — pencabutan bridge adalah pekerjaan arsitektur tersendiri.

### Perubahan kode
- `server/services.ts`: helper `getDynamicAssetWriteAuthority(user)` — union scope dinamis `all`/`division`; tanpa policy berisi authority → set kosong (deny-by-default). Komentar menjelaskan keputusan visibility ≠ mutability.
- `server.ts` (PATCH `/api/assets/:id` + jalur UPDATE bulk-import): tiap pengecekan divisi kini `string legacy ATAU match-dynamic-scope`; dinamis hanya dihitung bila PostgreSQL aktif; gate permission operasi dan blokir Auditor/Karyawan/bulk empat role tetap di posisi semula.
- `scripts/dynamic-rbac-foundation-verify.mjs`: +7 pemeriksaan statis (semantik helper & deny-by-default, PATCH, bulk UPDATE, blokir role terbatas, gate permission, gate PG).
- Tidak ada perubahan UI, skema DB, konfigurasi produksi, atau modul lain.

### Hasil tes (benar-benar dijalankan pada branch ini)
| Command | Hasil |
|---|---|
| `npm run lint` | PASS (0 error) |
| `npm run build` | PASS |
| `node scripts/dynamic-rbac-foundation-verify.mjs` | **89/89 PASS** (7 check baru) |
| `node scripts/p0-security-verify.mjs` | **37/37 PASS** (file-store) |
- Hasil CI GitHub pada PR: **pass** (run 39532655819, https://github.com/inieki-lab/gabah-gas/actions/runs/39532655819/job/119001957474) — satu-satunya workflow CI repo (job `verify`: lint + build + kedua verify script). PR #6 dibuka pada state `OPEN`, `MERGEABLE` status: menunggu review/merge (bukan force-merge, sesuai aturan kerja).

### Limitasi dan sisa risiko
- **Uji runtime PostgreSQL live tetap belum pernah dijalankan**; seluruh pemeriksaan tahap ini statis + file-store. Jalur tulis dinamis menunggu environment PG.
- CREATE aset, assign/move/lifecycle masih murni rule string legacy — asimetri serupa menunggu tahap berikutnya bila dianggap diperlukan.

---

## Tahap 13D — Verifikasi CI dan Sinkronisasi Progres (2026-10-21)

### Tujuan
Verifikasi status aktual Stage 13B/13C di GitHub (bukan catatan lama), jalankan seluruh pemeriksaan yang memungkinkan secara lokal, dan sinkronkan dokumentasi. Tidak ada perubahan kode, skema, atau konfigurasi produksi pada tahap ini.

### Status aktual yang diverifikasi dari GitHub (HEAD main: `9bd52863829c9371d6e34465c65d6d1b44c4156f`)
- **Stage 13B (Knowledge):** branch `work/stage-13b-knowledge-rbac`, PR #4 **MERGED**, merge commit `3f075da13328bbffb1d2c174a1e1f31218c0f1ad`, CI push-merge **SUCCESS** (run 39353093753).
- **Stage 13C (Vendor):** branch `work/stage-13c-vendor-rbac`, PR #5 **MERGED**, merge commit `9bd52863829c9371d6e34465c65d6d1b44c4156f`, CI push-merge **SUCCESS** (run 39353550039).
- Seluruh run CI terakhir pada `main` berstatus `success`; tidak ditemukan check yang gagal, jadi tidak ada perbaikan yang diperlukan.

### Audit implementasi (baca kode, HEAD `9bd5286`)
- `POST /api/knowledge` & `PATCH /api/knowledge/:id`: gate `requireRbacPermission('knowledge.create'/'knowledge.update')` hanya saat PostgreSQL aktif; allowlist file-store `['Admin GABAH','IT','GA']` dipertahankan sebagai else-branch eksplisit.
- `POST /api/vendors` & `PATCH /api/vendors/:id`: gate `vendors.create`/`vendors.update` dengan pola identik; allowlist file-store lima role dipertahankan.
- Migration `018_*`: grant `knowledge.create`+`knowledge.update` hanya ke `superadmin`, `it`, `ga` (role aktif + permission aktif). Migration `019_*`: grant `vendors.create`+`vendors.update` hanya ke `superadmin`, `it`, `ga`, `supply_chain`, `pibc`. Keduanya additive/idempotent (`ON CONFLICT DO NOTHING`), tidak memberi grant implisit ke role lain/kustom.
- Gate permission bersifat no-op di file-store (`requireRbacPermission` langsung `return true` tanpa PG), sehingga fallback tetap ditentukan oleh allowlist legacy — kompatibilitas role legacy terjaga jalur-lokal.
- Guard domain IT/GA pada kategori vendor tetap dieksekusi **setelah** gate permission juga di mode PG; karena berbasis string `actor.role`, ia hanya aktif bagi role legacy `IT`/`GA` (role kustom pemegang permission tidak terkena restriksi kategori — lihat Gap).

### Hasil tes yang benar-benar dijalankan (sesi ini, HEAD `9bd5286`)
| Command | Hasil |
|---|---|
| `npm run lint` (tsc --noEmit) | PASS (0 error) |
| `npm run build` (vite build + build-server) | PASS |
| `node scripts/dynamic-rbac-foundation-verify.mjs` | **82/82 PASS** (termasuk 5 check knowledge + 4 check vendor) |
| `node scripts/p0-security-verify.mjs` (file-store live) | **37/37 PASS** |

### Limitasi
- **Pengujian integrasi PostgreSQL live masih belum pernah dijalankan** (berlaku sejak Stage 5; CI tidak menyediakan instance PostgreSQL). Tidak ada klaim PASS runtime-PG — verifikasi endpoint 13B/13C bersifat contract-statis dengan pola kode identik dengan endpoint RBAC yang sudah berjalan sejak Stage 5–8.

### Gap tetap terbuka (kumulatif, ringkas)
- Vendor read, maintenances (create/update/read), dan gate read-only/global observer masih hard-coded role (Tahap 13A; kontrak CR-01 untuk read-mode dinamis).
- Authority divisi pada PATCH/bulk import UPDATE aset tidak berlaku bagi role kustom pemegang permission — butuh rancangan authority dinamis.
- Restriksi kategori vendor berbasis string legacy hanya menjangkau role `IT`/`GA` legacy, bukan role kustom pemegang permission vendor.
- Endpoint baca assignment user, UI assignment role, pengujian integrasi PG, dan invalidasi cache multi-instance.

---

## Tahap 13C — Dynamic RBAC untuk Vendor Writes (2026-10-20)

### Tujuan dan cakupan
Memigrasikan endpoint create/update vendor ke permission dinamis pada mode PostgreSQL, dengan perubahan terbatas pada dua operasi tulis.

### Perubahan kode
- `POST /api/vendors` memeriksa `vendors.create` melalui `requireRbacPermission` ketika PostgreSQL aktif.
- `PATCH /api/vendors/:id` memeriksa `vendors.update` ketika PostgreSQL aktif.
- Mode file-store mempertahankan allowlist legacy Admin GABAH, IT, GA, Supply Chain, dan PIBC.
- Migration `019_dynamic_rbac_vendor_write_permissions_seed.sql` memberi grant awal hanya ke role canonical `superadmin`, `it`, `ga`, `supply_chain`, dan `pibc`; role custom tidak memperoleh grant implisit.
- Pengecekan domain IT/GA dan allowlist field pada update tetap ada. Perilaku baca vendor tidak diubah.
- Verify script mendapat pemeriksaan statis untuk seed dan kedua endpoint.

### Status verifikasi (diperbarui Tahap 13D, 2026-10-21)
- Lengkap di-merge ke `main` melalui PR #5 (branch `work/stage-13c-vendor-rbac`); merge commit `9bd52863829c9371d6e34465c65d6d1b44c4156f`.
- CI GitHub pada push merge ke `main`: **SUCCESS** (run 39353550039, https://github.com/inieki-lab/gabah-gas/actions/runs/39353550039).
- Pengujian integrasi PostgreSQL live belum dilakukan oleh sesi ini.

### Gap tetap terbuka
- Vendor read masih menggunakan role legacy dan penyaringan kategori; belum dimigrasikan karena memerlukan rancangan permission/scope baca.
- Enforcement permission dinamis di modul lain (maintenance, contracts, loan, ticket, room) belum disentuh.
- Endpoint baca assignment user dan UI assignment role masih belum ada.
- Kolom `users.role` masih menjadi sumber kompatibilitas legacy; backfill dapat memulihkan assignment legacy.
- Cache policy masih lokal per proses; invalidasi multi-instance belum diselesaikan.
- Risiko authority divisi pada PATCH/bulk update aset dan desain role read-only/global observer tetap mengikuti catatan Tahap 13A.

---

## Tahap 13B — Dynamic RBAC untuk Knowledge (2026-10-20)

### Tujuan dan cakupan
Migrasi dua operasi tulis Knowledge Base ke permission dinamis, sebagai tahap kecil setelah audit role statis Tahap 13A. Perubahan dibatasi pada create/update artikel; endpoint read, vote, dan view tidak diubah.

### Perubahan kode
- `POST /api/knowledge` memeriksa `knowledge.create` melalui `requireRbacPermission` ketika PostgreSQL aktif.
- `PATCH /api/knowledge/:id` memeriksa `knowledge.update` ketika PostgreSQL aktif.
- Mode file-store mempertahankan allowlist sebelumnya (`Admin GABAH`, `IT`, `GA`) secara eksplisit. Ini penting karena helper permission memang no-op di file-store; menghapus allowlist tanpa fallback akan memperluas akses lokal secara tidak sengaja.
- Migration `018_dynamic_rbac_knowledge_permissions_seed.sql` menambahkan grant idempoten untuk `superadmin`, `it`, `ga` saja, dan hanya untuk permission create/update Knowledge. Role lain dan role custom tidak memperoleh grant implisit.
- Validasi input, allowlist field update, audit event, dan persist behavior tidak diubah.
- Verify script ditambah lima pemeriksaan statis untuk migration, daftar grant, dan guard kedua endpoint.

### Status verifikasi (diperbarui Tahap 13D, 2026-10-21)
- Lengkap di-merge ke `main` melalui PR #4 (branch `work/stage-13b-knowledge-rbac`); merge commit `3f075da13328bbffb1d2c174a1e1f31218c0f1ad`.
- CI GitHub pada push merge ke `main`: **SUCCESS** (run 39353093753, https://github.com/inieki-lab/gabah-gas/actions/runs/39353093753).
- Pengujian integrasi PostgreSQL live tetap belum pernah dijalankan (CI tidak menyediakan instance PostgreSQL); hasil verifikasi selanjutnya tercatat di Tahap 13D.

### Gap tetap terbuka
- Enforcement permission dinamis di modul lain (maintenance, vendors, loan, ticket, contract, room) belum disentuh.
- Endpoint baca assignment user dan UI assignment role masih belum ada.
- Kolom `users.role` masih menjadi sumber kompatibilitas legacy; backfill dapat memulihkan assignment legacy.
- Cache policy masih lokal per proses; invalidasi multi-instance belum diselesaikan.
- Risiko authority divisi pada PATCH/bulk update aset dan desain role read-only/global observer tetap mengikuti catatan Tahap 13A.

---

## Tahap 12 — Dynamic RBAC User-to-Role Assignment (2026-10-15)

### Tujuan
Memberi Superadmin kemampuan menetapkan/mengubah assignment role (termasuk role custom) ke sebuah user via `PUT /api/admin/rbac/users/:id/roles`, dengan validasi ketat, operasi atomik, dan tanpa mengubah modul lain.

### Status sebelum perubahan (acuan `7a5cedbd7439b9cc692d696915ff49fade358ecd`)
- Fondasi Dynamic RBAC lengkap (Stage 1–11): CRUD role, permission per role, scope per role, enforcement permission dinamis di dashboard/assets(7)/movements, dan scope dinamis untuk visibilitas aset role non-legacy.
- `gabah_user_roles` **belum memiliki endpoint assignment** — baris assignment hanya dibaca (hitung) di CRUD role (`server.ts`) dan dibangkitkan oleh backfill legacy di `server/persistence.ts`. Role custom dapat dibuat via API namun tidak dapat dipasangkan ke user mana pun (temuan audit tahap sebelumnya).

### Status sesudah perubahan
- Assignment user→role dikelola Superadmin sebagai **set penuh** (`role_ids: number[]`), atomik dalam satu `withRbacTransaction` (DELETE set lama + INSERT set baru `ON CONFLICT (user_id, role_id) DO NOTHING`) — tidak ada assignment parsial; gagal setengah jalan di-rollback.
- Gate `requireRbacSuperadmin`: 503 saat PostgreSQL nonaktif, 403 bila pelaksana bukan pemegang role superadmin dinamis.
- Validasi server-authoritative:
  - User target harus ada di tabel `users` → `RBAC_USER_NOT_FOUND` (404).
  - Semua `role_id` harus terdaftar **dan aktif** → `RBAC_ROLE_INVALID` (400). Role nonaktif/tak dikenal ditolak.
  - Duplikat `role_id` di-dedup sebelum disimpan.
- Perlindungan Superadmin terakhir (`RBAC_LAST_SUPERADMIN` 409): bila target adalah satu-satunya pemegang role superadmin-capable (gab `gabah_roles.is_superadmin`) dan set baru tidak memuat role tersebut, ditolak — konsisten dengan guard PATCH/DELETE `/api/users/:id` yang sudah ada.
- `assigned_by_user_id` diisi id Superadmin pelaksana.
- Audit event `RBAC_USER_ROLES_UPDATED` (nama + email target, daftar role baru) dicatat setelah `await refreshRbacPolicy()`.
- `rbacFailure` diperluas dengan 3 mapping status baru (404/400/409).

### Endpoint yang dibuat/diubah
- **Baru:** `PUT /api/admin/rbac/users/:id/roles` (`server.ts`, blok Dynamic RBAC admin, setelah handler scopes). Body: `{ "role_ids": [1, 2, …] }`. Response: `{ user_id, user_name, user_email, role_ids, role_names }`.
- **Diubah:** helper `rbacFailure` di `server.ts` (pesan baru untuk 3 error).
- Tidak ada endpoint baca assignment (daftar per user) dan tidak ada UI — di luar batas minimum tahap ini.

### Ketentuan desain yang dipertahankan
- Kolom `users.role` legacy tetap otoritatif untuk logic bisnis; assignment dinamis adalah layer RBAC paralel (istilah repo: "compatibility bridge"). Konsekuensi yang perlu dipahami operator: jika `users.role` sebuah user masih legacy dan assignment legacy-nya dihapus via endpoint ini, backfill saat persist berikutnya akan memulihkan mapping legacy tersebut sesuai `users.role`. Assignment ke **role custom tidak pernah disentuh** backfill.

### Tes yang benar-benar dijalankan (aktual)
| Check | Command | Hasil |
|---|---|---|
| Verify Dynamic RBAC (contract-statis) | `node scripts/dynamic-rbac-foundation-verify.mjs` | **73/73 PASS** (8 check baru: keberadaan endpoint, guard superadmin, validasi user & role nonaktif/tak dikenal, atomicity transaksi, stamp `assigned_by`, last-superadmin guard, audit + refresh policy) |
| Typecheck | `npm run lint` | PASS, 0 error |
| Build | `npm run build` | PASS |
| P0 security (file-store live HTTP) | `node scripts/p0-security-verify.mjs` | **37/37 PASS** (kompatibilitas file-store tak berubah; endpoint baru PG-only) |

### Tes yang belum tersedia / belum dijalankan
- **Integrasi PostgreSQL live untuk endpoint ini**: CI tidak menyediakan instance PostgreSQL (berlaku sejak Stage 5). Semua pemeriksaan yang menyentuh jalur endpoint baru bersifat contract-statis; jalur PostgreSQL (INSERT/DELETE nyata, rollback saat error, refresh cache) belum dieksekusi nyata di pipeline. Secara arsitektur identik (pattern & helper) dengan RBAC admin endpoints yang sudah berjalan di produksi-env PG sejak Stage 5–8; tetap direkomendasikan uji integrasi PG sebelum produksi.
- Tes runtime case: allowed/denied akses, role custom yang berhasil ditetapkan, role nonaktif/tak dikenal ditolak, rollback kegagalan penyimpanan — semuanya berada dalam kategori di atas (design-test belum tersedia, bukan tes yang gagal).
- P1 verify script (`scripts/p1-features-verify.mjs` dll.) tidak berjalan di CI — kondisi pra-tahap ini, tidak diubah.

### Gap yang masih terbuka (tahap berikutnya)
1. Tes integrasi PostgreSQL di CI (prioritas; menguntungkan semua tahap sebelumnya).
2. Endpoint baca assignment per user + UI AdministrationModal untuk mengelola assignment dari browser.
3. Keputusan produk terkait ketentuan desain di atas (backfill yang memulihkan assignment legacy) — perketat atau didokumentasikan ke operator.
4. Enforcement permission dinamis modul lain (loan/ticket/contract/maintenance) — sesuai batas tahap, masih statis (117 komparasi nama role terhitung pada audit tahap 11).
5. Uji multi-instance: cache policy `refreshRbacPolicy()` hanya cache lokal di proses yang mengeksekusi mutasi; deployment multi-node dengan PostgreSQL berisiko policy cache antar-node tidak saling ter-refresh (temuan audit tahap 11, belum ditangani).

### Commit
- **`2d87f4e18c890547e13f190fc6c2fb177dce96ff`** (`2d87f4e`, "feat(rbac): add superadmin user-to-role assignment endpoint") — ter-push ke `main` (`7a5cedb..2d87f4e`), 5 file, 160 insertion / 1 deletion.
- CI GitHub pada commit tersebut: **SUCCESS** (11/11 step success: checkout, Node 20, install, typecheck/lint, Dynamic RBAC contract checks 73/73, production build, P0 security verification 37/37, dan langkah post-jobs).
- Verifikasi hash dilakukan terhadap `git rev-parse HEAD` aktual saat push, bukan tebakan; update ini masuk di commit docs terpisah agar hash tidak pernah ditulis berbeda dengan push yang nyata.

---

## Tahap 13A — Hardcoded Role Audit (READ-ONLY, 2026-10-19)

### Commit HEAD yang diperiksa
`8b7a8e2222e307d752030adb3ca1b2be0fa67006` (`8b7a8e2`, docs Stage 12) — bukan commit acuan `2d87f4e` lagi; HEAD divalidasi `git fetch` + `git rev-parse` sebelum audit. **Tahap ini tidak mengubah kode aplikasi, skema database, atau konfigurasi — hanya dokumentasi.**

### Kualitatif
- ~117 perbandingan nama role hidup di 3 file otorisasi (`server.ts` 53, `server/services.ts` 49, `server/runtime-hardening.ts` 15).
- Batas tugas: max 30 temuan teratas, prioritas middleware/helper. Pola berulang (authority divisi owner sama di 5 lokasi services + 2 lokasi server) dilaporkan sebagai 1 grup temuan per pola.

### Temuan per kategori (30)

#### Kategori 1 — Security gate (12)
| # | Lokasi | Perilaku sekarang | Dampak role custom | Rekomendasi |
|---|---|---|---|---|
| 1 | `runtime-hardening.ts:135-144` (middleware global) | `actor.role === 'Auditor' && method !== GET` → 403 seluruh non-GET; allowlist `['/api/auth/logout','/api/notifications/read-all']` + regex read notifikasi | Role custom **tidak tersentuh** (gate match nama legacy) — detailnya itu justru dampak terpentingnya: role custom tidak diblok (bisa menulis jika handler lain mengizinkan), dan sebaliknya role read-only custom tidak bisa diwujudkan setara Auditor | Konversi ke flag dinamis (mis. scope/type `read_only` di `gabah_roles`) yang dihitung `getUserRbacPolicies()`; file-store pertahankan legacy string |
| 2 | `runtime-hardening.ts:7 isGlobalObserver` | `isSuperadmin(actor) \|\| role === 'Auditor'` | Custom role tak bisa jadi global observer | Permission dinamis (katalog belum punya `audit.read`; tambahkan atau pakai `audit.export` khusus) |
| 3 | `runtime-hardening.ts:149-155` | `/api/audit-logs` & `/api/reconciliation` di-gate `isGlobalObserver` | Sama dengan #2 | Ikut `isGlobalObserver` jika #2 dikerjakan |
| 4 | `runtime-hardening.ts:157-161` | `/api/assets/:id` → 403 bila `!canSeeAsset` | Tercek di canSeeAsset (#5) | Perbaiki lewat #5/Stage 11 scope dinamis |
| 5 | `runtime-hardening.ts:27-46 canSeeAsset` | 9 cabang role legacy; **role tak dikenal → `return false` (aman)** | Custom role = blind total untuk detail aset lewat path ini, meski punya `assets.read` (inkonsisten vs list yang sudah scope dinamis) | Reuse resolusi scope dinamis Stage 11 (`filterAssetsByDynamicScopes`) untuk role non-legacy |
| 6 | `runtime-hardening.ts:51-57 canManageTicket` | Role→kategori tiket (Auditor false, Karyawan reporter-sendiri, IT/GA/SC/PIBC=kategori divisi); unknown role → false | Custom role tak bisa mengelola tiket siapa pun | Permission dinamis `tickets.update_*` per kategori, atau scope `division` |
| 7 | `server.ts:1745,1748 (POST /api/assets/bulk-import)` | Tolak eksplisit Auditor & Karyawan | Custom role lolos blok ini, tapi masih ditahan `assets.bulk_import` (016) | Tidak mendesak; biarkan, permission gate sudah menahan |
| 8 | `server.ts:1846-1858` | Bulk-import jalur UPDATE: authority divisi per owner (`role !== 'IT'/'GA'/'Supply Chain'/'PIBC'`) — SEC-10 | Custom role dengan permission bulk-import **menembus authority divisi ini** (pemilik divisi tak terdefinisi) | Perlu keputusan eksplisit Stage 13+: mapping divisi custom (via scope `division`) → authority |
| 9 | `server.ts:1950-1968 (PATCH /api/assets/:id)` | Blok Auditor/Karyawan + authority divisi owner | Sama seperti #8 | Sama dengan #8 |
| 10 | `server.ts:2324,2384 (POST/PATCH /api/maintenances)` | Hard list `['Admin GABAH','IT','GA']` | Custom role selalu ditolak (403) meski diberi permission `maintenances.*` | Ganti ke `requireRbacPermission('maintenances.create'/'update')` + seed 018 mirror list legacy |
| 11 | `server.ts:2448,2482 (POST/PATCH /api/vendors)` | Hard list `[Admin GABAH, IT, GA, Supply Chain, PIBC]` | Sama: custom selalu ditolak | Sama dengan #10 (`vendors.create`/`update`) |
| 12 | `server.ts:2513,2540 (POST /api/knowledge, PATCH /api/knowledge/:id)` | Hard list `['Admin GABAH','IT','GA']` | Sama: custom selalu ditolak | Sama dengan #10 (`knowledge.create`/`update`) **→ kandidat 13B (paling kecil)** |

#### Kategori 2 — Business rule (11)
| # | Lokasi | Perilaku sekarang | Dampak role custom | Rekomendasi |
|---|---|---|---|---|
| 13 | `services.ts:247-260 createAsset` | Blok 4 role read-only + authority divisi kategori; pengecualian khusus: GA boleh membuat INV-F(N) `services.ts:254` | Custom tak lolos blok read-only & authority tak terdefinisi | Biarkan; aturan bisnis divisi dipertahankan | 
| 14 | `services.ts:377-386 assignAsset` | Authority divisi + guard aset IT hanya IT | Sama | Pertahankan; nanti rujuk scope `division` |
| 15 | `services.ts:463-472 & 513-522 (moveAsset, mutateLifecycle)` | Authority divisi owner (pola berulang, 1 grup) | Sama | Pertahankan |
| 16 | `services.ts:368-370 approve_disposal` | Sudah dinamis via `isSuperadminActor` (bukan string) — contoh yang benar | Custom role superadmin-capable otomatis diakomodasi jalan | Siap pakai sebagai pola acuan modul lain |
| 17 | `services.ts:646-652 approveLoan`, `715-724 requestLoan` | Authority divisi owner loan | Sama | Pertahankan |
| 18 | `services.ts:761-764` | Map role→divisi persetujuan loan (IT/GA/SC/PIBC) | Custom tak terpetakan | Pertahankan; petakan via scope saat migrasi |
| 19 | `services.ts:729 cancelLoan`, `runtime-hardening.ts:68` | Auditor tolak cancel; Karyawan lihat loan sendiri | Kecil; custom blind | Ikut migrasi loan nanti |
| 20 | `services.ts:1122,1260,1162-1165 (room reservation)` | Auditor ditolak; **Sekretaris Direksi auto-approve + prioritas high VIP** | Behavior VIP hilang untuk custom | **Rule bisnis khusus — pertahankan; rancang ulang eksplisit bila dibutuhkan** |
| 21 | `services.ts:1395,1477 (approve/rejectRoomReservation)` | `isSuperadminActor \|\| role !== 'GA'` | Custom tak bisa approve | Pertahankan (PIC fasilitas) |
| 22 | `services.ts:1664,1685,1700 (meeting types/facilities)` | `superadmin \|\| GA(\|\| IT)` master-data guard | Custom sama tak tersentuh | Pertahankan; admin-only by design |
| 23 | `server.ts:2582 (GET /api/notifications)` | Rule routing khusus Humas (notifikasi liputan) | Custom tak terlayani rule | **Rule bisnis khusus — pertahankan** |
| 24 | `server.ts:2193-2212 (GET /api/tickets)` | List filter: superadmin/Auditor semua; IT=IT; SC/PIBC=kategori sendiri; GA; sisanya reporter sendiri | Custom = reporter-sendiri (aman, default ketat) | Pertahankan; rujuk scope `division` saat migrasi |
| 25 | `server.ts:2305-2314, 2430-2440` | Filter list maintenances & vendors per role | Custom blind (list kosong/deny) | Ikut #10/#11 saat migrasi |

#### Kategori 3 — Compatibility mapping (4)
| # | Lokasi | Perilaku sekarang | Dampak role custom | Rekomendasi |
|---|---|---|---|---|
| 26 | `persistence.ts backfillDynamicRbacUserRoles` | Bridge: reconcile 9 mapping legacy dari `users.role` → `gabah_user_roles` | Role custom tidak pernah disentuh (by design, terdokumentasi Stage 12) | **Dipertahankan** | 
| 27 | `server.ts:590-594 (PATCH /api/users/:id)` | Last-superadmin guard berbasis string legacy `'Admin GABAH'` demi proteksi akun USR-01 | Custom superadmin-capable TIDAK dihitung di guard ini, meski terproteksi via endpoint Stage 12 (`RBAC_LAST_SUPERADMIN`) | Selaraskan kedua guard: hitung dari `gabah_roles.is_superadmin` |
| 28 | `server.ts:468-470 (POST /api/users)` | `validRoles` 9 legacy untuk atribut `users.role` | User baru tak bisa dibuat dengan nama role custom di kolom legacy (by design — role custom lewat assignment Stage 12) | Dipertahankan sampai `users.role` migrasi penuh |
| 29 | `server.ts:907 (POST /api/auth/login)` | Alias-prefix login untuk 9 akun kanonikal | Identitas akun, bukan authorization | Dipertahankan |

#### Kategori 4 — Display/UI logic (2)
| # | Lokasi | Perilaku sekarang | Dampak role custom | Rekomendasi |
|---|---|---|---|---|
| 30 | `server.ts:390,470,643` (label) & teks detail audit (mis. `server.ts:594-dll`) | Map label tampilan role ('Super Admin', 'Admin GABAH (Super Admin)') dan teks audit memakai nama role | Label custom menggunakan fallback; teks audit hanya isi pesan | Murni tampilan/non-otorisasi — biarkan sampai frontend role custom |

### Kandidat paling aman dan kecil untuk Stage 13B
**#12 — ganti hard list di `POST /api/knowledge` (`server.ts:2513`) & `PATCH /api/knowledge/:id` (`server.ts:2540`) menjadi `requireRbacPermission('knowledge.create' / 'knowledge.update')`.** Alasan: permission **sudah ada di katalog** (011/012, tanpa migration catalogue baru — cukup migration seed `018_*` additive: grant `[superadmin, it, ga]` mirror hard list); gate no-op di file-store (P0 tetap hijau); perilaku legacy role invarians (9 legacy tetap terkeha), hanya membuka jalur yang tadinya mustahil bagi role custom; blast radius terkecil (modul knowledge, 2 handler).

### Yang sengaja belum disentuh (dan alasannya)
1. #1–#3 (read-only Auditor middleware & global observer) — semantik `Auditor` adalah kontrak keamanan lintas aplikasi (CR-01); migrasi butuh perancangan read-mode dinamis, bukan pergantian string.
2. #8/#9/#13–#18/#20–#23 (authority divisi & rule bisnis khusus: VIP SekDir, notifikasi Humas, INV-F GA) — keputusan produk, bukan refactor mekanis; beberapa harus dipertahanan selamanya.
3. #26–#29 (kompatibilitas `users.role`) — dipertahankan sesuai arsitektur jembatan sejak Stage 2.
4. Semua modul loan/ticket/contract/maintenance/room — di luar batas tugas 13A.

### Konfirmasi
Tahap 13A **tidak mengubah** file `server.ts`, `server/services.ts`, `server/runtime-hardening.ts`, `server/rbac-policy.ts`, migration, CI, maupun konfigurasi. Seluruh perubahan commit ini hanya `CHANGELOG.md` dan `docs/*` (setelah diff review).


---

## Addendum — Handoff & koreksi keputusan bisnis (2026-11-08)

> **Bagian ini lebih baru dan mengesampingkan catatan lama yang bertentangan di atas.** AI/pengembang berikutnya wajib membaca bagian ini sebelum mengubah RBAC, migrasi organisasi, atau data aset.

### Status branch dan perubahan terakhir yang terverifikasi

- Repository: `inieki-lab/gabah-gas`
- Branch kerja: `fix/role-based-navigation`
- PR: [#18](https://github.com/inieki-lab/gabah-gas/pull/18) — masih **Draft / Open**, belum merge.
- HEAD saat catatan ini dibuat: `656dc36d952af918415b9c4eea385ca988b566ad`.
- CI terakhir yang diperiksa: [run 42475092479](https://github.com/inieki-lab/gabah-gas/actions/runs/42475092479) — **success**. Ini hanya membuktikan job CI yang tersedia lulus, bukan UAT seluruh role atau kesiapan produksi.
- Commit terbaru yang relevan:
  - `61c1bc1` — GA inventory mengikuti explicit dynamic asset scope; akses baca IT workstation dipisahkan.
  - `3014c90` — POST asset tidak lagi menolak berdasarkan label role Auditor/Karyawan; otorisasi tetap harus diputuskan oleh permission dan domain service.
  - `656dc36` — verifikasi source asset scope diperbarui.
- Perubahan GA: GA mengelola aset owner GA; IT laptop/desktop dapat terlihat oleh GA hanya jika permission `assets.read.it_workstations` diberikan. Kategori yang dibaca dibatasi kode `HLT` dan `HPC`; akses ini read-only.

### Koreksi penting atas catatan migrasi sebelumnya

Catatan tahap 13/8 November sebelumnya menyebut migration `026_map_branch_accounts_to_employee_location.sql` memetakan seluruh akun Supply Chain/PIBC ke role Karyawan. **Jangan menganggap pendekatan itu sebagai keputusan bisnis final.**

Keputusan user yang paling baru dan menjadi acuan:
- Supply Chain dan PIBC adalah **lokasi kerja/cabang**, bukan role aplikasi dan bukan otomatis unit pemilik aset.
- Di setiap lokasi terdapat jabatan/fungsi seperti Kadiv, Kadep, Kasi, dan Staf.
- Jangan mengubah seluruh pegawai SC/PIBC menjadi Karyawan hanya karena lokasi kerjanya.
- Role aplikasi ditentukan oleh fungsi pekerjaan dan permission yang disetujui; jabatan, unit organisasi, lokasi kerja, role aplikasi, dan scope data adalah atribut terpisah.
- Sebelum migration 026 dijalankan di database mana pun, audit ulang isi SQL dan data target. Buat pemetaan aman berdasarkan fungsi/jabatan dan pertahankan role tambahan. Jangan menghapus/mengganti akun, histori, atau role lama secara massal. Bila mapping tidak dapat dibuktikan, tandai untuk review Super Admin.
- Migration 026 dan 027 belum boleh dianggap sudah diterapkan di produksi. Backup, dry-run, row-count, dan persetujuan tetap wajib.

### Model organisasi dan otorisasi yang wajib dipertahankan

Pisahkan dimensi berikut; jangan gabungkan menjadi satu kolom/label:
1. Perusahaan.
2. Lokasi kantor/kerja (HO, Supply Chain, PIBC, dan lokasi lain).
3. Unit organisasi/fungsi.
4. Jabatan/level (Direksi, Kadiv, Kadep, Kasi, Staf).
5. Role aplikasi (template kapabilitas).
6. Permission tindakan.
7. Data scope per modul.
8. Owner division aset (IT atau GA untuk klasifikasi yang sudah terbukti).
9. Lokasi fisik aset.
10. Pegawai/PIC/custodian aset.

Matriks kepemilikan aset yang disetujui:
- Super Admin: akses global sesuai permission.
- IT: kelola aset owner IT di seluruh lokasi.
- GA: kelola aset owner GA di seluruh lokasi.
- GA dapat diberi permission baca IT Laptop/PC saja; tidak boleh melakukan mutasi atas aset tersebut. Super Admin dapat mengaktifkan/nonaktifkan akses baca tersebut melalui permission/menu.
- Lokasi SC/PIBC tidak memberikan hak kelola aset.
- Aset owner SC/PIBC historis tidak boleh otomatis dialihkan ke IT/GA. Review per aset dengan bukti; data ambigu tetap dibatasi untuk review Super Admin.
- Auditor read-only.
- Humas dan Sekretaris Direksi tetap pegawai dengan fungsi dasar personal sesuai permission, ditambah kapabilitas pekerjaan yang eksplisit; bukan asset owner.

### Pekerjaan lanjutan — urutan wajib

1. **Audit migration dan model organisasi:** periksa migration 026, migration 006/master org, migration 030/031, seed, data existing, dan UI Administration. Pastikan SC/PIBC tidak diperlakukan sebagai role/owner dan mapping pegawai tidak massal ke Karyawan.
2. **Backend authorization:** audit seluruh list dan direct-ID endpoint. Backend wajib menegakkan permission + scope; filter frontend hanya UX. Fokus users/master data, assets, loans, tickets, maintenance, rooms, vendors, contracts, licenses, reports, search, exports, dashboard aggregates, notifications, audit, dan BAST.
3. **Asset mutation:** pastikan assign/move/lifecycle/edit/delete/bulk import hanya dapat dilakukan oleh Super Admin atau pemilik fungsi IT/GA dengan permission + scope yang benar. GA read-only IT workstation tidak boleh lolos mutasi. SC/PIBC location tidak boleh menjadi grant.
4. **Loan/ticket/maintenance/reservation:** hilangkan keputusan akses berdasarkan label lokasi/role lama jika bertentangan dengan permission dan scope; pertahankan aturan bisnis khusus yang telah dikonfirmasi (mis. prioritas Sekretaris Direksi) sebagai capability/workflow eksplisit.
5. **Dynamic navigation:** menu, halaman, tombol, dan landing/workspace harus mengikuti permission efektif dan scope. Pegawai, termasuk Humas/Sekdir, perlu fungsi personal yang sesuai seperti My Assets, permintaan pinjaman, tiket, dan reservasi ruang bila permission diberikan.
6. **Administration UI:** role template, permission, user-role assignment, scope per modul, jabatan, unit, dan lokasi harus jelas serta dapat dikelola Super Admin tanpa daftar role statis yang bertentangan dengan backend.
7. **Regression test & UAT:** tes kombinasi role/permission/scope untuk list, detail ID, create/update/delete, dashboard, export, dan navigasi. CI hijau bukan pengganti UAT dengan akun representatif.
8. **Workflow Humas:** baru dikerjakan setelah fondasi RBAC stabil. Permintaan dokumentasi harus menjadi work item yang terkait agenda/reservasi, punya PIC, assignment ke satu/beberapa Humas, accept/reject dengan alasan, status/progress, notifikasi, dan audit trail — bukan notifikasi lepas.
9. Jangan migrasi backend ke Rust sekarang. Stabilkan dan rapikan sistem yang ada lebih dahulu.

### Instruksi kerja untuk AI/agent berikutnya

- Mulai dengan membaca `PROJECT-RULES.md`, `docs/audits/RBAC-DATA-SCOPE-AUDIT-2026-11.md`, dokumen ini (bagian addendum terbaru), migration terkait, lalu source code aktual pada branch terbaru.
- Jangan percaya catatan lama bila bertentangan dengan keputusan user terbaru atau implementasi aktual. Tandai konflik dokumentasi dan selesaikan dengan bukti.
- Jangan mengubah database produksi atau menjalankan migration destruktif tanpa backup, dry-run, laporan dampak, dan persetujuan eksplisit.
- Jangan membuat perubahan besar sekaligus. Kerjakan satu domain, tulis test yang menguji perilaku, jalankan CI, lalu lanjut.
- Jangan mengklaim selesai hanya karena TypeScript/build/CI lulus. Laporkan cakupan yang benar-benar diuji dan yang belum.
- Setiap sesi wajib memperbarui `docs/progress/dynamic-rbac-progress.md` dan `CHANGELOG.md` bila ada perubahan aplikasi. Catat tanggal, branch/HEAD, file/commit, tes/hasil, keputusan baru, risiko, dan next action.
- Jangan merge PR #18 sampai model organisasi, seluruh backend scope kritis, navigasi, CI, dan UAT role utama telah diverifikasi. User memang mengizinkan merge jika sudah benar; izin tersebut bukan instruksi untuk merge sebelum acceptance criteria terpenuhi.

### Penjelasan singkat mengapa pekerjaan ini sulit bagi agent coding

GABAH bukan satu bug terisolasi. Aturan akses tersebar di middleware, route Express, domain service, resolver RBAC, migration SQL, seed, frontend navigation, dashboard, dan modal Administration. Ada beberapa generasi model role (legacy role, dynamic role, primary/additional role, jabatan, unit, lokasi) yang hidup bersamaan dan beberapa dokumen masih saling bertentangan. Agent yang hanya membaca satu file, mengandalkan skill umum, atau mengerjakan prompt per fitur akan mudah memperbaiki tampilan tetapi melewatkan jalur API lain atau malah memperkuat aturan lama yang salah. Solusinya adalah audit lintas lapisan, satu keputusan bisnis yang otoritatif, tes matriks permission/scope, dan log handoff yang selalu diperbarui.


### Addendum keputusan bisnis terbaru — lokasi dinamis dan aset operasional (2026-11-08)

Keputusan ini memperjelas model organisasi/aset dan **menggantikan asumsi terlalu sederhana bahwa seluruh owner aset hanya IT atau GA**.

#### Lokasi kerja / site
- Lokasi bersifat master data yang dapat bertambah dan berubah; jangan hardcode daftar lokasi ke role atau permission.
- Lokasi yang saat ini diketahui: **HO, PIBC, RPC/SC, dan Pangsub**. Pangsub belum memiliki lokasi operasional di luar Jakarta saat ini; lokasi/site baru seperti Subang harus dapat ditambahkan ketika dibutuhkan.
- Nama lokasi, singkatan, dan struktur geografis harus menjadi data master terpisah dari role aplikasi dan owner aset.
- Jangan menganggap daftar di atas sebagai daftar lokasi final/permanen. Sistem harus mendukung penambahan site, gudang, kantor, pasar, dan fasilitas operasional baru tanpa membuat role baru.

#### Kepemilikan aset harus mendukung unit operasional
- Owner aset tidak boleh dipaksa hanya menjadi IT atau GA.
- Aset dapat dimiliki/dikelola fungsi operasional. Contoh yang diberikan user: **mesin produksi beras di gudang Subang merupakan aset RPC/SC, bukan GA**, karena merupakan peralatan operasional gudang.
- Karena itu, pisahkan sekurangnya: owner organisasi/fungsi (mis. IT, GA, RPC/SC), lokasi fisik/site (mis. Subang), kategori aset, unit pengguna, custodian/PIC, serta permission dan data scope pengguna.
- Lokasi Subang tidak otomatis menjadikan aset milik GA, RPC/SC, atau unit tertentu. Owner ditentukan dari kepemilikan/fungsi bisnis dan bukti pencatatan aset; lokasi hanya menyatakan tempat aset berada.
- Pegawai yang bekerja di suatu lokasi tidak otomatis mendapat akses ke seluruh aset di lokasi itu. Akses ditentukan oleh role/permission dan scope organisasi/site yang diberikan.
- IT dan GA tetap memiliki cakupan lintas lokasi sesuai mandat masing-masing. Unit operasional seperti RPC/SC dapat memiliki scope aset operasional sendiri. Super Admin mengelola template role, permission, owner classification, dan scope tersebut.
- Jangan memindahkan owner aset historis secara massal. Data owner yang belum jelas harus masuk antrean verifikasi.

#### Implikasi desain dan pekerjaan berikutnya
1. Evaluasi ulang schema `owner_division` dan scope RBAC. Jangan membatasi enum/katalog owner hanya ke IT/GA bila kebutuhan bisnis mencakup RPC/SC dan fungsi operasional lain. Pilih master owner/fungsi yang dapat diperluas, bukan hardcoded role.
2. Scope harus dapat dikombinasikan per modul, owner/fungsi, lokasi/site, unit organisasi, kategori, dan relasi PIC sesuai kebutuhan; hindari satu scope global yang tanpa sengaja membuka modul lain.
3. Role adalah kumpulan permission; scope menentukan data yang dapat diakses. Lokasi, owner aset, dan role tidak boleh disimpulkan satu sama lain.
4. UI Super Admin harus dapat menambah lokasi/site dan owner/fungsi serta mengatur assignment scope tanpa perubahan kode setiap kali ada gudang atau cabang baru.
5. Buat matriks akses untuk owner IT, GA, RPC/SC, dan owner operasional lain yang kelak ditambahkan. Contoh mesin produksi Subang wajib menjadi test case: user RPC/SC dengan permission dan scope yang tepat dapat mengelola; GA tidak otomatis dapat mengelola hanya karena aset berada di gudang.
6. Sebelum mengubah migration atau data existing, inventarisasi nilai owner saat ini, lokasi, kategori, dan pemilik proses. Jangan menjalankan perubahan produksi tanpa backup, dry-run, laporan dampak, dan persetujuan.

**Prinsip ringkas:** lokasi menjawab *aset berada di mana*; owner menjawab *fungsi/unit mana yang bertanggung jawab atas aset*; role dan permission menjawab *siapa boleh melakukan apa*; data scope menjawab *data mana yang boleh dijangkau*. Keempatnya independen dan harus fleksibel.


---

## Addendum — Proteksi migration role cabang (2026-11-08)

- User menegaskan bahwa GA saat ini hanya menangani aset yang memang menjadi tanggung jawab GA dan sesuai kapasitas personel; tidak boleh diasumsikan sebagai pengelola semua aset non-IT. Model owner harus dapat berkembang untuk RPC/SC dan fungsi operasional lain.
- Audit menemukan draft lama `server/migrations/026_map_branch_accounts_to_employee_location.sql` melakukan perubahan destruktif: mengubah seluruh `users.role` Supply Chain/PIBC menjadi Karyawan, menghapus role assignment supply_chain/pibc, dan menonaktifkan `UNIT-SC`/`UNIT-PIBC` berdasarkan label role. Ini tidak aman karena lokasi tidak membuktikan jabatan/fungsi pegawai.
- Pada commit `e058e4743340395099966259b95ea721fb4503ea`, migration 026 diubah menjadi no-op compatibility marker. Tidak ada perubahan role/user/unit yang dilakukan otomatis.
- Ditambahkan `scripts/branch-migration-safety-verify.mjs`, npm script `test:branch-migration-safety`, dan CI step pada commit `c6c3b5946de8a72d5a13fcaf02cf7c202018c2b3`.
- **Peringatan:** jika versi lama migration 026 sudah pernah diterapkan di suatu database, mengubah file tidak membatalkan perubahan historis. Jangan mencoba memulihkan role secara tebakan. Cocokkan backup, audit trail, HR master, dan penugasan aktual sebelum membuat recovery plan.
- CI run 42477031571 pada head tersebut masih berjalan saat catatan dibuat. Belum ada klaim PASS.
- PR #18 tetap Draft/Open; belum merge. Tahap berikutnya: verifikasi hasil CI, lalu audit model owner dan semua jalur aset/loan/ticket berdasarkan permission + module scope + owner scope.

---

## Addendum — Owner domain fleksibel & scope lintas modul (2026-11-08)

### Keputusan bisnis
- GA hanya menangani aset yang memang menjadi tanggung jawab GA dan sesuai kapasitas personel. GA tidak otomatis menjadi pengelola semua aset non-IT.
- Master Divisi yang dikelola Super Admin dipakai sebagai vocabulary owner domain yang dapat berkembang. Owner awal: IT, GA, SC, PIBC, Umum, Audit; owner baru dapat ditambahkan sebelum kategori/aset menggunakannya.
- Lokasi fisik, lokasi kerja pegawai, unit pengelola, owner domain, dan custodian/PIC adalah dimensi terpisah. Contoh uji: mesin produksi beras di Subang memiliki owner RPC/SC dan lokasi Subang; akses harus berasal dari permission + scope owner RPC/SC, bukan karena lokasi gudang.

### Perubahan kode
- server/services.ts: assetVisibleUnderDynamicScopes, filter aset, dan canMutateAssetOwner tidak lagi membatasi owner aktif ke IT/GA. Setiap owner non-kosong hanya dapat diakses/dimutasi melalui scope owner eksplisit; mutation juga wajib permission per operasi. File-store fallback tetap konservatif IT/GA.
- server/db.ts dan server/taxonomy.ts: owner code tidak lagi enum empat nilai; owner divisi adalah string kode master yang extensible.
- server/persistence.ts: sync db.divisions ke PostgreSQL sebelum users/category/assets agar owner baru tersedia untuk FK. server.ts: kategori dan aset baru harus merujuk owner yang ada di master; kode owner dibatasi 2–20 karakter. Master owner tidak dapat dihapus saat masih direferensikan aset/kategori/pegawai/unit.
- server.ts: PATCH aset dan bulk import UPDATE memakai helper mutation yang sama; Karyawan tidak diblokir berdasarkan jabatan jika ia memiliki permission + scope tambahan. Auditor tetap read-only.
- server.ts: daftar pinjaman, tiket, dashboard ticket/loan, dan operasi maintenance memakai scope owner per modul, bukan whitelist IT/GA. server/contracts.ts: contract owner visibility/create/edit juga mengikuti owner scope dinamis.
- server/migrations/006_org_model_masters.sql: menambahkan seed Umum dan Audit sebelum org_units agar FK master unit valid pada instalasi baru.
- Migration 026 tetap non-destruktif/no-op; lihat addendum proteksi migration sebelumnya untuk risiko database yang mungkin pernah menjalankan versi lama.

### Verifikasi
- Head branch: 8fdd15db91335f2c937e98294272770b75dd1ebc.
- CI #382 / run 42478977996: SUCCESS. Typecheck, seluruh contract/regression checks, production build, 37 P0 HTTP security assertions, dan maintenance authorization assertions lulus.
- PR #18 tetap Draft/Open, belum merge. Tidak ada migration production yang dijalankan.

### Pekerjaan berikutnya
1. Audit endpoint vendor, laporan, rekonsiliasi, dan administrasi untuk shortcut role/owner yang tersisa.
2. Rapikan menu, landing page, dan tindakan tiap halaman berdasarkan effective permissions + scope; role label saja tidak boleh menjadi sumber kebenaran.
3. UAT lintas role untuk mesin produksi RPC/SC di Subang, aset GA, aset IT, dan pengecualian baca-only GA atas laptop/desktop IT.
4. Rekonsiliasi data historis hanya berdasarkan backup, audit trail, dan data HR terverifikasi. Jangan lakukan mass remapping.


### Final handoff status (2026-11-08)
- Documentation head at this handoff: 016c1a7be8740c4b5ff0273be00b2b6d629e0fc7.
- CI #383 / run 42479231928 completed SUCCESS on that head. This run includes the latest source changes and documentation: typecheck, all RBAC/asset-scope/navigation/dashboard checks, production build, 37 P0 HTTP assertions, and maintenance authorization assertions passed.
- PR #18 remains Draft/Open and intentionally unmerged pending the remaining vendor/report/reconciliation/admin authorization audit and end-to-end per-user UAT.


### 2026-11-08 — Flexible owner exclusion policy
- User decision: asset ownership and authority must remain configurable. GA may in future be assigned broad responsibility for all non-IT asset owners; other teams may receive read-only or business-specific permissions. This is a policy option, not an automatic change to current GA grants.
- Implemented the generic `division_except` data-scope type. Super Admin can combine module permission + `all` + `division_except:IT` to express "all owners except IT", or use explicit owner scopes for narrower cases.
- Explicit division grants can override a broad exclusion for a selected owner. Unit/location scopes cannot bypass an owner exclusion. Location still does not imply ownership or authorization.
- The new scope is supported by the role editor, RBAC API validation, backend asset visibility/mutation checks, generic module owner-scope checks, and PostgreSQL migration 032.
- Existing policies are preserved; no automatic permission expansion to GA or other teams is applied. Super Admin remains the authority to activate the new rule.
- Verification pending on the newest CI head. No production migration has been run.


### Follow-up verification — owner exclusions and owner-master safety
- CI run #402 completed SUCCESS on head `b437abf78abdcf2c607f65943f2ba95a4c3b4b3f`.
- Passed: TypeScript lint; Dynamic RBAC foundation contracts; branch migration safety; asset scope policy checks (including owner exclusions and inactive owner master); navigation/dashboard checks; production build; 37 P0 HTTP security assertions; 33 maintenance authorization assertions.
- Owner-master sync now preserves inactive status, and new asset creation rejects inactive owner domains. Existing assets/history remain untouched.
- This is code/CI verification only. Migration 032 has not been run against production PostgreSQL; production backup, dry-run, impact review, and approval are still required.


### 2026-11-08 — Reconciliation follows asset authorization
- `GET /api/reconciliation` now scopes totals and result rows to assets visible to the current actor. Super Admin and Auditor retain global read-only visibility.
- `POST /api/reconciliation/link` now requires the reconciliation-link permission and the shared asset-update permission with matching owner scope.
- Regression checks added to `test:asset-scope-policy`.
- CI run #409 completed SUCCESS on head `c5d71a0e7e20f6c1dfbe146af2a8d8fa1d4b0a3f`. Production migration 032 remains unapplied pending backup/dry-run/impact review/approval.


### 2026-11-08 — Koreksi lokasi kantor aktif
- Lokasi aktif saat ini ditetapkan hanya: HO, PIBC, RPC/SC, Pangsub.
- Subang sudah tutup dan bukan lokasi aktif/seed. Tidak ada pemindahan user atau aset historis terkait lokasi lama.
- ID lokasi lama dipertahankan. Kantor Perawatan dinonaktifkan, bukan dihapus.
- Super Admin tetap dapat menambah lokasi baru melalui master data; tidak ada daftar lokasi permanen di kode kebijakan akses.
- Seed `server/db.ts`, fallback `server/persistence.ts`, migration 033, dan regression test diselaraskan. Migration produksi belum dijalankan.


### Correction — Kantor Perawatan remains active (2026-11-08)
- User clarified that Kantor Perawatan is still operational. This supersedes the immediately preceding assumption that it should be inactive.
- Current active office locations: HO, PIBC, RPC/SC, Pangsub, and Kantor Perawatan. Subang remains closed/not an active office location.
- Corrected seed (`server/db.ts`), persistence fallback, migration 033, and regression assertions. No user or asset references are reassigned or deleted.
- Validation status: CI for the correction is pending; do not claim pass until the run completes.


### Handoff update — 2026-11-08 (office migration + loan custody audit)

**Branch:** `fix/role-based-navigation`  
**PR:** #18 (Draft/Open, not merged)  
**Latest code commit at this update:** `00e628e601ed3cf06554ce29161d6a99fa162050`

#### New user-confirmed office rule
- Kantor Perawatan is still operational. The five active office locations are HO, PIBC, RPC/SC, Pangsub, and Kantor Perawatan. Subang is closed and is not an active office location.
- The previous migration 033 incorrectly deactivated OFF-PERAWATAN. Fixed it to set `name='Kantor Perawatan', is_active=TRUE`; no IDs, user references, or asset references are deleted/reassigned.
- Seed and persistence fallback already contain all five active locations. Super Admin-managed master data remains extensible.

#### CI correction
- CI run 42486650240 failed during `npm run lint` because TypeScript parses the `.mjs` regression script and the RPC/SC regex literal was malformed. This is a test-source syntax error, not evidence of an application build/runtime defect.
- Corrected RPC/SC matching to use a slash-safe regex and strengthened migration 033 assertion to require the explicit active update. Added regression coverage for loan-return location preservation.
- Latest CI on commit `00e628e601ed3cf06554ce29161d6a99fa162050` must be checked; do not claim green until a new run completes.

#### Loan custody audit finding and fix
- `GabahDomainService.canOperateLoan` already uses the loan operation permission plus explicit matching owner scope in PostgreSQL, so owner domains are not limited to IT/GA for this path.
- Updated stale IT/GA-only error messages and old hardcoded-role comments.
- Found a business-data defect: `returnLoan()` silently set every returned asset's physical location to `Head Office - Gudang Pool`. Removed that assignment. A return changes custody/status/condition only; physical relocation must be a separate authorized asset-move workflow.
- Added regression assertion that loan return cannot reset physical location.

#### Next actions
1. Check CI on latest head and fix any remaining test failures.
2. Continue endpoint-by-endpoint authorization audit, prioritizing loan list/detail/BAST, tickets, room reservations, reports, vendors, licenses, exports, dashboard aggregates, and Administration masters.
3. Reconcile stale `scripts/org-model-verify.mjs` assumptions about role/location names and add an API-level check for all five active office locations.
4. Keep PR #18 Draft/Open until backend scope audit and representative role UAT are complete. No production migrations without backup, dry-run, impact report, and explicit approval.


### Follow-up — loan request identity and HTTP authorization status (2026-11-08)
- `GabahDomainService.requestLoan()` now prevents ordinary users from setting another employee as borrower via crafted `borrower_id`. Self-service requests must be for the authenticated actor; delegated/on-behalf requests require a future explicit capability/workflow. Super Admin retains administrative exception.
- `/api/loans` create/approve/reject routes now propagate domain `statusCode`, so a domain-level 403 is not misreported as 400.
- Added source regression checks for borrower impersonation protection and approve/reject status propagation.
- These are source-level regression checks; CI must pass on the newest branch head before claiming verified. No production data changed.


### Office master verification refinement — 2026-11-08
- Clarified the live baseline: five confirmed active office locations (HO, PIBC, RPC/SC, Pangsub, Kantor Perawatan). Future sites remain allowed; therefore API verification checks that these five exist and are active rather than forbidding all future additions.
- Migration 033 now retires a legacy `org_office_locations` row named Subang by setting `is_active=FALSE` if such a row exists. It does not delete the row and does not touch the separate `asset_locations` table or asset history.
- Updated `scripts/org-model-verify.mjs` to stop treating the nine legacy role labels as the target organization model; they are retained only for account/history compatibility. Updated its HO location lookup and added the five-active-office/Subang-closed API assertion.
- Added regression coverage to ensure migration 033 keeps Kantor Perawatan active, retires Subang only in the office master, and preserves historical rows.


### CI review — migration 033 SQL/test correction (2026-11-08)
- Run #438 failed only the new office migration source assertion: the test expected `LOWER(BTRIM(name))` before `is_active = FALSE`, while SQL correctly expresses `SET is_active = FALSE WHERE LOWER(BTRIM(name)) = 'subang'`. Test order was corrected.
- Manual review also caught a trailing comma in the first `UPDATE org_office_locations ... SET name = CASE` statement after removing the prior deactivation expression. Removed the comma; statement is now `END WHERE ...`.
- Run #439 was queued on the documentation head at the time of writing. Verify its result and logs before claiming CI green.


### Ticket status authorization audit — 2026-11-08
- Found an inconsistency between ticket list scope and ticket status mutation: list visibility accepted arbitrary owner codes through dynamic scope, but `runtime-hardening.ts::canManageTicket()` only recognized IT/GA scopes in PostgreSQL. This blocked operational functions such as RPC/SC despite explicit permission + owner scope.
- Fixed PostgreSQL guard to check the ticket's category/owner code generically with `hasRbacScope(actor, 'division', owner, 'tickets')`; legacy IT/GA role-label checks now apply only in file-store compatibility mode. Reporter/assignee self-access remains; Auditor stays read-only.
- Added regression assertion. CI status for the newest head is pending; do not claim this ticket change verified until CI completes.


### Verification checkpoint and next audit finding — 2026-11-08

#### Verified CI
- CI #441 / run `42487422969` passed on source head `9f3faf86f7f23f40ea8db167a9554f0abf8ef48e`.
- Verified in that run: TypeScript lint; Dynamic RBAC foundation checks; branch-migration safety; asset-scope policy 46/46; navigation/dashboard policy checks; production build; P0 HTTP security 37/37; maintenance authorization 33/33.
- CI #443 / run `42487486675` passed on documentation head `6f3e2b2a772d632d6f17ea82d1f5cb90859ac746`, including migration 033 office tests and the updated office baseline.
- Ticket dynamic-owner scope fix was then added and source regression added. CI #446 on the latest head is pending at this update; verify before reporting green.

#### Next domain: Vendor ownership
- Audit found `/api/vendors` still derives vendor ownership from `category`: `IT`/`License` => IT, every other category => GA. This hardcodes an IT-vs-GA dichotomy and would mis-scope vendors belonging to RPC/SC or future owner domains.
- Do not patch by simply treating category text as owner. Vendor category/type and responsible owner domain are separate business attributes. Inspect current vendor data, frontend form/types, persistence, and any external contract linkage; design an explicit `owner_division` field and migration/backfill only when historical mapping is verified. Ambiguous existing vendor records must be reviewed, not auto-assigned to GA.
- Room reservation visibility still has legacy role/function branches (GA/IT/Humas) for privacy/operations. Audit those against effective permission/scope without weakening the privacy redaction rules.


### Additional audit — vendor and room reservation domains (2026-11-08)

#### CI results
- CI #446 (`42487582277`) passed on the ticket authorization source change and test.
- CI #447 (`42487587798`) and #448 (`42487694450`) passed on later documentation heads. Newest run #449 is currently in progress; check before reporting latest branch green.

#### Vendor directory: not yet aligned with flexible owner model
- Frontend `src/components/views/VendorsView.tsx` uses `['Admin GABAH','IT','GA'].includes(currentUser.role)` for management UI.
- Backend `GET/POST/PATCH /api/vendors` infers owner domain from category: IT/License => IT; all other categories => GA. This is not safe for operational vendors belonging to RPC/SC or future owner domains.
- `ServerVendor` / frontend `Vendor` currently have category but no explicit owner domain. Vendor category (e.g. IT service, license reseller, maintenance, supplier) must not double as owner.
- Next implementation should add explicit owner-domain master reference to vendor data, allow Super Admin to set it, authorize list/create/update by `vendors.*` permission + `vendors` owner scope, and update frontend visibility from effective permissions. Review ambiguous legacy records; do not default every non-IT vendor to GA.

#### Room reservations: privacy-sensitive legacy rules remain
- `/api/room-reservations` list currently has role-specific branches for GA operations (redacted agenda), IT facility requests (filtered/redacted), Humas documentation requests, and personal reservations for other users.
- Preserve privacy redaction and operational intent while replacing role-label assumptions with effective capabilities/scopes. Do not expose meeting titles/descriptions, attendee lists, phone numbers, documentation notes, or rejection/interruption reasons to users lacking the corresponding permission/work item assignment.
- Approval/override priority for Sekretaris Direksi and GA is a business workflow, not a blanket role grant; retain explicit priority/override constraints.


### Latest handoff status — 2026-11-08
- Latest verified source CI: #449 / `42487698982` SUCCESS on head `2dd9d2a9b79a07d7dcfd96291108b5cbfd46e14f`, including ticket custom-owner scope guard + regression check.
- Documentation updates after that source head triggered CI #450 and #451; at this update #450 is in progress and #451 is queued. No source changes were made after the verified ticket source commit; latest doc CI remains pending.
- PR #18 remains Draft/Open, not merged. No production migration has been run.
- Continue with vendor explicit owner-domain model, then room reservation capability/scope conversion and remaining report/export/admin endpoints. Preserve privacy and do not mass-map ambiguous legacy records.


### Vendor owner-domain remediation — 2026-11-08

**Defect fixed in branch source (CI pending):** vendor ownership was inferred from category (`IT`/`License` -> IT, every other category -> GA), and UI management was hardcoded to Admin GABAH/IT/GA. This prevented arbitrary operational owner domains and conflated vendor service category with accountability.

**Changes:**
- Added `owner_division?: string | null` to `ServerVendor` and frontend `Vendor` type.
- Vendor list now filters by explicit `owner_division` through `hasRbacScope(actor, 'division', owner, 'vendors')` in PostgreSQL. File-store compatibility checks the same explicit owner code against the legacy actor role.
- New vendor creation requires an active owner code present in the configurable owner/division master, plus `vendors.create` and matching scope in PostgreSQL.
- Update requires authority over both current and requested owner. `owner_division` was added to the server-side update allowlist so changes persist.
- Legacy vendor records with null/empty owner are deliberately not auto-mapped from category. They remain visible to Super Admin/Auditor only; Super Admin can classify them from verified business information. No database migration/backfill is needed for the JSON-backed vendor collection; the new field is additive.
- Vendor UI loads owner choices from `/api/master/divisions` and uses `permission_keys` / `is_superadmin`, not a static role-name list.

**Regression checks added:** explicit owner field, no category-to-owner inference, scope enforcement on list/create/update, owner field persistence, and permission-driven UI. Check CI result on latest head before claiming pass.

**Important domain caveat:** current master `divisions` contains legacy SC/PIBC entries alongside IT/GA and other functions. This UI only presents configured master entries; it does not infer owner from employee location. Super Admin must select the actual responsible owner for each vendor.


### Room reservation RBAC remediation — 2026-11-08

**Defect:** reservation list filtering and domain mutations relied on role labels GA, IT, Humas, and Sekretaris Direksi even though route permissions were already dynamic. This caused inconsistent access: permission grants alone could not enable the corresponding workflow, and custom roles could not participate.

**Implementation:**
- Reservation list operational queues now use effective capabilities:
  - `room_reservations.approve` or `room_reservations.reject`: GA-style operational queue, with agenda/private fields redacted.
  - `room_reservations.it_facilities.read`: IT-facility requests only, with private agenda fields redacted.
  - `room_reservations.documentation.read`: documentation-request queue only.
  - Other users: own reservations only. Super Admin/Auditor global read remains unchanged.
- Added migration `034_dynamic_rbac_room_reservation_capabilities.sql`: grants IT facility queue read to canonical IT role, documentation queue read to Humas, and `room_reservations.override_priority` to Sekretariat Direksi. Custom roles can receive these permissions through RBAC administration.
- Domain service guards for approve/reject/check-in/check-out/cancel and room status update now consult effective permission in PostgreSQL; legacy file-store fallback remains limited to GA. Reservation create checks `room_reservations.create` in PostgreSQL; Auditor remains blocked in file-store.
- Director-priority interruption now requires the separate `room_reservations.override_priority` permission and HIGH priority. It is no longer inferred from the primary role label.
- Privacy redaction fields are unchanged; this change only changes how the operational queue capability is granted.

**Validation:** added source regression checks for queue permissions, privacy redaction, domain operation checks, and migration grants. Run CI on latest head before claiming verified. PostgreSQL runtime migration and live API integration still need to be exercised before production.


### Fresh PostgreSQL migration and production gate — 2026-11-08

**Two blocking migration defects found and corrected:**
1. `004_contract_management.sql` previously assumed `contracts.owner_division_id` always existed. The fresh schema from migration 001 already has `owner_division`, so this reference can fail. The migration now checks `information_schema.columns` before using the legacy ID. Unknown/null legacy owners become `UNASSIGNED` (not GA) and remain global-admin review only; no contract ownership is silently inferred.
2. `015_room_reservations.sql` referenced `rooms(id)` even though room master data is still held in the application datastore and no PostgreSQL `rooms` table exists. Removed the invalid FK while retaining the room ID as an application-level reference. Anti-collision range/index/trigger remain.

**CI was upgraded:** GitHub Actions now provisions PostgreSQL 17 and runs `scripts/cr04-cr05-verify.mjs` with a throwaway database before the other live HTTP/regression tests. Additional gates include loan authz, room reservations, org model, T2B1/T2B2/T2B3 master data, sidebar menu connectivity, P0 security, and maintenance authorization. Existing lint/build, dynamic RBAC, branch migration safety, asset-scope, navigation and dashboard tests remain.

**Status:** changes and regression guards are committed to `fix/role-based-navigation`; wait for the new PostgreSQL-backed CI run. A green static-only run is not production readiness. No production DB has been touched.


### PostgreSQL CI failure — primary-role reconciliation SQL alias (2026-11-08)
- Run #471 / `42489245450` exercised PostgreSQL 17 on a fresh isolated database and failed during startup after migrations. Error: `column assigned_role.is_primary does not exist`.
- Root cause: in `backfillDynamicRbacUserRoles()` the SQL aliases `gabah_roles` as `assigned_role`, but `is_primary` belongs to `gabah_user_roles` alias `ur`. The query incorrectly used `assigned_role.is_primary = TRUE`.
- Fixed to `ur.is_primary = TRUE`. Migration 030 was present and adds `is_primary` to `gabah_user_roles`; the defect was a wrong table alias, not migration ordering.
- Added a source regression assertion for the correct alias. Re-run the complete PostgreSQL CI suite; this is the first live database-backed verification and must pass before declaring PG readiness.


### CI verifier follow-up — 2026-11-08
- The first rerun after the SQL alias correction failed before PostgreSQL integration because `scripts/dynamic-rbac-foundation-verify.mjs` still asserted the old alias `assigned_role.is_primary` in the reconciliation query.
- Updated the assertion to `ur.is_primary`. This is a stale verifier expectation, not a new runtime defect. The next run must pass the 111 Dynamic RBAC checks before the PostgreSQL integration step can execute.


### Branch consolidation checkpoint — 2026-11-08
- Canonical working branch remains `fix/role-based-navigation`; PR #18 remains the single integration branch for RBAC/org-model/vendor/room/migration remediation.
- Closed superseded PRs:
  - PR #13 `ci/expand-regression-gates`: expanded CI now included in PR #18 with PostgreSQL service and additional regression suites.
  - PR #14 `fix/contract-migration-fresh-db`: migration 004 compatibility fix and migration 015 room FK fix copied into PR #18; unknown contract owner is `UNASSIGNED`, not silently GA.
  - PR #15 `fix/rbac-sidebar-fail-closed`: PR #18 sidebar already defaults to no navigation when role identity is missing and uses permission-aware tab visibility.
- Closed PR branches are not deleted; history remains preserved. This session's available GitHub actions can close PRs but do not expose branch deletion. They are not to be used for new work.
- PR #11 deployment hardening, PR #12 finalization checklist, PR #17 user/role assignment audit, and PR #3 legacy ticket gate remain open for careful consolidation. No parallel work branch should be created.


### Ticket permission audit — Auditor read-only correction (2026-11-08)
- Review of PR #3 against the current branch found that `tickets.read` was already seeded to Auditor by migration 023, but migration 024 also included Auditor in the broad `tickets.create` grant set. The API had a separate Auditor denial, but the effective permission was still wrong and could cause a UI create action to appear.
- Added migration `036_dynamic_rbac_auditor_ticket_create_deny.sql` to remove only the `tickets.create` grant for role key `auditor`. `tickets.read` is retained. No data or ticket rows are changed.
- Added regression assertion for Auditor read-only ticket behavior. Do not merge old PR #3 migrations 017/018: their version numbers conflict with existing movement/knowledge migrations in the consolidated branch, and the current branch already has the endpoint gates and canonical permission catalogue.


### Vendor domain and owner-scope remediation — 2026-11-08

**Defect review:** Vendor category (e.g. IT Hardware, License, Maintenance) is descriptive service classification and must not be treated as owner. Owner domain is selected from the dynamic master. The current server implementation already had the basic owner field/scope guard, but validation and UI action gating needed tightening; no category-based ownership backfill is permitted.

**Changes:**
- API create/update normalizes owner codes case-insensitively against active owner master; rejects missing/inactive owner, empty/oversized name/category, and invalid rating. Update checks both existing and destination owner scope.
- Vendor list returns only the caller's owner scopes (Super Admin/Auditor global read per policy). Vendor creation/update require the corresponding vendors permission in PostgreSQL plus owner scope.
- Vendor UI separates create from update permissions, displays owner domain, and removes hardcoded 99% SLA compliance text that had no source data.
- Owner master delete now refuses when vendor/contract/maintenance/loan references remain, in addition to assets/categories/users/org units.
- Added PostgreSQL integration scenarios: IT and GA create vendors only in their owner domains; categories can differ from owner; Karyawan without vendor permission is denied; custom RPCSC owner + custom role + module scope can create/read a vendor; owner master cannot be deleted while referenced.

**Validation:** source regression checks added. PostgreSQL runtime coverage is part of the latest CI head; wait for that exact run before reporting vendor tests as passed.


### Deployment/runbook hardening — 2026-11-08

- The previous deploy.sh auto-installed Docker from get.docker.com, shut down the existing Compose project with --remove-orphans, and printed success without verifying health. Replaced with fail-fast preflight, .env/PGPASSWORD validation, Compose config check, app-only recreation, health polling, and failure diagnostics. It no longer stops the DB first or claims success without health.
- PostgreSQL host port now binds only to loopback. Compose now passes GABAH_INITIAL_ADMIN_PASSWORD and GABAH_INITIAL_USER_PASSWORD into the application container (previously documented in runbook but not passed by Compose).
- CI checks Compose configuration and shell syntax. VM runbook now requires clean main, fast-forward-only update, database backup, health verification, and explicit rollback/restore safeguards. Production deploy remains NO-GO pending merge, UAT, restore rehearsal, TLS, and sign-off.


### Asset creation owner-scope alignment — 2026-11-19

**Finding:** the asset creation modal still inferred writable owner domains from primary-role labels (IT/GA/Supply Chain/PIBC) and hard-coded owner choices. This diverged from the backend's effective Dynamic RBAC permission + owner-scope policy, particularly for custom/additional roles.

**Changes in PR #127:**
- Added `GET /api/assets/create-options`; it requires `assets.create` and calculates writable owners with the same `canMutateAssetOwner` policy used by the asset mutation service.
- The endpoint returns only active owner masters with active categories in the caller's effective write scope.
- Explicitly routes this GET endpoint through the Assets module lifecycle gate, not the self-service My Assets module.
- Replaced role-label inference and hard-coded owner dropdown values in `CreateAssetModal` with server-provided owner/category options.
- The form fails closed when options cannot be loaded or the caller has no eligible owner/category; it does not fall back to permissive static taxonomy.
- The existing backend `createAsset` authorization remains authoritative and rechecks owner permission/scope at mutation time.

**Data migration boundary:** legacy SC/PIBC codes are excluded from new owner choices because they are historical operational/location labels under the current organization decision. No asset owner, category, number, ticket, or user data is rewritten in this change. The canonical RPC owner master and category mapping must be established before RPC becomes a selectable creation domain.

**Validation:** TypeScript, the asset-scope policy regression, production build, Docker image/runtime smoke, PostgreSQL fresh-database/persistence integration, and the full CI workflow are required on the exact PR head. This change is not a production approval and does not replace browser UAT for IT, GA, Superadmin, and custom multi-role accounts.

### Dynamic domain authorization hardening — 2026-11-20

**Branch:** `fix/dynamic-rbac-domain-authorization`  
**Base:** `main` after PR #152 was merged.

**Changes in this work batch:**
- Meeting-facility CRUD no longer rejects a custom role after the API permission gate has already accepted `meeting_facilities.manage`. PostgreSQL authorization now consistently uses the effective permission; the GA/IT role-label fallback remains only for file-store development.
- IT workstation read-only visibility is now a capability overlay, not a `user.role === 'GA'` branch. Any explicitly assigned role can grant `assets.read.it_workstations`; the overlay is limited to IT-owned HLT/HPC workstation categories and does not grant mutation authority.
- Contract creation now has a dedicated `canCreateContract` domain check. A role with only `contracts.update` can no longer pass the shared create/manage helper and create a contract through a domain-service call. The existing `canManageContracts` helper remains available for combined UI/manage capability checks.
- Added regression assertions for the meeting-facility permission path, IT workstation capability overlay, and separation of contract create/update capability.


- Header notification queues now resolve IT/GA/Humas/Superadmin from effective permission keys (and Superadmin metadata), not role-name matching. Custom-named roles can receive the correct queue indicator by being granted the corresponding queue capability.
- Director-priority room-reservation override UI now checks `room_reservations.override_priority` when PostgreSQL permission metadata is present. Legacy Sekdir/GA/Admin fallback is retained only for file-store development.

**Validation boundary:** changes are committed on this branch; exact-head CI is required before merge. These are source-level fixes and regression assertions, not a claim of live browser UAT or production deployment.

### Ticket workspace dynamic-role UI hardening — 2026-11-20

**Branch:** `fix/dynamic-role-workflow-ui`  
**PR:** #154 (CI pending)

- Ticket UI now derives Auditor read-only precedence from `GabahService.isAuditor()`, which recognizes additional Dynamic RBAC assignments.
- Superadmin UI identity uses stable `is_superadmin` / effective `role_keys` metadata.
- IT/GA operational indicators recognize assigned canonical role keys. SC/PIBC labels are retained only as file-store compatibility; PostgreSQL permission metadata disables those legacy role branches.
- The personal-ticket-only view is based on ticket-management capability and actual server-scoped queue data rather than a hardcoded list of employee/job labels.
- Added regression checks to the ME/PIBC ticket queue verifier for Auditor additional-role, IT/GA assignments, and SC/PIBC compatibility boundaries.

**Previous integration:** PR #153 passed CI run #2644 (TypeScript, Dynamic RBAC/asset-scope regression, production build, Docker runtime smoke, PostgreSQL 17 integration, live HTTP security, room/ticket/org/master-data regressions) and was merged to `main` as `81cbb2d`.

### Dynamic user onboarding — 2026-11-20

**Branch:** `fix/dynamic-user-onboarding-roles`

- New employee creation no longer presents a fixed operational-role dropdown. New accounts start with the baseline `Karyawan` profile; department, job level, and office location do not implicitly grant operational capabilities.
- After account creation, the administration flow refreshes the persisted PostgreSQL role assignments and opens the Dynamic RBAC assignment dialog for that new user. Superadmin can assign any active configured role immediately.
- The primary profile role remains visibly checked and immutable in the assignment dialog; additional operational roles remain explicitly selectable.
- Existing role management and user-edit flows are retained for compatibility pending a separate migration-safe audit of legacy primary-role accounts.
- Regression coverage extends the canonical primary-role verifier to assert the neutral create flow, immediate assignment handoff, and primary-role checkbox behavior.

**Validation boundary:** this branch requires exact-head CI, including TypeScript, primary-role policy regression, production build, Docker runtime smoke, and PostgreSQL 17 integration. No existing user assignments or production records are modified.

### Additional operational-view permission gates — 2026-11-20

**Branch:** `fix/dynamic-permission-ui-gates`

- License creation shortcut now follows `assets.create` and preserves Auditor read-only precedence; IT/Admin legacy fallback applies only when permission metadata is absent.
- Vendor create/update shortcuts no longer grant access merely because the primary role label is Admin GABAH when PostgreSQL permission metadata exists. Superadmin metadata and `vendors.create` / `vendors.update` are authoritative; Auditor additional-role membership keeps all write shortcuts hidden.
- Contract view uses stable Superadmin metadata and `GabahService.isAuditor` for additional Auditor assignments. Contract owner reassignment UI remains Superadmin-only; legacy Admin GABAH fallback is limited to file-store mode.
- Added UI permission regression assertions to the asset-scope policy verifier.

**Validation boundary:** exact-head CI required. No backend permission catalogue, vendor/contract records, or database grants are changed by this UI-only batch.

### Meeting-room UI capability alignment — 2026-11-20

**PR:** #156 — merged to `main` as part of commit `974fe03`.

- Meeting-room UI reads PostgreSQL `permission_keys` as the authority for room workflows; legacy role-name checks remain only as file-store compatibility.
- Facility master/status controls use `meeting_facilities.manage`; approve, reject, check-in, check-out, cancel, and create actions each use their own capability.
- Humas documentation and Sekdir priority override use `room_reservations.documentation.read` and `room_reservations.override_priority`.
- Auditor additional-role membership is read-only precedence over all room write controls, including when another role or Superadmin metadata is present.
- CI run #2661 passed all 75 checks, including typecheck, room capability UI regression, production build, Docker runtime smoke, PostgreSQL 17 integration, and security checks.

### Dashboard capability alignment — 2026-11-20

**PR:** #158 — merged to `main` as `472dc24`.

- Superadmin dashboard identity uses stable `is_superadmin` / `role_keys.superadmin`; the legacy Admin GABAH fallback applies only without PostgreSQL permission metadata.
- Humas and Sekretariat Direksi indicators derive from `room_reservations.documentation.read` and `room_reservations.override_priority`.
- Auditor detection uses all effective role assignments and continues to override write shortcuts.
- Dashboard ticket heading no longer infers IT queue access from the primary role name.
- CI run #2657 passed all 75 checks, including employee profile capability normalization and dashboard owner-scope regression.

### Ticket creation modal — dynamic Auditor precedence — 2026-11-20

**PR:** #159 — merged to `main` as `0ded801`.

- Ticket creation modal now uses `GabahService.isAuditor`, so Auditor additional-role membership blocks all ticket creation controls and submit paths.
- ME ticket request access uses stable Superadmin metadata or the explicit `tickets.create.me` capability. A primary-role label alone no longer bypasses PostgreSQL permission metadata.
- Regression coverage includes the ME requester permission and Auditor additional-role deny-write behavior.
- CI run #2665 passed all 75 checks, including Dynamic RBAC, ticket queue, production build, Docker runtime smoke, PostgreSQL 17 integration, and security assertions.

### Loan UI Dynamic RBAC alignment — 2026-11-20

**PR:** #160 — merged to `main` as `07c5302`.

- Loan list now trusts backend borrower/owner/unit scope instead of re-filtering by a hardcoded primary-role list.
- Loan creation shortcut uses `loans.create` and is hidden when the user lacks that permission.
- LoansView and CreateLoanModal use `GabahService.isAuditor`; additional Auditor membership remains read-only and blocks creation/return actions.
- CI run #2669 passed all 75 checks, including typecheck, loanable-pool UI regression, loan authorization/state transitions, Docker runtime smoke, PostgreSQL 17 integration, and security checks.

### Dynamic ME ticket queue capability — 2026-11-20

**PR:** #161 — merged to `main` as `b425351`.

- Added explicit `tickets.queue.me` capability for the PIBC ME queue UI.
- Existing canonical Admin Tiket ME template receives the capability idempotently; custom-named roles receive nothing automatically.
- Superadmin can create a custom role and explicitly assign `tickets.queue.me` plus `UNIT-PIBC-ME` scope to expose the ME queue.
- CI run #2672 passed all 75 checks, including migration validation, ticket queue regressions, Docker runtime smoke, PostgreSQL 17 integration, and security checks.


### Sidebar queue indicator capability alignment — 2026-11-20

**Branch:** `fix/dynamic-sidebar-queue-indicators`

- Sidebar Humas, Sekdir, IT, and GA queue labels/badges now derive from effective PostgreSQL permission keys rather than the primary role label.
- Legacy role-name checks remain only as file-store compatibility when permission metadata is absent.
- Custom-named roles with the corresponding documentation, priority override, IT facilities, approval/rejection, or facility-management capabilities now receive the matching contextual indicator.
- Added regression assertions to the meeting-room capability verifier; backend queue data remains server-scoped and no API/data permissions were broadened.

**Validation:** exact-head CI required before merge.


### Infrastructure loanability enforcement — 2026-11-20

**PR:** #174 — merged to `main` as `51928b5c1e371d7c2e02ca866c02f821be74f519`.

- Added one domain-level non-loanable category guard resolved from the authoritative category master, with protected category codes, IT software/license metadata, and infrastructure descriptions.
- Asset creation forces infrastructure and license categories to `is_loanable=false`, even if a caller submits `true`.
- Direct asset PATCH and bulk asset update reject attempts to enable loanability for protected categories.
- Loan request service rechecks the authoritative category policy before accepting a request.
- Added HTTP regression coverage for infrastructure creation, PATCH override, and loan request rejection.
- Exact-head CI run #44689553042 passed 78/78 checks.


## 2026-11-20 — Superadmin Administration entry guard

- Replaced the Administration modal's active-role-only Superadmin check with authoritative identity checks: `is_superadmin` and stable `role_keys=superadmin`.
- Legacy `Admin GABAH` label fallback is retained only when permission metadata is absent, preventing a dashboard persona/active-role label from granting or hiding administrative access in dynamic-RBAC sessions.
- Added `test:superadmin-administration-entry` and wired it into CI.
- Work is isolated on `fix/rbac-superadmin-admin-entry-2026-11-20`, created from current `main`; no changes were made to `main` or the divergent 544-commit PR #36 branch.
- Exact-head CI and browser UAT are pending; this is a focused regression guard, not a production-readiness claim.


### Dynamic RBAC module-scope fail-closed hardening — 2026-11-20

- Hardened `hasRbacScope()`: when a caller omits the module argument, module-specific grants no longer match. Only unscoped and explicit wildcard (`*`) grants remain applicable.
- Explicit module checks retain exact matching; e.g. a `tickets` scope does not grant `loans` access.
- Added a CI regression contract for omitted-module, exact-module, cross-module, global, and wildcard cases.
- This is authorization hardening only; it does not alter existing role assignments, scope rows, or business records.


### Loan state/UI contract repair — 2026-11-20

- UI normalizes persisted API states: `pending_approval` maps to pending and `borrowed` maps to active. Filters, counts, badges, and action buttons use the same helper.
- Frontend LoanStatus includes authoritative server states and legacy aliases.
- Server approval now accepts only `pending_approval`. Completed, rejected, approved, and borrowed loans cannot be re-approved after the asset later becomes available.
- Added CI regression coverage for UI/API state mapping and the approval transition guard.

- Superadmin approval button now honors global Superadmin identity even when dynamic permission metadata is present; server remains authoritative for the owner-scope check.


### Effective permission UI consistency — 2026-11-20

- Centralized frontend checks for Superadmin identity and effective permission keys (`*` or exact key).
- Asset edit, loan approval, and ticket management helpers now consistently honor Superadmin metadata and wildcard permission while preserving Auditor deny-write precedence.
- Legacy fallback is limited to legacy role sessions; dynamic sessions no longer infer Admin GABAH authority from a persona label.
- Added CI regression contract for Superadmin identity, wildcard permissions, and all affected helper methods.

- Loans API now computes per-record server-authoritative action flags. The UI separately gates approve, reject, handover, and return buttons from those flags; borrower visibility no longer implies owner-division approval authority.


### Superadmin dashboard persona correction — 2026-11-20

- Fixed dashboard persona precedence: Superadmin remains the global administration persona even though its wildcard permissions include Humas and Sekretaris Direksi capabilities.
- Humas/Sekdir-only dashboard panels and labels are suppressed for Superadmin; the global Admin GABAH dashboard description is shown. Auditor read-only precedence remains higher.
- Extended the dashboard scope regression script to prevent this persona regression.


### Loan rejection authorization hardening — 2026-11-20

- Rejection now verifies the actor's loans.reject permission and matching owner scope before returning workflow-state details, avoiding state disclosure to callers who know a loan ID.
- Unauthorized rejection attempts are written to the audit trail.
- Rejection accepts an optional reason only when it is a string of at most 1,000 characters; stored text is trimmed and empty input uses the standard fallback.
- Invalid state transitions return HTTP 409; invalid reason input returns HTTP 400.
- Extended the loan contract regression to assert authorization ordering, denied-attempt audit, state conflict, and reason-length validation.
- No loan records, user assignments, role grants, or owner scopes were changed.


### Asset mutation authorization response semantics — 2026-11-20\n\n- Asset assignment and physical movement already required both the operation permission and matching owner-domain scope in the domain service. However, authorization failures were thrown as generic errors, and the move route flattened every failure to HTTP 400.\n- Changed denied assign/move operations to carry HTTP 403 and made the move route preserve domain status codes (including future 409 conflicts), matching the existing assign route behavior.\n- Added `test:asset-mutation-http-status` and wired it into CI. This changes response semantics only; it does not modify asset ownership, location, assignment, or movement records.\n- Exact-head CI is required before treating this batch as verified.\n

### Ticket reporter workflow authorization — 2026-11-21

- Ticket status API previously allowed the ticket reporter to use every operational transition, including marking work resolved or moving tickets into staff progress states.
- Restricted non-operational reporters to confirming closure after staff resolution (`resolved → closed`) or reopening a closed ticket (`closed → open`). Superadmin, assigned agent, and users with matching ticket owner/unit scope retain the operational transition workflow.
- Added a regression contract and CI step. No ticket data was changed.


### Loan borrower self-return authorization — 2026-11-21

- Fixed a mismatch between loan domain rules and the API: the domain service allowed a borrower to return their own borrowed asset, but the route-level `loans.return` permission gate blocked borrowers without custodian permissions; the UI also hid the return action.
- The borrower can now return only their own loan. Returns on other borrowers' loans still require the custodian's `loans.return` permission and matching owner scope through the domain service. Auditor remains read-only.
- Added a regression contract and CI step. No loan records or permissions were modified.


### Asset lifecycle status workflow guard — 2026-11-21

- Found a privilege-boundary gap: generic asset PATCH and bulk-import update paths accepted direct status changes even though lifecycle transitions have a dedicated `assets.lifecycle` permission and disposal approval rules.
- Generic PATCH now rejects actual status changes with HTTP 409 and directs users to the Lifecycle or loan workflow. Status is removed from the generic mutable-field allowlist.
- Bulk-import updates now reject status changes and no longer include status in their update allowlist. New asset creation remains server-authoritative; lifecycle and loan endpoints continue to own state transitions.
- Added `test:asset-status-workflow-guard` and wired it into CI.
- No asset records, lifecycle states, or permissions were changed by this code update.
- Exact-head CI and browser UAT remain required.


- Follow-up UI alignment: the asset edit modal no longer offers direct operational-status changes, and the App update handler no longer sends `status` through generic PATCH. Assignment/unassignment continues through the dedicated assignment endpoint; lifecycle states remain handled by the Lifecycle workflow.
- Extended the same regression script to cover both UI payload paths and the read-only status explanation.


- Updated the loan authorization integration fixture so damaged/available setup uses the dedicated Lifecycle and assignment endpoints. Assertions for generic PATCH rejection remain direct PATCH calls; this preserves the security contract instead of weakening it to satisfy old test setup.


### User creation profile validation — 2026-11-21

- Hardened `POST /api/users`: optional division, department, and phone values must be strings within the same length limits used by the update endpoint (120/120/40 characters).
- Values are trimmed and normalized before creating the profile; missing/blank division and department use the existing defaults.
- Primary role validation and independent job/unit/office-location validation remain unchanged. Humas/Sekretariat remain function capabilities; RPC/SC and PIBC remain office locations, not primary roles.
- Added `test:user-create-profile-validation` and wired it into CI.

- Extended the same field limits to bulk employee import: name 160, email 254, division 120, department 120, and phone 40 characters. Invalid rows are reported individually and skipped rather than persisted with oversized values. Regression coverage now checks both account creation and bulk import.


### Last active Superadmin assignment guard — 2026-11-21

- Found a count mismatch in the per-user role assignment endpoint: its "remaining Superadmin" SQL count included inactive accounts, unlike the user deactivation/deletion guards.
- The assignment check now counts only users whose account is active, and only applies the last-active-Superadmin restriction when the target account itself is active.
- Added a regression assertion to the Dynamic RBAC foundation test. No role assignments were modified.


### CI assertion correction and ticket API audit — 2026-11-21

- Latest-head CI exposed one stale static assertion (139/140 checks passed): the per-user role assignment query now selects `is_active` as part of the last-active-Superadmin safeguard. Updated the contract test to assert the actual normalized-user lookup plus active-state check; implementation authorization was not loosened.
- Ticket route audit confirms list visibility and status mutation use `tickets.read` / `tickets.update` plus reporter, assignee, owner-division, and unit boundaries. Reporter transitions are restricted to confirming `resolved → closed` and reopening `closed → open`.
- Follow-up gap: normalized schema defines `ticket_comments`, but current server route inventory exposes ticket list/create/status only; comment persistence/API is not yet surfaced. Keep this as a tracked functional gap; do not claim ticket discussion is PostgreSQL-persistent until a dedicated authorized endpoint and UI flow are implemented.
- Exact-head CI run #2776 is in progress on commit `3b5a91f7b8596ad1ea5ce789a203396d089c9939`; PR #177 remains draft/open and unmerged.


### Ticket lifecycle transition hardening — 2026-11-21

- Found a mismatch between the documented ticket state machine and the actual transition map: operators could move `open`/`assigned` directly to `resolved` or `closed`, and `in_progress` directly to `closed`.
- Tightened the server-authoritative transitions: `open → in_progress`, `assigned → in_progress`, `in_progress → resolved` (or reopen to `open`), `resolved → closed` (or reopen), and `closed → open` only.
- Added `test:ticket-lifecycle-no-skip` and registered it in CI. This is a workflow integrity fix; existing reporter restrictions remain in place.
- The prior CI run for the RBAC assertion correction is still being monitored separately; the current ticket change requires its own exact-head CI before it is considered validated.


### Ticket state coverage and per-ticket action authorization — 2026-11-21

- Aligned the ticket lifecycle contract with the existing `pending_vendor` status: operators can move `in_progress → pending_vendor`, then resume `pending_vendor → in_progress`. The Kanban board now has visible `assigned` and `pending_vendor` lanes and exposes matching actions in list and Kanban views.
- Added `assigned` to the client `TicketStatus` union so legacy assigned tickets remain type-safe.
- Fixed a UI/API authorization mismatch: the ticket UI previously inferred mutation controls from broad permission keys and could show actions that object-level scope checks would reject. `GET /api/tickets` now includes server-computed `allowed_actions` per record, based on Superadmin, assigned-agent, owner-division, unit scope, reporter identity, and Auditor read-only status.
- The UI now prefers these server-computed action flags. Reporters can see the permitted confirmation (`resolved → closed`) and reopen (`closed → open`) actions; they cannot start or resolve their own ticket merely because they have a broad update permission.
- Added `test:ticket-allowed-actions` to CI, and expanded lifecycle regression coverage to include legacy and vendor-waiting states.
- Validation pending: latest exact-head CI will determine whether typecheck, build, runtime and regression checks pass. No merge to `main`.


### PostgreSQL CI runtime-test port collision hardening — 2026-11-21

- An intermediate CI run failed in `cr04-cr05-verify.mjs` after all migrations completed and the production server booted, because its randomly selected test port collided with another server process (`EADDRINUSE`). This was test-harness flakiness, not a PostgreSQL migration or application startup defect.
- Replaced the narrow random-port selection with OS-assigned ephemeral localhost ports and tracked all spawned server children for cleanup, including the restart and fail-fast processes. This also prevents orphaned test servers on early exit.
- Re-run exact-head CI to confirm the harness fix and the ticket authorization batch together.


### Reporter self-service ticket confirmation permission — 2026-11-21

- Further authorization review found the status endpoint's blanket `tickets.update` gate contradicted the reporter-only transition policy: an employee with ticket read access but no operator grant could be shown a `close`/`reopen` action and still receive 403.
- Changed the endpoint to require `tickets.read` for the ticket context. Operational transitions still require `tickets.update` plus the matching assigned-agent/owner-division/unit boundary. A ticket's own reporter may only perform the two explicitly allowed self-service transitions (`resolved → closed`, `closed → open`) without the operator grant.
- Server-generated `allowed_actions` now mirrors this distinction: operator actions require `tickets.update`; reporter confirmation/reopen is separately allowed; Auditor remains read-only.
- Regression checks updated to protect both authorization paths.


### Live-test port allocation cleanup — 2026-11-21

- CI exposed the same ephemeral-port collision pattern in multiple live HTTP verification scripts (`bulk-import`, `asset-import`, `org-model`, `P1 features`, `maintenance authz`, `menu connectivity`, `loan authz`, and `meeting-room stage 3`). A random port in a narrow fixed range is not collision-safe when a prior test process or another listener still owns it.
- Replaced random-range port selection with OS-assigned ephemeral localhost ports across those scripts, matching the CR-04/CR-05 harness fix. This addresses flaky `EADDRINUSE` failures without changing application behavior or weakening assertions.
- Latest full CI is queued/running after these test-harness changes; exact-head result remains pending.

- Extended OS-assigned ephemeral port allocation to the two multi-phase T2B2/T2B3 live verification suites as well; their phase-2 restart servers now receive distinct free ports instead of drawing from overlapping fixed ranges.

## 2026-11-21 — Notification self-service permission correction

- CI run #2839 on commit `c73d5b8274a9d6dc1f3f118d1afa8d78a35d938c` passed.
- Found a permission mismatch in `PATCH /api/notifications/:id/read`: it required `notifications.read_all` even though the endpoint changes only the authenticated recipient's own notification.
- Changed the single-notification endpoint to require `notifications.read`; recipient ownership remains enforced by `isNotificationRecipient` and non-recipient IDs continue to return 404.
- Kept `POST /api/notifications/read-all` behind `notifications.read_all`.
- Extended `scripts/notification-recipient-rbac-verify.mjs` to assert the separation between individual and bulk read permissions.
- CI for commit `139b5f54ac946ea501de667c935919bfb1711c83` is queued; do not treat this correction as CI-verified until that run completes.


## 2026-11-21 — Dedicated ticket-assignment capability

- Authorization review found that the permission catalogue already defined `tickets.assign`, but the assignee lookup and assignment mutation endpoints still required the broader `tickets.update` capability.
- Separated assignment authority from ticket operation authority: listing eligible assignees and changing an assignment now require `tickets.assign` plus the matching ticket division/unit scope.
- Eligible assignee accounts still require `tickets.update` and the matching scope because they must be able to operate the ticket after assignment; inactive accounts, Auditor, and Superadmin remain excluded as assignees.
- Added `GabahService.canAssignTickets` and changed the “Atur Petugas” UI gate to the dedicated permission so the UI no longer advertises assignment to update-only users.
- Updated `scripts/ticket-assignment-api-verify.mjs` to cover the dedicated actor permission, the separate operator permission for candidates, and the UI capability gate.
- CI verification for the new commits is pending; do not treat this batch as validated until the exact branch head completes CI.

- Follow-up migration `047_me_ticket_assignment_permission.sql` grants `tickets.assign` to the existing `admin_tiket_me` role template. This closes the operational gap created by separating assignment from ticket update; existing ME admins keep their `tickets.update` permission.
- Extended the PIBC ME queue verification script to assert the new additive/idempotent grant.

- CI caught a malformed line break in the updated ticket-assignment verification script during TypeScript lint (the test file contained literal `\\n` text). Corrected the test source into separate statements; application code was not implicated. The corrected exact-head CI run is pending.


## 2026-11-21 — Contract-linked ticket action permission alignment

- Contract review found the “Buat Tiket Terkait” action was incorrectly gated by `contracts.renewal.decide`, even though the action creates a Helpdesk ticket and the API requires `tickets.create`.
- Updated the Contracts UI to gate this action by `tickets.create` (and keep Auditor read-only). Renewal decision controls remain independently gated by `contracts.renewal.decide`.
- Extended `scripts/contract-owner-filter-verify.mjs` with a regression check that linked-ticket creation no longer depends on the renewal-decision permission.
- Reviewed loan API/UI action parity and contract read/download/upload/renewal routes. No additional mismatch was confirmed in this pass.
- The prior ticket-assignment batch CI completed successfully on commit `5f15dab`. The contract permission alignment commits are newer and require their own exact-head CI run before validation can be claimed.

- CI for the first contract regression-test draft failed at the TypeScript lint/parser stage because the source-inspection regex literals were not accepted by the configured parser. Replaced those assertions with straightforward source-string checks and positional checks; this changes only the verification harness, not application behavior. The corrected exact-head run is pending.


## 2026-11-21 — PR #177 merged; Dashboard quick-action permission audit

- PR #177 was merged to `main` at merge commit `c9ed5c9dd0058f237aceb15842ab955f586f45b4`.
- Exact-head CI run #44920285642 on `898d864eada256cd30b848704eac33c9497a2de1` completed SUCCESS. It covered TypeScript lint, navigation policy, dashboard scope, production build, Docker image/runtime, PostgreSQL 17 fresh-database/persistence, P0 security, and the remaining regression suites.
- Before that green run, CI exposed escaped template-literal characters in `scripts/contract-owner-filter-verify.mjs`; corrected the verification script and confirmed the final exact-head run is green.
- A further Dashboard review found employee empty-state loan/ticket creation buttons and an operator-dashboard ticket shortcut could appear based on page persona rather than effective create permissions.
- Dashboard quick actions now require `loans.create` or `tickets.create` consistently. Regression assertions were added to `scripts/dashboard-scope-verify.ts`.
- Follow-up work is on `fix/dashboard-role-action-permission-audit-2026-11-21`; this new batch still requires its own exact-head CI before merge.


## 2026-11-21 — Form and asset-action permission parity audit

- Follow-up review found additional create controls that used `!isAuditor` or no permission check instead of the capability required by the backend.
- Asset list and asset detail actions now require `tickets.create` before opening an asset-linked issue, and `loans.create` before opening a loan request.
- My Assets page now gates generic ticket entry, asset-linked reporting, and loan-request shortcuts by their respective effective create permissions.
- Tickets page header and empty-state create actions now require the effective ticket-create capability; non-Auditor status alone is not sufficient.
- Knowledge Base helpful-vote control now requires `knowledge.vote`, matching the API permission guard.
- ME requester workflow was checked separately: users with only `tickets.create.me` can still reach the generic ticket form, default to ME, and cannot select/submit IT or GA categories without `tickets.create`. Standard category choices require `tickets.create`.
- Regression coverage was expanded in asset-scope, dashboard-scope, and PIBC ME ticket queue verification scripts.
- Working branch: `audit/form-permission-parity-2026-11-21`. Exact-head CI is required before merge; no merge has been performed for this batch.

- Additional My Assets review found the borrower self-return button was visible to Auditor accounts even though backend policy intentionally denies Auditor return actions. The UI now hides that control for Auditor; regression assertion added to asset-scope verification.


## 2026-11-21 — PR #179 merged; remaining ticket UI permission parity

- PR #179 merged to `main` at `a1ee87bb7b7e00fea50539e9acc7e3e143e65575`.
- Exact-head CI run #44921951687 on `85d310a350bb4c105b23d4e047c8708548cb3e26` completed SUCCESS (**92/92** steps). Typecheck, asset-scope, navigation/dashboard, production build, Docker runtime, PostgreSQL 17, P0 security, and ME queue regression all passed.
- A further ticket discussion review found the comment composer checked `permission_keys.includes('tickets.update')` directly, which missed effective wildcard grants. It now uses `GabahService.hasEffectivePermission(currentUser, 'tickets.update')`, while retaining reporter self-comment access and Auditor deny-write.
- Regression assertion added to asset-scope policy verification.
- Follow-up branch: `audit/remaining-ui-permission-parity-2026-11-21`; exact-head CI required before merge.

- Global Search review found its asset/loan/ticket visibility and result-selection guards called `isNavTabAllowedForRole` without the user's effective permission keys. Updated all Global Search checks to pass `currentUser.permission_keys`, matching Sidebar and the central navigation guard; added a regression assertion.


## 2026-11-21 — PR #180 merged; creation-form authorization hardening

- PR #180 merged to `main` at `69d6c6a409f1b66a69c91f001e847c29d24ae262`.
- Exact-head CI run #44922490183 on `2b92f255cee949065a3970569a4999108828e800` completed SUCCESS (**92/92** steps), including typecheck, asset-scope/navigation/dashboard regressions, Docker runtime, PostgreSQL 17, P0 security, and ticket-comments API authorization.
- Follow-up form audit found `CreateLoanModal` relied only on Auditor exclusion while the API requires `loans.create`; it now independently checks effective permission, blocks submit, and disables the submit control without permission.
- `CreateContractModal` similarly now checks `contracts.create` plus Auditor deny-write at submit and button level, consistent with ContractsView and backend authorization.
- Regression coverage added to `scripts/loanable-pool-ui-verify.mjs` and `scripts/contract-owner-filter-verify.mjs`.
- Working branch: `audit/loan-document-action-permissions-2026-11-21`; exact-head CI required before merge.

- Continued form audit found the room-reservation modal relied on the parent page for `room_reservations.create`; the modal now independently denies Auditor and requires the explicit PostgreSQL capability (retaining the existing non-Auditor file-store fallback).
- Vendor create/edit form now revalidates `vendors.create` versus `vendors.update` at submit and disables Save when the relevant permission is absent, covering permission changes while the form is open.
- Added regression assertions to room-capability and asset-scope verification.
- The room-reservation modal also denies Auditor additional-role members the priority-override control, not just the final submit action; regression coverage protects this read-only boundary.


## 2026-11-21 — PR #181 merged; meeting master capability parity

- PR #181 merged to `main` at `70e82d87475d3492cb23fd4b44accf969e6c9ede`.
- Exact-head CI run #44923337165 on `06665cf17a7b4a476e183fe510e67bec246c12fa` completed SUCCESS (**92/92** steps), including loanable pool, contract, room reservation, vendor, Docker runtime, PostgreSQL 17, and P0 security checks.
- New review found the meeting master modal exposed both type and facility CRUD to anyone who could open it, although meeting-type write API is governed by `meeting_types.manage` and facility CRUD by `meeting_facilities.manage`.
- The database migration already grants `meeting_types.manage` to GA, but the domain service incorrectly restricted meeting-type create/update/delete to Superadmin. Service guards now honor the explicit capability with GA legacy fallback.
- Meeting Rooms entry point and master modal now expose only the tabs/actions the actor can manage, and only load each master list when its read permission is available.
- Regression coverage expanded in `scripts/room-capability-ui-verify.mjs`.
- Working branch: `audit/meeting-master-form-permissions-2026-11-21`; exact-head CI required before merge.


## 2026-11-21 — PR #182 merged; meeting room status action permission parity

- PR #182 merged to `main` at `db53c275b4692382912f5804be633c16a08eb7ad`.
- Exact-head CI run #44924057745 on `daa68ad635c97d9cb3337219cf839a2fc6b6890e` completed SUCCESS (**92/92** steps), including meeting-room UI, reservation, PostgreSQL 17, Docker runtime, and P0 security.
- Further room workflow review found the room status toggle used `meeting_facilities.manage`, while the backend route/domain guard requires `meeting_rooms.update`.
- The status action now uses the exact `meeting_rooms.update` capability with GA legacy fallback; regression assertion added.
- Working branch: `audit/meeting-room-status-permission-2026-11-21`; exact-head CI required before merge.

- PR #183 has been marked ready for review; exact-head CI will be checked before merge.


## 2026-11-22 — Module lifecycle navigation consistency

- Audit found that the global module registry could deactivate core modules (loans, tickets, knowledge, etc.), and the API middleware would reject them, but App.tsx and Sidebar.tsx exempted every core tab from module availability checks. This left dead menu entries and could keep an inactive page selected.
- Navigation now applies global module status to every tab, including core employee workspace modules. RBAC permission checks remain separate and authoritative.
- Landing-page fallback now selects the first tab that is both authorized for the user's effective permissions and globally active; it returns null if no such module exists rather than routing to a disabled Dashboard.
- Regression coverage added for deactivating the Dashboard, selecting an active Tickets fallback, and no active modules; module lifecycle UI verification now asserts that Sidebar does not exempt core modules.
- Working branch: fix/module-lifecycle-core-navigation-2026-11-22; exact-head CI required before merge.


## 2026-11-22 — Fail-closed navigation when module registry is unavailable

- Follow-up review found the UI treated an unavailable module registry as “all modules available” while the backend lifecycle middleware fails closed. That mismatch could display links that every managed API request would reject during a database/registry outage.
- Module availability now has an explicit unverified state. Until the registry returns a verified list, the application hides module navigation and shows a clear loading/error state; a registry failure offers a retry action.
- An empty verified registry is distinguished from a registry outage and from a user who has no read permission on any active module.
- Sidebar filtering now requires a verified active-module list. RBAC remains a separate authorization layer and no permission is granted by module activation.
- Added regression assertions for registry outage, fail-closed Sidebar filtering, and retry/error messaging. Exact-head CI is pending; no merge until all checks pass.
- Working branch: `fix/module-status-fail-closed-2026-11-22`.


## 2026-11-22 — Meeting master API lifecycle coverage

- Route inventory review found that `/api/meeting-types` and `/api/meeting-facilities` were protected by their own RBAC permissions but absent from the global `meeting_rooms` lifecycle route map.
- Added both route families to the module resolver and managed-path guard so disabling Meeting Rooms blocks master-data APIs as well as room/reservation operations.
- Added a regression assertion for both route families. Exact-head CI is pending; no merge until all checks pass.


## 2026-11-22 — Case-insensitive persistence response gate

- Security review found Express route matching and the authentication middleware are case-insensitive, but the global persistence response gate checked `req.path.startsWith('/api/')` case-sensitively.
- An uppercase path such as `/API/...` could therefore reach a state-changing Express route while skipping the global pre-response persistence gate.
- The gate now normalizes the request path to lowercase before deciding whether a mutation must wait for persistence. Added a regression assertion to the PostgreSQL runtime-persistence contract.
- Working branch: `fix/persistence-gate-case-insensitive-api-2026-11-22`; exact-head CI required before merge.


### 2026-11-22 — Karantina API setelah kegagalan PostgreSQL runtime

- Temuan terverifikasi: `persistDataStore()` melatch PostgreSQL authoritative store setelah pool/write gagal dan menolak mutasi berikutnya, tetapi proses masih dapat melayani GET dari objek `db` yang mungkin sudah berubah sebelum commit gagal. Response gate mencegah respons sukses palsu, namun tidak membatalkan mutasi in-memory.
- Dampak: sesudah respons 503, GET berikutnya pada proses yang sama berpotensi memperlihatkan state sementara yang belum committed; state itu akan hilang saat restart dan hydration ulang dari PostgreSQL.
- Mitigasi pada branch ini: ekspor status failure latch; middleware keamanan mengarantina seluruh API selain `/api/health` dengan HTTP 503 setelah latch aktif; health melaporkan `status=degraded`, `ready=false`, dan restart-required, bukan menyebutnya file-store fallback.
- Restart diperlukan untuk memulihkan state otoritatif dari database. Tidak ada fallback diam-diam ke file store setelah PostgreSQL pernah aktif.
- Validasi kontrak ditambahkan ke regression runtime persistence dan akan dijalankan pada CI exact-head. Belum diklaim sebagai hasil browser UAT.


### 2026-11-22 — Relokasi aset saat pinjaman aktif

- Audit membandingkan guard `assignAsset`, `mutateLifecycle`, dan `moveAsset`. Assign dan lifecycle sudah menolak aset dengan loan `approved`/`borrowed`; `moveAsset` sebelumnya hanya memeriksa permission dan dapat mengubah lokasi fisik saat aset masih berada dalam custody/pemesanan pinjaman.
- Perbaikan: `moveAsset` kini menolak relokasi untuk loan `approved` atau `borrowed` dengan HTTP 409. Pemeriksaan berada di domain service, bukan hanya UI/route.
- Pinjaman `pending_approval` tidak diblokir, konsisten dengan guard assign/lifecycle saat ini; approval tetap memvalidasi status aset.
- Regression ditambahkan pada asset status workflow guard yang sudah menjadi bagian CI. Menunggu CI exact-head.

### 2026-11-22 — Audit waktu bentrok pinjaman (Asia/Jakarta)

- Audit menemukan ketidaksamaan interpretasi waktu: form browser mengirim `datetime-local` (waktu dinding lokal), sementara backend mengubah jam/menit dengan `Date.UTC`. Pemeriksaan bentrok di UI memakai `new Date(datetime-local)`, sehingga pada WIB hasil UI dan server berbeda tujuh jam.
- Dampak: jadwal yang berdekatan dengan batas waktu dapat dinilai bentrok di satu sisi tetapi tidak di sisi lain; pemeriksaan ulang saat approval juga harus memakai interpretasi waktu yang sama.
- Perbaikan pada PR #190: parser bersama `shared/loan-datetime.ts` dipakai oleh validasi request, collision check pengajuan, collision recheck approval, dan UI pre-check. Input datetime-local tanpa zona ditafsirkan sebagai Asia/Jakarta (UTC+07:00); ISO bertanda zona dipertahankan sebagai instant absolut; tanggal legacy tanpa jam tetap mempertahankan semantik UTC-midnight lama agar kompatibel.
- Regression baru menguji konversi WIB, overlap, jadwal berurutan, tanggal legacy, ISO eksplisit, serta tanggal/jam tidak valid. Didaftarkan pada CI.
- PR #190 head terbaru `a2f282a4e671dcaf61f492ce04c8c6d5d7dc7146`; CI exact-head run #2912 lulus 93/93 langkah. Perbaikan lanjutan juga menormalisasi jadwal ke ISO UTC eksplisit pada snapshot baru dan normalized PostgreSQL `TIMESTAMPTZ`; upsert menulis ulang jadwal lama melalui parser yang sama. CI setelah sinkronisasi commit PR #191 tetap diperlukan. Belum ada klaim UAT browser.

### 2026-11-22 — Validasi input tiket sebelum persistensi PostgreSQL

- Temuan terverifikasi: `createTicket()` melakukan `trim()` pada judul/deskripsi tetapi tidak membatasi panjang judul, sementara schema normalized PostgreSQL menetapkan `tickets.title VARCHAR(255)`.
- Dampak: judul lebih dari 255 karakter lolos service, lalu gagal saat `persistPostgresState()` menulis tabel normalized. Kegagalan write mengaktifkan `postgresFailureLatched`; sebelum karantina, hal ini dapat membuat API layanan masuk degraded hingga restart. Ini merupakan jalur denial-of-service melalui input tiket yang memiliki permission sah.
- Perbaikan: validasi tipe, teks tidak kosong, judul maksimal 255 Unicode code points, deskripsi maksimal 20.000 Unicode code points sebelum nomor tiket dibuat atau state dimutasi. Hanya nilai yang telah dinormalisasi yang disimpan.
- Regression memperiksa batas 255, 256, deskripsi di atas batas, dan judul Unicode tepat pada batas. Script `test:ticket-related-asset-scope` sudah menjadi bagian CI.
- Menunggu CI exact-head; belum diklaim sebagai browser UAT.


- Audit tambahan pada reservasi ruang rapat menemukan field `meeting_type` yang dapat mencapai kolom `VARCHAR(50)` tanpa batas panjang, serta NUL byte yang dapat masuk ke kolom `TEXT`/array fasilitas. Guard sekarang membatasi kode meeting type ke 50 code points dan menolak NUL pada field teks dan fasilitas sebelum state dimutasi. Regression ditambahkan ke `room-capability-ui-verify` yang sudah berjalan di CI.


- Audit kontrak juga menemukan `createContract()` dan `updateContract()` tidak membatasi `contract_type VARCHAR(100)`, `title VARCHAR(255)`, dan `vendor_name VARCHAR(255)`; NUL byte pada judul/vendor/catatan juga dapat menggagalkan insert/update. Validasi bersama sekarang diterapkan pada create dan update untuk field tersebut, dengan batas Unicode code points serta penolakan NUL sebelum mutasi.

- Audit tambahan pada reservasi ruang rapat menemukan field `meeting_type` yang dapat mencapai kolom `VARCHAR(50)` tanpa batas panjang, serta NUL byte yang dapat masuk ke kolom `TEXT`/array fasilitas. Guard sekarang membatasi kode meeting type ke 50 code points dan menolak NUL pada field teks dan fasilitas sebelum state dimutasi. Regression ditambahkan ke `room-capability-ui-verify` yang sudah berjalan di CI.


- Audit kontrak juga menemukan `createContract()` dan `updateContract()` tidak membatasi `contract_type VARCHAR(100)`, `title VARCHAR(255)`, dan `vendor_name VARCHAR(255)`; NUL byte pada judul/vendor/catatan juga dapat menggagalkan insert/update. Validasi bersama sekarang diterapkan pada create dan update untuk field tersebut, dengan batas Unicode code points serta penolakan NUL sebelum mutasi.

- Audit kontrak juga menemukan `createContract()` dan `updateContract()` tidak membatasi `contract_type VARCHAR(100)`, `title VARCHAR(255)`, dan `vendor_name VARCHAR(255)`; NUL byte pada judul/vendor/catatan juga dapat menggagalkan insert/update. Validasi bersama sekarang diterapkan pada create dan update untuk field tersebut, dengan batas Unicode code points serta penolakan NUL sebelum mutasi.

- Batas numerik kontrak juga diselaraskan dengan tipe SQL: `notice_period_days` dan seluruh reminder dibatasi ke rentang PostgreSQL `INTEGER` (0–2.147.483.647), sedangkan `contract_value` dibatasi ke nilai aman JS yang berada di bawah kapasitas `NUMERIC(18,2)`. Berlaku untuk create dan update; regression overflow ditambahkan.

- Maintenance juga menolak NUL byte pada `title`, `technician_name`, `notes`, dan setiap item checklist. Sebelumnya batas panjang ada, tetapi karakter NUL masih dapat masuk ke JSONB snapshot dan menggagalkan commit. Regression `maintenance-input-validation` diperluas.

- Pembuatan, bulk import, dan update profil pengguna juga menolak NUL byte pada nama, email, divisi, departemen, telepon, dan Telegram ID. Batas panjang sebelumnya sudah ada, tetapi karakter NUL masih dapat masuk ke teks/JSONB snapshot. Regression `user-create-profile-validation` diperluas untuk ketiga jalur.

- Alur pinjaman menolak NUL byte pada `purpose`, `borrower_phone`, `rejection_reason`, `handover_notes`, dan catatan pengembalian yang masuk ke audit log; catatan serah-terima/pengembalian dibatasi 2.000 karakter. Regression loan timezone diperluas.

- Direktori vendor menolak NUL dan membatasi panjang nama, kategori, PIC, telepon, email, alamat, serta catatan pada create/update sebelum menyentuh snapshot JSONB. Regression `vendor-contract-count` diperluas.


### 2026-11-22 — Serialisasi persetujuan pinjaman bersamaan

- Audit trigger `check_loan_schedule_collision()` menemukan pemeriksaan `IF EXISTS` tanpa penguncian aset. Dua transaksi PostgreSQL yang menyetujui dua baris pinjaman berbeda untuk aset yang sama dapat sama-sama membaca belum ada pinjaman aktif, lalu keduanya commit. Pemeriksaan service/in-memory tidak menutup race antar transaksi/proses.
- Migration 098 memperbarui trigger agar mengunci baris aset `FOR UPDATE` sebelum membaca bentrok. Lock ditahan sampai transaksi selesai; persetujuan kedua untuk aset yang sama menunggu lalu melihat pinjaman pertama yang sudah committed.
- CI CR-04/CR-05 diperluas dengan uji integrasi PostgreSQL nyata: dua koneksi independen, dua transaksi bersamaan, verifikasi transaksi kedua menunggu lock dan ditolak dengan SQLSTATE P0001; status akhir harus satu `approved` dan satu tetap `pending_approval`.
- Uji ini hanya memakai database throwaway CI dan fixture yang dibersihkan setelah test. Menunggu CI exact-head; belum ada klaim UAT browser.


### 2026-11-22 — Proteksi kepemilikan tiket saat penghapusan akun

- Audit lifecycle akun menemukan endpoint DELETE pengguna hanya melindungi pinjaman aktif dan aset yang masih ditugaskan. Akun operator yang masih menjadi assignee tiket non-closed dapat dihapus; tiket tetap menunjuk ID operator yang tidak lagi ada di roster autentikasi. Akun reporter juga dapat dihapus sebelum tiket selesai, sehingga jalur self-service close/reopen dan identitas pelapor aktif terputus.
- Perbaikan: penghapusan akun ditolak dengan HTTP 409 jika pengguna masih menjadi reporter atau assignee pada tiket yang statusnya belum `closed`. Pesan menyebut jumlah tiket dan langkah penyelesaian. Tiket closed tetap dipertahankan sebagai histori.
- Regression ditambahkan pada `user-admin-validation-verify.mjs`, yang sudah dijalankan CI.
- Menunggu CI exact-head; belum mengklaim UAT browser.


### 2026-11-22 — Keunikan primary key histori perpindahan aset

- Audit `assignAsset()`, `unassignAsset()`, dan `moveAsset()` menemukan ketiganya membuat ID movement dengan pola `MOV-${Date.now()}`. Kolom `asset_movements.id` adalah primary key. Dua perpindahan berbeda yang diproses dalam milidetik sama dapat menghasilkan primary key identik.
- Dampak: salah satu persistensi movement gagal; karena PostgreSQL merupakan authoritative store dan kegagalan runtime dilatch, error tersebut berpotensi mengarantina API sampai proses restart.
- Perbaikan: ketiga jalur menggunakan `randomUUID()` dari `node:crypto`, tetap memakai prefix `MOV-` dan tidak mengubah format nomor aset.
- Regression ditambahkan ke asset lifecycle workflow guard yang sudah terdaftar di CI.
- Menunggu CI exact-head; belum diklaim sebagai UAT.


### 2026-11-22 — UUID untuk seluruh ID record domain

- Audit lanjutan setelah perbaikan movement menemukan generator ID lain masih memakai timestamp dan/atau suffix `Math.random() * 1000`: audit log, notifikasi, aset, pinjaman, tiket, reservasi ruang, meeting type, dan meeting facility.
- Semua kolom ID tersebut merupakan identitas record yang harus unik. Timestamp saja bisa bentrok pada operasi serentak; suffix 1.000 kemungkinan juga bukan jaminan keunikan.
- Perbaikan: semua generator di atas kini memakai `randomUUID()` Node crypto, dengan prefix domain dipertahankan. Generator nomor bisnis (nomor aset/tiket/pinjaman/reservasi) tidak diubah.
- Regression ditambahkan pada service workflow guard yang sudah berjalan di CI.
- Menunggu CI exact-head; belum diklaim sebagai UAT.


### 2026-11-22 — Serialisasi double-booking ruang rapat lintas transaksi

- Audit ulang migration `015_room_reservations.sql` menemukan trigger `prevent_double_booking()` memakai `IF EXISTS` tanpa lock. Dua transaksi PostgreSQL independen dapat sama-sama membaca slot kosong lalu commit reservasi aktif yang bertabrakan.
- Migration baru `099_room_reservation_collision_lock.sql` memperoleh transaction-scoped advisory lock berdasarkan `room_id` sebelum query collision. Lock dilepas otomatis saat transaksi commit/rollback.
- Integrasi CR-04/CR-05 diperluas dengan dua koneksi PostgreSQL independen: transaksi kedua harus menunggu lock, lalu ditolak dengan SQLSTATE `P0001`; hasil akhir satu reservasi `pending` dan satu tetap `cancelled`.
- Pengujian memakai fixture CI acak dan menghapus seluruh record setelah test. Menunggu CI exact-head dan belum diklaim sebagai UAT browser.


### 2026-11-22 — Audit log append-only di PostgreSQL

- FR-10.2 mensyaratkan histori audit immutable, tetapi tabel `audit_logs` sebelumnya belum memiliki proteksi database terhadap UPDATE, DELETE, atau TRUNCATE.
- Migration `100_audit_log_immutability.sql` menolak ketiga operasi tersebut dengan SQLSTATE `55000`. Penambahan log tetap berjalan melalui INSERT.
- FK actor diubah menjadi `ON DELETE SET NULL`; trigger hanya mengizinkan perubahan nested dari aksi FK ini dan hanya pada kolom `user_id`. Snapshot `user_name`, `user_role`, action, details, dan timestamp tetap immutable.
- CR-04/CR-05 fresh PostgreSQL integration menguji user deletion, penolakan UPDATE/DELETE/TRUNCATE, dan retensi baris audit di dalam transaksi yang di-rollback setelah verifikasi.
- Menunggu CI exact-head; belum diklaim sebagai UAT.


### 2026-11-22 — UUID untuk ID audit kontrak

- Audit generator ID menemukan pengecualian yang tertinggal di `server/contracts.ts` dan `server/notifications/notificationService.ts`: audit reminder memakai timestamp + 32-bit random suffix, sementara notifikasi in-app memakai 64-bit random suffix.
- Ganti ID audit kontrak, audit reminder, dan notifikasi reminder in-app menjadi UUID dari `node:crypto`; prefix domain dipertahankan.
- Regression `contract-creation-relations-verify.mjs` memastikan seluruh generator tersebut memakai UUID.
- Menunggu CI exact-head; belum diklaim sebagai UAT.


### 2026-11-22 — Perbaikan lifecycle advisory lock scheduler reminder

- Audit `reminderScheduler.ts` menemukan `releaseLeaderLock()` menjalankan query `pg_advisory_unlock` tanpa `await`, lalu langsung mengembalikan client ke pool. Karena advisory lock bersifat session-scoped, koneksi berpotensi dipakai ulang saat lock belum dilepas.
- Jalur kegagalan `acquireLeaderLock()` juga dapat meninggalkan client yang sudah berhasil di-checkout ketika query gagal.
- Perbaikan: semua client dilepas melalui `finally`; unlock ditunggu sebelum client dilepas; koneksi yang mengalami error dilepas dengan error agar pg-pool membuangnya; stop scheduler menunggu pelepasan lock.
- Tambah regression CI untuk urutan unlock/release, cleanup saat acquisition gagal, dan semua lifecycle path scheduler.
- Menunggu CI exact-head; belum diklaim sebagai UAT multi-instance produksi.


### 2026-11-22 — Scheduler reminder fail-closed saat leader lock tidak tersedia

- Audit lanjutan menemukan `acquireLeaderLock()` masih fail-open: jika koneksi/query PostgreSQL gagal, fungsi mengembalikan `true` dan sweep tetap berjalan.
- Pada deployment multi-instance, dua server dapat mengirim email/Telegram bersamaan sebelum baris idempotency tersimpan. Unique key mencegah duplikasi log, tetapi tidak dapat menarik kembali pesan eksternal yang sudah terkirim.
- Perbaikan: jika PostgreSQL pool tersedia tetapi advisory lock tidak dapat diverifikasi, scheduler mencatat warning dan melewatkan sweep. File-store development tanpa pool tetap berjalan seperti sebelumnya.
- Regression scheduler mewajibkan catch error PostgreSQL mengembalikan false, membersihkan koneksi, dan tidak mengeksekusi sweep tanpa leader lock.
- Menunggu CI exact-head; belum diklaim sebagai uji multi-instance produksi.


### 2026-11-22 — Manual reminder sweep wajib memakai leader lock

- Audit menemukan endpoint `POST /api/contracts/reminders/run` memanggil `ContractDomainService.runReminderSweep(actor)` langsung, melewati advisory leader lock yang dipakai scheduler interval.
- Dua Admin GABAH pada instance berbeda dapat menjalankan sweep bersamaan. Karena provider email/Telegram mengirim sebelum idempotency log tersimpan, unique log saja tidak menjamin pesan eksternal tidak ganda.
- Tambah `runManualOnce(actor)` yang mengambil advisory lock, memakai guard `running`, dan selalu melepas lock setelah selesai. Endpoint manual menggunakan fungsi ini; lock tidak tersedia → HTTP 409 dan tidak ada pengiriman.
- Regression scheduler memeriksa jalur manual endpoint tidak lagi memanggil engine secara langsung.
- Menunggu CI exact-head; belum diklaim sebagai UAT multi-instance produksi.


### Core navigation permission bypass closed — 2026-11-22

- Audit found `isNavTabAllowedForRole` returned true for Dashboard, My Assets, Loans, Tickets, and Knowledge Base before evaluating PostgreSQL `permission_keys`. Users whose effective RBAC set omitted a page's read permission still saw that menu and could be routed to it; backend APIs remained authoritative, but the UI policy violated default-deny and produced misleading empty/403 pages.
- Removed the PostgreSQL-mode bypass. Every core page now requires its mapped read permission; landing selection picks the first permitted page and returns no page if none is granted. Legacy role navigation remains only when permission metadata is absent.
- Regression coverage now verifies all five core tabs deny empty grants, allow their exact read grants, custom-role landing behavior, and Auditor restrictions. CI's existing `test:navigation-policy` step executes this suite.
- This closes a UI/navigation authorization defect only; API enforcement and browser UAT remain separately required.


### Public landing employee-directory exposure closed — 2026-11-22

- Audit found the public landing page rendered the seeded employee directory and accepted `allUsers` from authenticated application state. The page exposed employee names, login emails, and department details; after an authenticated session loaded the directory, navigating back to the public landing page could retain and render those records.
- Removed public account-role shortcuts and the employee directory section. The public landing page now accepts only the login callback and no longer imports mock users or receives the authenticated directory state.
- Login remains available through the normal credential form; public role/account prefill was removed.
- Added `test:public-landing-privacy` to assert no employee directory props, mock-account imports, login emails, or department fields are rendered or passed into the public page. The test is registered as a required CI step.
- This is a client-side public-page exposure fix; it does not replace server-side directory authorization or production browser UAT.


### Public-facing claims and login controls corrected — 2026-11-22

- Follow-up review found the public landing page still claimed `100% Aktif`, `4.280+` assets, `99.8%` fleet readiness, and response SLA under two hours without any live data source. These are now neutral descriptions of system modules rather than invented operational metrics.
- Login header no longer asserts SSL/TLS 256-bit protection; the app cannot establish transport encryption from client UI. It now describes the server-backed authentication flow without claiming a cipher or TLS configuration.
- Removed the "Ingat perangkat ini" checkbox because login always stores the session token in localStorage regardless of the checkbox state. Replaced the inert password-help text with clear Service Desk contact guidance.
- Removed the unused `availableUsers` prop and mock-user import from LoginPage; employee directory state is no longer passed into either public landing or login screens.
- Expanded `test:public-landing-privacy` to assert these public-facing claims and controls remain truthful.


### Legacy snapshot capability restoration — 2026-11-23 (stacked fix for PR #249; validation pending)

- PR #249 CI run #3282 passed typecheck, dependency audit, production build, Docker runtime smoke, and PostgreSQL integration, but the meeting-room stage-3 regression failed 7 of 34 assertions: Sekdir HIGH-priority interruption and GA room operations were denied.
- Root cause identified in `hydrateDbFromState()`: canonical users' primary profile and label were refreshed from `CANONICAL_USERS`, but canonical `role_keys` were not restored when loading older persisted snapshots that predate the `role_keys` field. That left canonical GA/Sekdir/Humas/IT users without their default secondary capability mirror after hydration, despite the new two-profile model.
- Fix: when a canonical user's persisted `role_keys` field is absent/malformed, restore the canonical seed role keys. Preserve an explicit empty array so a deliberate role revocation is not undone. The subsequent existing Dynamic RBAC reconciliation persists those assignments and the PostgreSQL policy refresh reads them.
- Added regression assertions to `test:employee-role-normalization` for missing-field restoration and explicit-empty preservation.
- Fix branch: `fix/rbac-restore-canonical-secondary-roles-2026-11-23`. Code commit: `ae7db7906d1174f7072edecfff08317bc1a04c73`; test commit: `977a2b116e9e4766e61c76866ef044abd5f92f67`.
- Exact-head CI and the previously failing meeting-room PostgreSQL test remain PENDING. Do not treat this as resolved until a fresh exact-head CI run passes.


### Meeting Room secondary-role authorization fix — 2026-11-23 (PR #251; CI pending)

- Exact CI run #3286 reproduced the same 7/34 failures. The diagnostic output showed canonical functional role keys (ga, sekretaris_direksi, humas) but no effective PostgreSQL permission metadata. The direct SQL probe did not run because the test parent process has no DATABASE_URL/PGHOST; therefore its absence must not be interpreted as proof of missing database assignments.
- The actionable root cause is in server/services.ts: hasRoomPermission() used Dynamic RBAC permissions when PostgreSQL was active, but its file-store compatibility fallback compared only actor.role with legacy labels such as GA and Sekretaris Direksi. Employee-profile normalization intentionally sets these users' primary role to Karyawan, retaining their actual job functions in role_keys. Thus GA approval/check-in/check-out and Sekdir priority override were denied in file-store test/runtime mode.
- Fix commit 7529a5e54044d0018e02bf070226d4b77e36efd3: file-store fallback now matches the requested legacy function against both the primary label and normalized secondary role_keys. Auditor denial and PostgreSQL authoritative permission checks remain unchanged; this does not grant roles by division or location.
- CI run #3286 is still red on the meeting-room test; this new fix requires a fresh exact-head run. Do not claim resolved until all 34 assertions and the full workflow pass.


### Contract creation role-capability and owner-scope fallback fix — 2026-11-23 (PR #251; CI pending)

- Exact-head CI #3287 exposed a contract creation fixture failure: the seeded IT employee (USR-03) has primary profile Karyawan, functional capability `role_keys: ['it']`, and division IT. The file-store compatibility checks still compared only `user.role` with IT/GA and used the primary role as the owner-division scope. The create request was therefore denied before the test could validate missing/inactive PIC relations.
- Fix commit 6a26f9995b6c903d92daff1b6ed35e9f5617c5ea: contract file-store fallback now honors normalized IT/GA secondary capabilities for contract management/create, and uses the employee's explicit `division` for owner-division scope/read/edit checks. PostgreSQL remains authoritative through `contracts.*` permissions and module-specific division scopes; Auditor deny-write and Superadmin handling remain unchanged.
- This is an authorization compatibility fix, not a test bypass. The existing contract relation test still verifies missing/inactive PIC, escalation user, parent contract, dates, and payload integrity after authorization succeeds. Awaiting fresh CI validation.


### Asset owner mutation secondary-role fallback fix — 2026-11-23 (PR #251; CI pending)

- CI #3289 and #3290: Meeting Room now passes all 34/34 assertions. The remaining organization-model failure was case 6 (relocating an IT asset while preserving its asset number). The expected and actual asset-number strings were identical; the compound assertion failed because the move request itself was not HTTP 200.
- Root cause in `canMutateAssetOwner()`: file-store fallback mapped ownership only from `actor.role` (legacy IT/GA primary labels). Canonical employees have primary role Karyawan and their operational function in `role_keys`, so the IT employee was denied relocation despite carrying `it` capability.
- Fix commit e323a618c21e6b5f4104a7aecd07bc3dd1ff2a1f: file-store asset owner mutation now matches normalized IT/GA capability in either legacy primary role or secondary `role_keys`. PostgreSQL still requires both the explicit operation permission and owner-division scope; Superadmin and Auditor enforcement remain unchanged.
- Updated `scripts/org-model-verify.mjs` to print move HTTP status and error message alongside the asset number, so future failures identify the failed condition rather than displaying two identical numbers. Fresh exact-head CI is required before declaring green.


### Asset read-scope fallback ordering fix — 2026-11-23 (PR #251; CI pending)

- Exact-head CI #3292 confirmed the prior mutation-capability fix was not sufficient: the organization-model case 6 still received HTTP 403 `Aset berada di luar scope pengguna.` before the move handler. The assertion now reports the move status and response message, exposing the true failing layer.
- Root cause: `getScopedAssets()` file-store compatibility branch evaluated the generic employee baseline first. Because `isEmployeeBaseline` is true for all non-Superadmin/non-Auditor actors, the subsequent IT/GA branches were unreachable. Canonical IT employees (primary role Karyawan, secondary `it`) therefore could not see non-loanable IT assets at all locations, and GA's explicit read filter was also bypassed.
- Fix commit d7cdcc6a0c3d5c40c1442ab0743b2bea6fc7d18b: evaluate explicit IT/GA secondary capabilities before the employee baseline. IT receives its IT owner domain plus personal/loan-pool assets; GA receives GA owner assets and IT HLT/HPC workstations only, plus personal/loan-pool assets; ordinary Karyawan retain assigned/pool-only visibility. PostgreSQL dynamic scope and permission logic is unchanged.
- Exact-head CI must rerun the organization-model regression and the full workflow before this fix is considered complete.


### Secondary-role consistency across tickets, loans, and room queues — 2026-11-23 (PR #251; CI pending)

- The organization-model test exposed a second-stage access check: even after IT mutation capability was corrected, request middleware denied the asset because file-store `getScopedAssets()` returned the generic employee baseline before evaluating IT/GA secondary roles. Fix d7cdcc6a0c3d5c40c1442ab0743b2bea6fc7d18 resolves that ordering and preserves GA's workstation-only IT read exception.
- Follow-up code audit found the same primary-role-only fallback pattern in scoped ticket/loan attention checks and Meeting Room operational queue visibility. Fix commits cb1b5ec7ae56e53da755425f074c211c42279672 and bb2088578692524400497731f7390d0a40d0e9aa now honor normalized IT/GA `role_keys` in file-store compatibility mode. PostgreSQL permission/scope checks remain authoritative.
- Added regression guards to ticket transition and Meeting Room Stage 3 verification scripts to prevent these secondary-role fallbacks from regressing. Fresh full CI is required.


### Dynamic RBAC source-contract test alignment — 2026-11-23 (PR #251; CI pending)

- CI #3295 reached the Dynamic RBAC foundation checks and failed 1/142 source-contract assertions. Runtime behavior changes were not implicated: the static assertion still required the obsolete unreachable `user.role === 'IT'` branch in `getScopedAssets()`, which the new secondary-capability-first fallback intentionally replaces.
- Updated `scripts/dynamic-rbac-foundation-verify.mjs` in commit 23ef8744fa267d3c54e4d5a35efa18ac8e9e7a3e to assert the new ordered IT/GA capability checks and the constrained owner-domain filters, while retaining the PostgreSQL dynamic scope and workstation-read assertions.
- The exact-head full CI run must pass before merge. This updates the test contract to the intended model; it does not remove runtime coverage.


### Frontend capability fallback consistency — 2026-11-23 (PR #251; CI pending)

- Extended the secondary-role audit to the frontend compatibility layer. `src/services/gabahService.ts` still used primary-role labels for asset edit, loan approval, ticket visibility, and ticket actions whenever effective PostgreSQL permission metadata was absent. Canonical Karyawan users with IT/GA capabilities could therefore have correct backend access but missing UI actions in file-store mode.
- Fix commit 0c3656f7a98ac7b1060f9859ac0906cb0ae6bce0 adds normalized capability matching for IT/GA and preserves Auditor deny-write precedence.
- Added regression coverage in `scripts/auditor-additional-role-verify.ts` (commit 6c2b3d125827a26e7402fe7452d423ecd246bb35) for Karyawan+IT and Karyawan+GA fallback behavior, including GA's prohibition on editing IT assets.
- CI must validate typecheck, UI capability tests, and all integration suites before merge.


### Dashboard attention test contract alignment — 2026-11-23 (PR #251; CI pending)

- CI #3299 passed Dynamic RBAC foundation checks (142/142) and then failed one source-contract assertion in `scripts/dashboard-attention-middleware-verify.mjs`. That assertion still required primary IT/GA role-label checks in the file-store branch; the implementation now intentionally resolves both primary legacy labels and normalized secondary `role_keys`.
- Updated the assertion in commit 42c83da721f6e2015ada77e3ef9a0ff2feb8bcfe to verify the secondary-role capability path and retain the requirement that it stays behind the file-store compatibility branch. Runtime PostgreSQL module-scope checks remain unchanged.


### Asset-scope policy test contract alignment — 2026-11-23 (PR #251; CI pending)

- CI #3300 reached the asset-scope policy suite and found one outdated source assertion: it expected `isAuditor()` to inspect only an explicit `role_keys.includes('auditor')` array. The frontend helper now also preserves the legacy primary Auditor label through the shared normalized capability helper.
- Updated the source-contract assertion in commit 0a474c5b7fa9347de2a1edac8c38d2779afddfbe to require `hasLegacyCapability(user, 'auditor')` while retaining deny-write checks in asset edit, loan approval, and ticket management. Runtime authorization behavior is not weakened.


### Frontend module capability gates — dashboard, loans, assets, contracts, meeting masters — 2026-11-23 (PR #251; CI pending)

- Extended the frontend compatibility audit beyond the first set of buttons. Several modules used `legacyRoles.includes(currentUser.role)`, which silently hid role-specific UI for canonical Karyawan profiles carrying IT/GA in `role_keys` when PostgreSQL permission metadata was absent.
- Updated Dashboard, Loans, My Assets, Contracts, Asset Detail, and Meeting Master Settings to resolve legacy fallback roles through the shared normalized `GabahService.hasLegacyCapability()` helper. Existing permission metadata remains authoritative; Auditor deny-write and Superadmin precedence are preserved.
- Earlier related UI fixes also cover Meeting Room GA operations, Sekdir override, and IT license creation. Full typecheck and UI/source-contract CI are pending.


### UI regression follow-up — ticket actions and source-test hygiene — 2026-11-23 (PR #251; CI pending)

- CI #3307 caught one missed frontend fallback: `canManageTickets()` still used a primary-role array after the other IT/GA UI gates were migrated. Updated it in commit 551b525de9b6eb89422115daaf773a828a847273 to honor secondary IT/GA capabilities, matching `canAssignTickets()` and the server policy.
- CI #3309/#3310 caught a duplicate local `licenseUi` declaration introduced while adding the license UI source assertion. Removed the duplicate in commit eff03348e7826826a79017ab3fd895187ac30d85; the assertion now reuses the existing source binding.
- Both are validation/test maintenance fixes; fresh exact-head CI remains required.


### Organization-model fixture correction after IT asset scope passed — 2026-11-23 (PR #251; CI pending)

- Exact-head CI #3315 confirmed the IT relocation path now succeeds (case 6: HTTP 200 and unchanged asset number). The remaining organization-model failure was case 5: the test selected the first Karyawan account without excluding assigned IT/GA capabilities, then expected it to be denied asset mutation after changing only job level to DIREKSI. With the new role model that fixture could be an operational IT/GA employee, so HTTP 200 was correct for its assigned capability.
- Updated `scripts/org-model-verify.mjs` in commit a39508206a0febc699c0a07420ffc24075384b52 to select a Karyawan with no IT/GA operational role keys. The test now isolates the intended invariant: job level alone must not grant asset mutation.
- No production authorization was weakened. Fresh exact-head CI remains pending.


### Maintenance schedule secondary-role authorization fix — 2026-11-23 (PR #251; CI pending)

- CI #3316 passed the organization-model regression, including IT asset relocation (HTTP 200) and job-level non-escalation. It then exposed the same primary-role-only pattern in Maintenance schedules: IT/GA list filters returned empty, while create/update allowlists denied canonical Karyawan users carrying `it`/`ga` capabilities.
- Fix commit 40c013be3273bd62514fdc85a599244988617c5e updates the file-store maintenance list to scope IT schedules to IT-owned assets and GA schedules to GA-owned assets, using `hasApplicationRole()` for secondary capabilities. Create/update allowlists now accept Admin GABAH or explicitly assigned IT/GA capability, while the existing `canMutateAssetOwner()` check still enforces matching owner domain. Ordinary Karyawan, SC/RPC, PIBC, and Auditor remain denied as before.
- Exact-head CI must rerun the maintenance live HTTP matrix and full workflow before merge.


### Cross-module file-store secondary-role fallback audit — 2026-11-23 (PR #251; CI pending)

- A broader server route audit found additional primary-role-only checks that were not covered by the first UI/asset/maintenance tests: ticket owner queue visibility, vendor owner filtering, dashboard owner summaries/attention, movement-history filtering, employee-directory read allowlist, and Knowledge Base write allowlists.
- Fix commit dc415da4e8682a42c618f80896e7bc508c0c82a2 replaces these file-store-only role-label comparisons with the existing `hasApplicationRole()` resolver, which honors both legacy primary labels and explicit secondary `role_keys`. PostgreSQL paths continue to require their explicit permission and module scope. SC/RPC and PIBC location identities do not gain IT/GA capabilities from location alone.
- This is a consistency pass across remaining server routes; full CI must validate movement, ticket, dashboard, directory, vendor, maintenance, and Knowledge Base behavior before merge.


### Maintenance Dynamic RBAC source-contract test alignment — 2026-11-23 (PR #251; CI pending)

- CI #3319 failed one of 142 Dynamic RBAC source-contract checks after the maintenance file-store allowlist was migrated from primary labels to `hasApplicationRole()`. The test still required the obsolete `['Admin GABAH', 'IT', 'GA'].includes(actor.role)` expression.
- Updated the assertion in commit 347f5a99427c3aac3f24922c5ec4b76904e7e3eb to require the new Superadmin + explicit IT/GA capability guard for both create and update routes, while retaining the PostgreSQL permission gate and shared owner-scope mutation policy.


### Knowledge Base source-contract test alignment — 2026-11-23 (PR #251; CI pending)

- CI #3322 passed the maintenance source-contract check but reported two stale Dynamic RBAC source assertions for Knowledge Base create/update. The routes now intentionally use `isSuperadminActor()` plus `hasApplicationRole(it/ga)` in file-store mode rather than the legacy primary-role array.
- Updated both assertions in commit 78e2efd3de439538d2df64b05572adc43a91805d to require the new capability-aware allowlist while preserving PostgreSQL `knowledge.create`/`knowledge.update` permission checks.


### Employee-directory source-contract test alignment — 2026-11-23 (PR #251; CI pending)

- CI #3324 passed Dynamic RBAC foundation checks after the Knowledge Base assertion update, then found one stale asset-scope source assertion for the file-store employee-directory allowlist. The implementation now uses Superadmin plus explicit IT/GA capabilities through `hasApplicationRole()`.
- Updated the assertion in commit b05f75fafa39b75d45ea996490ca1e03278006bf to validate the capability-aware fallback while retaining the PostgreSQL `users.read` gate.


### Maintenance dynamic-scope source-contract test alignment — 2026-11-23 (PR #251; CI pending)

- CI #3327 passed the maintenance live HTTP authorization matrix (19/19), including IT/GA list filtering and matching-owner create/update. It then failed one source-contract check in `scripts/maintenance-dynamic-scope-verify.mjs`, which still expected the old primary-role GA filter.
- Updated that assertion in commit 5a389ca939fcc56c972fd6be2e5525d19068cb9b to verify the new IT/GA secondary-capability owner filters, while retaining the PostgreSQL dynamic-scope and workstation-read-exclusion assertions.


### Maintenance input-validation source-contract test alignment — 2026-11-23 (PR #251; CI pending)

- CI #3328 passed the maintenance authorization live HTTP matrix (19/19), dynamic-scope consistency, and vendor reference checks. It then failed the maintenance input-validation source test because it still expected the old primary-role allowlist on POST.
- Updated `scripts/maintenance-input-validation-verify.mjs` in commit 7999ddabf7803edb40808d54a88ec061331daf15 to assert the new capability-aware Superadmin/IT/GA allowlist on both POST and PATCH while retaining the validation-before-mutation assertions.


### Merge readiness and final target-base validation — 2026-11-23

- Exact-head CI #3331 on commit `c2b1289db92f5c5ce1ead31800d248ab7650fe90` completed successfully: 116/116 steps green, including the full production, Docker, PostgreSQL, security, RBAC, organization, Meeting Room, ticket, loan, and Maintenance suites.
- PR #251 was retargeted from the stacked PR #249 branch directly to `main`, its description was consolidated to cover the complete stack, and it was marked ready for review. PR #249 is now superseded but remains open until PR #251 merges successfully.
- A new exact-head CI run against the final `main` base is mandatory. Merge only after that run is green, the PR remains mergeable, and no required check/review gate is outstanding.


### Loan list owner-scope secondary-role fallback — 2026-11-23 (follow-up PR; CI pending)

- Post-merge audit of the live `main` branch found one remaining file-store compatibility check in `GET /api/loans`: borrower visibility was combined with owner custody using `actor.role === loan.owner_division`. This hid division-owned loans from canonical Karyawan accounts whose IT/GA operational role exists only in `role_keys`, even though `GabahDomainService.canOperateLoan()` already honored those secondary roles.
- Fix commit 2dc420d1b5a6d00c5b0907aa23cbc5e23912fa36 changes only the file-store fallback to `hasApplicationRole()` using a normalized owner-division key. PostgreSQL continues to use the explicit Loans division scope; borrower visibility and server-authoritative allowed actions are unchanged.
- Commit 277f8c801e653db9107fa1b7110e9d6316089e1e adds a regression guard to the existing loan authorization verification script.
- Follow-up PR targets `main`; do not merge until the complete CI workflow is green.


### Ticket and vendor owner-scope fallback audit — 2026-11-23 (PR #252; CI pending)

- Broader primary-role-only scan on `main` found additional file-store checks that bypassed the already-normalized `role_keys`: ticket assignment eligibility, ticket record/comment/status scope, and vendor create/update owner checks.
- Commit 94803bc9649e14028cc370f10b1022723469b484 updates ticket owner checks to honor `hasApplicationRole()` for the ticket category while preserving legacy primary-label matching; vendor create/update now also recognize normalized owner capabilities. PostgreSQL permission and division/unit scope checks are unchanged.
- Commits 9958c3cab01f8a8c3a77db53176a263ff6366a44 and dc22706abb31e9b6956e3073c8261d00c1f74bb4 add regression guards for ticket assignment, ticket record/comment/status access, and the existing Dynamic RBAC vendor endpoint contract checks.
- CI must pass at the final PR head before merge.


### Bulk user import primary-role validation alignment — 2026-11-23 (follow-up PR; CI pending)

- Post-merge UI audit found the user-import preview allowlist accepted IT, GA, Auditor, Humas, and Sekretaris Direksi as if they were valid primary profiles, while the authoritative bulk-import API correctly rejects functional capabilities as primary roles. This produced rows that appeared valid in preview but were rejected only after upload.
- Commit 8ea50bda3743f24ca8c47c3f0558763788e544ff aligns the Administration UI allowlist with the server contract: Admin GABAH, Karyawan, Superadmin compatibility alias, and legacy Supply Chain/SC/PIBC location aliases. Operational capabilities remain assigned separately through Dynamic RBAC.
- Commit 29aec427bf16f3f56732ebeacc614b68d5b093d0 extends parser regression coverage for accepted legacy aliases and rejection of function roles, and verifies the UI allowlist cannot drift back.
- CI must pass at the exact PR head before merge.


### PIBC ME ticket file-store capability fallback — 2026-11-23 (follow-up PR; CI pending)

- Post-merge audit of the dedicated ME ticket workflow found the PostgreSQL path correctly enforces `tickets.create.me`, `tickets.queue.me`, and `UNIT-PIBC-ME`, but the development file-store path has no effective-permission resolver. The generic permission guard therefore did not enforce the ME requester grant in that mode, and `hasApplicationRole(..., 'me')` did not recognize the canonical `admin_tiket_me` role key.
- Fix commits f0521148b02ed3df6f400cd7da8372ae0be208e4 and f51239a16dc26cc073d5d2d08065248b5c543f01 add a file-store-only alias from ME queue operations to `admin_tiket_me` and explicitly require `pemohon_tiket_me` (or Superadmin) before creating ME tickets. PostgreSQL remains governed by explicit permissions and unit scopes.
- Commit 1229ae3425a155837866039c115f8f9692b56a5f adds regression checks for both fallback paths. Exact-head CI is required before merge.
- Follow-up commit 35616260fbdcb8873a26e61d0f51a449c1c7359c also brings the file-store Attention Center into line: `admin_tiket_me` can see ME-linked attention items only when the ticket is assigned to `UNIT-PIBC-ME`. Regression guard added in `scripts/pibc-me-ticket-queue-verify.mjs`; PostgreSQL continues to use explicit unit scope.
- Notification recipient filtering now applies the same narrow file-store fallback for `recipient_unit_id = UNIT-PIBC-ME`; other unit notifications remain hidden outside PostgreSQL Dynamic RBAC. The ME queue regression script guards this path as well.
- Commit 51a2ef35521a2dbc7974351aabbad47a39f87f2e updates the primary-role policy regression to verify the explicit ME role alias rather than the former one-line resolver shape.


### Loan approval separation-of-duties audit — 2026-11-25
- Review confirmed owner-domain approval checks were already enforced through `canOperateLoan()` in PostgreSQL mode; Auditor is denied and Superadmin is global.
- Found no explicit self-approval denial after owner authorization. Added a service-layer rule: a borrower cannot approve their own loan unless acting as Superadmin. This protects against operational IT/GA users approving requests they created themselves.
- Added audit event `LOAN_APPROVAL_DENIED` and runtime regression coverage: self-approval returns 403 and leaves the request pending; Superadmin can still approve as the documented break-glass exception.
- File-store compatibility still uses legacy owner role keys as the authority signal; it does not have the PostgreSQL permission/scope policy cache. This remains a separate compatibility limitation to address without weakening production RBAC.
- Exact-head CI required before merge.
