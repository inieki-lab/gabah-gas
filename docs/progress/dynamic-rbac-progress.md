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
- **Integrasi PostgreSQL live untuk endpoint ini**: CI tidak menyediakan instance PostgreSQL (berlaku sejak Stage 5). Semua pemeriksaan yang mengatasi jural endpoint baru bersifat contract-statis; jalur PostgreSQL (INSERT/DELETE nyata, rollback saat error, refresh cache) belum dieksekusi nyata di pipeline. Secara arsitektur identik (pattern & helper) dengan RBAC admin endpoints yang sudah berjalan di produksi-env PG sejak Stage 5–8; tetap direkomendasikan uji integrasi PG sebelum produksi.
- Tes runtime case: allowed/denied akses, role custom yang berhasil ditetapkan, role nonaktif/tak dikenal ditolak, rollback kegagalan penyimpanan — semuanya berada dalam kategori di atas (design-test belum tersedia, bukan tes yang gagal).
- P1 verify script (`scripts/p1-features-verify.mjs` dll.) tidak berjalan di CI — kondisi pra-tahap ini, tidak diubah.

### Gap yang masih terbuka (tahap berikutnya)
1. Tes integrasi PostgreSQL di CI (prioritas; menguntungkan semua tahap lalu-lalu).
2. Endpoint baca assignment per user + UI AdministrationModal untuk mengelola assignment dari browser.
3. Keputusan produk terkait ketentuan desain di atas (backfill yang memulihkan assignment legacy) — perketat atau didokumentasikan ke operator.
4. Enforcement permission dinamis modul lain (loan/ticket/contract/maintenance) — sesuai batas tahap, masih statis (117 komparasi nama role terhitung pada audit tahap 11).
5. Uji multi-instance: cache policy `refreshRbacPolicy()` hanya Barang lokal; deployment multi-node dengan PostgreSQL berisiko cache policy yang tidak saling bisa ter-hitung (temuan audit tahap 11, belum ditangani).

### Commit
- Commit kode fitur + tes + docs (entri ini dibuat di commit yang sama): lihat `git log --oneline -- docs/progress/dynamic-rbac-progress.md` di `main` untuk hash aktual — file ini sengaja tidak mencantumkan hash yang diperkirakan karena hash baru diketahui setelah commit dibuat. Entri hash aktual akan ditulis di entri tahap berikutnya setelah push terverifikasi.
