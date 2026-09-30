# GABAH-AUDIT-REPORT.md

**Repository:** `inieki-lab/gabah-gas` — GABAH (General Asset, Business & Automated Helpdesk)
**HEAD saat audit:** `610c899` (`feat: separate Contract Management domain and restrict ticket categories`) = `origin/main`
**Jumlah commit diaudit:** 36 (`f14d6cc` → `610c899`)
**Tanggal audit:** 30 September 2026
**Sifat audit:** Audit saja — tidak ada perubahan kode, tanpa commit, tanpa migrasi, tanpa patch.

---

# 1. Executive Summary

**Bahasa sederhana:**
GABAH adalah aplikasi manajemen aset + helpdesk + peminjaman + reservasi ruang rapat + manajemen kontrak yang dibangun dengan React + Node/Express + PostgreSQL. Dari sisi tampilan dan logika bisnis harian (aset, tiket, peminjaman), aplikasi ini sudah terlihat "jadi" dan build-nya sukses. **Namun aplikasi ini belum aman dan belum siap production**, karena ada 6 masalah besar:

1. **Siapa pun tanpa login bisa mendapat akses Admin.** Endpoint alih-peran (`/api/auth/switch-role`) berada di daftar jalur publik, dan handler-nya otomatis menjatuhkan caller tanpa sesi ke akun `db.users[0]` (Admin GABAH / USR-01). Artinya: tanpa password, siapa pun bisa "menjadi Admin".
2. **Kata sandi tertulis di source code & di layar login.** 9 sandi peran dikodekan di server, halaman login punya tombol "1-Click Login", dan dokumen audit internal (AUDIT_NOTES.md, RBAC.md, UAT.md) menuliskan semua kredensial.
3. **File data produksi ter-commit ke git** (`server/data/gabah_state.json`) berisi 9 password hash + **89 token sesi yang masih valid** setelah server restart, dan bisa dipakai siapa pun yang meng-clone repo.
4. **Reminder kontrak tidak otomatis, email/Telegram tidak benar-benar terkirim.** Tidak ada scheduler (cron/node-cron/setInterval), dan "kirim notifikasi" hanya menulis baris log. Semua klaim email/Telegram di dokumen = NOT ACTUAL DELIVERY.
5. **PostgreSQL gagal aktif di commit terbaru.** Migrasi 004 dibuat untuk skema kontrak, tetapi karena tabel `contracts` versi lama (migrasi 001) sudah terlanjur ada, `CREATE INDEX ... ON contracts(owner_division, pic_user_id)` di 004 selalu error (kolom tidak ada) → boot persistence gagal → aplikasi jatuh permanen ke file store. **PostgreSQL tidak akan pernah menyala sampai skema diperbaiki.**
6. **Sejumlah endpoint tanpa cek otorisasi/IDOR** (lihat §3 dan §7): siapa pun yang login bisa menandai notifikasi orang lain terbaca, melihat semua pergerakan aset, semua reservasi ruang, semua user (dengan password tidak tapi metadata lengkap), menyerah-terima/mengembalikan pinjaman tanpa jadi pihak berwenang, dan mengubah status tiket sembarangan.

Kekuatan repo: hash PBKDF2-SHA512 + timingSafeEqual, anti-spoofing `x-user-id` → 403, Auditor read-only dipaksa di middleware, anti-collision peminjaman dilindungi trigger database (003), `npm run lint` 0 error, `npm run build` sukses.

**Integritas rantai fitur (UI → API → AuthZ → Bisnis → Persistensi):** Aset ✔, Tiket ⚠ (mass assignment status), Loan ⚠ (handover/return tanpa cek status/aktor), Room ⚠ (race condition), Contract ✖ (persistensi PG rusak; reminder tidak otomatis; email tidak terkirim), Notification ✖ (IDOR).

---

# 2. Critical Findings

| ID | Severity | Area | Finding | Evidence | Impact | Recommendation |
|---|---|---|---|---|---|---|
| CR-01 | 🔴 CRITICAL | AuthN/AuthZ | **switch-role publik + fallback admin**: `/api/auth/switch-role` ada di `PUBLIC_API_PATHS`; handler menyetujui target apa pun (userId/email/name/role) dan `getActor()` fallback ke `db.users[0]` (USR-01 Admin GABAH) saat tanpa token | `server/runtime-hardening.ts` PUBLIC_API_PATHS; `server.ts` handler switch-role + getActor | Caller anonim dapat token Admin penuh (vertical privilege escalation); Auditor bisa lepas read-only dengan switch-role; klien dengan fallback lokal `setCurrentUser(user)` membuat UI seolah berhasil walau server menolak | Hapus dari PUBLIC_API_PATHS; wajibkan sesi valid; batasi target hanya untuk user sendiri atau admin; tolak tanpa sesi (401) |
| CR-02 | 🔴 CRITICAL | Secrets | **Hardcoded role passwords**: `VALID_ROLE_PASSWORDS` di server (AdminGabah#2026, Pangan2026! sebagai fallback universal, dll.) + `defaultPasswordForRole` + 1-Click Login di UI + semua kredensial ditulis di AUDIT_NOTES.md / RBAC.md / UAT.md | `server.ts` (login), `src/components/auth/LoginPage.tsx`, AUDIT_NOTES.md §3 | Siapa pun yang membaca repo/docs login sebagai role apa pun, termasuk Admin; tidak ada rotasi kredensial | Hapus dari kode & UI; password per-user acak saat provisioning; rotasi semua kredensial; hapus/mask dari dokumen |
| CR-03 | 🔴 CRITICAL | Secrets/Persistence | **State file ter-commit dengan sesi hidup**: `server/data/gabah_state.json` di git berisi 9 password_hash + **89 token sesi**; `hydrateDbFromState` memuat `state.sessions` ke `db.sessions` → token committed valid lagi setelah boot | `server/data/gabah_state.json` (HEAD); `server/persistence.ts` hydrate | Pencuri token dari repo = akun sah; bypass seluruh login; jejak audit salah identitas | Untrack file (gitignore), hapus dari history, rotasi token, jangan hydrate sesi dari snapshot; seed data = master data saja |
| CR-04 | 🔴 CRITICAL | Contract/Persistence | **Migrasi 004 tidak pernah berhasil → PostgreSQL mati**: 001 membuat `contracts` versi lama (`owner_division_id BIGINT`, tanpa kolom kontrak) dengan `CREATE TABLE IF NOT EXISTS`; 004 mencoba `CREATE TABLE IF NOT EXISTS contracts` (no-op) lalu `CREATE INDEX idx_contracts_owner ON contracts(owner_division, pic_user_id)` → error kolom tidak ada → `ensureNormalizedSchema()` throw → `initializePersistence()` retry → **fallback file store permanen** | `server/migrations/001_gabah_normalized_schema.sql` (contracts table), `server/migrations/004_contract_management.sql`, `server/persistence.ts` initializePersistence/ensureNormalizedSchema | Skema PG tidak sinkron: backfill `contracts/contract_documents/contract_milestones/contract_notification_logs` selalu ROLLBACK; seluruh data (bukan hanya kontrak) hanya di JSON; klaim PRD "PostgreSQL authoritative" tidak terpenuhi | Perbaiki 004 (mis. ALTER TABLE drop/replace tabel contracts lama + ADD COLUMN; jangan bergantung IF NOT EXISTS), tambah migration ledger, jangan biarkan boot fallback senyap di production (fail-fast) |
| CR-05 | 🔴 HIGH→CRITICAL | Contract Notification | **Reminder tidak otomatis & pengiriman tidak nyata**: satu-satunya jalur adalah `POST /api/contracts/reminders/run` (Admin-only, manual); tidak ada cron/node-cron/setInterval/scheduler; `queueNotification` hanya menulis baris log (`in_app` = 'sent', email/telegram = 'failed' bila env kosong); tidak ada nodemailer/api.telegram.org | `server/contracts.ts` queueNotification/runReminderSweep; grep tanpa hasil untuk scheduler/transport | Kontrak mendekati kedaluwarsa tidak pernah diingatkan otomatis; laporan "sent" menyesatkan operator; kepatuhan kontrak berisiko | Tambahkan scheduler (node-cron atau cron container terpisah); integrasikan provider email & bot Telegram nyata; status = sent hanya setelah delivery sukses |
| CR-06 | 🔴 HIGH | API Security | **Mass assignment & IDOR lintas endpoint**: PATCH `/api/maintenances/:id` & `/api/meeting-rooms/:id` memakai `Object.assign(x, req.body)`; `PATCH /api/tickets/:id/status` menerima status arbitrer tanpa validasi transisi; PATCH `/api/notifications/:id/read` tanpa cek pemilik; `POST /api/users` menyimpan & mengembalikan `temp_password` plaintext; `updateContract` protectedFields tidak mencakup status/restricted/pic_user_id | `server.ts` endpoints; `server/services.ts`; `server/contracts.ts` updateContract | User biasa bisa menimpa field sensitif (role/division/status/approver); tiket bisa dipaksa closed tanpa SLA; notifikasi orang lain bisa dimanipulasi | Whitelist field per endpoint, validasi transisi status server-side, cek ownership di notification, jangan kembalikan plaintext password |

> Catatan severity CR-05/CR-06: CR-05 dinilai CRITICAL untuk konteks kepatuhan kontrak BUMD (klaim fitur vs realita); CR-06 HIGH dengan beberapa sub-item CRITICAL saat dieksploit berantai.

---

# 3. Security Findings

Semua temuan diberi kode + bahasa teknis + bahasa sederhana.

### 🔴 SEC-01 — Public switch-role (CRITICAL)
- **Technical:** `PUBLIC_API_PATHS` memuat `/api/auth/switch-role`; handler menerima `{userId|email|name|role}` tanpa verifikasi sesi; fallback `getActor()` ke `db.users[0]` menghasilkan sesi Admin GABAH.
- **Sederhana:** Orang luar tanpa password bisa "ganti peran" dan langsung mendapat akses Admin hanya dengan satu request HTTP.
- **Rekomendasi:** Wajibkan autentikasi; kembalikan 401 untuk anonim; batasi target; audit-log setiap switch.

### 🔴 SEC-02 — Hardcoded credentials di server & UI (CRITICAL)
- **Technical:** Map `VALID_ROLE_PASSWORDS` (termasuk fallback universal `Pangan2026!`); `defaultPasswordForRole` + tombol 1-Click Login; 9 kredensial didokumentasikan terbuka.
- **Sederhana:** Sandi semua akun tertulis di kode, di layar login, dan di dokumen — siapa pun yang melihat repo bisa masuk sebagai Admin/IT/GA/so on.
- **Rekomendasi:** Hapus dari kode & UI; provisioning password acak per user; force reset pertama login; rotasi semua kredensial; bersihkan dokumen.

### 🔴 SEC-03 — Committed sessions & password hashes (CRITICAL)
- **Technical:** `server/data/gabah_state.json` (tracked) berisi 9 `password_hash`, **89 session tokens**, 0 `temp_password`; `hydrateDbFromState` mengaktifkan kembali token committed.
- **Sederhana:** Data rahasia ikut ter-commit; token lama di file itu masih bisa dipakai masuk setelah server hidup lagi.
- **Rekomendasi:** Untrack + purge history; rotasi semua token; jangan pernah hydrate sesi dari snapshot; snapshot = data master saja.

### 🟠 SEC-04 — IDOR / otorisasi hilang di beberapa endpoint (HIGH)
- **Technical:** `PATCH /api/notifications/:id/read` (tanpa ownership check); `GET /api/movements` (semua pergerakan semua aset, tanpa scoping); `GET /api/room-reservations` (tanpa scoping aktor); `GET /api/users` (metadata seluruh user tanpa filter, tanpa pembatasan role — cocok untuk directory, tapi harus diputuskan); `handoverLoan/returnLoan/checkin/checkout` tanpa cek status & aktor; `POST /api/tickets` menerima `contract_id` tanpa `canSeeContract`.
- **Sederhana:** User A bisa menandai notifikasi user B terbaca, melihat seluruh riwayat pergerakan aset perusahaan, semua reservasi ruang, dan bisa "menyerahkan/mengembalikan" pinjaman orang lain tanpa jadi petugas berwenang.
- **Rekomendasi:** Tambahkan ownership/division check per endpoint; scoping GET list; cek status sebelum mutasi (state machine); validasi kontrak visible sebelum link.

### 🟠 SEC-05 — Mass assignment (HIGH)
- **Technical:** `Object.assign(maintenance, req.body)`; `Object.assign(room, req.body)`; `updateContract` protectedFields tidak melarang `status`, `restricted`, `pic_user_id`, `owner_division`, `documents`, `milestones`; PATCH tiket status arbitrer; `POST /api/users` menerima `temp_password` plaintext dan mengembalikannya di response.
- **Sederhana:** Cukup kirim field tambahan di request body, user biasa bisa mengubah hal yang seharusnya cuma boleh diubah Admin — misal status kontrak, PIC kontrak, atau menutup tiket sendiri.
- **Rekomendasi:** Whitelist field; pisahkan DTO; larang field sensitif; status tiket hanya via transisi valid (open→in_progress→resolved→closed) yang memicu/ Hormati SLA.

### 🟠 SEC-06 — Auth hardening gaps (HIGH)
- **Technical:** Lockout dinonaktifkan saat `NODE_ENV !== 'production'` (`isLoginLocked`); rate limit key dari `x-forwarded-for` (spoofable); login match email **prefix** + alias + role-alias (memungkinkan user enumeration); responder error login membedakan "email tidak dikenal" vs "password salah" (cek kembali).
- **Sederhana:** Di mode development tidak ada batas percobaan login; pembatasan berbasis header IP yang bisa dipalsukan; dan sistem membiarkan penyerang mencoba-coba email sampai menemukan yang valid.
- **Rekomendasi:** Lockout on by default; trusted proxy hanya jika `TRUST_PROXY` diset; balasan login seragam ("email/sandi salah"); monitoring percobaan gagal.

### 🟠 SEC-07 — Race condition double-booking ruangan (HIGH)
- **Technical:** Collision check hanya in-memory (`find()` sebelum push); tidak ada constraint/trigger DB untuk `room_reservations` (kontras dengan loans yang punya trigger 003).
- **Sederhana:** Dua orang yang memesan ruangan yang sama di waktu yang sama pada detik bersamaan bisa sama-sama berhasil → double booking.
- **Rekomendasi:** Constraint DB (EXCLUDE USING gist pada room_id + tsrange) atau trigger analog loans; validasi ulang pada persistensi.

### 🟠 SEC-08 — Contract document upload tanpa file fisik & tanpa validasi (HIGH)
- **Technical:** `POST /api/contracts/:id/documents` hanya menyimpan `file_name` + `file_ref` string dari klien; tidak ada multipart upload, tidak ada MIME/extension/size validation, tidak ada path traversal check (input bebas), tidak ada versi/retensi/delete.
- **Sederhana:** "Upload dokumen kontrak" belum benar-benar mengunggah berkas — hanya mencatat nama file yang diketik user; jadi bisa saja berisi string berbahaya atau menunjuk file yang tidak ada.
- **Rekomendasi:** Implementasi storage nyata (S3/local disk via multer), whitelist MIME & extension, scan ukuran & sanitasi nama file, path terkontrol server-side, kontrol akses download via `canSeeContract`.

### 🟡 SEC-09 — Numbering collision setelah restart (MEDIUM)
- **Technical:** `AssetNumberingEngine` sepenuhnya in-memory; boot hanya `syncFromExistingRecords({tickets, loans})` + `syncFromExistingAssets`; `contractSeq` tidak pernah disinkronkan → setelah restart, nomor kontrak `CTR-YYYY-NNNN` mulai dari 0001 lagi dan bisa menabrak nomor lama (unique index PG akan menolak di PG, tapi file store tidak menolak).
- **Sederhana:** Nomor tiket/pinjaman aman di-recover, tapi nomor kontrak bisa dobel setelah server restart (tabrakan nomor).
- **Rekomendasi:** Sync contractSeq saat boot; idealnya pindahkan semua sequence ke DB (`asset_number_sequences` sudah ada; kontrak ikut pola sama).

### 🟡 SEC-10 — Auditor read-only bekerja, dengan satu celah desain (MEDIUM)
- **Technical:** Middleware memblokir semua non-GET untuk Auditor (403), whitelist `allowedAuditorActions` hanya logout/switch-role/read notifications — benar. Tapi karena switch-role publik (SEC-01), Auditor bisa "keluar" dari read-only via switch-role.
- **Sederhana:** Auditor memang terkunci read-only… kecuali ia memanfaatkan celah alih-peran publik untuk pindah identitas.
- **Rekomendasi:** Perbaiki SEC-01; pertahankan whitelist minimal.

### 🟢 SEC-11 — Hal positif yang terverifikasi
- PBKDF2-SHA512 100k iterasi + timingSafeEqual (`server/crypto.ts`); anti-spoofing `x-user-id` → 403; token 32-byte random; token 7 hari expiry + last_active; Auditor read-only middleware; loan anti-collision DB trigger; unique index corporate asset number; audit trail dibuat untuk mutasi utama; rate limit header; scoping aset/tiket berfungsi sesuai role.

---

# 4. RBAC Matrix

Berdasarkan kode aktual (`server/runtime-hardening.ts`, `server/services.ts`, `server/contracts.ts`, `server.ts`), bukan UI.

Legenda: R=Read, C=Create, U=Update, D=Delete, A=Approve, -=No access. `Own` = hanya milik sendiri/divisinya.

| Modul | Admin GABAH | IT | GA | Supply Chain | PIBC | Karyawan | Auditor | Sekretaris Direksi | Humas |
|---|---|---|---|---|---|---|---|---|---|
| **Asset — Read** | R semua | R IT + read GA/furniture | R GA + read IT (read-only) | R SC | R PIBC | R assigned/loanable saja | R semua | R assigned/loanable | - (katalog disembunyikan) |
| **Asset — Create/Assign/Move/Lifecycle** | CRUD | C/U (IT only) | C/U (non-IT only) | C/U (SC only) | C/U (PIBC only) | - | - (read-only dipaksa) | - | - |
| **Asset — Disposal approval** | A (eksklusif) | - | - | - | - | - | - | - | - |
| **Ticket — Read** | R semua | R IT-category | R GA-category | R SC-category | R PIBC-category | R own (fuzzy reporter match) | R semua | R own | R own |
| **Ticket — Create** | C | C | C | C | C | C | - (403) | C | C |
| **Ticket — Update status/assign** | U semua | U IT-cat | U GA-cat | U SC-cat | U PIBC-cat | - | - | - | - |
| **Ticket — Status transition validity** | ⚠ TIDAK DIVERIFIKASI di server (arbitrary status diterima) — temuan SEC-05 | ⚠ | ⚠ | ⚠ | ⚠ | - | - | - | - |
| **Loan — Request** | C | C | C | C | C | C | - (403) | C | C |
| **Loan — Approve/Reject** | A semua | A (aset IT) | A (aset GA) | A (aset SC) | A (aset PIBC) | - | - | - | - |
| **Loan — Handover/Return** | U semua | U (aset IT) | U (aset GA) | U (aset SC) | U (aset PIBC) | - | - | - | - |
| **Loan — Handover/Return otoritas ⚠** | endpoint TANPA cek aktor/status — bisa dipanggil siapa pun untuk pinjaman apa pun (SEC-04) | ⚠ | ⚠ | ⚠ | ⚠ | ⚠ (bocor) | - | ⚠ | ⚠ |
| **Room — Create reservation** | C | C | C | C | C | C (pending GA) | - | C (VIP auto-approve) | C |
| **Room — Approve/Reject** | A | - | A | - | - | - | - | - | - |
| **Room — Check-in/Check-out/Cancel** | U | ⚠ tanpa otorisasi (siapa saja) | ⚠ | ⚠ | ⚠ | ⚠ | - | ⚠ | ⚠ |
| **Room — Update master room** | U | U (Object.assign mass assignment) | U | U | U | U | - | U | U |
| **Contract — Read** | R semua | R own div + non-restricted | R own div + non-restricted | R own div + non-restricted | R own div + non-restricted | R non-restricted (org-wide) | R semua | R non-restricted | R non-restricted |
| **Contract — Create** | C semua | C (own div) | C (own div) | C (own div) | C (own div) | - | - (403) | C (own div) | C (own div) |
| **Contract — Update** | U semua | U (admin/PIC/owner div) | U (PIC/owner div) | U (PIC/owner div) | U (PIC/owner div) | - | - | U (PIC/owner div) | U (PIC/owner div) |
| **Contract — Delete** | TIDAK ADA endpoint delete | - | - | - | - | - | - | - | - |
| **Contract — Renewal decision** | A | - | - | - | - | - | - | - | - |
| **Contract — Reminder sweep** | A (manual run) | - | - | - | - | - | - | - | - |
| **Contract — Documents/Milestones add** | C | C (canEdit) | C (canEdit) | C (canEdit) | C (canEdit) | - | - | C (canEdit) | C (canEdit) |
| **Users — Read** | R | R (semua user metadata) | R | R | R | R | R | R | R |
| **Users — Create/Update/Delete** | CRUD | - | - | - | - | - | - | - | - |
| **Master data (taxonomy/locations/divisions/rooms) — Create/Update/Delete** | CRUD | - | - | - | - | - | - | - | - |
| **Meeting types/facilities CRUD** | CRUD | C/U/D ⚠ (tanpa guard role di handler) | C/U/D ⚠ | C/U/D ⚠ | C/U/D ⚠ | C/U/D ⚠ | - | C/U/D ⚠ | C/U/D ⚠ |
| **Notifications read/unread** | Own | Own ⚠ IDOR (bisa read milik orang lain via PATCH id) | Own ⚠ | Own ⚠ | Own ⚠ | Own ⚠ | Own ⚠ | Own ⚠ | Own ⚠ |
| **Movements — Read** | R semua | R semua ⚠ | R semua ⚠ | R semua ⚠ | R semua ⚠ | R semua ⚠ | R semua | R semua ⚠ | R semua ⚠ |
| **Audit trail & Reconciliation** | R | - | - | - | - | - | R (full) | - | - |
| **Administration panel** | Akses penuh | - | - | - | - | - | - | - | - |

**DECISION REQUIRED:**
1. Kontrak non-restricted terlihat seluruh karyawan (org-wide) — apakah ini diinginkan? Belum ada business rule tertulis yang menyetujui tampilan data vendor/nilai kontrak ke semua staf. Ini DECISION REQUIRED sebelum UAT.
2. `GET /api/users` memperlihatkan metadata seluruh pegawai ke semua role — konfirmasi kebijakan privacy.
3. Sekretaris Direksi & Humas: keduanya bisa create kontrak di divisinya (mewarisi canManageContracts = semua non-Auditor) — konfirmasi apakah dua role protokoler ini memang seharusnya mengelola kontrak.

---

# 5. Contract Management Audit

### 5.1 CRUD
- **Create** ✔ server-side dengan divisinya sendiri (canManageContracts = semua role non-Auditor; Admin bisa semua divisinya; generate `CTR-YYYY-NNNN` + `created_by`). ⚠ Nomor bisa collision setelah restart (SEC-09).
- **Read** ✔ scoped via `canSeeContract` (Admin/Auditor semua; PIC; owner division; non-restricted = org-wide).
- **Update** ✔ tapi `protectedFields` hanya `id/contract_number/created_by/created_at` — field `status`, `restricted`, `pic_user_id`, `owner_division`, `documents`, `milestones` bisa ditimpa via PATCH biasa (SEC-05).
- **Delete** ❌ TIDAK ADA endpoint delete/deactivate. Tidak bisa menghapus kontrak salah entry (harus lewat status terminated — tapi status bisa ditimpa siapa pun berkat SEC-05).
- **Ownership/PIC/division** ✔ tercatat; PIC bisa ditunjuk dari user aktif mana pun.

### 5.2 Visibility & restricted
- restricted=TRUE → hanya Admin, Auditor, PIC, owner division.
- restricted=FALSE → **seluruh karyawan** (org-wide) — DECISION REQUIRED.
- ⚠ restricted flag bisa diubah oleh PIC/owner division sendiri (karena tidak masuk protectedFields) — memungkinkan "un-restrict" kontrak rahasia tanpa approval Admin.
- Tidak ada data leakage antar divisi untuk restricted; tetapi flag-nya sendiri bisa dimanipulasi.

### 5.3 Documents
- Append-only ✔ di level kode (addDocument), tapi **bukan upload fisik** — hanya string `file_name` + `file_ref` dari klien (SEC-08).
- Tidak ada MIME/extension/size/path traversal validation.
- Tidak ada download endpoint; akses dokumen mengikuti canSeeContract (bagus untuk metadata, tapi metadata saja).

### 5.4 Milestones
- Add-only; **tidak ada API untuk menandai milestone selesai** → milestone tersimpan tapi tidak pernah bisa "completed" melalui sistem (INCOMPLETE).
- Reminder milestone (`MILESTONE_DUE`) ada di enum log tetapi tidak dievaluasi dalam sweep — didefinisikan, tidak diimplementasikan (INCOMPLETE).
- Milestone tidak dikonsumsi modul lain (ticket/kontrak tidak terhubung otomatis) — disimpan saja.

### 5.5 Renewal
- `POST /api/contracts/:id/renewal-decision` ✔ outcome divalidasi (renewed/not_renewed/terminated/replaced); `replaced_by_contract_id` dicatat; kontrak lama dipertahankan (audit-friendly) ✔.
- ⚠ Tidak ada enforcement bahwa outcome hanya boleh diubah oleh Admin/owner (endpoint memanggil decideRenewal dengan actor check canEditContract — cukup, tapi tergantung kebenaran canEditContract yang terpengaruh SEC-05).

### 5.6 Reminder
- Sweep logic sendiri ✔ idempotent per (type, day, contract): `EXPIRY_60`, `EXPIRY_35`, `EXPIRY_7`, `NOTICE_DATE`; skip draft/terminated/renewed/not_renewed; auto-renewal mengubah salam ke "perpanjangan otomatis" ✔.
- ❌ **Tidak ada scheduler**: satu-satunya trigger adalah POST manual `/api/contracts/reminders/run` (Admin-only). Tidak ada cron/node-cron/setInterval/systemd/container cron (CR-05) → 🔴 HIGH — REMINDER NOT AUTOMATED.
- Threshold configurable per kontrak (default 60/35/7) ✔.

### 5.7 Email
- ❌ NOT ACTUAL DELIVERY. Tidak ada nodemailer / SMTP client / API call. `queueNotification` hanya INSERT log; status email/telegram = 'failed' bila env kosong, 'sent' untuk in_app tanpa benar-benar mengirim apa pun.
- Recipient mapping (PIC + owner division + escalation user) ✔ dirancang benar di level data; hanya transport yang tidak ada.

### 5.8 Telegram
- ❌ NOT ACTUAL DELIVERY. Tidak ada `api.telegram.org`, tidak ada bot API call, tidak ada mapping chat_id per user (field `telegram_chat_id` tidak ada di user model). Token env `TELEGRAM_BOT_TOKEN` dibaca tapi tidak pernah dipakai mengirim.

### 5.9 Scheduler
- ❌ TIDAK ADA. Tidak ada cron, node-cron, setInterval untuk reminder, systemd timer, container cron terpisah, atau external scheduler. (grep terverifikasi).

### 5.10 Audit
- ✔ contract create/update/document/milestone/renewal semua memanggil recordAudit; notification log tersimpan per channel.
- ⚠ Audit log tidak immutable di PG (table audit_logs tanpa trigger proteksi), tapi ini masalah umum bukan spesifik kontrak.

### 5.11 Persistensi kontrak ke PostgreSQL
- ❌ **RUSAK** (CR-04): migrasi 004 selalu gagal pada index `idx_contracts_owner` karena tabel `contracts` lama (001) tidak punya kolom tersebut; seluruh backfill normalized ROLLBACK; kontrak hanya hidup di JSON file + memory.
- `tickets.contract_id` ✔ ada di kode & di migrasi 004 (ALTER TABLE tickets ADD COLUMN) — tapi karena 004 gagal jalan, kolom ini juga tidak akan ada di PG sampai 004 diperbaiki.

---

# 6. Persistence Audit

Klasifikasi per fitur — di mana data benar-benar disimpan.

| Fitur | PostgreSQL | JSON (gabah_state.json) | Memory | Mock/Seed | Status |
|---|---|---|---|---|---|
| Users (9 canonical) | ⚠ hanya jika PG hidup (kini mati, CR-04) | ✔ | ✔ | ✔ CANONICAL_USERS auto-merge saat boot | Hybrid, PG mati |
| Sessions/token | ⚠ | ✔ (89 committed!) | ✔ | - | 🔴 sesi valid dari snapshot |
| Assets | ✔ skema ✔ | ✔ | ✔ | ✔ seed 20+ | Hybrid |
| Asset movements | ✔ | ✔ | ✔ | - | Hybrid |
| Assignments | ✔ | (dalam asset JSON) | ✔ | - | Hybrid |
| Loans | ✔ + trigger anti-collision | ✔ | ✔ | seed | Hybrid |
| Tickets | ✔ (+ kolom contract_id setelah 004 diperbaiki) | ✔ | ✔ | seed | Hybrid |
| Ticket comments | Tidak ada persistensi khusus (komposisi di memori) | ✔ | ✔ | - | ⚠ Memory-only path |
| Notifications | ✔ | ✔ | ✔ | seed | Hybrid |
| Maintenance records | ✔ | ✔ | ✔ | - | Hybrid |
| Meeting rooms & reservations | ❌ TIDAK ADA tabel room_reservations di migrasi mana pun | ✔ | ✔ | seed | 🟠 JSON+memory only |
| Meeting types/facilities | ❌ TIDAK ADA tabel | ✔ | ✔ | seed | 🟠 JSON+memory only |
| Contracts | ❌ GAGAL (CR-04) | ✔ | ✔ | - | 🔴 rusak |
| Contract documents | ❌ GAGAL | ✔ | ✔ | - | 🔴 rusak |
| Contract milestones | ❌ GAGAL | ✔ | ✔ | - | 🔴 rusak |
| Contract notification logs | ❌ GAGAL | ✔ | ✔ | - | 🔴 rusak |
| Audit logs | ✔ | ✔ | ✔ | - | Hybrid |
| Numbering sequences (asset) | ✔ tabel asset_number_sequences ADA tapi TIDAK DIPAKAI oleh engine | - | ✔ in-memory Maps | - | 🟠 memory-authoritative |
| Ticket & loan numbering | - | - | ✔ (synced at boot) | - | 🟠 memory (ter-sync) |
| Contract numbering (CTR) | - | - | ✔ (TIDAK ter-sync) | - | 🔴 collision risk |
| Divisions (master, dari migrasi) | ✔ seed 4 | - | - | - | ⚠ tidak sinkron dgn divisions dinamis di app |

**Ringkasan bahasa sederhana:** Kalau PostgreSQL tidak jalan, aplikasi tetap hidup dari file JSON — itu memang disengaja. Tapi kebalikannya juga terjadi: karena bug migrasi (CR-04), meski PostgreSQL jalan pun, data kontrak dan ruang rapat **tetap hanya** hidup di file JSON, bukan di database. Ini menyalahi klaim PRD "PostgreSQL authoritative".

**Fallback behavior:** PG gagal saat boot → retry 2x (dev) / 5x (prod) → fallback file store + warning log (bukan fatal). Untuk production, fallback senyap ini berbahaya: operator bisa tidak sadar bahwa DB utama mati berminggu-minggu.

---

# 7. API Authorization Audit

Daftar endpoint dengan otorisasi lemah/tidak ada. (Semua endpoint lain sudah diverifikasi punya `getActor()` + guard role.)

| Endpoint | Method | Masalah | Severity |
|---|---|---|---|
| `/api/auth/switch-role` | POST | Di PUBLIC_API_PATHS; target bebas; fallback db.users[0]=Admin (CR-01) | 🔴 CRITICAL |
| `/api/notifications/:id/read` | PATCH | Tidak ada ownership check — siapa pun bisa mark milik orang lain | 🟠 HIGH |
| `/api/movements` | GET | Semua pergerakan aset perusahaan untuk semua role, tanpa scope | 🟠 HIGH |
| `/api/room-reservations` | GET | List semua reservasi (termasuk divisinya orang lain) tanpa scope | 🟠 MEDIUM |
| `/api/users` | GET | Metadata seluruh user ke semua role (perlu keputusan kebijakan) | 🟡 MEDIUM |
| `/api/loans/:id/handover` | POST | Tidak cek status pinjaman & tidak cek aktor berwenang | 🟠 HIGH |
| `/api/loans/:id/return` | POST | Sama: tidak cek status & aktor; kondisi barang bebas | 🟠 HIGH |
| `/api/room-reservations/:id/checkin` / `checkout` | POST | Tidak cek organizer/status/waktu | 🟠 MEDIUM |
| `/api/tickets/:id/status` | PATCH | Arbitrary status (bypass SLA), tidak ada state machine | 🟠 HIGH |
| `/api/tickets` (POST) | POST | `contract_id` diterima tanpa cek canSeeContract | 🟠 MEDIUM |
| `/api/maintenances/:id` | PATCH | Object.assign mass assignment | 🟠 HIGH |
| `/api/meeting-rooms/:id` | PATCH | Object.assign mass assignment (updateMeetingRoom) | 🟠 HIGH |
| `/api/meeting-types` & `/api/meeting-facilities` CRUD | POST/PATCH/DELETE | Handler hanya getActor, service menerima role apa pun (non-auditor) — master data bisa diubah user biasa | 🟠 MEDIUM |
| `/api/users` | POST | Menerima & mengembalikan temp_password plaintext | 🟠 HIGH |
| `/api/contracts/:id` | PATCH | protectedFields terlalu sempit (status/restricted/pic bisa ditimpa) | 🟠 HIGH |
| `/api/contracts/:id/documents` | POST | Tidak ada file validation (SEC-08) | 🟠 HIGH |
| `/api/taxonomy/resolve` | POST | Butuh auth ✔ tapi Auditor diblok (403) walau read-only — inkonsisten minor | 🟢 LOW |

Yang **sudah benar**: `/api/audit-logs` & `/api/reconciliation` (Admin+Auditor), asset detail scoping, asset create/assign/move/lifecycle role checks, disposal approval Admin-only, approve/reject loan by owner division, reminder sweep Admin-only, users CUD Admin-only, master data Admin-only, Auditor global read-only middleware, anti-spoofing x-user-id.

---

# 8. 36 Commit Review

Timeline (terlama → terbaru). Status: GOOD-SAFE / NEEDS UAT / RISK / REDUNDANT / INCOMPLETE.

| # | Commit | Perubahan | Area | Risk | Status |
|---|---|---|---|---|---|
| 1 | `f14d6cc` | Initial commit (React+Vite+Express, mock data) | All | Low | GOOD-SAFE |
| 2 | `d101bcd` | Init project config & deployment (compose, .env.example) | Infra | Low | GOOD-SAFE |
| 3 | `e117194` | PostgreSQL persistence & security (dual persistence, crypto) | DB/Auth | Medium — fallback file aktif | NEEDS UAT |
| 4 | `86514d4` | Refactor auth flow & user mgmt (Bearer, lockout) | Auth | Medium — lockout off di dev | NEEDS UAT |
| 5 | `6762225` | User simulation & robust DB config (switch-role) | Auth | 🔴 High — bermuara ke CR-01 | RISK |
| 6 | `3274ef4` | Delete opt directory | Cleanup | Low | REDUNDANT |
| 7 | `d3b7990` | Dynamic asset categories (taxonomy engine) | Asset | Low | GOOD-SAFE |
| 8 | `a8be0bd` | Null-safety checks component props | Frontend | Low | GOOD-SAFE |
| 9 | `b69149b` | Expand room reservation & user roles (9 roles) | Room/RBAC | Medium | NEEDS UAT |
| 10 | `6f47b51` | Auditor role access ke administration module | RBAC | Low | GOOD-SAFE |
| 11 | `0fa1490` | Update meeting room data & reservation UI | Room | Low | GOOD-SAFE |
| 12 | `38d340e` | API rate limiting & auth security | Auth | Medium — IP spoofable | NEEDS UAT |
| 13 | `7d13e3d` | Master data mgmt categories & locations | Master data | Low | GOOD-SAFE |
| 14 | `ae7e102` | Refactor user management & auth (canonical users) | Auth | Medium | NEEDS UAT |
| 15 | `fc915e1` | Archive stale Laravel mock modal | Cleanup | Low | REDUNDANT |
| 16 | `784dd68` | Remove Laravel UI/stale refs | Cleanup | Low | REDUNDANT |
| 17 | `8f2be17` | Remove Laravel navbar CTA | Cleanup | Low | REDUNDANT |
| 18 | `897b89a` | Remove Laravel sidebar refs | Cleanup | Low | REDUNDANT |
| 19 | `7db37f3` | Remove unused Laravel architecture UI | Cleanup | Low | REDUNDANT |
| 20 | `44b27fa` | Remove obsolete Laravel backend audit | Docs | Low | REDUNDANT |
| 21 | `88839d4` | Remove obsolete Laravel backend reference | Docs | Low | REDUNDANT |
| 22 | `537f614` | Remove obsolete Laravel architecture references | Docs | Low | REDUNDANT |
| 23 | `3acb5f6` | Align current-state audit w/ Node/Express/PG | Docs | Low | GOOD-SAFE |
| 24 | `0f9942a` | Allow Docker PostgreSQL hostname in persistence | Infra | Low | GOOD-SAFE |
| 25 | `7ee780a` | Refine ticket visibility, remove legacy refs | Ticket/RBAC | Medium | NEEDS UAT |
| 26 | `fa8bbc1` | Docs source of truth | Docs | Low | GOOD-SAFE |
| 27 | `06d5b0f` | Docs source of truth | Docs | Low | REDUNDANT (duplikat) |
| 28 | `c99dec6` | Docs source of truth | Docs | Low | REDUNDANT (duplikat) |
| 29 | `5078795` | Docs source of truth | Docs | Low | REDUNDANT (duplikat) |
| 30 | `747e13f` | Docs source of truth | Docs | Low | REDUNDANT (duplikat) |
| 31 | `de83074` | Asset-linked ticketing & role restrictions | Ticket/RBAC | Medium | NEEDS UAT |
| 32 | `a2c4b83` | Loan rejection flow + RBAC PIBC/SC/Auditor | Loan/RBAC | Medium — rejection path perlu UAT end-to-end | NEEDS UAT |
| 33 | `14b8041` | Live SLA timer + per-asset history timeline (SlaTimer.tsx) | Ticket/UI | Medium — client-side countdown only | NEEDS UAT |
| 34 | `610c899` | **Contract Management domain + restrict ticket categories** (contracts.ts, ContractsView, modal, migrasi 004, ticket categories) | Contract/DB | 🔴 High — migrasi 004 gagal jalan (CR-04); reminder manual-only (CR-05); no real email | RISK + INCOMPLETE |

**Pola yang terlihat:** 6+ commit docs/cleanup beruntun (REDUNDANT), fitur besar terakhir (contract) masuk dengan migrasi yang tidak pernah tervalidasi terhadap skema existing — indikasi kuat tidak ada migration-testing di pipeline.

---

# 9. Documentation Consistency

| Document | Status | Problem |
|---|---|---|
| `README.md` | STALE/CONTRADICTORY | Klaim "SHA-256 + salt" (aktual: PBKDF2-SHA512 100k); klaim "16 tabel normalized" (aktual 13 tabel + gabah_state; kontrak/rooms tidak ter-backfill); klaim "Authoritative Database PostgreSQL" tidak terpenuhi saat ini (CR-04) |
| `PRD.md` | STALE/CONTRADICTORY | Klaim persistence PostgreSQL authoritative (aktual: JSON blob utama karena CR-04); klaim "Konfigurasi SLA & Kebijakan Sistem" di admin panel (tidak diimplementasikan); klaim notifikasi otomatis reservasi (in-app saja, tanpa email) |
| `PROJECT-RULES.md` | PARTIALLY CURRENT | Aturan "Request tanpa token tidak pernah di-fallback menjadi Super Admin" — **CONTRADICTORY** dengan getActor fallback (CR-01); aturan lain (server-authoritative, numbering, rate limit header) sesuai |
| `AUDIT_NOTES.md` | CURRENT tapi berbahaya | Dokumentasi kredensial 9 akun + alias + password lengkap; mengakui mode "development unrestricted"; bagus sebagai changelog, berbahaya sebagai repo publik |
| `GABAH-CURRENT-STATE-AUDIT.md` | CONTRADICTORY | "Final application roles: 7" (aktual: 9 login roles, code masih punya Sekretaris Direksi & Humas); klaim PG authoritative (CR-04) |
| `docs/architecture/RBAC.md` | MOSTLY CURRENT | Matrix selaras implementasi; tapi menuliskan semua password default (SEC-02); klaim "Auditor strictly read-only" lemah karena switch-role publik |
| `docs/architecture/API-DESIGN.md` | MOSTLY CURRENT | Contract API terdokumentasi (2.9b) sesuai; perlu catatan restricted=org-wide decision |
| `docs/architecture/DATABASE-DESIGN.md` | STALE | Tidak mencakup migrasi 004; tidak menyebut tabel contract_*; tidak mencatat masalah kompatibilitas 001 vs 004 |
| `docs/architecture/ARCHITECTURE.md` | MOSTLY CURRENT | Diagram arsitektur sesuai; "PBKDF2/SHA-256" ambigu (aktual sha512) |
| `docs/architecture/DECISIONS.md` | CURRENT | ADR-006 sesuai implementasi anti-spoofing |
| `docs/product/BUSINESS-RULES.md` | MOSTLY CURRENT | BR-06 contract rules sesuai; "Reminder dikirim ke PIC+divisi (bukan broadcast)" ✔ di data, tapi transport tidak ada; "saluran email/telegram" menyesatkan |
| `docs/product/REQUIREMENTS.md` | MOSTLY CURRENT | FR sesuai; perlu penambahan FR reminder automation |
| `docs/testing/UAT.md` | INCOMPLETE | Tidak ada skenario uji kontrak/reminder/renewal; menuliskan password default terbuka; tidak ada test untuk migrasi 004 |
| `docs/asset/ASSET-NUMBERING.md` | CURRENT | Sesuai implementasi numbering engine (dengan caveat sequence in-memory) |
| `docs/design/DESIGN-SYSTEM.md` | CURRENT | Warna/typography sesuai kode |
| `.env.example` | CURRENT | Varibel PG lengkap; tidak ada secret nyata ✔ |

---

# 10. Test Results

Perintah yang dijalankan pada audit ini (tanpa mengubah kode):

| Command | Hasil |
|---|---|
| `npm install` | ✔ Sukses (lockfile npm) |
| `npm run lint` (`tsc --noEmit`) | ✔ **0 error** |
| `npm run build` (`vite build && node scripts/build-server.cjs`) | ✔ **Sukses** (frontend 884 kB chunk warning non-fatal; backend bundled "with PostgreSQL persistence, numbering recovery and API hardening") |
| `npm test` | Tidak tersedia (tidak ada test runner di package.json) |
| `docker compose config` / `docker compose build` | ⚠ Tidak dijalankan — `docker` tidak tersedia di environment audit |
| Migration validation (statis) | ❌ **GAGAL (analisis statis)** — 004 vs 001 incompatible pada `contracts.owner_division` (CR-04) |
| `git rev-list --count HEAD` | 36 commit ✔ |
| Inspeksi `gabah_state.json` (HEAD) | 9 password_hash, **89 session tokens**, 0 temp_password, tidak ada `contracts` key (snapshot pra-kontrak) |

Catatan build: chunk >500 kB hanya warning Vite, bukan error. Tidak ada unit/integration test yang bisa dijalankan; verifikasi dilakukan lewat lint, build, dan analisis statis kode.

---

# 11. Recommended Fixes

### P0 — WAJIB sebelum production (juga sebelum UAT internal yang melibatkan data sensitif)
1. **CR-01:** Keluarkan `/api/auth/switch-role` dari `PUBLIC_API_PATHS`; tolak anonim (401); batasi target (self atau Admin); log audit.
2. **CR-02:** Hapus `VALID_ROLE_PASSWORDS`, `defaultPasswordForRole`, tombol 1-Click Login; rotasi semua 9 kredensial; hapus kredensial dari AUDIT_NOTES/RBAC/UAT docs.
3. **CR-03:** Untrack `server/data/gabah_state.json`; purge dari git history; rotasi/invalidasi 89 token; larang hydrate sessions dari snapshot.
4. **CR-04:** Perbaiki migrasi 004 agar idempotent terhadap skema 001 (rebuild tabel `contracts` + ALTER); tambah migration ledger (versi terpakai); fail-fast bila migrasi gagal di production (jangan fallback senyap).
5. **CR-06/SEC-05:** Whitelist field untuk PATCH maintenance/room/contract; validasi transisi status tiket; ownership check notifications; jangan kembalikan temp_password.

### P1 — WAJIB sebelum UAT selesai
1. **CR-05:** Scheduler reminder kontrak (node-cron atau cron container terpisah) + integrasi email & Telegram nyata dengan delivery status + retry.
2. **SEC-04:** Tambahkan otorisasi pada handover/return/checkin/checkout + ownership notifications + scoping movements & reservations + canSeeContract check pada ticket contract_id.
3. **SEC-07:** Anti double-booking room di level DB (constraint/trigger) seperti loans.
4. **SEC-08:** Upload dokumen kontrak nyata (storage + MIME/size/path validation + access control download).
5. **SEC-09:** Sync contractSeq saat boot (dan idealnya pindahkan sequence ke DB).
6. **SEC-06:** Lockout aktif juga di non-dev; trusted proxy; respons login seragam.

### P2 — Setelah stabil
1. Kontrak non-restricted org-wide: putuskan & dokumentasikan (DECISION REQUIRED) atau default restricted.
2. Milestone completion API + evaluasi MILESTONE_DUE dalam sweep; hubungkan milestone dengan tiket.
3. Contract delete/deactivate endpoint (soft-delete dengan audit).
4. Persistensi room reservations & meeting master ke PG (tabel baru + backfill).
5. Ganti pencocokan reporter tiket fuzzy (`reporter_name.includes`) dengan ID.
6. Rate limit key dari `req.ip` + TRUST_PROXY eksplisit.
7. Migrasi numbering sequences penuh ke DB (`asset_number_sequences` sudah ada, gunakan).
8. Dockerfile proper (multi-stage, non-root, healthcheck), PORT env-aware, jangan `npm install` saat run container.
9. Tambah test suite minimal (auth, RBAC matrix, loan collision, contract reminder sweep, migration smoke test).

### P3 — Improvement
1. Split bundle frontend (lazy load modul) — warning chunk 884 kB.
2. Konsistensi dokumen (README/PRD/DATABASE-DESIGN) dengan implementasi setelah fix; tambahkan versi skema.
3. Audit log append-only di DB (trigger proteksi UPDATE/DELETE).
4. Observability: alerting ketika persistence fallback aktif; metrics delivery email/telegram.
5. Hapus mock data yang overlap dengan API live di frontend untuk hindari kebingungan data.
6. Tambah CSP/secure headers di Express (helmet), refresh token rotation.

---

# 12. Final Release Gate

# **NOT READY**

Alasan ringkas (bahasa sederhana):
1. Ada jalur tanpa password untuk mendapatkan akses Admin (CR-01).
2. Semua kata sandi akun tertulis di kode, UI, dan dokumen (CR-02).
3. Token sesi hidup ter-commit ke git dan otomatis valid lagi setelah restart (CR-03).
4. PostgreSQL tidak akan pernah aktif dengan skema saat ini — data kontrak/ruang rapat hanya di file JSON, menyalahi PRD (CR-04).
5. Reminder kontrak tidak berjalan otomatis dan email/Telegram tidak pernah benar-benar terkirim (CR-05).
6. Banyak endpoint dapat dimanipulasi field-nya atau diakses milik orang lain (CR-06, SEC-04/05).

Gate akan dipertimbangkan naik ke **PASS WITH CONDITIONS** setelah: semua P0 selesai + verifikasi migrasi 004 terbukti jalan + reminder otomatis terbukti terkirim (P1). **PASS** hanya setelah P0+P1 selesai dan UAT per-role lulus.

---

*Akhir laporan — dibuat untuk review pemilik repository sebelum keputusan perbaikan. Tidak ada perubahan kode yang dilakukan dalam audit ini.*
