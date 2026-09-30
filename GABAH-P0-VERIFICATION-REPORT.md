# GABAH-P0-VERIFICATION-REPORT.md

**Repository:** `inieki-lab/gabah-gas` — GABAH (General Asset, Business & Automated Helpdesk)
**Tanggal verifikasi:** 30 September 2026
**Basis pembanding:** `GABAH-P0-SECURITY-HARDENING-REPORT.md` (laporan P0) vs **source code aktual** vs **kondisi Git aktual**
**Baseline HEAD:** `610c89922eda3ad29a7e62aeb47a9117a0357474`
**Sifat pekerjaan:** AUDIT ONLY — tanpa perubahan source, tanpa commit, tanpa push, tanpa rewrite history, tanpa migration, tanpa hapus file, tanpa memperbaiki apa pun. Tidak ada secret/token/password aktual yang ditampilkan dalam laporan ini.

---

# 1. Executive Summary

# **P0 VERIFIED IN LOCAL WORKSPACE**

Seluruh empat temuan P0 (CR-01, CR-02, CR-03, CR-06) **benar-benar ada di source code lokal** — diverifikasi langsung ke file, bukan hanya percaya isi report P0. Test live HTTP dijalankan ulang pada run fresh: **37/37 PASS**, lint 0 error, build sukses.

**Catatan penting (bukan penurunan gate):** seluruh perubahan P0 masih berupa **uncommitted working-tree changes**. HEAD lokal = `origin/main` = `610c899`. **Tidak ada satu pun perubahan P0 yang committed atau pushed.** Risiko kehilangan pekerjaan ada sampai perubahan di-commit (di luar scope tahap ini — instruksi eksplisit melarang commit). Detail di §2 dan §7.

---

# 2. Git Status

| Item | Nilai |
|---|---|
| Branch | `main` |
| HEAD | `610c89922eda3ad29a7e62aeb47a9117a0357474` |
| `origin/main` (setelah `git fetch`) | `610c89922eda3ad29a7e62aeb47a9117a0357474` |
| Local vs origin/main | **IDENTIK** (ahead 0 / behind 0) |
| Working tree | **DIRTY** |
| 5 commit terakhir | `610c899` (contract domain), `14b8041`, `a2c4b83`, `de83074`, `747e13f` — tidak ada commit baru sejak baseline |

**Status perubahan P0:**
- **Committed?** TIDAK — seluruh perubahan P0 adalah uncommitted changes (staged + unstaged + untracked).
- **Pushed?** TIDAK — `git log origin/main..HEAD` kosong; HEAD = origin/main.

**Rincian working tree (`git status --short`):**
- Modified (19 file): `.gitignore`, `AUDIT_NOTES.md`, `docs/architecture/RBAC.md`, `docs/testing/UAT.md`, `scripts/reset-temporary-users.mjs`, `scripts/test-core-modules.ts`, `server.ts`, `server/auth.ts`, `server/contracts.ts`, `server/db.ts`, `server/persistence.ts`, `server/runtime-hardening.ts`, `server/services.ts`, `src/App.tsx`, `src/components/auth/LoginPage.tsx`, `src/components/landing/LandingPage.tsx`, `src/components/modals/AdministrationModal.tsx`, `src/data/mockData.ts`, `src/types.ts`
- Staged deletion: `D  server/data/gabah_state.json` (untrack dari index — file tetap ada di disk, kini gitignored)
- Untracked (3 file): `GABAH-AUDIT-REPORT.md`, `GABAH-P0-SECURITY-HARDENING-REPORT.md`, `scripts/p0-security-verify.mjs`
- `git diff --stat` (unstaged): 19 file changed, **516 insertions(+), 379 deletions(−)**

**State file runtime:**
- `git ls-files server/data` → **0 file** (tidak ada yang ter-track)
- `git check-ignore -v server/data/gabah_state.json` → ter-ignore oleh `.gitignore:13: server/data/`
- `.gitignore` memuat blok CR-03: `server/data/`, `server/data/gabah_state.json`, `server/data/gabah_state.json.tmp`, `server/data/initial_credentials_dev.txt`, `*.session`, `*.token`
- File `server/data/gabah_state.json` di disk masih berisi data lama (89 sesi legacy + field `initialPassword` × 3) — sesuai aturan audit, file TIDAK dihapus; kini untracked + ignored dan tidak pernah di-hydrate (lihat §5).

---

# 3. CR-01 — Public Switch-Role Authentication Bypass

## **PASS**

Verifikasi langsung ke source aktual (`server/runtime-hardening.ts`, `server.ts`, `src/App.tsx`):

| Klaim report | Bukti aktual di source | Status |
|---|---|---|
| Endpoint tidak public | `PUBLIC_API_PATHS = ['/api/health', '/api/auth/login']` — switch-role TIDAK ada di daftar | ✅ |
| Anonymous → 401 | Handler: `getActor(req)` gagal → `return res.status(401)` — komentar eksplisit "never fall back to db.users[0]" | ✅ |
| `x-user-id` tidak dipercaya | `authenticateRequest`: header `x-user-id` tanpa token → `spoofAttempt` → middleware 403; mismatch dgn sesi → 403 | ✅ |
| Non-Admin → 403 | `actor.role !== 'Admin GABAH'` → 403 + audit `AUTH_SWITCH_ROLE_DENIED` | ✅ |
| Hanya Admin GABAH bisa switch | Gate tunggal di handler; target HANYA dari `db.users` riil (byId/email/name/role), `is_active=false` → 403, target tak ada → 404; mekanisme persona virtual `SIM-*` dihapus dari server | ✅ |
| Tidak ada fallback `db.users[0]` | Grep `db.users[0]`/`CANONICAL_USERS[0]` di source → 0 hasil kode (hanya komentar penjelas) | ✅ |
| Client tidak bisa menentukan role bebas | `src/App.tsx`: `setCurrentUser` HANYA setelah server konfirmasi & kirim token baru; penolakan → toast warning, tanpa fallback lokal | ✅ |
| Session di-rotate | `destroySession(currentSession.token)` lalu `createSession(targetUser.id, …, originalAdminId)` | ✅ |
| Audit log | `AUTH_SWITCH_ROLE_DENIED` (ditolak) dan `AUTH_SWITCH_ROLE` (sukses) tercatat via `recordAudit` | ✅ |
| Auditor tidak bisa keluar read-only via switch | `allowedAuditorActions = ['/api/auth/logout', '/api/notifications/read-all']` — switch-role dihapus | ✅ |

**Bukti live (run ulang hari ini, semua PASS):** anon 401; spoof `x-user-id` 403; token acak invalid 401; Karyawan→USR-01 403; Karyawan minta role Admin 403; Admin→USR-04 200; token lama admin → 401 setelah rotasi; token rotasi terverifikasi sebagai USR-04.

---

# 4. CR-02 — Hardcoded Credentials / 1-Click Login

## **PASS** (dengan 3 temuan residu non-aktif — lihat tabel temuan)

Verifikasi grep menyeluruh (`VALID_ROLE_PASSWORDS`, `initialPassword`, `defaultPasswordForRole`, `1-click login`, `one-click login`, `auto-login`, `temp_password`, `password=`, `password:`) pada `server/`, `src/`, `scripts/`, `docs/`, `*.md`, `.env*`:

- `VALID_ROLE_PASSWORDS` → **0 hasil** di seluruh kode. Handler login (`server.ts`) memverifikasi **hanya** PBKDF2 (`verifyPassword`, `server/crypto.ts`: PBKDF2-SHA512 100k iterasi + `timingSafeEqual`). Satu-satunya jalur alternatif adalah konsumsi `temp_password` legacy: di-hash, langsung di-`delete`, **tidak pernah** dikembalikan ke klien.
- `server/db.ts`: `CANONICAL_USERS` bertipe `Omit<ServerUser,'password_hash'|'password_salt'|'temp_password'>` — tanpa `initialPassword`; `seedInitialData` memetakan user tanpa material password + `authVersion: 1`.
- Provisioning (`server/persistence.ts` → `provisionCanonicalUserPasswords()`, dipanggil di ketiga jalur boot): env `GABAH_INITIAL_ADMIN_PASSWORD` / `GABAH_INITIAL_USER_PASSWORD`; tanpa env (dev only) → CSPRNG per akun (`crypto.randomBytes(18).toString('base64url')`), ditulis **sekali** ke `server/data/initial_credentials_dev.txt` (permission `0600`, terverifikasi `rw-------`, gitignored, terverifikasi tidak ter-track). Tidak pernah menimpa hash yang sudah ada.
- `src/components/auth/LoginPage.tsx`: tanpa `defaultPasswordForRole`, tanpa 1-Click Login (hanya komentar changelog "REMOVED").
- `src/components/landing/LandingPage.tsx`: display password kini literal `********` (tanpa nilai).
- `src/App.tsx initAuth()`: tanpa auto-login — tanpa token valid = tetap signed out.
- `src/data/mockData.ts` & `src/types.ts`: `temp_password` dihapus dari data & model klien.
- `scripts/reset-temporary-users.mjs`: tanpa fallback password literal (exit error tanpa env). `scripts/test-core-modules.ts`: kredensial dari env `GABAH_TEST_ADMIN_PASSWORD` / `GABAH_TEST_USER_PASSWORD`.
- Docs: `AUDIT_NOTES.md`, `docs/architecture/RBAC.md`, `docs/testing/UAT.md` — semua ter-redact dengan placeholder `<INITIAL_ADMIN_PASSWORD>` / `<INITIAL_USER_PASSWORD>` (terverifikasi ada).
- `.env.example`: `DATABASE_URL`/`PGPASSWORD` kosong — tidak ada secret.
- **Live:** login PBKDF2 → 200 + token; response login & `POST /api/users` terverifikasi tanpa `temp_password`.

### Daftar temuan (tanpa nilai)

| File | Jenis temuan | Status |
|---|---|---|
| `server/data/gabah_state.json` (runtime, untracked+ignored) | Field `initialPassword` legacy ×3 (nilai plaintext lama dari snapshot lama) | **TIDAK AKTIF** — tidak dibaca kode mana pun (`provisionCanonicalUserPasswords` tidak pernah memakainya); file tidak boleh dihapus per aturan audit; nilai dianggap COMPROMISED, wajib rotasi |
| `GABAH-P0-SECURITY-HARDENING-REPORT.md` | Menyebut literal `'AdminBumd#2026'` dalam kalimat changelog "fallback yang dihapus" | **TIDAK AKTIF** — referensi historis pada dokumen, nilai lama dianggap COMPROMISED |
| `GABAH-AUDIT-REPORT.md` (untracked, fase 1) | Dokumen audit historis yang memuat rujukan kredensial lama sebagai bukti temuan | **TIDAK AKTIF** — artefak audit, untracked; nilai dianggap COMPROMISED |

**Provisioning & kebocoran:** `GABAH_INITIAL_ADMIN_PASSWORD` / `GABAH_INITIAL_USER_PASSWORD` tidak muncul sebagai literal di Git (hanya nama env var); tidak dikirim di response API (diverifikasi live); tidak dicetak ke log (log hanya menyebut nama file dev, bukan nilainya); file dev credentials tidak masuk Git (gitignored + permission 0600); docs hanya memuat nama env var.

---

# 5. CR-03 — Session/Token, Persistence & Revocation

## **PASS**

### Session creation (source aktual)
- `server/crypto.ts generateToken()` = `crypto.randomBytes(32).toString('hex')` → **256-bit CSPRNG**, unpredictable. ✅
- `createSession()` (server/auth.ts) melampirkan `auth_epoch: getSecurityEpoch()` dan `user_auth_version` (authVersion owner saat penerbitan). ✅
- Token tidak disimpan di Git — `createPayload()` meng-emit `sessions: []`; file state untracked + gitignored (§2). ✅
- Token tidak dipulihkan dari `gabah_state.json` — `loadStateFromFile()` meng-`delete state.sessions` **sebelum** hydrate; `hydrateDbFromState()` set `db.sessions = []`. Snapshot lama di disk berisi 89 sesi legacy, namun jalur hydrate mengabaikannya sepenuhnya. ✅

### Revocation — 7 skenario
| Skenario | Implementasi aktual | Live test |
|---|---|---|
| 1. Logout | `destroySession(token)` di handler logout | ✅ 401 |
| 2. Restart | Sesi in-memory, tidak pernah di-restore (hydrate strip + `sessions: []`) | ✅ 401 setelah restart proses baru |
| 3. Password change | PATCH `/api/users/:id` + `password` → `revokeUserSessions()` (authVersion++ + hapus semua sesi user) | ✅ 401; re-login password baru 200 |
| 4. Role/privilege change | PATCH role berbeda (`privilegeChanged`) / deactivation → `revokeUserSessions()` | ✅ terverifikasi via jalur sama (helper ada & dipanggil) |
| 5. Epoch change | `SECURITY_EPOCH = GABAH_SECURITY_EPOCH \|\| 2`; `getActiveSession()` menolak & menghapus sesi ber-epoch lama; helper `revokeAllSessions()` tersedia | ✅ token pra-rilis ditolak kategoris |
| 6. Expired token | `getActiveSession()`: `expires_at <= now` → splice + null | ✅ (mati oleh absolute 7-day window) |
| 7. Invalid token | Tidak ada di registry → null → 401 | ✅ random 64-hex → 401 |

`authenticateRequest()` juga menolak token bila `session.user_auth_version !== owner.authVersion` (splice). `SESSION_LIFETIME_POLICY`: absolute 7 hari, tanpa idle timeout, tanpa refresh token (didokumentasikan).

### Persistence & Git
- `server/data/gabah_state.json` BUKAN sumber bearer token aktif saat boot (terbukti: restart → sesi lama 401; snapshot tersimpan `sessions=0`). ✅
- `.gitignore` memuat blok CR-03; `git ls-files server/data` = 0; staged deletion di index. ✅
- Live: snapshot pasca-run `sessions=0`. ✅

### Cookie/session security
Aplikasi **tidak menggunakan cookie** untuk auth — hanya header `Authorization: Bearer` (fallback `x-auth-token`). Maka permukaan HttpOnly/Secure/SameSite/CSRF-cookie **tidak ada** (N/A); ancaman CSRF otomatis-terkirim tidak berlaku pada model header. Ini dokumentasi kondisi aktual, bukan asumsi. ✅

---

# 6. CR-06 — Mass Assignment & Ticket State Machine

## **PASS**

| Endpoint | Implementasi aktual (source) | Protected fields terverifikasi |
|---|---|---|
| `PATCH /api/maintenances/:id` | Allowlist eksplisit 11 field (`title, scheduled_date, frequency, status, technician_name, vendor_id, vendor_name, estimated_cost, actual_cost, notes, checklist`) | `id, schedule_code, asset_id, asset_name, asset_number, category_type, owner_division, created_at` |
| `updateMeetingRoom` (`server/services.ts`) | Allowlist 7 field (`name, capacity, facilities, status, color, description, image_url`) | `id, code, building, floor, pic_ga` |
| `PATCH /api/assets/:id` | Allowlist (sudah ada sejak sebelumnya, dipertahankan) | `asset_number`, `owner_division` di luar allowlist (server-owned) |
| `PATCH /api/tickets/:id/status` | State machine `TICKET_TRANSITIONS`: `open→[in_progress,resolved,closed]`, `assigned→[sama]`, `in_progress→[resolved,closed,open]`, `resolved→[closed,open]`, `closed→[open]`; string arbitrer/transisi lompatan → **400**; `resolved_at` dikelola server | Semua field non-status tidak lewat jalur ini |
| `updateContract` (`server/contracts.ts`) | `protectedFields` = **16 item persis** seperti klaim report (`id, contract_number, created_by, created_by_name, created_at, owner_division, owner_division_label, pic_user_id, pic_name, restricted, status, renewal_outcome, replaced_by_contract_id, parent_contract_id, documents, milestones`); perubahan lifecycle hanya via endpoint khusus (decideRenewal/addDocument/addMilestone/reminder sweep) | ✅ semua |
| `POST /api/users` | Password selalu CSPRNG server-side (`crypto.randomBytes(12)`); response lewat `sanitizeUser` (strip `password_hash/password_salt/temp_password`) → tidak pernah echo | `role` default 'Karyawan'; password tidak client-authoritative |
| `PATCH /api/users/:id` | Field eksplisit (`name/email/role/division/department/is_active/phone/password`); `id`/`created_*` tidak dapat diubah klien | ✅ |
| Master data (taxonomy/divisions/meeting-types/facilities) | Field-by-field eksplisit + guard role (Admin GABAH / GA) | ✅ |
| Loan create | `requestLoan` menerima field bertipe eksplisit; `borrower_id` di-resolve server-side dari aktor (bukan client-authoritative) | ✅ |

**`Object.assign` pada `req.body`: 0 kejadian** di seluruh `server.ts` + `server/` (hanya komentar penanda CR-06). Spread `...req.body` hanya pada `POST /api/assets/:id/loans` yang langsung masuk service bertipe eksplisit.

**Bukti live (run ulang, semua PASS):** asset `asset_number` tidak tertimpa + `notes` diterapkan; maintenance protected unchanged + `notes` diterapkan; room `id/code/building` unchanged + `description` diterapkan; kontrak `owner_division/pic_user_id/created_by/contract_number` unchanged, `status='terminated'` tidak bisa dipaksa, `notes` diterapkan; tiket: `hacked_status`→400, `open→in_progress→resolved→closed`→200, `resolved→in_progress`→400, `closed→in_progress`→400.

---

# 7. Apakah Perubahan P0 Sudah Masuk Git?

**Belum.** HEAD lokal = `origin/main` = `610c899` → tidak ada commit P0, tidak ada push. Seluruh pekerjaan P0 hidup hanya di working tree + index (staged deletion).

| FILE | STATUS | LOCAL CHANGE | COMMITTED? | PUSHED? |
|---|---|---|---|---|
| `server/runtime-hardening.ts` | Modified | PUBLIC_API_PATHS digumbal, auditor whitelist dipersempit | TIDAK | TIDAK |
| `server.ts` | Modified | Handler switch-role ditulis ulang, login PBKDF2-only, allowlist maintenance, state machine tiket, POST/PATCH users | TIDAK | TIDAK |
| `server/auth.ts` | Modified | epoch + authVersion, revoke helpers, anti-spoof, lifetime policy | TIDAK | TIDAK |
| `server/persistence.ts` | Modified | hydrate strip sessions, sessions:[] di payload, provisioning env/CSPRNG | TIDAK | TIDAK |
| `server/db.ts` | Modified | CANONICAL_USERS tanpa material password | TIDAK | TIDAK |
| `server/contracts.ts` | Modified | protectedFields diperluas ke 16 | TIDAK | TIDAK |
| `server/services.ts` | Modified | allowlist updateMeetingRoom | TIDAK | TIDAK |
| `src/App.tsx` | Modified | hapus fallback identitas lokal & auto-login | TIDAK | TIDAK |
| `src/components/auth/LoginPage.tsx` | Modified | hapus 1-Click & defaultPasswordForRole | TIDAK | TIDAK |
| `src/components/landing/LandingPage.tsx` | Modified | hapus kredensial landing | TIDAK | TIDAK |
| `src/components/modals/AdministrationModal.tsx` | Modified | hapus password literal & display | TIDAK | TIDAK |
| `src/data/mockData.ts` | Modified | hapus temp_password | TIDAK | TIDAK |
| `src/types.ts` | Modified | hapus field temp_password | TIDAK | TIDAK |
| `.gitignore` | Modified | blok ignore CR-03 | TIDAK | TIDAK |
| `AUDIT_NOTES.md` | Modified | redaksi kredensial | TIDAK | TIDAK |
| `docs/architecture/RBAC.md` | Modified | redaksi kredensial | TIDAK | TIDAK |
| `docs/testing/UAT.md` | Modified | redaksi kredensial | TIDAK | TIDAK |
| `scripts/reset-temporary-users.mjs` | Modified | hapus fallback PGPASSWORD | TIDAK | TIDAK |
| `scripts/test-core-modules.ts` | Modified | kredensial via env | TIDAK | TIDAK |
| `server/data/gabah_state.json` | Deleted (staged, untrack) | file kini gitignored, tetap ada di disk | TIDAK (hanya staged) | TIDAK |
| `scripts/p0-security-verify.mjs` | Untracked | test P0 baru | TIDAK | TIDAK |
| `GABAH-AUDIT-REPORT.md` | Untracked | deliverable fase 1 | TIDAK | TIDAK |
| `GABAH-P0-SECURITY-HARDENING-REPORT.md` | Untracked | deliverable fase 2 | TIDAK | TIDAK |

Dibanding `610c899` (= HEAD = origin/main): working tree berisi tepat perubahan-perubahan di atas; remote tidak memiliki satu pun di antaranya.

---

# 8. Test Results

| Check | Command | Hasil |
|---|---|---|
| Lint | `npm run lint` (`tsc --noEmit`) | **PASS — 0 error** |
| Build | `npm run build` (vite + esbuild → `dist/`, `dist/server.cjs`) | **PASS** (warning chunk 881 kB non-fatal, pre-existing) |
| P0 verification | `node scripts/p0-security-verify.mjs` (run fresh hari ini) | **TOTAL: 37 \| PASS: 37 \| FAIL: 0** |

**Audit kualitas test (`scripts/p0-security-verify.mjs`):** skrip **menguji behavior server sungguhan**, bukan assertion statis — boot `dist/server.cjs` di port acak (39000+), mengirim request HTTP nyata (anon/spoof/invalid-token, login, PATCH mass-assignment, transisi tiket, logout/password-change/restart), membaca snapshot hasil persist, lalu exit sendiri (self-terminating, proses child di-SIGKILL, snapshot di-backup & direstore, tidak menyentuh DB, tidak mencetak secret — hanya label + mask 4 karakter akhir). Tidak ada test baru yang dibuat dan tidak ada test yang diubah.

---

# 9. Mismatch (Report P0 vs Source vs Git)

1. **[GIT] P0 belum committed & belum pushed.** Report fase 2 konsisten menyatakan "tanpa commit, tanpa push", namun implikasinya: seluruh perubahan P0 hanya ada di working tree lokal (`516+/379−` + 3 file untracked + 1 staged deletion). HEAD = origin/main = `610c899` — remote belum memuat perbaikan apa pun. Risiko kehilangan pekerjaan sampai di-commit.
2. **[TEST-EVIDENCE] Uji "OLD_TOKEN_1 dari gabah_state.json di HEAD" berjalan beda jalur.** Report fase 2 mencatat bukti HTTP 401 via token yang diekstrak dari file di HEAD. Pada run ini file sudah tidak ada di HEAD (untracked/staged deletion), sehingga skrip otomatis mencatat PASS dengan alasan "no committed token available in HEAD". Bukan kegagalan keamanan — buktinya justru lebih kuat (file sudah keluar dari tracking) — tetapi jalur evidensinya berbeda dari run pertama.
3. **[RESIDU-CR-02] `server/data/gabah_state.json` di disk masih memuat 89 sesi legacy + field `initialPassword` × 3.** Report menyebut untrack+ignore (akurat), tapi konten legacy lokal tetap ada (tidak boleh dihapus per aturan tahap ini). Tidak aktif (tidak pernah di-hydrate; epoch 2 menolak token lama), namun file tetap harus dianggap COMPROMISED dan jadi bahan rotasi kredensial.
4. **[DOCS] Residu dokumentasi di luar daftar file P0:** `README.md` masih menulis "Halaman login & 1-click persona switch" (fitur sudah dihapus), dan `PROJECT-RULES.md` masih menyebut token "dikelola pada tabel user_sessions" serta menampilkan "switch-role" sebagai pengecualian Auditor (kini memory-only dan admin-only). Tidak mengandung kredensial; murni ketidaksesuaian narasi dokumen vs implementasi.
5. **[KONSISTEN] Semua klaim teknis inti report terkonfirmasi:** PUBLIC_API_PATHS, gate 401/403, rotasi sesi, audit log switch-role, PBKDF2-only login, provisioning env/CSPRNG, hydrate strip sessions, epoch 2, revoke helpers, allowlist maintenance/room, 16 protectedFields kontrak, state machine tiket, POST /api/users tanpa plaintext. Tidak ditemukan klaim report yang tidak ada di source.

---

# 10. Release Gate

# **VERIFIED**

Kriteria: verifikasi dilakukan terhadap **kondisi aktual**, bukan isi report. Keempat CR terverifikasi PASS di source aktual **dan** direproduksi via test live 37/37 PASS + lint PASS + build PASS.

**Perhatian (bukan penurunan gate, wajib diperhatikan tahap berikutnya):**
1. Seluruh perubahan P0 **belum committed / belum pushed** — pekerjaan rentan hilang sampai di-commit.
2. Kondisi lama report tetap berlaku: rotasi kredensial, pertahankan epoch ≥ 2, history purge + incident response sebagai operasi terpisah (token & hash lama masih ada di riwayat Git 36 commit).
3. CR-04 (PostgreSQL migrasi) & CR-05 (reminder otomatis) tetap di luar scope dan masih terbuka.
4. Residu dokumen (README/PROJECT-RULES) perlu penyelarasan kecil pada tahap berikutnya.

---

*Dibuat sebagai audit-only verification. Tanpa perubahan source, tanpa commit, tanpa push, tanpa rewrite history, tanpa migration, tanpa penghapusan file. Tidak ada secret/token/password aktual di dalam dokumen ini.*
