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
