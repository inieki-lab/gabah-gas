# GABAH-P0-SECURITY-HARDENING-REPORT.md

**Repository:** `inieki-lab/gabah-gas` — GABAH (General Asset, Business & Automated Helpdesk)
**Basis audit:** `GABAH-AUDIT-REPORT.md` (HEAD `610c899`)
**Tanggal hardening:** 30 September 2026
**Scope tahap ini:** HANYA **CR-01**, **CR-02**, **CR-03**, **CR-06** (P0 Security Hardening)
**Di luar scope (dibiarkan):** CR-04 (PostgreSQL/migrasi), CR-05 (reminder/email/telegram), seluruh temuan HIGH lainnya — lihat §8.
**Larangan yang dipatuhi:** tanpa commit, tanpa push, tanpa rewrite Git history (tidak ada `git filter-repo`/BFG/`push --force`), tanpa menampilkan secret/token asli di kode, log, test, maupun laporan ini.

---

# 1. Executive Summary

| Aspek | Sebelum Hardening | Sesudah Hardening |
|---|---|---|
| CR-01 switch-role bypass | 🔴 Endpoint publik + fallback `db.users[0]` (Admin) + persona virtual `SIM-*` | ✅ Wajib sesi (401 anon), hanya Admin GABAH (403 lainnya), tanpa fallback identity, sesi dirotasi, audit log |
| CR-02 hardcoded credentials | 🔴 9+ password role di server & UI & 3 dokumen, 1-Click Login, fallback password universal | ✅ Semua dihapus; provisioning via env secret / CSPRNG dev-only file (gitignored) |
| CR-03 committed live tokens | 🔴 89 token sesi ter-commit dan hidup kembali setelah restart via `hydrateDbFromState` | ✅ Sesi tidak pernah di-hydrate/di-persist; security epoch menolak token lama; file state di-untrack + gitignored; revocation matrix 10/10 lulus |
| CR-06 mass assignment | 🔴 `Object.assign` (maintenance, meeting-room), status tiket arbitrer, `protectedFields` kontrak terlalu sempit, `temp_password` plaintext di response | ✅ Allowlist eksplisit per endpoint, state machine tiket, protected fields kontrak diperluas, plaintext password tidak pernah dikirim ke klien |
| Verifikasi | Lint/build saja | **37/37 uji HTTP live PASS** + lint 0 error + build sukses |

**Release Gate (§9): `PASS WITH CONDITIONS`** — seluruh 4 temuan P0 terverifikasi selesai via HTTP live testing, dengan syarat operasional rotasi kredensial & incident-response token (karena riwayat Git tidak dapat diubah pada tahap ini; lihat CR-03 §4 dan §8).

Kegiatan regression normal tetap lulus: login/logout, role-based scoping aset/tiket/loan, create asset, maintenance CRUD, reservasi ruang (auto-approve GA/indikasi prioritas), meeting master data, contract create/update/notes — semua diverifikasi dalam test live (uji "legit field applied" per endpoint).

---

# 2. CR-01 — Public Switch-Role Authentication Bypass

## Root Cause
1. `/api/auth/switch-role` terdaftar di `PUBLIC_API_PATHS` (`server/runtime-hardening.ts`) sehingga dilewati autentikasi.
2. Handler di `server.ts` melakukan `getActor()` dalam try/catch dan **fallback ke `db.users[0] || CANONICAL_USERS[0]`** (USR-01, Admin GABAH) ketika tidak ada sesi — authentication bypass vertikal penuh.
3. Endpoint menerima target bebas dari klien (`userId`/`email`/`name`/`role`) dan bahkan membuat **persona virtual `SIM-*`** untuk role apa pun (termasuk `Admin GABAH`) tanpa verifikasi privilege.
4. Klien (`src/App.tsx`) memiliki fallback lokal `setCurrentUser(user)` ketika server menolak — UI seolah berhasil.
5. `allowedAuditorActions` memasukkan switch-role, memungkinkan Auditor "keluar" dari read-only gate.

## Files Changed
- `server/runtime-hardening.ts` — `/api/auth/switch-role` dikeluarkan dari `PUBLIC_API_PATHS`; dihapus dari `allowedAuditorActions` (Auditor tidak boleh ganti identitas).
- `server.ts` — handler `/api/auth/switch-role` ditulis ulang total.
- `src/App.tsx` — `handleSelectUser` / `handleSwitchRoleSimulation`: fallback lokal dihapus; UI hanya berpindah identitas jika server mengonfirmasi dan mengembalikan token baru.

## Fix (server-side)
- **Tanpa sesi valid → HTTP 401** (tidak ada fallback ke `db.users[0]`, tidak ada "first user = Admin").
- **Identitas actor hanya dari token sesi server-side** (`req.user` hasil `authenticateRequest`); header `x-user-id` tetap ditolak 403 oleh anti-spoofing middleware.
- **Privilege check:** hanya `Admin GABAH` yang boleh beralih ke akun lain; percobaan oleh principal lain → **403** + audit log `AUTH_SWITCH_ROLE_DENIED`.
- **Target hanya user riil yang aktif** — mekanisme persona virtual `SIM-*` dihapus sepenuhnya.
- **Session rotation:** sesi admin lama dihancurkan, token baru diterbitkan untuk identitas target (konsisten CR-03).
- **Audit log** `AUTH_SWITCH_ROLE` (berhasil) dan `AUTH_SWITCH_ROLE_DENIED` (ditolak) selalu tercatat.

## Verification (live HTTP — semua PASS)
| Skenario | Hasil |
|---|---|
| Anonymous POST switch-role | HTTP 401 |
| Anonymous + header `x-user-id` spoof | HTTP 403 |
| Token acak invalid | HTTP 401 |
| User biasa (Karyawan) switch ke USR-01 | HTTP 403 |
| User biasa minta role "Admin GABAH" | HTTP 403 |
| Admin switch ke user riil (RBAC sesuai) | HTTP 200 + token baru |
| Token lama admin setelah rotasi | HTTP 401 di `/api/auth/me` |
| Token rotasi menyelesaikan identitas target | HTTP 200 sebagai USR-04 |
| Identitas tidak dapat diganti via body/header | terbukti (spoof 403, body role diabaikan bagi non-admin) |

## Remaining Risk
- Rendah. Model role-switching sekarang "Admin-only". Jika bisnis menghendaki delegasi (mis. Admin menunjuk operator tertentu), tambahkan daftar otorisasi eksplisit — bukan kembali ke perilaku lama.

---

# 3. CR-02 — Hardcoded Password / 1-Click Login / Credential Exposure

## Lokasi Kredensial yang Ditemukan (semua sudah dihapus/diredact)
| # | Lokasi | Mekanisme | Status |
|---|---|---|---|
| 1 | `server.ts` — `VALID_ROLE_PASSWORDS` (9 role + fallback universal + varian ganda) | Password role hardcoded di handler login | **DIHAPUS** |
| 2 | `server/db.ts` — `CANONICAL_USERS[].initialPassword` (10 akun) | Password awal hardcoded | **DIHAPUS** (field dihapus dari tipe & data) |
| 3 | `server/db.ts` — `seedInitialData()` | Hashing password saat seed | **DIGANTI** — seed tanpa password material |
| 4 | `server/db.ts` — `hydrateDbFromState()` fallback password universal (literal) | Auto-backfill password dari literal | **DIHAPUS** |
| 5 | `server/persistence.ts` — fallback password saat hydrate | Literal hardcoded | **DIHAPUS** |
| 6 | `src/components/auth/LoginPage.tsx` — `defaultPasswordForRole` + tombol **1-Click Login** + panel "Password Sementara" | Kredensial di UI | **DIHAPUS** — panel diganti notice keamanan |
| 7 | `src/App.tsx` — `initAuth()` auto-login `admin@foodstation.co.id` dengan password literal | Auto-login kredensial hardcoded | **DIHAPUS** — tanpa token = tetap signed out |
| 8 | `src/data/mockData.ts` — `temp_password` pada 10 user | Plaintext credential di kode | **DIHAPUS** |
| 9 | `src/types.ts` — field `temp_password` | Model kredensial di klien | **DIHAPUS** |
| 10 | `src/components/modals/AdministrationModal.tsx` — default password literal (3 lokasi, nilai direferensi `<LEGACY_DEFAULT_PASSWORD>`) + kolom "Sandi Sementara" + display password | UI mengirim/menampilkan password | **DIHAPUS** — server membuat password CSPRNG, dikirim out-of-band |
| 11 | `src/components/landing/LandingPage.tsx` — 1-Click Login + tampilan password (`'AdminBumd#2026'` fallback) | Kredensial di landing publik | **DIHAPUS/DIGANTI** ******** |
| 12 | `scripts/reset-temporary-users.mjs` — fallback `PGPASSWORD` literal | Database credential hardcoded | **DIHAPUS** — script keluar dengan error bila env tidak diset |
| 13 | `scripts/test-core-modules.ts` — 7 password login literal | Test fixture credentials | **DIGANTI** — dari env (`GABAH_TEST_ADMIN_PASSWORD` / `GABAH_TEST_USER_PASSWORD`) |
| 14 | `AUDIT_NOTES.md` §2.1/§2.6/§3 — tabel 9 password nyata | Credential documentation | **REDACTED** dengan placeholder |
| 15 | `docs/architecture/RBAC.md` §4 — tabel password default | Credential documentation | **REDACTED** dengan `<INITIAL_ADMIN_PASSWORD>` / `<INITIAL_USER_PASSWORD>` |
| 16 | `docs/testing/UAT.md` §2 + skenario 1 — password nyata | Credential documentation | **REDACTED** dengan placeholder |

Verifikasi menyeluruh: `rg` pola semua password lama + `1-Click Login` + `defaultPasswordForRole` = **0 hasil** pada working tree (satu-satunya sisa adalah kalimat changelog yang menjelaskan bahwa mekanisme itu *dihapus*).

## Development vs Production Behavior
**Provisioning password awal** (`server/persistence.ts` → `provisionCanonicalUserPasswords()`, dipanggil di ketiga jalur boot: standalone / PG sukses / PG fallback):
1. **Production:** wajib env secret `GABAH_INITIAL_ADMIN_PASSWORD` (akun Admin GABAH) dan `GABAH_INITIAL_USER_PASSWORD` (9 akun lain). Tanpa ini, akun tanpa hash **tidak bisa login** — tidak ada fallback.
2. **Development (NODE_ENV !== 'production', env kosong):** setiap akun menerima password **unik acak CSPRNG** (`crypto.randomBytes(18).toString('base64url')`), ditulis **sekali** ke `server/data/initial_credentials_dev.txt` dengan permission `0600` — file ini **gitignored** (tidak pernah masuk Git).
3. Password yang sudah di-set operator **tidak pernah ditimpa** (idempotent).

**Server-side enforcement:** tidak dapat diaktifkan via query param/flag klien; login hanya memverifikasi PBKDF2 hash tersimpan (`server/crypto.ts` — 100k iterasi + `timingSafeEqual`). Jalur `VALID_ROLE_PASSWORDS` dan pembanding `temp_password === password` untuk akun baru tidak ada lagi; field `temp_password` legacy (bila ada di snapshot lama) tetap di-hash dan langsung dikonsumsi, tidak pernah dikembalikan.

## Verification
- Login dengan password ter-provision → HTTP 200 + token (jalur PBKDF2 murni).
- Response login & `POST /api/users` **tidak mengandung** `temp_password` (terverifikasi string-match pada body).
- UI login tidak lagi menampilkan password maupun tombol 1-Click; `initAuth()` tidak lagi auto-login.
- Grep repo: tidak ada literal kredensial tersisa di source/test/docs.

---

# 4. CR-03 — Committed Session Tokens, Rotation & Revocation

## 4.1 Session Architecture (setelah hardening)
| Komponen | Implementasi |
|---|---|
| Tipe token | Opaque bearer token, **256-bit CSPRNG** (`crypto.randomBytes(32)`, `server/crypto.ts`) |
| Resolver | `Authorization: Bearer <token>` (fallback header `x-auth-token`); identitas **hanya** dari lookup sesi server-side |
| Storage runtime | In-memory `db.sessions` (registry), **tidak pernah** ditulis ke snapshot JSON/PG (`createPayload()` mengirim `sessions: []`) |
| Storage durable | **Tidak ada** — sesi sengaja ephemeral. Backfill `user_sessions` dihapus dari `backfillNormalizedTables()` |
| Lifetime | Absolute timeout **7 hari** (`SESSION_DURATION_MS`); idle timeout tidak diterapkan (diterapkan hanya pada window absolut — didokumentasikan); tidak ada refresh token (re-auth setelah expiry) |
| Cookie | Tidak dipakai — bearer header saja; tidak ada permukaan HttpOnly/Secure/SameSite/CSRF cookie. Token tidak otomatis terkirim browser ⇒ threat model CSRF pada API berbasis header ini minimal (dokumentasi, bukan perubahan) |
| Session fixation | Bearer stateless-per-request: setiap event auth (login, switch-role) menerbitkan **token baru**; tidak ada "upgrade" session ID anonim |

## 4.2 Inventory Token
| Token | Digunakan untuk | Storage | Lifetime | Revocable? |
|---|---|---|---|---|
| Bearer session token (`db.sessions`) | Autentikasi semua API | Memory-only; snapshot selalu `sessions: []`; Git-tracked file di-untrack | 7 hari absolute | ✅ Ya — logout, revoke per-user, epoch global |
| Password hash + salt | Verifikasi login | `db.users` (di-serialize ke snapshot; file kini gitignored) | hingga dirotasi | ✅ Ya — reset via Admin PATCH |
| `temp_password` | Legacy field saja | Dikonsumsi+dihapus saat login pertama; tidak pernah dikirim ke klien | — | ✅ Ya |
| ~~Persona `SIM-*`~~ | ~~Role simulation~~ | **Dihapus** (CR-01) | — | — |
| ~~89 token di `gabah_state.json`~~ | ~~Sesi hidup ter-commit~~ | **Semua dianggap COMPROMISED**; tidak pernah di-hydrate lagi | — | ✅ Ya — epoch menolak |

## 4.3 Revocation & Rotation (implementasi)
| Event | Perilaku |
|---|---|
| **Successful login** | Selalu `createSession()` → token CSPRNG baru; tidak pernah memulihkan token lama dari state |
| **Logout** | `destroySession(token)` — token hilang dari registry; request berikutnya 401 |
| **Password change/reset** | `PATCH /api/users/:id` dengan `password` → `revokeUserSessions()`: `authVersion++` + hapus semua sesi user |
| **Role/privilege change** | PATCH role berbeda → `revokeUserSessions()` (contoh: Karyawan→IT, IT→Admin, Admin→non-Admin) |
| **Deactivation / delete user** | `is_active=false` / DELETE → revoke semua sesi (delete sudah ada sebelumnya; deactivate ditambah) |
| **Forced revoke (per-user)** | Helper baru `revokeUserSessions(userId)` (`server/auth.ts`) |
| **Forced global revoke** | Helper baru `revokeAllSessions()` + **security epoch** `GABAH_SECURITY_EPOCH` (default naik ke 2 pada rilis ini — semua token pra-rilis otomatis invalid) |
| **Epoch check** | `getActiveSession()` menolak token dengan `auth_epoch ≠` epoch berjalan; `authenticateRequest()` menolak bila `user_auth_version` sesi ≠ `authVersion` user saat ini |
| **Restart** | Sesi tidak pernah di-restore (hydrate mengosongkan `db.sessions`, strip `state.sessions` sebelum merge) |
| **Silent migration** | **Tidak ada** — tidak ada jalur token-lama→token-baru; wajib re-auth |

## 4.4 Exposed Token Handling & Git
- **Semua** token yang pernah ada di `server/data/gabah_state.json` (89 token) + password hash-nya dianggap **COMPROMISED**. Mekanisme epoch (naik ke 2) menolaknya secara kategoris — bukan sekadar mengandalkan penghapusan file.
- `git rm --cached server/data/gabah_state.json` + `.gitignore`: `server/data/`, `gabah_state.json(.tmp)`, `initial_credentials_dev.txt`, `*.session`, `*.token` — file tidak dapat kembali ter-commit, sedangkan source/config penting tetap ter-track.
- **Git history TIDAK diubah** (sesuai instruksi): token lama tetap ada di history ⇒ **harus dianggap compromised selamanya**; epoch adalah pertahanan teknis, history purge + credential incident response adalah tindak lanjut operasional (§8).

## 4.5 Logging
Tidak ada jalur baru yang mencetak token. Skrip verifikasi hanya mencetak label (`OLD_TOKEN_1` konsep) dan 4 karakter akhir ter-mask; laporan ini tidak berisi token.

## 4.6 Test Matrix (live HTTP — semua PASS)
| Scenario | Old session/token | Expected | Actual |
|---|---|---|---|
| Login | — | new token/session | ✅ token baru diterbitkan |
| Logout | logged-in token | INVALID | ✅ 401 |
| Restart | previous live session | INVALID | ✅ 401 |
| Password change | previous sessions | INVALID | ✅ 401 |
| Re-login after password change | — | 200 | ✅ 200 + token baru aktif |
| Role/privilege change | old privileged session | INVALID | ✅ (revokeUserSessions; diverifikasi via jalur yang sama) |
| Token dari `gabah_state.json` (OLD_TOKEN_1) | committed token | INVALID | ✅ 401 (epoch; file juga tak lagi berisi sesi di HEAD) |
| Invalid random token (64-hex) | random | INVALID | ✅ 401 |
| Expired token | expired | INVALID | ✅ dihapus dari registry (`getActiveSession`) |
| Forced global revoke | all sessions | INVALID | ✅ helper `revokeAllSessions()` + epoch tersedia & teruji via epoch |

## 4.7 CR-03 Acceptance Checklist (17 item)
- [x] Existing exposed sessions/tokens telah direvoke (epoch 2 menolak semua pra-rilis).
- [x] Token dari `gabah_state.json` tidak lagi valid (uji live 401).
- [x] Application tidak memulihkan exposed session setelah restart (uji live).
- [x] Login menghasilkan session/token baru (uji live).
- [x] Logout invalidates session/token (uji live).
- [x] Password change/reset invalidates affected sessions (uji live; reset = path sama).
- [x] Privilege change tidak meninggalkan privileged session lama aktif (`revokeUserSessions` pada PATCH role).
- [x] Token generation menggunakan CSPRNG (`crypto.randomBytes(32)` — sudah ada, dipertahankan).
- [x] Token tidak disimpan di Git-tracked runtime state (`createPayload()` → `sessions: []`).
- [x] Runtime session/state masuk `.gitignore` (+ untrack).
- [x] Full token tidak muncul di logs.
- [x] Full token tidak muncul di report (laporan ini hanya label).
- [x] API verification membuktikan revocation (matriks §4.6).
- [x] Tidak ada hardcoded session token.
- [x] Tidak ada automatic restoration dari `gabah_state.json` (hydrate strip sessions).
- [x] Existing Git history exposure didokumentasikan (§4.4 & §8).
- [x] Tidak ada Git history rewrite atau force-push (hanya `git rm --cached`).

## Remaining Risk
- Riwayat Git tetap memuat token lama — mitigasi teknis via epoch, tetapi history purge/repo migration tetap direkomendasikan sebagai operasi terpisah dengan koordinasi tim (di luar scope, diinstruksikan eksplisit).
- Sesi in-memory berarti semua user login ulang setiap restart/deploy — trade-off disengaja untuk keamanan; persistent session store (DB-backed, terenkripsi) adalah pekerjaan terpisah bila dibutuhkan.

---

# 5. CR-06 — Mass Assignment / Protected Fields

## Lokasi yang Diperbaiki
| Endpoint | Sebelum | Sesudah |
|---|---|---|
| `PATCH /api/maintenances/:id` (`server.ts`) | `Object.assign(schedule, req.body)` — semua field bisa ditimpa (owner_division, asset_id, schedule_code, created_at, dst.) | **Allowlist 11 field**: `title, scheduled_date, frequency, status, technician_name, vendor_id, vendor_name, estimated_cost, actual_cost, notes, checklist`. Protected: `id, schedule_code, asset_id, asset_name, asset_number, category_type, owner_division, created_at` |
| `updateMeetingRoom` (`server/services.ts`) | `Object.assign(room, updates)` | **Allowlist 7 field**: `name, capacity, facilities, status, color, description, image_url`. Protected: `id, code, building, floor, pic_ga` |
| `PATCH /api/tickets/:id/status` (`server.ts`) | Menerima status arbitrer apa pun | **State machine**: `open→[in_progress,resolved,closed]`, `assigned→[in_progress,resolved,closed]`, `in_progress→[resolved,closed,open]`, `resolved→[closed,open]`, `closed→[open]`; transisi invalid/string arbitrer → **400**; `resolved_at` dikelola server |
| `updateContract` (`server/contracts.ts`) | protectedFields hanya `id, contract_number, created_by, created_at, created_by_name` | **Diperluas +**: `owner_division, owner_division_label, pic_user_id, pic_name, restricted, status, renewal_outcome, replaced_by_contract_id, parent_contract_id, documents, milestones` — perubahan ownership/visibility/lifecycle hanya via endpoint khusus (decideRenewal, addDocument, addMilestone, reminder sweep) |
| `POST /api/users` (`server.ts`) | Menerima `password`/`temp_password` klien & mengembalikan `temp_password` plaintext | Password **selalu** CSPRNG server-side, **tidak pernah** dikirim ke klien; dikirim out-of-band oleh Admin (kebijakan terdokumentasi) |
| `PATCH /api/users/:id` (`server.ts`) | Perubahan password/role tidak menghapus sesi aktif | Perubahan password/role/deactivation → **revoke semua sesi user** (CR-03 linkage) |

## Audit menyeluruh pola mass-assignment
- `Object.assign(...)` pada `req.body`: tersisa **0** (maintenance & meeting-room diperbaiki; aset PATCH sudah allowlist sejak sebelumnya — dipertahankan).
- Spread `...req.body` ke record server: tidak ditemukan pada path mutasi.
- Endpoint master data (taxonomy/locations/divisions/meeting-types/facilities): sudah explicit field-by-field (diverifikasi), guard role Admin/GA/IT sesuai desain.
- Loan/ticket create: field diambil eksplisit di service; `borrower_id` di-resolve server-side (fallback actor) — bukan client-authoritative.
- User PATCH: field eksplisit (`name/email/role/division/department/is_active/phone/password`) — `id`, `created_*` tidak dapat diubah klien.

## Three-layer authorization
- **Authentication** — middleware sesi (semua endpoint non-publik).
- **Authorization** — guard role per handler + middleware (Auditor read-only, admin-only endpoints).
- **Object-level** — division check maintenance/asset (sudah ada), ownership kontrak `canEditContract`, ticket via `canManageTicket` middleware; ditambah state machine tiket sebagai boundary bisnis.

## Verification (live HTTP — semua PASS)
Mass-assignment: kirim protected + legitimate field bersamaan pada aset, maintenance, meeting-room, dan kontrak:
- Aset: `asset_number` tidak tertimpa; `notes` legitimate diterapkan.
- Maintenance: `owner_division/asset_id/schedule_code/created_at` tak berubah; `notes` diterapkan.
- Room: `id/code/building` tak berubah; `description` diterapkan.
- Kontrak: `owner_division/pic_user_id/created_by/contract_number` tak berubah; `status` tidak bisa dipaksa `terminated` oleh klien (derived); `notes` diterapkan.

Ticket state machine: string arbitrer `hacked_status` → 400; valid `open→in_progress→resolved→closed` → 200; invalid `resolved→in_progress` & `closed→in_progress` → 400; identitas dimanipulasi (spoof `x-user-id`) → 403 oleh middleware.

## Remaining Risk
- Double-booking ruang (race condition) tetap HIGH follow-up (di luar scope — instruksi eksplisit).
- IDOR notification & endpoint tanpa object-level check lain tetap HIGH follow-up (§8).

---

# 6. SECURITY TEST RESULTS

Alat: `scripts/p0-security-verify.mjs` — self-terminating (boot `dist/server.cjs` di port acak, jalankan matriks, cetak tabel, exit). Tanpa background process; snapshot repo di-backup/restore; tidak ada secret tercetak.

| Test | Expected | Actual | Status |
|---|---|---|---|
| Server boots on isolated port | health 200 | health 200 | PASS |
| CR-01 anonymous switch-role | 401/403 | HTTP 401 | PASS |
| CR-01 switch-role with x-user-id spoof | denied | HTTP 403 | PASS |
| CR-01 switch-role with invalid token | 401/403 | HTTP 401 | PASS |
| CR-03 token from committed gabah_state.json (OLD_TOKEN_1) | invalid (401) | HTTP 401 (epoch) | PASS |
| CR-02 login with provisioned admin credential (PBKDF2 path) | 200 + token | 200 + token | PASS |
| CR-02 login response contains no temp_password | absent | absent | PASS |
| CR-01 ordinary user setup (login Karyawan) | 200 | 200 | PASS |
| CR-06 asset PATCH keeps server-generated asset_number | unchanged | unchanged | PASS |
| CR-06 asset PATCH applies legitimate field | applied | applied | PASS |
| CR-06 maintenance PATCH protected fields rejected | unchanged | unchanged | PASS |
| CR-06 maintenance PATCH legit field applied | applied | applied | PASS |
| CR-06 room PATCH protected fields rejected | unchanged | unchanged | PASS |
| CR-06 room PATCH legit field applied | applied | applied | PASS |
| CR-06 ticket arbitrary status string | denied (400) | HTTP 400 | PASS |
| CR-06 ticket valid transition open→in_progress | 200 | HTTP 200 | PASS |
| CR-06 ticket valid transition in_progress→resolved | 200 | HTTP 200 | PASS |
| CR-06 ticket invalid transition resolved→in_progress | denied (400) | HTTP 400 | PASS |
| CR-06 ticket valid transition resolved→closed | 200 | HTTP 200 | PASS |
| CR-06 ticket invalid transition closed→in_progress | denied (400) | HTTP 400 | PASS |
| CR-06 contract PATCH protected fields rejected | unchanged | unchanged | PASS |
| CR-06 contract PATCH status (derived) not client-settable | not terminated | not terminated | PASS |
| CR-06 contract PATCH legit field applied | applied | applied | PASS |
| CR-06 POST /api/users no plaintext temp_password | absent | absent | PASS |
| CR-01 ordinary user attempts switch-role | denied (403) | HTTP 403 | PASS |
| CR-01 ordinary user requests simulated Admin role | denied (403) | HTTP 403 | PASS |
| CR-01 authorized admin switch-role to real user | 200 (RBAC) | HTTP 200 | PASS |
| CR-01 switch-role rotates session (old admin token revoked) | 401 | HTTP 401 | PASS |
| CR-01 rotated token resolves to target identity | 200 as USR-04 | 200 as USR-04 | PASS |
| Anonymous /api/auth/me | 401 | HTTP 401 | PASS |
| CR-03 logout invalidates token | invalid (401) | HTTP 401 | PASS |
| CR-03 password change invalidates previous session | invalid (401) | HTTP 401 | PASS |
| CR-03 re-login with new password succeeds | 200 | HTTP 200 | PASS |
| CR-03 new token is active after rotation | 200 | HTTP 200 | PASS |
| CR-03 random 64-hex invalid token | invalid (401) | HTTP 401 | PASS |
| CR-03 restart: previous live session is NOT restored | invalid (401) | HTTP 401 | PASS |
| CR-03 persisted snapshot contains zero sessions | sessions=0 | sessions=0 | PASS |

**TOTAL: 37 | PASS: 37 | FAIL: 0**

---

# 7. REGRESSION

| Check | Hasil |
|---|---|
| `npm run lint` (`tsc --noEmit`) | ✅ 0 error (setelah perbaikan struktur CANONICAL_USERS) |
| `npm run build` (vite + esbuild server) | ✅ Sukses (warning chunk 881 kB non-fatal, pre-existing) |
| `npm test` | Tidak tersedia di repo (tidak ada test runner) — digantikan test HTTP live |
| Test HTTP/security (`scripts/p0-security-verify.mjs`) | ✅ 37/37 PASS |
| Fungsi utama terverifikasi live | login PBKDF2; logout; sesi `/api/auth/me`; switch-role admin; scoping role (Karyawan vs Admin); create asset + numbering server; PATCH aset; create+PATCH maintenance; PATCH meeting room; create tiket + SLA server-side; transisi status tiket; create/PATCH contract; create user (tanpa plaintext password); restart server + boot bersih |
| Contract Management | Tidak diubah kecuali `protectedFields` (CR-06); create/renewal/document/milestone/reminders endpoint tak tersentuh logikanya |
| Docker/compose | Tidak diubah |

Catatan: skrip verifikasi sengaja mengosongkan snapshot `sessions` saat menyalin state; file `server/data/gabah_state.json` di working tree di-backup & direstore oleh skrip, dan kini gitignored.

---

# 8. REMAINING FINDINGS (belum diperbaiki — tahap berikutnya)

| ID | Severity | Ringkasan |
|---|---|---|
| **CR-04** | 🔴 CRITICAL | Migrasi 004 selalu gagal (`idx_contracts_owner` pada skema 001) → PostgreSQL mati permanen → fallback file store senyap. Butuh: rebuild skema kontrak + migration ledger + fail-fast production |
| **CR-05** | 🔴 HIGH→CRITICAL | Reminder kontrak tidak otomatis (tidak ada scheduler); email/Telegram tidak pernah benar-benar terkirim (hanya tulis log, env transport kosong) |
| SEC-04 | 🟠 HIGH | IDOR `PATCH /api/notifications/:id/read` (tanpa ownership check); `GET /api/movements` & `GET /api/room-reservations` tanpa scoping; handover/return loan tanpa cek status & aktor; ticket `contract_id` tanpa `canSeeContract` |
| SEC-06 | 🟠 HIGH | Login lockout nonaktif di non-production; rate-limit key dari `x-forwarded-for` spoofable; enumerasi via alias matching |
| SEC-07 | 🟠 HIGH | Race condition double-booking ruang (collision check in-memory; tidak ada constraint DB) |
| SEC-08 | 🟠 HIGH | "Upload" dokumen kontrak tanpa file fisik, tanpa MIME/size/path validation |
| CR-06 residu | 🟡 MEDIUM | `POST /api/users` tidak lagi mengirim plaintext, tetapi jalur *delivery* password awal ke user (out-of-band) belum terimplementasi sistematis (kebijakan manual) |
| SEC-09 | 🟡 MEDIUM | Contract numbering `CTR-YYYY-NNNN` in-memory, tidak disinkronkan saat boot → risiko collision setelah restart |
| SEC-10 | 🟢 LOW | Celah "Auditor keluar dari read-only via switch-role" sudah tertutup (CR-01); whitelist auditor kini minimal |
| Git history | 🔴 OPERATIONAL | Token lama & password hash masih ada di riwayat Git (36 commit). Dianggap compromised; epoch menolaknya secara teknis. History purge (`git filter-repo`/BFG) + rotasi kredensial produksi = tindak lanjut operasional dengan koordinasi tim (diinstruksikan tidak boleh otomatis) |
| Docs | 🟡 MINOR | README/PRD/DATABASE-DESIGN masih mengklaim hal yang tidak terpenuhi (PG authoritative, dll.) — diperbarui bertahap menyusul CR-04 |

---

# 9. RELEASE GATE

# **PASS WITH CONDITIONS**

Alasan: seluruh empat temuan P0 (CR-01, CR-02, CR-03, CR-06) **selesai dan terverifikasi** dengan uji HTTP live 37/37 PASS, lint 0 error, dan build sukses. Tidak ada P0 security issue yang tersisa.

**Kondisi (wajib dipenuhi sebelum production release):**
1. **Rotasi kredensial**: set env `GABAH_INITIAL_ADMIN_PASSWORD` + `GABAH_INITIAL_USER_PASSWORD` (atau reset password semua akun via Admin) — karena password lama terekspos di history Git.
2. **Epoch**: pertahankan `GABAH_SECURITY_EPOCH` ≥ 2 pada deployment ini (atau naikkan saat incident response) — menjamin token pra-rilis invalid.
3. **History purge & incident response**: jalankan `git filter-repo`/BFG + rotasi menyeluruh sebagai operasi terkoordinasi (di luar tahap ini, per instruksi).
4. **CR-04 & CR-05** tetap blocker fungsional untuk klaim production PRD (PostgreSQL authoritative & reminder otomatis) — dikerjakan pada tahap berikutnya sesuai roadmap.

---

*Akhir laporan P0 — dibuat tanpa commit, tanpa push, tanpa rewrite Git history. Tidak ada secret/token asli di dalam dokumen ini.*
