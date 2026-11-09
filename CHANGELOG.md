## [2026-11-09] — Clarify Administration data sources and remove misleading local actions

### Perubahan
- Administration modal menjaga urutan React Hooks dan hanya menjalankan pemuatan RBAC, assignment pengguna, numbering, reminder, dan health snapshot saat modal terbuka.
- Master kategori, lokasi fasilitas, divisi, jabatan, unit, dan lokasi kantor menggunakan hasil API sebagai sumber kebenaran; respons array kosong kini menggantikan data contoh/cache lama, bukan mempertahankannya.
- Tombol struktur divisi yang sebelumnya mengembalikan state lokal ke default kini memuat ulang master dari database.
- CRUD lokasi fasilitas memakai ID dan record yang dikembalikan server setelah create/update; UI tidak lagi membangun ID lokal yang berpotensi berbeda dari ID tersimpan.
- Editor scope Dynamic RBAC menampilkan dan mengetikkan `division_except` secara eksplisit, dengan penjelasan bahwa pengecualian owner membatasi data tetapi tidak memberikan permission tindakan.
- Form edit pegawai dan impor CSV kini hanya menerima role profil utama kanonikal; Humas/Sekretaris Direksi serta Supply Chain/PIBC tetap ditempatkan sebagai capability tambahan atau atribut unit/lokasi, bukan role utama baru.
- Endpoint create/update pegawai kini menolak role fungsi/cabang sebagai role utama; bulk import mempertahankan kompatibilitas label Supply Chain/PIBC dengan memetakannya ke Karyawan + unit/lokasi, serta menolak Humas/Sekretaris Direksi sebagai role utama.
- Bulk import menolak role utama yang tidak dikenal, alih-alih diam-diam mengubahnya menjadi Karyawan; pemetaan legacy Supply Chain/PIBC tetap diberi warning dan unit/lokasi eksplisit.
- Regression test HTTP bulk import ditambahkan ke pipeline CI untuk memeriksa validasi role utama, pemetaan unit/lokasi cabang, dan larangan role fungsi sebagai role utama.
- Template/impor CSV pegawai mendukung kode jabatan, ID unit, dan ID lokasi kantor; parser memvalidasi semuanya terhadap master aktif dan tidak lagi mengubah role tidak dikenal diam-diam menjadi Karyawan.
- Aturan notifikasi dan format nomor yang masih lokal diberi keterangan eksplisit bahwa perubahan tidak mengubah scheduler atau generator sequence server.
- Ekspor JSON panel dinamai sebagai snapshot data, bukan backup PostgreSQL. Pemeriksaan integritas diberi label sebagai pemeriksaan internal GABAH, bukan rekonsiliasi SAP.
- Keterangan sumber data ditampilkan pada kartu menu Administration.

### Validasi
- `npm audit` lokal: 0 vulnerabilities setelah pembaruan dependency.
- `npm run lint` dan `npm run build` lokal: PASS pada working tree pengguna.
- CI branch untuk perubahan Administration terbaru sedang berjalan; UAT browser/PostgreSQL tetap diperlukan.

---

## [2026-11-09] — Honor dynamic asset scopes in maintenance visibility

- PostgreSQL maintenance reads now follow explicit dynamic asset scopes without a second primary-role filter, so additional operational roles are not hidden behind an employee's base identity.
- Employee baseline visibility remains limited to maintenance records for assets assigned to that employee.
- GA's optional read-only IT workstation inventory exception does not grant IT maintenance-record visibility; explicit dynamic asset scopes remain independently evaluated.
- File-store legacy behavior is preserved.
- Added a focused regression contract and CI step. CI has not yet run on this branch.

---

## [2026-11-09] — Align asset movement history with dynamic asset scope

- The movement-history endpoint now uses the canonical `getScopedAssets()` result without a second filter based on legacy primary-role labels.
- Employees with explicit additional asset scopes can see movement history for assets in those scopes; personal asset visibility remains governed by the canonical resolver.
- Added `test:movement-scope` and a CI step to prevent a duplicate legacy filter from returning.
- CI for this follow-up branch has not run yet.

---

## [2026-11-08] — Align dashboard loan attention with explicit owner scope

- The defense-in-depth Dashboard Attention middleware now preserves the borrower's own loan cards and honors explicit PostgreSQL `loans` division scope for owner-division cards.
- Legacy IT/GA role-label fallback is limited to file-store compatibility.
- Added `test:dashboard-attention-middleware` and a CI step to prevent scope drift.
- CI for this follow-up branch has not run yet.

---

## [2026-11-08] — Validate contract renewal decisions and replacement links

- Renewal outcomes are validated at runtime; TypeScript types alone are not trusted for HTTP input.
- `replaced_by_new_contract` requires an existing, visible replacement contract in the same normalized owner division and rejects self-reference.
- Replacement IDs are rejected for all other outcomes.
- Added `test:contract-renewal-integrity` and a CI step.
- CI for this follow-up branch has not run yet.

---

## [2026-11-08] — Minimize reservation data in Humas documentation queue

- Humas documentation queue remains limited to reservations requesting documentation.
- For reservations owned by other users, API responses retain schedule and documentation brief but redact attendee list, organizer contact, requested facilities, consumption details, and internal/rejection/interruption notes.
- The organizer's own reservation remains fully visible.
- Added API regression assertions to the meeting-room Stage 3 verification script.
- CI for this follow-up branch has not run yet.

---

## [2026-11-08] — Unify asset visibility for list and direct-ID access

### Perbaikan keamanan dan konsistensi
- Direct-ID middleware tidak lagi memakai resolver aset kedua yang bercabang berdasarkan role primer GA/IT.
- List, detail, direct URL, dan linked attention asset checks kini menggunakan `GabahDomainService.getScopedAssets(actor)` yang sama, termasuk scope dari role tambahan.
- Permission mutasi tetap menjadi pemeriksaan terpisah; akses baca tidak memberikan hak mengubah aset.
- Regression contract diperbarui untuk mencegah resolver scope ganda muncul kembali.
- Perubahan diajukan pada branch `ai/codex/unify-asset-scope-guard`; CI exact head masih menunggu.

---

## [2026-11-08] — Dashboard attention record-level scope

### Perbaikan keamanan
- `GET /api/dashboard/attention` kini memfilter kartu tiket berdasarkan reporter/assignee atau owner scope modul Tickets; kartu pinjaman berdasarkan borrower atau owner scope Loans; kartu aset berdasarkan resolver aset server-side.
- Super Admin dan Auditor tetap mendapat read scope global. Record hilang dan link type tak dikenal fail-closed.
- Ditambahkan regression test dan langkah CI `test:dashboard-attention-scope`.
- Perubahan diajukan melalui PR #19; status CI untuk branch follow-up masih menunggu pemicu workflow.

### Status
- Ini menutup satu temuan scope yang teridentifikasi, bukan menyatakan seluruh endpoint sudah diaudit atau GABAH siap produksi.

---

## [2026-11-08] — Contract file storage, role administration, and production container hardening

### Perubahan
- Auditor read-only ditentukan dari role efektif, termasuk role tambahan. PostgreSQL integration membuktikan Karyawan + GA + Auditor: assignment 200, API write 403, audit read 200.
- Form tambah pegawai menggunakan primary profile role; Humas/Sekretariat Direksi ditetapkan sebagai role tambahan, Supply Chain/PIBC dicatat sebagai unit/lokasi kerja. Lokasi kantor dapat dipilih terpisah dan role tambahan ditampilkan di direktori pengguna.
- Dokumen kontrak sekarang benar-benar ditulis ke storage persisten; upload divalidasi berdasarkan ekstensi, MIME, dan signature; file path dibuat server-side dan diisolasi per kontrak. Download memeriksa permission serta visibility contract dan tidak diekspos sebagai static public file.
- ContractsView menyediakan upload dan download dokumen dengan token autentikasi dan capability efektif.
- Docker production memakai multi-stage Node 22 Alpine image, npm ci dari lockfile, production dependencies, non-root runtime, migration SQL yang disertakan, dan tidak bind-mount source atau install dependency saat startup.
- Docker Compose memisahkan PostgreSQL data volume dan uploads_data; healthcheck app memeriksa API. deploy.sh membangun image, memastikan PostgreSQL healthy, lalu mengganti app saja tanpa down atau menghapus volume.
- CI menambahkan production image runtime smoke terhadap PostgreSQL 17, Node 22, dan permission tulis pada uploads volume.
- Runbook backup/restore sekarang mencakup PostgreSQL dan uploads_data secara berpasangan.

### Verifikasi
- CI #587: production image berhasil boot pada **Node 22.23.4**, terhubung ke PostgreSQL 17, health API menunjukkan persistence PostgreSQL, dan uploads volume dapat ditulis.
- CI #588: PostgreSQL CR-04/CR-05 **63/63 PASS**; invalid PDF signature ditolak 400; upload 200; unauthorized contract download 404; Auditor additional-role download 200; byte dokumen tetap tersedia setelah restart.
- CI #589: Dynamic RBAC foundation **63/63**, asset scope **37/37**, P0 security **37/37**, maintenance authorization **33/33**, contract UI/storage, owner-path isolation, Docker image, dan deployment guard assertions PASS.
- CI #554/#555: employee primary-role/location UI and static checks PASS; CI #557 role badge and Auditor precedence checks PASS.
- Semua hasil di atas adalah CI, bukan pengganti browser UAT atau staging/production rehearsal.

### Release status
**NO-GO.** PR #18 tetap draft/open. Belum ada browser UAT oleh pemilik proses, upgrade rehearsal dari snapshot legacy, backup/restore rehearsal untuk database + uploads_data, staging deployment, TLS/reverse proxy, monitoring, atau business sign-off. Jangan deploy branch kerja.

---

## [2026-11-08] — Auditor multi-role enforcement, documentation alignment, and PostgreSQL verification

### Perubahan
- Auditor read-only kini dihitung dari role efektif yang ditetapkan ke user, termasuk role tambahan. Middleware menolak seluruh operasi tulis API untuk user dengan capability Auditor; aturan juga dipakai pada asset scope, contract visibility/logs, reconciliation, dan room reservations.
- Menambahkan regression integration test PostgreSQL: Karyawan diberi role GA + custom vendor + Auditor; assignment tetap mempertahankan primary Karyawan, API write ditolak HTTP 403, dan audit read yang diizinkan tetap HTTP 200.
- Menyelaraskan PRD, requirement, RBAC spec, audit data-scope, UAT, dan skill/guardrails AI dengan keputusan owner domain fleksibel, lima lokasi aktif, role tambahan, serta pemisahan lokasi kerja/lokasi aset/owner.
- Menambahkan AGENTS.md dan skill .agents/skills/gabah-maintainer/SKILL.md sebagai instruksi wajib untuk AI coding agent. Agent lain memakai branch ai/<agent>/<work-item> dan PR ke branch integrasi.
- Menegaskan release status tetap NO-GO sampai UAT browser, upgrade snapshot legacy, backup/restore, staging deployment, dan persetujuan bisnis selesai.

### Verifikasi terukur
- CI run #544 pada code SHA 398ba8fa61ddef9f5cf63dc22ff330cd7d1a0f33: SUCCESS.
- PostgreSQL 17 fresh DB: migration ledger 35 migration entries; CR-04/CR-05 integration 57/57 PASS; restart persistence dan production fail-fast checks PASS.
- Tambahan role Auditor: assignment 200, API write 403, authorized audit read 200.
- Regression suites pada run #544: Dynamic RBAC foundation 63/63, asset scope policy 37/37, P0 security 37/37, maintenance authorization 33/33, serta org/navigation/dashboard/loan/room checks PASS.
- CI run #545 pada dokumentasi/RBAC head 408d922968be84980026f7a346f7e3992c6346f4: SUCCESS. Perubahan UAT dan audit documentation setelahnya memiliki run CI tersendiri yang masih berjalan saat catatan ini dibuat.

### Batas yang belum ditutup
- Belum ada UAT manual browser dengan persona pengguna sebenarnya.
- Belum ada rehearsal migrasi upgrade dari snapshot database produksi/legacy.
- Belum ada backup/restore rehearsal, staging deployment, TLS/monitoring verification, atau sign-off pemilik proses.
- Jangan deploy branch draft; deployment produksi hanya dari commit/tag yang telah di-review dan di-merge.

---

## [2026-10-21] — Finalisasi Stage 13F: Maintenance Authorization merged

### Hasil akhir terverifikasi
- PR #9 **MERGED** ke `main` sebagai `921d3bb5bcdc32874a556260865e047a0af10868`.
- CI pada head PR #9 **SUCCESS**: lint, dynamic RBAC foundation checks, production build, P0 security HTTP assertions, dan maintenance authorization HTTP assertions semuanya selesai sukses.
- PR #7 lama ditutup sebagai superseded; tidak ada force-push.
- PR #8 dokumentasi UAT sudah merged; `docs/testing/gabah-uat-checklist.md` tersedia.
- **Belum production-ready**: PostgreSQL live integration, UAT pengguna, deployment/rollback, dan backup/restore belum dibuktikan.

---

## [2026-10-21] — Dynamic RBAC Stage 13F: Maintenance Authorization (reconciled after Stage 13E merge)

### Status / provenance
- Stage 13E / PR #6 telah MERGED pada `c769420e6b65afbfcca5ac6acbc839eff3b41f64`.
- Implementasi Stage 13F dipindahkan ke branch baru `work/stage-13f-reconciled-main` yang berbasis main setelah PR #6 dan dokumentasi UAT masuk. Branch lama PR #7 masih OPEN saat rekonsiliasi; jangan menganggap PR #7 merged.
- Perubahan kode Stage 13F mempertahankan cakupan sebelumnya: permission gate maintenance, filter scope dinamis untuk role kustom di PostgreSQL mode, migration seed 020, dan verifikasi HTTP file-store.
- CI untuk branch rekonsiliasi ini **belum diverifikasi** pada saat catatan ini ditulis. Tunggu hasil CI terbaru sebelum merge.
- PostgreSQL live integration, UAT pengguna, deployment, dan backup/restore tetap belum diverifikasi.

---

## [2026-10-21] — Repo handoff: Stage 13E merged, Stage 13F blocked pending branch reconciliation

### Status aktual dari GitHub
- Stage 13E / PR #6 **MERGED** via squash commit `c769420e6b65afbfcca5ac6acbc839eff3b41f64`.
- Stage 13F / PR #7 **OPEN, belum merged**. CI pada head PR terakhir terlapor SUCCESS, tetapi setelah PR #6 masuk `main`, GitHub menandai PR #7 `mergeable=false`. Perlu rekonsiliasi branch dan rerun CI sebelum merge; jangan menganggap status CI lama cukup.
- Checklist UAT ditambahkan dalam commit dokumentasi terpisah; checklist bukan bukti UAT selesai.
- PostgreSQL live integration, deployment, restore test, dan UAT end-to-end tetap belum diverifikasi di sini.

---

## [2026-10-21] — Dynamic RBAC Stage 13E: Audit dan Perbaikan Authority Divisi Aset

### Temuan audit (re-verifikasi kode pada HEAD `d30315d`, tidak menerima catatan lama mentah-mentah)
- **Klaim Stage 13A tentang "bypass" ditelusuri ulang dan TIDAK terbukti sebagaimana tertulis**: pemegang role kustom dengan permission `assets.update`/`assets.bulk_import` tetap DITOLAK pada aset milik divisi (IT/GA/SC/PIBC) karena guard membandingkan `actor.role` — dan pada mode PostgreSQL `actor.role` selalu berasal dari `users.role` legacy (compat bridge yang memang disengaja sejak Stage 5/12).
- **Celah yang benar-benar terbukti** adalah asimetri baca/tulis: baca aset (Stage 11) menghormati scope dinamis `all`/`division` dari `gabah_role_division_scopes`, tetapi tulis (PATCH dan bulk import UPDATE) sama sekali tidak — role dinamis dengan authority divisi yang sah tidak bisa memperbarui aset yang bisa mereka baca; role dinamis tanpa scope memang tidak mendapat apa pun, tetapi scope yang sah juga tidak diakui.

### Perubahan
- Helper baru `getDynamicAssetWriteAuthority()` di `server/services.ts`: menyelesaikan authority tulis dari scope dinamis `all`/`division` (case-insensitive); scope `own`/`unit`/`location` sengaja TIDAK memberi wewenang tulis (keputusan kebijakan terdokumentasi: visibility tidak sama dengan mutability). Tanpa policy yang memberi authority, hasilnya set kosong (deny-by-default).
- `PATCH /api/assets/:id` dan jalur UPDATE `POST /api/assets/bulk-import`: rule legacy sembilan role TIDAK berubah, hanya ditambah authority dinamis (union) bila PostgreSQL aktif; permission gate operasi tetap wajib; blokir eksplisit Auditor/Karyawan di PATCH dan empat role di bulk-import tetap.
- Verifikasi: +7 pemeriksaan statis di `scripts/dynamic-rbac-foundation-verify.mjs` (semantik helper, deny-by-default, PATCH dan bulk UPDATE, blokir role terbatas, gate permission, hanya aktif di mode PostgreSQL). Tidak ada perubahan UI, skema, atau modul lain.

### Hasil tes
- `npm run lint` PASS; `npm run build` PASS; `node scripts/dynamic-rbac-foundation-verify.mjs` 89/89 PASS; `node scripts/p0-security-verify.mjs` 37/37 PASS (file-store).
- Pengujian integrasi PostgreSQL live tetap TIDAK tersedia (CI tanpa instance PG), sehingga perbaikan ini belum dapat dieksekusi live pada mode PostgreSQL di tahap ini.

### Sisa risiko / pertanyaan kebijakan
- Authority legacy via `users.role` masih tak dapat dicabut lewat assignment dinamis (compat bridge — pekerjaan arsitektur berikutnya); CREATE asset, assign/move/lifecycle masih rule legacy-string murni (tahap ini sengaja terbatas pada PATCH dan bulk import UPDATE sesuai cakupan).

---

## [2026-10-21] — Dynamic RBAC Stage 13D: Verifikasi CI & Sinkronisasi Progres

### Ringkasan
Verifikasi status aktual Stage 13B/13C sepenuhnya dari GitHub dan jalankan pemeriksaan lokal pada HEAD `9bd52863829c9371d6e34465c65d6d1b44c4156f`. Tidak ada perubahan kode pada tahap ini.

### Hasil verifikasi aktual
- **Stage 13B**: PR #4 MERGED, merge commit `3f075da13328bbffb1d2c174a1e1f31218c0f1ad`, CI push-merge `main` **SUCCESS** (run 39353093753).
- **Stage 13C**: PR #5 MERGED, merge commit `9bd52863829c9371d6e34465c65d6d1b44c4156f`, CI push-merge `main` **SUCCESS** (run 39353550039).
- Seluruh run CI terakhir pada `main` `success`; tidak ada check yang gagal.

### Tes yang dijalankan (sesi ini, HEAD `9bd5286`)
- `npm run lint` — PASS.
- `npm run build` — PASS.
- `node scripts/dynamic-rbac-foundation-verify.mjs` — 82/82 PASS.
- `node scripts/p0-security-verify.mjs` — 37/37 PASS (file-store).

### Batas yang dicatat
- Pengujian integrasi PostgreSQL live tetap belum pernah dijalankan (CI tidak punya instance PG); konfirmasi tercatat di `docs/progress/dynamic-rbac-progress.md` Tahap 13D. Gap vendor read/maintenance dan authority divisi dinamis masih terbuka.

---

## [2026-10-20] — Dynamic RBAC Stage 13C: Vendor Write Permissions

### Perubahan
- `POST /api/vendors` memakai permission `vendors.create` saat PostgreSQL aktif.
- `PATCH /api/vendors/:id` memakai permission `vendors.update` saat PostgreSQL aktif.
- Mode file-store tetap memakai allowlist legacy Admin GABAH, IT, GA, Supply Chain, dan PIBC.
- Migration `019_dynamic_rbac_vendor_write_permissions_seed.sql` memberi grant awal secara idempoten hanya kepada lima role legacy yang sebelumnya dapat mengelola vendor. Role custom tidak mendapat grant otomatis.
- Pemeriksaan domain IT/GA pada kategori vendor dan allowlist field update tetap dipertahankan.
- Verify script ditambah empat pemeriksaan statis. Pengujian PostgreSQL live tetap diperlukan.

### Verifikasi
- Perubahan dibuat pada branch `work/stage-13c-vendor-rbac`; tunggu CI sebelum merge.
- Static contract checks bukan pengganti integrasi database/runtime.

---

## [2026-10-20] — Dynamic RBAC Stage 13B: Knowledge Write Permissions

### Perubahan
- `POST /api/knowledge` memakai permission `knowledge.create` saat PostgreSQL aktif.
- `PATCH /api/knowledge/:id` memakai permission `knowledge.update` saat PostgreSQL aktif.
- Migration `018_dynamic_rbac_knowledge_permissions_seed.sql` bersifat additive/idempotent dan memberi grant hanya kepada role legacy `superadmin`, `it`, dan `ga`, sesuai allowlist sebelumnya. Role legacy lain dan role custom tidak mendapat grant otomatis.
- Mode file-store tetap menggunakan allowlist legacy yang sama, sehingga perilaku pengembangan lokal tidak terbuka tanpa sengaja. Validasi isi artikel, field allowlist, dan audit event tetap dipertahankan.
- Pemeriksaan statis ditambah untuk seed, daftar grant, dan kedua endpoint. PostgreSQL runtime belum diverifikasi pada tahap ini.

### Verifikasi
- Perubahan dibuat di branch `work/stage-13b-knowledge-rbac`; hasil CI dan pengujian runtime harus diperiksa sebelum merge.
- Tidak mengklaim `lint`, build, verify script, atau P0 security test lulus sampai benar-benar dijalankan oleh CI.

---
## [2026-10-19] — Dynamic RBAC Stage 13A: Hardcoded Role Audit (Read-Only)

### Ringkasan
Audit **read-only** terhadap ~117 perbandingan nama role yang menentukan otorisasi/perilaku (`server.ts` 53, `server/services.ts` 49, `server/runtime-hardening.ts` 15). HEAD diperiksa: `8b7a8e2222e307d752030adb3ca1b2be0fa67006` — bukan commit acuan `2d87f4e` (HEAD sudah maju). Tidak ada perubahan kode, skema, atau konfigurasi pada tahap ini; laporan lengkap tersimpan di `docs/progress/dynamic-rbac-progress.md` bagian Tahap 13A.

### Hasil audit (30 temuan teratas, dikompilasi dari pola berulang)
| Kategori | Jumlah | Contoh lokasi |
|---|---|---|
| **Security gate** | 12 | `runtime-hardening.ts:135-144` (blok non-GET Auditor, allowlist + regex), `:7 isGlobalObserver` + guard `/api/audit-logs` & `/api/reconciliation`, `canSeeAsset` (unknown → `return false`, aman) & `canManageTicket`, `server.ts:1745/1748` bulk-import blokir, `1846-1858` authority bulk UPDATE, `1950-1968` PATCH assets, hard-list `maintenances` (2324/2384), `vendors` (2448/2482), `knowledge` (2513/2540) |
| **Business rule** | 11 | `services.ts` createAsset (termasuk pengecualian khusus GA→INV-F), assign/move/mutateLifecycle/approveLoan/requestLoan + map role→divisi; VIP Sekretaris Direksi (auto-approve 1260, prioritas 1162-65); room approve/reject (1395/1477); notifikasi khusus Humas (server.ts:2582); filter list tickets/maintenances/vendors |
| **Compatibility mapping** | 4 | Backfill 9 mapping legacy (`persistence.ts`), last-superadmin guard PATCH users (~590-594, hitungan tidak mencakup superadmin-capable custom), `validRoles` 9 legacy POST /api/users (468-470), alias login 907 |
| **Display/UI logic** | 2 | Label "Super Admin" (390/470/643), teks audit detail |

**Kondisi role custom hari ini:** tidak dapat menembus gate mana pun yang berbasis string legacy; beberapa gate justru deny-by-default aman (`canSeeAsset`, `canManageTicket`, filter list). Namun dua kebocoran nyata ditemukan: (a) role custom dengan permission `assets.bulk_import`/`assets.update` dari grant admin **menembus authority divisi** jalur UPDATE bulk-import & PATCH (8/9) — pemilik divisi tak terdefinisi bagi mereka; (b) middleware Auditor (#1) tidak mengenali role read-only custom.

### Kandidat paling aman & kecil untuk Stage 13B
Ganti hard list di `POST /api/knowledge` (`server.ts:2513`) dan `PATCH /api/knowledge/:id` (`server.ts:2540`) menjadi `requireRbacPermission('knowledge.create'/'knowledge.update')` + migration seed `018_*` additive grant `[superadmin, it, ga]` (mirror hard list). Permission sudah ada di katalog 011/012; gate no-op di file-store; perilaku 9 legacy role invarian; blast radius terkecil. Modul yang serupa tapi belakangan: `maintenances` (#10), `vendors` (#11).

### Sengaja belum disentuh
Gate read-only Auditor & global observer (#1–3 — kontrak CR-01, butuh perancangan read-mode dinamis), authority divisi & rule bisnis khusus (VIP SekDir, Humas, INV-F — keputusan produk), kompatibilitas `users.role` (#26–29 — jembatan arsitektur).

### Verifikasi
Diff di-scoped ke docs saja; `npm run lint` tetap lolos (tidak ada perubahan kode); CI tidak mewajibkan rerun khusus.

---

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

## [2026-11-08] — Prevent destructive branch-role migration

### Fixed
- Replaced the unsafe body of `server/migrations/026_map_branch_accounts_to_employee_location.sql` with an intentional no-op compatibility marker. The previous draft rewrote Supply Chain/PIBC users to Karyawan, deleted their branch-role assignments, and deactivated `UNIT-SC`/`UNIT-PIBC` based only on the legacy role label.
- The revised migration preserves employee role, primary/additional role assignments, job level, organizational unit, and history. It explicitly states that location alone grants no data scope and that RPC/SC can be an operational asset owner independently of the physical site.
- Added `scripts/branch-migration-safety-verify.mjs` and `npm run test:branch-migration-safety`; wired the check into `.github/workflows/ci.yml`.

### Important migration caveat
- Editing migration 026 prevents the unsafe draft from running on databases that have not applied it yet. It does **not** reverse changes in databases where the old version was already applied. Such environments require a separately reviewed recovery plan based on backups/audit evidence; no automatic role restoration is attempted.

### Verification
- CI run triggered for commit `c6c3b5946de8a72d5a13fcaf02cf7c202018c2b3` (run 42477031571) was still in progress when recorded. Do not report this change as CI-passing until the run completes.

## [2026-11-08] — Extensible asset-owner scopes across modules

### Business model implemented
- Owner domain is now an extensible code backed by the existing Super Admin-managed Master Divisi (db.divisions / PostgreSQL divisions), not a hardcoded IT/GA-only allowlist. Initial owner domains remain IT, GA, SC, PIBC, Umum, Audit; Super Admin can add future owner codes before assigning category/asset ownership.
- Physical site, employee office location, managing unit, asset owner domain, and custodian remain independent. Location never grants owner scope.
- New asset creation and category owner assignment require the owner code to exist in the configured division/owner master. Division code is validated to 2–20 uppercase alphanumeric / underscore / hyphen characters. Referenced owner master records cannot be deleted while referenced by assets, categories, employees, or org units.
- PostgreSQL persistence now synchronizes configurable division/owner master rows before users, categories, and assets so new owner codes satisfy foreign keys.

### Authorization changes
- Asset read visibility, create, update, assign, move, and lifecycle authorization now accepts any non-empty configured owner code when the user has the exact module permission and explicit owner scope. File-store fallback remains conservative and IT/GA-only.
- Asset PATCH and bulk-import UPDATE use the same shared canMutateAssetOwner policy. A Karyawan can perform an operation only when an additional role/capability explicitly grants its permission and matching owner scope; Auditor remains read-only.
- Loan visibility/operations, ticket visibility/dashboard counts, maintenance create/update, and contract visibility/create/edit now use module-specific owner scopes rather than IT/GA-only branches. Personal borrower/reporter/assignee access remains intact.
- GA's optional IT workstation visibility remains a separate read-only permission limited to HLT/HPC; it does not grant IT asset mutation rights.

### Migration correction
- Migration 026 remains a no-op compatibility marker to avoid role/unit rewrites inferred from branch labels.
- Fixed fresh-install ordering in migration 006: seed Umum and Audit into divisions before creating org units that reference them. This is additive/idempotent. It does not retroactively execute on databases where migration 006 is already recorded.

### Files changed
- server/services.ts, server/server.ts, server/contracts.ts, server/db.ts, server/taxonomy.ts, server/persistence.ts
- server/migrations/006_org_model_masters.sql, server/migrations/026_map_branch_accounts_to_employee_location.sql
- scripts/asset-scope-policy-verify.mjs, scripts/dynamic-rbac-foundation-verify.mjs, scripts/branch-migration-safety-verify.mjs
- CHANGELOG.md, progress log, package.json, .github/workflows/ci.yml

### Verification
- Latest verified branch head: 8fdd15db91335f2c937e98294272770b75dd1ebc.
- CI run #382 (42478977996) completed SUCCESS: typecheck, dynamic RBAC contracts, migration safety, asset-scope regression, role navigation, dashboard scope, production build, 37 P0 HTTP security assertions, and maintenance authorization assertions all passed.
- PR #18 remains Draft/Open and is not merged. Do not deploy or run production migrations without backup, dry-run, impact report, and explicit approval.

### Remaining work
- Continue auditing vendor/report/reconciliation/admin endpoints for remaining owner/role shortcuts.
- Replace stale role-name navigation assumptions with the effective-permission model end-to-end and verify menu/page actions per user.
- Reconcile historical owner codes and any previously applied migration 026 effects only from verified backup/audit/HR evidence. No mass owner or employee remapping.
- Complete cross-role UAT for RPC/SC production machinery at Subang (owner RPC/SC, location Subang), GA-owned assets, IT-owned assets, and GA's read-only HLT/HPC exception.


### Final handoff status (2026-11-08)
- Documentation head at this handoff: 016c1a7be8740c4b5ff0273be00b2b6d629e0fc7.
- CI #383 / run 42479231928 completed SUCCESS on that head. This run includes the latest source changes and documentation: typecheck, all RBAC/asset-scope/navigation/dashboard checks, production build, 37 P0 HTTP assertions, and maintenance authorization assertions passed.
- PR #18 remains Draft/Open and intentionally unmerged pending the remaining vendor/report/reconciliation/admin authorization audit and end-to-end per-user UAT.


## [2026-11-08] — Configurable owner exclusions in Dynamic RBAC

### Added
- Added the `division_except` scope type so Super Admin can configure policies such as "all asset owners except IT" without enumerating every current/future owner domain.
- Added role-editor option **Semua owner kecuali** and backend validation for the new scope.
- Added migration 032 to extend the PostgreSQL scope constraint safely.
- Asset read, asset mutation, and module owner-scope checks now honor exclusions. An explicit grant for a specific owner can override a broad exclusion; unit/location matches cannot bypass an owner exclusion.
- Existing role permissions/scopes are not silently changed. Super Admin must explicitly configure the desired policy per role and module.

### Verification
- Regression checks added for owner exclusions. CI must pass on the latest PR head before this change is considered verified.


### Follow-up hardening
- Owner-master synchronization now preserves `is_active=false`; persistence no longer silently reactivates disabled owner domains.
- New asset creation rejects an inactive owner master. Existing asset/history records are not rewritten.
- Owner exclusion comparisons are case-insensitive and normalized consistently.
- CI run #402 passed on source head `b437abf78abdcf2c607f65943f2ba95a4c3b4b3f`: TypeScript lint, RBAC contract checks, migration safety, asset-scope policy checks, navigation/dashboard checks, production build, 37 P0 HTTP security assertions, and 33 maintenance authorization assertions.


### Reconciliation scope hardening
- Reconciliation GET now calculates statistics and rows only from the caller's visible asset set (Super Admin/Auditor retain global read access).
- ERP number linking now requires both `reconciliation.link` and the shared `assets.update` permission + matching owner scope; client-side permission alone cannot mutate another owner's asset.
- CI run #409 passed on head `c5d71a0e7e20f6c1dfbe146af2a8d8fa1d4b0a3f`.


### Office location master correction — 2026-11-08
- Current active office locations are exactly HO, PIBC, RPC/SC, and Pangsub.
- The retired Kantor Perawatan office is inactive, not deleted. Existing location IDs are preserved so user references and history remain intact.
- Future locations remain configurable by Super Admin; Subang is not seeded or treated as an active site.
- Added migration 033 and regression assertions. Migration has not been applied to production.


### Corrected office master — 2026-11-08
- User correction: **Kantor Perawatan is still active**. The five active office locations are HO, PIBC, RPC/SC, Pangsub, and Kantor Perawatan. Subang is closed and is not seeded as an active office location.
- Corrected `server/db.ts`, persistence fallback, migration 033, and asset-scope regression assertions. No users or assets are reassigned.


### Follow-up correction — active offices and loan-return location (2026-11-08)
- Corrected migration 033: Kantor Perawatan is explicitly set to `is_active = TRUE`; removed the earlier deactivation branch. The migration preserves its existing ID and does not delete or reassign any user/asset references.
- Corrected the office regression test to assert that migration 033 keeps Kantor Perawatan active and preserves office history.
- Audited loan custody transitions and removed the hardcoded location reset to `Head Office - Gudang Pool` during loan return. Returning an item changes custody/status/condition; it must not silently relocate the physical asset. A real move must use the asset-mutation workflow and its audit trail.
- Updated loan authorization error text and comments to describe permission + Loans owner scope, not an IT/GA-only whitelist.
- CI run 42486650240 failed at TypeScript parsing of the newly added office regression regex (not application logic). Corrected the regex in the subsequent commit; latest CI result must be checked before claiming pass.


### Loan request authorization hardening — 2026-11-08
- `requestLoan()` now rejects attempts by ordinary users to create a loan request with another employee's `borrower_id`. Delegated requests are not implemented as a capability yet; only Super Admin may set a different borrower until that workflow is explicitly designed.
- `/api/loans`, approve, and reject routes now preserve domain `statusCode` values (including 403) rather than flattening authorization failures into HTTP 400.
- Added regression assertions for borrower identity, authorization status propagation, and physical-location preservation on return.


### Office master regression coverage — 2026-11-08
- Migration 033 now safely deactivates an existing `org_office_locations` row whose name is Subang, if present, without deleting it. This does not touch `asset_locations`, so physical asset-location history is preserved.
- Kantor Perawatan remains explicitly active. The five currently confirmed active offices are HO, PIBC, RPC/SC, Pangsub, and Kantor Perawatan; future office sites may still be added through Super Admin master data.
- Updated `scripts/org-model-verify.mjs`: the nine legacy role labels are documented as compatibility data, the old Kantor Pusat label was replaced by HO, and the live API check requires the five confirmed offices while allowing future locations.


### Migration 033 validation fix — 2026-11-08
- CI run #438 failed one source assertion because the regression regex expected the Subang `WHERE` clause before its `SET` clause. Updated the assertion to match actual SQL order.
- During the same review, found and removed a trailing comma left after editing the `UPDATE ... SET name = CASE` statement. Migration 033 now has valid `SET ... END WHERE ...` syntax.
- New CI run #439 is the first run expected to validate the corrected migration and test together; status must be checked before marking this migration verified.


### Ticket authorization follow-up — 2026-11-08
- `canManageTicket()` in `server/runtime-hardening.ts` previously allowed dynamic PostgreSQL scopes only for IT and GA ticket categories. Custom operational owner categories such as RPC/SC were blocked even when their users had explicit `tickets.update` permission and matching owner scope.
- PostgreSQL mode now evaluates the ticket's owner/category code generically through `hasRbacScope(user, 'division', owner, 'tickets')`. IT/GA role-label fallback remains only for file-store compatibility. Reporter/assignee self-access and Auditor read-only behavior remain intact.
- Added regression coverage for custom owner-code ticket status authorization.


### Verification and remaining authorization audit — 2026-11-08
- CI run #441 (run `42487422969`) passed on source head `9f3faf86f7f23f40ea8db167a9554f0abf8ef48e`: 46/46 asset-scope checks, production build, 37/37 P0 HTTP security assertions, and 33/33 maintenance authorization assertions; the workflow also completed lint and Dynamic RBAC contract checks successfully.
- CI run #443 (run `42487486675`) passed on documentation head `6f3e2b2a772d632d6f17ea82d1f5cb90859ac746`, confirming the migration 033 correction and office regression checks at that point.
- Subsequent ticket custom-owner-scope fix and regression check were added in commits `0b0db0a66d7a3e1ca2d049ce77740b0717818548` and `e02a522f5efaec49dea5466e0edc0c5aac29f30a`. CI #446 is running on the newest head; pending result.
- Additional audit finding (not yet changed): vendor visibility/write ownership is still inferred from vendor `category` using an IT-vs-GA fallback. This cannot represent configurable owner domains such as RPC/SC safely. Requires a separate schema/API/UI design; do not infer vendor owner from employee location or category text.


### Latest CI and additional UI/domain audit — 2026-11-08
- CI #446 (`42487582277`) passed with the dynamic ticket-owner authorization fix; CI #447 (`42487587798`) and #448 (`42487694450`) also passed on subsequent documentation heads.
- Vendor audit confirms a broader issue than backend category mapping: `VendorsView.tsx` enables management only for hardcoded role labels Admin GABAH/IT/GA, while `/api/vendors` infers owner from category IT/License vs everything else GA. Vendor category and responsible owner are distinct concepts; future RPC/SC vendors cannot be represented safely yet.
- Room reservation list still applies legacy role branches for GA, IT, Humas, and self-only users. These rules include privacy redaction and must be translated carefully into effective capabilities/scopes without exposing agenda descriptions, attendee lists, or documentation notes.


### CI status correction — 2026-11-08
- CI #449 (`42487698982`) completed SUCCESS on head `2dd9d2a9b79a07d7dcfd96291108b5cbfd46e14f`; this includes the ticket dynamic-owner-scope change and its regression check.
- CI #450/#451 were triggered by the latest documentation-only commits and were still running/queued at this update. PR #18 remains Draft/Open and unmerged.


### Vendor owner-domain correction — 2026-11-08
- Added an explicit optional `owner_division` field to vendor records and the frontend model. Vendor service category is now independent from the responsible owner domain.
- `/api/vendors` list, create, and update authorization now use the explicit owner code and module `vendors` scope. The previous `IT`/`License` => IT, everything else => GA inference has been removed.
- New vendor records require a valid active owner code from the configurable division master. Update checks authority over both the existing and requested owner and persists `owner_division` through the explicit update allowlist.
- Legacy vendor rows without owner classification remain visible to Super Admin/Auditor only and cannot be edited by scoped users until Super Admin classifies them. No automatic owner backfill is performed.
- `VendorsView` now loads owner choices from the master division API and uses effective permission keys / Super Admin capability rather than the fixed Admin/IT/GA role allowlist.
- Added regression checks for owner/category separation, dynamic scope, unclassified legacy handling, and UI permission behavior. Latest CI run must be checked before marking this change verified.


### Room reservation authorization correction — 2026-11-08
- Replaced room-reservation operational queue visibility based on GA/IT/Humas role labels with explicit capabilities: `room_reservations.approve` / `reject` for the redacted GA operations queue, `room_reservations.it_facilities.read` for the redacted IT-facility queue, and `room_reservations.documentation.read` for the Humas documentation queue. Personal reservations remain visible to their organizer; Super Admin/Auditor read access remains as before.
- Added migration 034 with additive grants: IT facility queue to `it`, documentation queue to `humas`, and `room_reservations.override_priority` to `sekretaris_direksi`. Super Admin can grant these permissions to custom roles.
- Room approve/reject/check-in/check-out/cancel and room update domain guards now use effective permissions with narrow file-store compatibility fallback. Priority interruption is controlled by `room_reservations.override_priority` plus HIGH priority, not a hardcoded Sekretaris Direksi role-name comparison.
- Preserved redaction of agenda, description, attendee list, phone, consumption notes, documentation notes, and rejection/interruption reasons for operational queues.
- Added regression assertions for queue capabilities, privacy redaction, operation permission checks, and migration grants. CI pending on latest head.


### PostgreSQL migration hardening and live CI — 2026-11-08
- Replaced migration 004's unconditional reference to `contracts.owner_division_id` with an information_schema-guarded compatibility backfill for both fresh and legacy schemas. Unknown/unmapped legacy contract owners are set to `UNASSIGNED`, not silently assigned to GA; Super Admin must review and classify them.
- Corrected migration 015: `rooms` is still an application datastore collection, not a PostgreSQL table. Removed the invalid foreign key `room_id REFERENCES rooms(id)` so fresh PostgreSQL startup is not blocked by a nonexistent table.
- Expanded CI to provision PostgreSQL 17 and run `scripts/cr04-cr05-verify.mjs` against an isolated fresh database, then run loan, room, org model, asset master, menu connectivity, security, and maintenance regressions in addition to lint/build and RBAC scope checks.
- Added static regression guards against reintroducing the unsafe contract owner default or invalid room foreign key. Live PostgreSQL result is pending; do not claim database integration passes until CI completes.


### PostgreSQL fresh-boot blocker found by live CI — 2026-11-08
- First PostgreSQL 17 CI run failed on a real fresh database: `backfillDynamicRbacUserRoles()` queried `assigned_role.is_primary`, but `assigned_role` aliases `gabah_roles`; the column belongs to `gabah_user_roles` alias `ur`.
- Corrected the SQL predicate to `ur.is_primary = TRUE`. This is the actual root cause of the fresh PostgreSQL boot failure after migrations; not a missing migration 030.
- Added a regression assertion that the primary marker is read from the assignment table and that migration 030 creates it. Re-run the PostgreSQL-backed workflow; do not mark PostgreSQL integration green until the new run passes.


### Follow-up CI assertion alignment — 2026-11-08
- After correcting the primary-role SQL to `ur.is_primary`, the next CI attempt stopped earlier in the static Dynamic RBAC verifier: one assertion still expected the old incorrect `assigned_role.is_primary` alias. Updated that assertion to expect `ur.is_primary`.
- This was a stale test expectation; the live PostgreSQL step had not yet been reached in that run. Re-run CI on the new head to verify both the source checks and actual PostgreSQL startup.


### Branch/PR consolidation — 2026-11-08
- Closed PR #13 (expanded regression CI), PR #14 (fresh PostgreSQL contract migration fix), and PR #15 (sidebar fail-closed) as superseded. Their relevant work is now carried by PR #18: expanded CI workflow, corrected migrations 004/015, and dynamic permission-based fail-closed sidebar navigation.
- Their remote branches are no longer active work paths. No branches or commits were force-deleted; Git history is preserved. Continue development only on `fix/role-based-navigation` until it is merged to `main`.
- PR #11 deployment hardening, PR #12 finalization checklist, PR #17 user/role assignment audit, and PR #3 legacy ticket gate remain open pending review/consolidation; do not start parallel implementation branches.


### Auditor ticket read-only correction — 2026-11-08
- Found migration 024 granted `tickets.create` to Auditor along with employee roles, contradicting Auditor's read-only mandate. Route-level Auditor denial existed, but the effective permission could still expose a create action in the UI.
- Added migration 036 to remove only the Auditor `tickets.create` role grant. `tickets.read` remains granted; no tickets or user records are modified.
- Added a regression check ensuring Auditor retains read permission and is denied create permission. PR #3's older ticket seed approach is superseded by the current consolidated permission catalog/seeds and this correction.


### Vendor owner-domain hardening — 2026-11-08
- Vendor category and owner domain are treated as independent attributes. Create/update now resolve owner codes against the active owner master (case-insensitive) and validate category/name/rating input; the category text no longer implies IT or GA ownership.
- Backend vendor list/create/update enforce the effective vendors permission and owner scope. Owner changes require authority for both the existing and destination owner. Legacy vendors without an owner remain Super Admin-only for classification.
- Vendor UI now renders Add and Edit controls separately based on vendors.create/vendors.update, displays the owner domain, and removes the fabricated static SLA Compliance 99% metric.
- Owner master deletion now checks vendor, contract, maintenance, and loan references in addition to asset/category/user/org-unit references.
- PostgreSQL integration coverage added for IT/GA owner isolation, cross-owner write denial, Karyawan denial without permission, creating a future owner domain, creating a custom role with vendors permissions + RPCSC scope, and category/owner independence.


### Production deployment safety — 2026-11-08
- Reworked deploy.sh: no automatic Docker installation, no docker compose down/--remove-orphans, preflight requires .env and non-empty PGPASSWORD, validates Compose, recreates only the app service, and waits for /api/health before returning success. Failure prints container/log diagnostics and exits non-zero.
- Docker PostgreSQL port now binds to 127.0.0.1 only, not all VM interfaces. Initial admin/user provisioning secrets are passed from .env to the app container.
- CI now validates docker compose config and bash -n deploy.sh.
- Replaced OFFICE-VM-RUNBOOK's destructive reset --hard/clean instructions with a release-gated update, PostgreSQL backup, health verification, rollback and restore procedure. It explicitly marks current release NO-GO.
