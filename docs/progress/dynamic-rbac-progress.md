# Progres Dynamic RBAC — GABAH-GAS

Catatan progres permanen per tahap. Pemeriksa berikutnya dapat melanjutkan pekerjaan hanya dari file ini + `CHANGELOG.md`.

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
