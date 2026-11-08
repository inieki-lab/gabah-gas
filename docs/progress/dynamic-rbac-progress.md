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
