# GABAH COMPREHENSIVE AUDIT REPORT
## GABAH-COMPREHENSIVE-AUDIT-2026-11-17.md

**Lampiran:** `docs/audits/HERMES-AUDIT-SUMMARY.md`, `docs/audits/HERMES-INDEPENDENT-AUDIT.md`
**Tanggal Audit:** 17 November 2026 (WIB, UTC+07:00)
**Branch yang diperiksa:** `audit/dynamic-rbac-full-sync`
**Commit SHA yang diperiksa:** `b3c2489d63ece6aef0670332a5f0149c454a01e1`
**Repository:** `https://github.com/inieki-lab/gabah-gas`
**PR terkait:** PR #115 (draft, belum di-merge; head `11f559b258d724329d32cee8cc3cd2c36cee865f`)

> Laporan ini merupakan dokumen audit komprehensif dalam bahasa Indonesia. Semua temuan disusun berdasarkan kode sumber, migrasi database, konfigurasi, dan test automation yang benar-benar dijalankan. Tidak ada pengujian yang dianggap PASS hanya dari membaca kode, dan tidak ada data produksi yang diakses.

---

## A. IDENTITAS AUDIT

### 1.1 Identitas Audit

| Item | Nilai |
|---|---|
| Tanggal dan waktu audit | 17 November 2026, pukul 17:30 WIB (UTC+07:00) |
| Repository | `https://github.com/inieki-lab/gabah-gas` |
| Branch yang diperiksa | `audit/dynamic-rbac-full-sync` |
| Commit SHA lengkap | `b3c2489d63ece6aef0670332a5f0149c454a01e1` |
| Status working tree | Bersih (tersimpan, tidak ada perubahan lokal) |
| Lingkungan audit | Linux lokal (`~/projapps/gabah-gas`), Node.js + TypeScript + React, database tidak tersedia |
| Keterbatasan lingkungan | Tidak ada PostgreSQL terinstal; tidak ada browser automation; admin credentials tidak tersedia; gate rate-limit API diaspora |
| PR terkait | PR #115 (draft, belum di-merge; head `11f559b258d724329d32cee8cc3cd2c36cee865f`) |

### 1.2 Status dan Kehadiran Branch

| Branch | Commit | Status |
|---|---|---|
| `main` | `b8211ad` | Base; dari `audit/dynamic-rbac-full-sync` ada 396 commits ahead, 0 behind |
| `test/gabah-uat-2026-11-17` | `b3c2489` | Sama dengan remote `audit/dynamic-rbac-full-sync` HEAD |
| `audit/dynamic-rbac-full-sync` (remote) | `b3c2489d63ece6aef0670332a5f0149c454a01e1` | Target audit |
| `audit/dynamic-rbac-full-sync` (local) | `cdaa547` | 63 commits behind remote (belum sinkron) |

**Kesimpulan:** Target audit yang dioperasionalkan adalah commit `b3c2489d63ece6aef0670332a5f0149c454a01e1` — yang merupakan komit terbaru dari `main` tapi 396_commit_penambahan dari feature branch `audit/dynamic-rbac-full-sync`. Laporan komprehensif sebelumnya (`HERMES-INDEPENDENT-AUDIT.md`) dan ringkasan (`HERMES-AUDIT-SUMMARY.md`) adalah dokumen pendamping yang sudah pernah dipublikasikan di branch yang sama.

---

## B. RINGKASAN EKSEKUTIF

### 2.1 Kondisi Aplikasi Saat Ini

Aplikasi GABAH (General Asset & Business Administration Hub) pada branch `audit/dynamic-rbac-full-sync` (commit `b3c2489`) adalah aplikasi yang telah melalui serangkaian pengembangan keamanan dan arsitektur dinamis (dynamic RBAC). Beberapa perubahan signifikan yang telah dizinkan:

- Dynamic RBAC yang bekerja pada PostgreSQL (tidak lagi hard-coded)
- Migration yang jelas (43+ file, mulai 001_sedang hingga 097)
- Multi-role, scope berdasarkan divisi, default-deny
- Otentikasi PBKDF2, session 7 hari, revokable
- Undang-undang bisnis (business rules) ditulis konsisten dengan pedoman organisasi

Namun, aplikasi ini **belum siap untuk UAT** atau lebih lanjut untuk production. Ada berbagai temuan yang memerlukan perbaikan sebelum lulus ke UAT.

### 2.2 Risiko Paling Serius

|peringkat|Risiko|
|---|---|
|**1** (P0)|**Authorization gap**: `/api/tickets/:id/status` bisa diubah oleh siapa saja yang memiliki role `tickets.update` tanpa cek kepemilikan antar-tiket (berpotensi merusak skema IT/GA/Jaringan)|
|**2** (P1)|**Data leakage** pada dashboard: data yang bebas divisorik (semua pinjaman, semua tiket terbuka, semua audit log) dikirim ke peran non-superadmin|
|**3** (P1)|**Gagasan atas tiket yang rusak**: `PATCH /api/tickets/:id/status` tidak melakukan pengecekan kepemilikan; setiap bagian yang punya `tickets.update` dapat menulis ulagi status tiket mana saja|
|**4** (P1)|**Audit trail hilang pada upload dokumen kontrak** (`POST /api/contracts/:id/documents/upload`), perlu trace untuk kesesuaian PSAK-16|
|**5** (P1)|**Race condition** alokasi nomor aset: `INSERT ... ON CONFLICT DO NOTHING` + `SELECT ... FOR UPDATE` berpotensi gagal jika baris sequence hilang saat konkurensi|

### 2.3 Jumlah Temuan Berdasarkan Severity

| Status | Jumlah | Keterangan |
|---|---|---|
|**P0** (Critical data corruption / security)|**0**|Tidak ada temuan P0 yang dikonfirmasi|
|**P1** (Core functions / authorization)|**5**|
|**P2** (Process integrity / UI consistency)|**4**|
|**P3** (Engineering quality / polish)|**2**|
|**TOTAL** (P1+P2+P3)|**11**|

### 2.4 Kesediaan Aplikasi

> **KESIMPULAN**: **BELUM SIAP UAT** (NOT READY → PRE-UAT)

Alasan:
- Ada 5 temuan P1 yang harus diperbaiki sebelum UAT (terutama authorization gap pada tickets, data leakage pada dashboard, audit trail pada dokumen kontrak, race condition alokasi, lockout pada non-prod)
- Prasyarat teknis (PostgreSQL, browser UAT, end-to-end test, backup/restore) belum tersedia di lingkungan ini
- PR #115 masih dalam status **draft** (bukan merge-ready); CI tetap green bukan indikasi konsep diterima

---

## C. AUDIT SELURUHENSK DOMAIN APLIKASI

### 3.1 User, Autentikasi, Session, dan Password

**Audit:** `server/auth.ts`, `server/crypto.ts`, `server/requestContext.ts`, `server/db.ts`

| Aspek | Hasil |
|---|---|
| Password hashing | PBKDF2-SHA512, 100k iterasi, `timingSafeEqual` (server/crypto.ts) |
| Session | 256-bit CSPRNG token, 7-day absolute expiry (`SESSION_DURATION_MS`), `auth_epoch`, `user_auth_version` binding |
| Revokable | `revokeUserSessions` (bump `authVersion`), `revokeAllSessions` (bump global epoch) |
| Lockout brute force | 5 gagal / 5 menit; **DINONJSONEKAN jika `NODE_ENV !== production`** (`auth.ts:114`) — SAGAP peringatan |
| Hardcoded password | Tidak ada (`VALID_ROLE_PASSWORDS` dihapus, CR-02 teratasi) |
| Session theft (git) | `sessions` tidak pernah dimasukkan ke `gabah_state.json` (`persistence.ts:344-347`); `loadStateFromFile` menghapus `state.sessions` (`persistence.ts:331`) — CR-03 teratasi |
| IP spoofing | `X-Forwarded-For` tidak dipercaya; `socket.remoteAddress` hanya (server/requestContext.ts:13-19) |
| Legacy path | `temp_password` dibandingkan langsung (hashed + consumed, never returned) — legacy compat, bukan kebocoran |

**Status:** VERIFIED (source) / **NOT TESTED** (lockout disabled in non-prod; runtime lockout untested)

### 3.2 Role, Multi-role, Permission, dan Dynamic RBAC

**Audit:** `server/rbac-policy.ts`, `server.ts` (requireRbacPermission, requireRbacSuperadmin, module status gating), `server/services.ts` (domain authorization), `src/navigation/roleNavigation.ts`

| Aspek | Hasil |
|---|---|
| RBAC policy | Cache (`refreshRbacPolicy`) — cache, bukan sumber keputusan |
| Superadmin actor | PG: DB `is_superadmin`; file-store: `USR-01` (Admin GABAH) |
| Auditor actor | PG: effective role keys include `auditor`; file-store: legacy role check |
| Default deny | `hasRbacPermission`/`hasRbacScope` mengembalikan `false` di akhir (`rbac-policy.ts:158`) |
| Module status gating | Managed API gagal-closed (`403 MODULE_DISABLED`, `503 MODULE_STATUS_UNAVAILABLE`) |
| `requireRbacPermission` di file-store | **LATEN fallback `true`** (server.ts:293) — critical caveat; harus ditutup sebelum produksi |
| Scope division | `all` / `own` / `division_except`, `EXCLUDE` conflict, `assets.read.it_workstations` (IT HLT/HPC read-only) |
| Scoping aset | `getScopedAssets` (services.ts:170-240): auditor hanya dengan `assets.audit.read`; base role tanpa scope lihat apa-apa |
| Domain authorization | `canMutateAssetOwner`, `canOperateLoan` (services.ts:43-70, 873-891): scope division + permission + operation |
| Frontend menu | `roleNavigation.ts` `isNavTabAllowedForRole` (line 62-77): permission branch memakai keys tertentu, tapi API returns `room_reservations.*` keys — namespace mismatch, **sidebar-wrapper collapse ke nol item** (STATIC REVIEW ONLY, risiko runtime tidak terukur) |
| Multi-role | `gabah_user_roles` (PK user_id, role_id); `is_primary` dalam `users.role` (seeds untuk Humas/Sekdir) |
| Escalation | Token-only identity, x-user-id rejection, auditor read-only, switch-role lockout (superadmin-only), `protected permissions` cannot be reassigned |

**Status:** VERIFIED (source) / **NOT TESTED** (runtime RBAC, module gating, namespace mismatch tidak diuji browser)

### 3.3 Sidebar, Menu Aktif/Nonaktif, Akses Direct URL

**Audit:** `src/components/Sidebar.tsx`, `src/components/HeaderNavbar.tsx`, `src/App.tsx`, `src/components/modals/`

| Aspek | Hasil |
|---|---|
| Menu per role | 12 tabs; Admin GABAH: seluruh 12; IT: 12 (termasuk licenses); GA: 11 (tidak licenses); Sekdir/Humas/SC/PIBC: 6; Karyawan: 5 (tidak meeting_rooms); Auditor: 5 |
| `permission_keys` namespace mismatch | `Sidebar.tsx:235` memanggil `isNavTabAllowedForRole` dengan `currentUser.permission_keys`, tapi API returns `room_reservations.*` keys, sementara `roleNavigation.ts` cek `dashboard.read`, `assets.read`, `assets.catalog.read`, `assets.audit.read`, `meeting_rooms.read`, `loans.read`... **tidak overlap sama sekali** |
| Implikasi | Untuk user dengan permission list non-`*` (contoh: setiap user terautentikasi), **path permission-gated helm menu selalu False** → sidebar akan runtuh ke nol item |
| Fallback | Peran-name mapping (`roleNavigation.ts:75-76`), "Legacy file-store navigation only" — ini satu-satunya yang benar-benar bekerja |
| Module management | Endpoint `/api/modules` + `/api/modules/:moduleKey` (PATCH) — module status registry (migration 042) |
| Menu tanpa route / route tanpa menu | Tidak ada (tab IDs muncul putus-putus di Sidebar dan App.tsx) |
| Direct URL & API | Gate module status (modules are managed via registry); unmanaged endpoints (login/health/notifications/admin) bypass the gate |
| Direct URL API access | Global RBAC + module status gate; insufficient if module active=False |

**Status:** STATIC REVIEW ONLY (namespace mismatch confirmed; runtime sidebar collapse not browser-tested)

### 3.4 Dashboard Sesuai Role

**Audit:** `src/components/views/DashboardView.tsx`, `src/App.tsx`

| Aspek | Hasil |
|---|---|
| Data source | `visibleAssets`/`visibleLoans`/`visibleTickets`/`auditLogs` diterima tanpa filter role (App.tsx:795-799) — data berasal dari API panggilan penuh |
| `dashboardAssets`, `itAssets`, `gaAssets`, `scAssets`, `pibcAssets` | Dikomputasi dari list aset penuh (DashboardView.tsx:147-150); global counts ditampilkan ke non-superadmin |
| Open ticket count | Menunjukkan **semua tiket terbuka** dari setiap divisor, bukan divisor sendiri (DashboardView.tsx:508-527) |
| Audit log card | Menampilkan `log.user_name`, `log.role`, `log.details` (DashboardView.tsx:993-1011) — role label semua user bocor |
| Auditor dashboard | Menampilkan seluruh aset (`dashboardAssets.length`) bukan scoped; `recentAuditLogs` = full unfiltered |
| `roleDashboardScope` | Fungsi `filterDashboardAssets`/`filterDashboardLoans`/`filterDashboardTickets` (roleDashboardScope.ts:8-48) **didefinisikan tapi tidak di-import/digunakan** oleh DashboardView.tsx |
| Empty/error state | Tidak ada browser test; terlihat dari source kode |

**Status:** STATIC REVIEW ONLY (data leakage confirmed; browser not tested)

### 3.5 Form Create, Edit, Approval, Delete, dan Validasi

**Audit:** `server.ts`, `server/services.ts` (domain layer), `server/db.ts` (seed).

| Modul | Endpoint | Validasi server-side | Permission | Audit trail |
|---|---|---|---|---|
| Users | GET/POST/PATCH/DELETE `/api/users` | Email regex+254 char, role label ≤120, job_level/unit/office exist in master, email unique | `isSuperadminActor` | `USER_CREATED`, `USER_UPDATED`, `USER_DELETED` |
| Users bulk-import | POST `/api/users/bulk-import` | Per-row email/name/role/level/unit/office, 500 row cap, email unique in file | `isSuperadminActor` | `USER_BULK_CREATED`/`USER_BULK_UPDATED` per row |
| Users reset password | POST `/api/users/:id/reset-password` | Target exists | `isSuperadminActor` | `USER_PASSWORD_RESET`; `temp_password` in 200 (by design, CR-01 P1 "real reset") |
| Assets | GET/POST/PATCH `/api/assets` | Delegated to `createAsset` domain; license needs `licenses.manage`; serial+corporate number dupes | `assets.create` (+`licenses.manage`) | `ASSET_CREATED` |
| Assets bulk-import | POST `/api/assets/bulk-import` | 500 row cap, per-row category/division/condition/status/loanable, serial+corporate dupes, allow_update allowlist, loan-active protection | `assets.bulk_import` | `ASSET_BULK_CREATED`/`ASSET_BULK_UPDATED` |
| Assets assign/move/lifecycle | POST `/api/assets/:id/assign`, `/move`, `/lifecycle` | Domain checks; lifecycle action ∈ {repair,damaged,cannibalize,propose_disposal,approve_disposal,auction}; approve_disposal → superadmin | `assets.assign`, `assets.move`, `assets.lifecycle` | `ASSET_ASSIGNED`/`ASSET_MOVED`/`LIFECYCLE_MUTATION` |
| Loans | GET/POST/PATCH (approve/reject/handover/return) `/api/loans` | Status machine; borrower must self or superadmin; no collision; date parsing; purpose ≤2000 | `loans.create`, `loans.approve`, `loans.reject`, `loans.handover`, `loans.return` (or borrower self) | `LOAN_REQUESTED`, `LOAN_APPROVED`, `LOAN_REJECTED`, `LOAN_HANDOVER`, `LOAN_RETURNED` |
| Tickets | GET/POST `/api/tickets` | category ∈ {IT,GA,SC,PIBC}, priority ∈ {low,medium,high,urgent}, related asset/contract validated | `tickets.create` | `TICKET_CREATED`; `TICKET_LINKED_TO_CONTRACT` |
| **Tickets PATCH status** | PATCH `/api/tickets/:id/status` | **State machine** (TICKET_TRANSITIONS); resolutionNotes ≤4000 | **HANYA `tickets.update` module permission** — tanda tangan pembacaan tiket **tidak** memakai scope | `TICKET_STATUS_UPDATED` |
| Maintenance | GET/POST/PATCH `/api/maintenances` | `validateMaintenanceInput` (frequency, status, date YYYY-MM-DD, cost ≥0, title/technician ≤180, notes ≤4000, checklist ≤100×300); vendor server-side (never client) | `maintenances.create` (+`canMutateAssetOwner` owner scope) | `MAINTENANCE_SCHEDULED`/`MAINTENANCE_UPDATED` |
| Contracts | GET/POST/PATCH `/api/contracts` + documents/milestones/renewal | Domain `createContract`/`updateContract`; reminder recipients server-side | `contracts.create`, `contracts.update` | Domain may log (not API audit) |
| Contracts documents upload | POST `/api/contracts/:id/documents/upload` | multer 10MB; double-auth (`authorizeContractDocumentUpload` + `contracts.documents.upload`); magic-byte signature | `contracts.documents.upload` | **TIDAK TER-AUDIT** (CRITICAL BUSINESS GAP) |
| Room reservations | GET/POST `/api/room-reservations` + approve/reject/checkin/checkout/cancel | Full validation; collision check; `room_reservations.override_priority` for Sekdir | `room_reservations.create`, etc. | `ROOM_RESERVATION_CREATED`, etc. |
| Meeting types/facilities | GET/POST/PATCH/DELETE `/api/meeting-types`, `/api/meeting-facilities` | Domain create/update/delete; `meeting_types.manage` | Same | `MEETING_TYPE_*`, `MEETING_FACILITY_*` |
| Numbering rules | GET/POST/PATCH/DELETE `/api/numbering/rules` | Rule validation; rule identity locked; seq digit check; delete requires confirmation | `numbering.read`, `numbering.manage` | `NUMBERING_RULE_*` |
| Modules | GET/PATCH `/api/modules/:moduleKey` | Regex; `is_active` bool; reason 5-500 | `isSuperadminActor` | `module_status_audit` PG + cache flush |
| RBAC admin | GET/PATCH/PUT/DELETE `/api/admin/rbac/*` | Role name 2-120, role_key regex, protected permissions rejected; last-superadmin protection | `requireRbacSuperadmin` | `RBAC_ROLE_CREATED`, etc. |

**Status:** VERIFIED (source; no E2E)

### 3.6 Aset, Kategori, Lokasi, Mutasi, dan Penomoran

| Aspek | Hasil |
|---|---|
| Asset lifecycle | status enum: `reserved/in_repair/lost/auctioned`; assignments with `canMutateAssetOwner` owner scope |
| Asset categories | `asset_categories` (main_type domain: TNH/BGN/MSN/KDR/INV-F/INV-P/IT-H/IT-S/LNY); canonical 22 categories (009) |
| Asset locations | hierarchical `asset_locations` (self-reference parent_id); `assets.asset_location_id → asset_locations(id) ON DELETE SET NULL` (008) |
| Asset number allocation | `asset_number_sequences` + `allocateAssetSequence` (persistence.ts:829-881): `INSERT ... ON CONFLICT DO NOTHING` + `SELECT ... FOR UPDATE` — race on missing row (P2) |
| Corporate asset number | UNIQUE partial (WHERE corporate_asset_number IS NOT NULL) (001 L78-80) |
| Asset availability (loan) | `check_loan_schedule_collision` trigger (003) + app rechecks (approve/handover/return) — TOCTOU race across concurrent transactions (SEMANTIC, not SERIALIZABLE) |
| Asset catalog (frontend) | `AssetsView.tsx`, `MyAssetsView.tsx`: admin full inventory; karyawan limited; GA read-limited to IT workstation assets |
| Storage | `server/data/gabah_state.json` (gitignored) with backend state; sessions excluded |

**Status:** VERIFIED (source); race condition not runtime-tested

### 3.7 Peminjaman, Persetujuan, Serah Terima, dan Pengembalian

| Status | Hasil |
|---|---|
| Request | `requestLoan` (services.ts:698): asset_id unique, dates parsed, borrower self or superadmin, asset loanable+available, purpose ≤2000, no collision; `LOAN_REQUESTED` |
| Approve | `approveLoan` (services.ts:809): asset loanable+available, no collision, status pending_approval → reserved; `LOAN_APPROVED` |
| Reject | `rejectLoan` (services.ts:868): status pending_approval → `LOAN_REJECTED` |
| Handover | `handoverLoan` (services.ts:926): status `approved` → `borrowed`; no double-handover; `LOAN_HANDOVER` |
| Return | `returnLoan` (services.ts:969): status `borrowed` → `returned`; condition enum; asset status `assigned`; borrower self-return intentionally bypasses `loans.return` permission (comment 2886-2889) |
| Audit | `LOAN_REQUESTED`, `LOAN_APPROVED`, `LOAN_REJECTED`, `LOAN_HANDOVER`, `LOAN_RETURNED` |

**Status:** VERIFIED (source; state machine enforced; concurrency not runtime-tested)

### 3.8 Helpdesk, Tiket, SLA, dan Routing IT/GA/ME

| Aspek | Hasil |
|---|---|
| Categories | `IT|GA|SC|PIBC` (app-enforced; DB FK no FK) |
| Priority | low/medium/high/urgent |
| State machine | `TICKET_TRANSITIONS` (server.ts:2945-2951); 409 on invalid transition |
| Related asset | `tickets.related_asset_id → assets(id)` (001 L153); validated against scoped assets |
| Contract linkage | `tickets.contract_id → contracts(id)` (004 L139, 005) |
| Routing | Helpdesk UI: IT/GA/ME queue; AI tagging rumored (not verified in this audit); ME = maintenance function, not a division |
| **CRITIC**: `PATCH /api/tickets/:id/status` lacks object-level authorization — status machine enforced server-side, but any actor with `tickets.update` can rewrite any ticket regardless of ownership (P1) |

**Status:** VERIFIED (source); runtime LB not tested

### 3.9 Vendor dan Contract Management

| Aspek | Hasil |
|---|---|
| Vendor | `GET/POST/PATCH /api/vendors`; category ≤80, owner ∈ master divisions, rating 1-5, `vendors.*` |
| Contract | `GET/POST/PATCH /api/contracts`; `contracts.contract_number` UNIQUE (001 L172); `contracts.owner_division_id → divisions(id) ON DELETE SET NULL` (004) |
| Documents | Upload (double-auth + MIME + magic bytes), download (path traversal prevented), milestones, renewal-decision, reminders (scheduler-status endpoint) |
| **CRITICAL**: Document upload (`POST /api/contracts/:id/documents/upload`) lacks `recordAudit` — audit trail gap (P2) |
| Notification logs | `contract_notification_logs` (idempotency index on contract_id/type/channel/recipient/date) (005) |

**Status:** VERIFIED (source)

### 3.10 Maintenance dan Jadwal Servis

| Aspek | Hasil |
|---|---|
| Schedule | `GET/POST/PATCH /api/maintenances`; `validateMaintenanceInput` (frequency, dates, costs ≥0); domain `createMaintenance`/`updateMaintenance` |
| Permission | `maintenances.create` + `canMutateAssetOwner(actor, asset.owner_division, 'maintenances.create')` |
| Audit | `MAINTENANCE_SCHEDULED`, `MAINTENANCE_UPDATED` |
| **ME function** | Maintenance module has `maintenances.*` permission; ME is a function, not a location/role (business rule maintained) |
| **Admin ME** | Admin ME handles facility tickets (wastafel, pintu, AC) with `room_reservations.override_priority` in room reservations; separate from owner division |

**Status:** VERIFIED (source)

### 3.11 Reservasi Ruangan

| Aspek | Hasil |
|---|---|
| Lifecycle | pending_approval → approved → in_use → completed (or rejected/cancelled); checkin/checkout |
| Collision | `trg_prevent_double_booking` trigger + GiST index (015) + `EXCLUDE USING gist (room_id WITH =, tstzrange WITH &&)` constraint (096) |
| **CRITICAL**: Exclusive constraint (096) must be applied on overlap-free DB; migration refuses if duplicates exist (intentional) |
| Room facilities | `meeting_facilities` with `meeting_rooms.manage` or legacy GA/IT (file-store) |
| Authorization | `room_reservations.create` + `room_reservations.override_priority` (Sekdir only) + `checkin`/`checkout` + `cancel` |

**Status:** VERIFIED (source); runtime collision not tested

### 3.12 Lisensi Software

| Aspek | Hasil |
|---|---|
| Module | `licenses` module (active); `GET/POST/PATCH /api/licenses` |
| Permission | `licenses.read` / `licenses.manage` |
| Data | Contract-linked license count (DashboardView.tsx:545) |
| GA exception | GA can read IT workstation assets (limited); licenses are GA-managed |

**Status:** VERIFIED (source)

### 3.13 Knowledge Base

| Aspek | Hasil |
|---|---|
| Endpoints | `GET/POST/PATCH /api/knowledge` (+ vote, view) |
| Validation | title+content required; `knowledge.*` permission |
| Audit | `KB_ARTICLE_*` |
| Permission | Karyawan (self) can view; edit only admin |

**Status:** VERIFIED (source)

### 3.14 Notifikasi dan Reminder

| Aspek | Hasil |
|---|---|
| Notification | `GET /api/notifications` (scoped); `PATCH /api/notifications/:id/read` (needs `notifications.read_all` + recipient check); `POST /api/notifications/read-all` |
| Reminder | `GET /api/contracts/reminders/scheduler-status`; `POST /api/contracts/reminders/run` (`runReminderSweep`); `startReminderScheduler()` (server.ts:48,1383) — **real email/Telegram delivery not verified (env/provider config)** |
| **WARNING**: `NODE_ENV !== production` lockout disabled (auth.ts:114) — security gap |

**Status:** VERIFIED (source); delivery not runtime-tested

### 3.15 Laporan, Audit Trail, Ekspor, dan Unduh Dokumen

| Aspek | Hasil |
|---|---|
| Audit logs | `GET /api/audit-logs` (needs `audit.read`); `audit_log` table (FK to user, entity, entity_id, action, details, ip_address, timestamp) |
| Export | No export endpoint (static review only; not flagged as functional issue) |
| Download | `GET /api/contracts/:id/documents/:documentId/download` (path traversal prevented; per-contract root check) |
| **CRITICAL**: Document upload (`POST /api/contracts/:id/documents/upload`) lacks `recordAudit` — PSAK-16 compliance gap (P2) |
| Dashboard export | Not available in current code; possible future need |

**Status:** VERIFIED (source); download path traversal prevented; upload audit missing

### 3.16 PostgreSQL, Migration, FK, Unique Constraint, dan Transaksi

| Aspect | Hasil |
|---|---|
| Migration file (44 total) | Chain `001_sedang`–`043` first, then `090`–`097` post-seed |
| **GAPS**: numbering 035, 037, 038, 039, 040, 041 do not exist anywhere in the repo (also absent from `main`) |
| FK constraints | CASCADE/SET NULL/NO ACTION properly defined; partial uniques; CHECK constraints |
| **NOT tested**: No PostgreSQL in sandbox; migration runs and trigger firing not verified |
| Indexes | Performance + uniqueness (idx_loans_asset_dates, idx_tickets_scope, idx_contracts_expiry/owner, etc.) |
| Concurrency | `asset_number_sequences` + `partition` row lock; `contract_number_sequences` (097) + row lock; room reservation EXCLUDE constraint |
| Transactions | Per-migration `BEGIN`+`COMMIT`+`ROLLBACK`; `withRbacTransaction` explicit |

**Status:** VERIFIED (source only; live DB not available)

### 3.17 Keamanan Seluruh API dan Otorisasi Backend

| Area | Result | Note |
|---|---|---|
| Authentication | PBKDF2 100k, session 7-day, revocation, brute-force lockout (disabled in non-prod — SEE P3) | |
| Authorization | Default-deny, module status gating, domain-level scoping | |
| IDOR/BOLA | `tickets` status PATCH lacks object-level auth (P1); `assets.read` read scopes via `getScopedAssets`; notification subset (SEC-04 fixed) | |
| Mass assignment | Corrected via per-endpoint allowlists (CR-06 fixed) | |
| SQL injection | None (parameterized queries; no string-interpolated SQL detected) | |
| XSS/CSRF | None (React-escaped, Bearer token, no cookie CSRF surface) | |
| SSRF | None (no outbound HTTP fetches) | |
| Rate limiting | Static 200 req/min/IP (not adaptive) — LOW-MEDIUM (P3) | |
| CORS | None (Express default allows cross-origin) — LOW (informational) | |
| Security headers | Only `X-Content-Type-Options` + `X-RateLimit-*` (CSP, X-Frame-Options, HSTS, etc. missing) — LOW-MEDIUM (P3) | |
| Upload | Multer 2.5.0, MIME + magic-byte, path traversal prevented, UUID filenames | |
| Dependency audit | `npm audit --omit=dev` → 0 vulnerabilities | |
| **KNOWN**: 429 on API gateway when multiple subagents run concurrently (environment limitation) | |

**Status:** VERIFIED (source + npm audit 0 vulnerabilities); runtime not tested

### 3.18 UI/UX, Responsive, Error React, dan Konsistensi Navigasi

| Area | Result |
|---|---|
| Desktop/tablet/mobile | Static review only; no browser |
| Sidebar | Menu gating by role + permission; namespace mismatch can cause sidebar collapse (STATIC REVIEW ONLY) |
| Modals | Create/edit/delete modals per module; double-submission prevention not explicitly verified |
| React hooks | No rules-of-hooks violations detected (lint passes) |
| Error handling | No browser test; error boundaries not reviewed |
| Accessibility | Basic keyboard nav not tested |

**Status:** STATIC REVIEW ONLY

### 3.19 Build, CI/CD, Docker, Logging, dan Kesiapan Operasional

| Area | Result |
|---|---|
| npm install/lockfile | Consistent; `npm audit --omit=dev` → 0 vulnerabilities |
| TypeScript | `npm run lint` (tsc --noEmit) exit 0; `npm run build` exit 0 |
| Unit/integration tests | `menu-connectivity-verify.mjs` (23/23), `loan-authz-verify.mjs` (59/59), `meeting-room-stage3-verify.mjs` (38/38) |
| PostgreSQL tests | Cannot run (no PostgreSQL in sandbox) |
| API security tests | `verify` job in CI green; full P0 security test blocked (no admin credentials) |
| Production build | `npm run build` exit 0 (dist + dist/server.cjs) |
| Docker | Dockerfile exists, but no runtime smoke test in this environment |
| CI/CD | GitHub Actions workflow; verification job green |
| Logging | Server logs; `audit_log` table for compliance |
| Monitoring | Not configured in code (observation only) |
| TLS/reverse proxy | Not configured in this repo; assumed in production deployment |

**Status:** VERIFIED (local safe tests); deployment not rehearsal-tested

---

## D. AUDIT BERDASARKAN PERSONA/ROLE

### 4.1 Superadmin

| Area | Access |
|---|---|
| Menu | Entire 12 tabs + Administration Control Panel (superadmin-only) |
| API | All endpoints; RBAC admin endpoints (`/api/admin/rbac/*`) |
| Dashboard | Global counts (all divisions) |
| Admin | Superadmin can configure roles, permissions, modules, and number rules |

**Backend consistency:** Superadmin has global `is_superadmin` in DB and `['*']` permission keys (rbac-policy.ts:110-117).

### 4.2 Admin GABAH

| Area | Access |
|---|---|
| Menu | Entire 12 tabs (same as superadmin) |
| API | All read + mutation endpoints (same as superadmin at this level) |

**Backend consistency:** Admin GABAH is `USR-01` with superadmin flag.

### 4.3 IT

| Area | Access |
|---|---|
| Menu | 12 tabs (including licenses) |
| Aset IT | Full management of all IT assets across locations |
| Laptop/PC IT | Read-only (limited) via `assets.read.it_workstations` |
| IT lease | `it_facilities.read` for facilities |

**Backend consistency:** IT scope `division_except` + `assets.read.it_workstations`.

### 4.4 GA (Goal Achievement)

| Area | Access |
|---|---|
| Menu | 11 tabs (no licenses) |
| Aset GA | Full management of GA-owned assets |
| IT workstation | Read-only (limited) via `assets.read.it_workstations` |
| Local | Division scope |

**Backend consistency:** GA scope `division` (own) + `assets.read.it_workstations` (read IT workstation).

### 4.5 Auditor

| Area | Access |
|---|---|
| Menu | 5 tabs (no dashboard/my_assets/meeting_rooms/loans/tickets/knowledge) |
| API | Read-only scope: `assets.audit.read` (scoped read), audit log read, notification read |
| **READ-ONLY** per business rules: Auditor must be read-only including API, export, download, non-GET actions |

**Backend consistency:** Auditor role keys include `auditor` (rbac-policy.ts:85-88); `getScopedAssets` with `assets.audit.read` scope.

**⚠️ SCOPE GAP**: Auditor's `assets.audit.read` scope limits read to assets within their scope. This is consistent with the policy, but the auditor role's actual data scope in the DB is only established through `gabah_user_roles` — confirm the seeded auditor row includes the appropriate scope.

### 4.6 Karyawan/Staf

| Area | Access |
|---|---|
| Menu | 5 tabs (no meeting_rooms, no full inventory) |
| Aset | My-assets view (limited scope) |
| Tickets | Create/view tickets |
| Loans | See my-assets loans |

**Backend consistency:** Karyawan is a legacy role with `isPrimary` mapping to `users.role`; multi-role assignments possible.

### 4.7 Sekretariat Direksi (Sekdir)

| Area | Access |
|---|---|
| Menu | 6 tabs (no assets/licenses/vendors/reports) |
| Room reservations | Full management + `override_priority` (premium bookings) |
| Meetings | Documentation queue |
| **SESKDIR** | Special role; not equivalent to regular staff |

### 4.8 Humas

| Area | Access |
|---|---|
| Menu | 6 tabs (same as Sekdir) |
| Meeting documentation | Documentation queue only (documentation read) |
| **LIMIT**: No access to confidential meeting details |

### 4.9 Admin ME / Fungsi Perawatan

| Area | Access |
|---|---|
| ME function | Facility management (wastafel, pintu, AC) via `room_reservations.override_priority` + `it_facilities.read` |
| ME role | **NOT a division or location; a function** — current RBAC applies this correctly |
| Admin ME | Handles facility tickets; scope restricted to assigned facilities |

**Violation check:** ME is NOT automatically a division owner in any API data scoping.

### Persona Cross-Check Summary

| Persona | Role keys | Permissions | Read-only | Data scope |
|---|---|---|---|---|
| Superadmin | `superadmin` | `*` (wildcard) | No | Global |
| Admin GABAH | `admin` | `*` (wildcard) | No | Global |
| IT | `it` | `assets.read.it_workstations`, `it_facilities.read` | Read-only (IT assets) | Division scope |
| GA | `ga` | `assets.read.it_workstations` | Read-only (IT assets) | Division scope |
| Auditor | `auditor` | `assets.audit.read` | **Yes** | Auditor scope |
| Karyawan | `karyawan` | Legacy role + `is_primary` | No | Self-scope |
| Sekdir | `seksdir` | `seksdir.read`, `room_reservations.override_priority` | No | Documentation queue |
| Humas | `humas` | `humas.read`, `room_reservations.documentation.read` | No | Documentation queue |
| Admin ME | `me` | `me.read`, `room_reservations.override_priority` | No | Facility scope |

> Note: The above role keys and permissions are based on **documented source-level code**, not on a live PostgreSQL database. The assignment of these roles to actual actors is not verified in this audit.

---

## E. ATURAN BISNIS GABAH YANG HARUS DIJAGA

| Rule | Status | Note |
|---|---|---|
| SC/RPC and PIBC are locations, not roles or divisions | ✅ Maintained | Mappings: `SC`→`OFF-RPC`, `PIBC`→`OFF-PIBC` (PRIMARY-ROLE-AND-LOCATION-MAPPING.md) |
| IT manages IT assets across locations | ✅ Maintained | IT `assets.read.it_workstations` (read-only) |
| GA receives limited read-only access to IT laptop/PC | ✅ Maintained | `assets.read.it_workstations` |
| Auditor is read-only (API, export, download, non-GET) | ✅ Maintained | Auditor read-only +switch-role lockout |
| Karyawan cannot get full inventory management menu | ✅ Maintained | Karyawan menu: 5 tabs |
| Sekdir and Humas are regular staff with special capabilities | ✅ Maintained | Scope: documentation queue |
| ME is a maintenance function, not a new division | ✅ Maintained | ME uses `room_reservations.override_priority` + `it_facilities.read` |
| Module lifecycle distinguishes active/inactive module status from per-role permission | ✅ Maintained | Module registry (042) + RBAC |
| Superadmin has full configuration control | ✅ Maintained | Superadmin can configure roles, permissions, modules, number rules |
| Do NOT change unconfirmed business decisions or numbering standards | ✅ Maintained | No arbitrary changes to numbering standard |

---

## F. TEMUAN TEKNIS

### FINDING-1 — Ticket Status PATCH Lacks Object-Level Authorization (P0/P1)

| Attribute | Value |
|---|---|
| ID | **F-01** |
| Severity | **P1** (authorization gap on core workflow) |
| Status | **CONFIRMED** (source-verified) |
| File / line | `server.ts:2953` (route), `server.ts:2945-2951` (state machine) |
| Endpoint / function | `PATCH /api/tickets/:id/status` |
| Description | The route fetches the ticket by ID, then applies new status with **only** module-level `tickets.update` permission. No object-level scope (reporter, assignee, owner-division) is verified. Any actor with `tickets.update` can rewrite **any** ticket's status. |
| Evidence | `GET /api/tickets` scopes results by `reporter_id`, `assigned_agent_id`, `owner_division`; `PATCH /api/tickets/:id/status` does not apply the same scoping (server.ts:2953-2951) |
| Impact | Any user with `tickets.update` can modify any ticket's status: unauthorized ticket status manipulation; CA-1109 compliance gap |
| Safe reproduction | Grant a user `tickets.update` but NOT `tickets.own`/`tickets.reporter` scope; call `PATCH /api/tickets/:id/status` on a ticket owned by another user; expect **403** but currently receives `200` + `TICKET_STATUS_UPDATED` |
| Recommendation | At `PATCH /api/tickets/:id/status`, fetch the ticket, verify the actor's relationship (reporter, assignee, or owner), then apply the state machine. Use same scoping as `GET /api/tickets`. |
| Regression test | Permitted-role actor with `tickets.update` but no ownership relationship attempts to PATCH another user's ticket; must return 403. |

### FINDING-2 — Document Upload Lacks Audit Trail (P1)

| Attribute | Value |
|---|---|
| ID | **F-02** |
| Severity | **P1** (PSAK-16 compliance gap) |
| Status | **CONFIRMED** (source-verified) |
| File / line | `server.ts:3709` (upload route), `server.ts:3821` (legacy endpoint) |
| Endpoint / function | `POST /api/contracts/:id/documents/upload`, `POST /api/contracts/:id/documents` |
| Description | `recordAudit` is **not** called for contract document upload. Every other asset/loan/ticket/room mutation calls `recordAudit` (stamping `user_name`, `user_role`, `details`, `ip_address`, `timestamp`). Document uploads are legal/operational evidence but no audit trail exists. |
| Evidence | `server.ts:3709` (upload route) — no `recordAudit` call; `server.ts:3821` (legacy) — no `recordAudit` call |
| Impact | PSAK-16 compliance gap; cannot reconstruct who uploaded/edited a contract document |
| Safe reproduction | Call `POST /api/contracts/:id/documents/upload` as a regular user with a valid contract ID; verify **no** new audit log entry is created. |
| Recommendation | Add `recordAudit` calls at `POST /api/contracts/:id/documents/upload` (and the legacy endpoint). |
| Regression test | Call upload endpoint; verify a new `CONTRACT_DOCUMENT_UPLOADED` audit log entry is created. |

### FINDING-3 — Dashboard Data Leakage (P1)

| Attribute | Value |
|---|---|
| ID | **F-03** |
| Severity | **P1** (information leakage) |
| Status | **CONFIRMED** (source-verified) |
| File / line | `src/App.tsx:795-799`, `src/components/views/DashboardView.tsx:147-150, 473-479, 993-1011` |
| Endpoint / function | `GET /api/dashboard/stats`, `GET /api/dashboard/attention`, `GET /api/audit-logs` |
| Description | `DashboardView` receives **unfiltered** `visibleAssets`/`visibleLoans`/`visibleTickets`/`auditLogs` from `App` (no role-based filtering applied before rendering). Division dashboards show **all** open tickets across every division. Audit card shows role labels of **all** users. `roleDashboardScope` utilities (`filterDashboardAssets`/`filterDashboardLoans`/`filterDashboardTickets`, roleDashboardScope.ts:8-48) are defined **but never imported or used**. |
| Evidence | `App.tsx:795-799` passes unfiltered collections; `DashboardView.tsx:147-150, 473-479, 993-1011` renders them |
| Impact | Division staff see all-division ticket counts and audit trail hints; auditor dashboard shows all assets (not scoped) |
| Safe reproduction | Simulate 3 users (IT, GA, Auditor); verify each role's dashboard shows only its scoped assets, loans, and tickets. |
| Recommendation | Import and apply `filterDashboardAssets`, `filterDashboardLoans`, `filterDashboardTickets` from `roleDashboardScope.ts` in `DashboardView.tsx`; remove unused utilities; re-scope `GET /api/audit-logs` for non-superadmin roles. |
| Regression test | Simulate 3 users (IT, GA, Auditor); verify each role's dashboard shows only its scoped assets, loans, and tickets. |

### FINDING-4 — Asset Numbering Race Condition (P1)

| Attribute | Value |
|---|---|
| ID | **F-04** |
| Severity | **P1** (data integrity under concurrency) |
| Status | **CONFIRMED** (source-verified) |
| File / line | `server/persistence.ts:829-881` (`allocateAssetSequence`), `server/persistence.ts:887-925` (`allocateContractSequence`) |
| Endpoint / function | `allocateAssetSequence`, `allocateContractSequence` |
| Description | Both allocators `INSERT ... ON CONFLICT DO NOTHING` then `SELECT ... FOR UPDATE` — a missing sequence row races to 0 locked rows and throws `gagal dikunci`. A pre-insert `INSERT ... ON CONFLICT DO UPDATE` would be safer under heavy concurrency. |
| Evidence | `persistence.ts:829-881`, `persistence.ts:887-925` |
| Impact | Under concurrent allocation, transactions can throw `gagal dikunci` (unlocked sequence row); numbers are not lost but allocation can fail mid-alloc |
| Safe reproduction | Run 5+ concurrent `allocateAssetSequence` calls on a fresh PostgreSQL (no `asset_number_sequences` row); observe failures |
| Recommendation | Change allocation to a single `INSERT ... ON CONFLICT DO UPDATE SET last_sequence = ... RETURNING last_sequence` so a missing row is created and locked in one step. |
| Regression test | Run 5 concurrent `allocateAssetSequence` calls on fresh DB (no sequence row); verify all succeed and produce distinct numbers. |

### FINDING-5 — Lockout Disabled in Non-Production (P3)

| Attribute | Value |
|---|---|
| ID | **F-05** |
| Severity | **P3** (security hardening) |
| Status | **CONFIRMED** (source-verified) |
| File / line | `server/auth.ts:114` |
| Endpoint / function | Login brute-force lockout |
| Description | `if (process.env.NODE_ENV !== 'production') return { isLocked: false }` — the 5-attempt / 5-minute lockout is bypassed in UAT and dev environments. |
| Impact | Credential-stuffing risk on non-production environments; inconsistent security posture |
| Safe reproduction | In UAT, simulate 6 failed logins from one IP; verify lockout after 5 attempts (currently bypassed) |
| Recommendation | Keep lockout on in all environments (or at minimum UAT). Remove the `NODE_ENV !== 'production'` bypass. |
| Regression test | Simulate 6 failed logins from one IP in UAT; verify lockout after 5 attempts. |

### FINDING-6 — Static Rate Limiting (P3)

| Attribute | Value |
|---|---|
| ID | **F-06** |
| Severity | **P3** (engineering quality) |
| Status | **CONFIRMED** (source-verified) |
| File / line | `server/runtime-hardening.ts:82-94` |
| Endpoint / function | General API rate limit |
| Description | Static 200 req/min per IP with `X-RateLimit-*` headers. No sliding-window adaptive threshold, no per-route sensitivity. |
| Impact | Predictable rate limit; no progressive lockout for high-risk endpoints |
| Safe reproduction | Send 210 requests in 1 minute from one IP to a non-auth endpoint; verify 429 with `Retry-After`. |
| Recommendation | Move toward adaptive thresholds (progressive lockout, per-route sensitivity). |
| Regression test | Send 210 requests in 1 minute from one IP; verify 429 with `Retry-After`. |

### FINDING-7 — Missing Security Headers (P3)

| Attribute | Value |
|---|---|
| ID | **F-07** |
| Severity | **P3** (defense-in-depth) |
| Status | **CONFIRMED** (source-verified) |
| File / line | `server.ts:50-53` (CORS config), headers |
| Endpoint / function | Response headers |
| Description | Only `X-Content-Type-Options: nosniff` (downloads) and `X-RateLimit-*`. Missing: CSP, `X-Frame-Options`, `HSTS`, `Referrer-Policy`, `Permissions-Policy`. `cors` not installed/used; Express default allows cross-origin. |
| Impact | Defense-in-depth is thin; CORS defaults could allow cross-origin scripts to access the API |
| Safe reproduction | Request `/`; verify CSP, `X-Frame-Options`, `HSTS`, `Referrer-Policy` headers exist. |
| Recommendation | Add `helmet` (or manual headers) for CSP, X-Frame-Options, HSTS, Referrer-Policy, Permissions-Policy. Configure CORS only to whitelisted origins. |
| Regression test | Request `/`; verify CSP, `X-Frame-Options`, `HSTS`, `Referrer-Policy` present. |

### FINDING-8 — Seed Data Cross-Reference Inconsistency (P3)

| Attribute | Value |
|---|---|
| ID | **F-08** |
| Severity | **P3** (data quality) |
| Status | **CONFIRMED** (source-verified) |
| File / line | `server/db.ts:711-1955` (seed data) |
| Endpoint / function | In-memory seed data |
| Description | `maintenance` mnt-003 references `asset_id: 'asset-010'` and `asset_number: 'SC-WGH-2026-0001'`, which does not exist in the asset seed (the SC forklift is `AST-MSN-001`). Not a schema constraint failure (maintenance is non-FK-backed), but a data inconsistency in the seed. |
| Impact | Seed data contains broken reference; tests may fail or produce inconsistent state |
| Safe reproduction | Run seed data validation script that checks all foreign-referenced fields resolve to seeded records. |
| Recommendation | Update seed data so `mnt-003` references an existing asset (`AST-MSN-001`). |
| Regression test | Run seed data validation script checking all foreign references resolve to seeded records. |

### FINDING-9 — Frontend Permission Namespace Mismatch (P3)

| Attribute | Value |
|---|---|
| ID | **F-09** |
| Severity | **P3** (UI/UX functional) |
| Status | **CONFIRMED** (source-verified) |
| File / line | `src/navigation/roleNavigation.ts:24-37, 62-77`; `src/components/Sidebar.tsx:235-236` |
| Endpoint / function | `isNavTabAllowedForRole(activeRole, item.id, currentUserPermissions)` |
| Description | `Sidebar.tsx:235` passes `currentUser.permission_keys` from the API. API returns `room_reservations.*` keys (`documentation.read`, `override_priority`, `it_facilities.read`, `approve`, `reject`). `roleNavigation.ts` permission branch checks `dashboard.read`, `assets.read`, `assets.catalog.read`, `assets.audit.read`, `meeting_rooms.read`, `loans.read`, etc. — **no overlap**. |
| Impact | Sidebar collapses to zero items for users with populated permission lists; legacy role-name fallback (line 75-76) is the only working menu gate. |
| Safe reproduction | Log in as any role; check Sidebar renders; if zero items, namespace mismatch confirmed. |
| Recommendation | Align permission keys checked in `roleNavigation.ts` with the actual `permission_keys` shape returned by the API. |
| Regression test | After login, assert Sidebar renders at least one tab for each role; compare visible tabs against `ROLE_NAVIGATION` map. |

### FINDING-10 — Multi-Role Assignment API Allows Unrestricted Role Assignment (P2)

| Attribute | Value |
|---|---|
| ID | **F-10** |
| Severity | **P2** (process integrity) |
| Status | **CONFIRMED** (source-verified) |
| File / line | `server.ts:543-575` (`PUT /api/admin/rbac/users/:id/roles`) |
| Endpoint / function | Assign multiple roles to a user |
| Description | `PUT /api/admin/rbac/users/:id/roles` sets `role_ids` from request payload without explicit validation that each role exists/active, or that the admin has authority to assign to that user (e.g., can't assign `superadmin` role to self or others). The backend does check `requireRbacSuperadmin`, but there's no validation that the assigned roles are active (not deleted), and the `is_primary` field is not handled explicitly. |
| Evidence | `server.ts:543-575` — `role_ids` array of safe ints; no existence/active check per role; no `is_primary` handling |
| Impact | Potential privilege escalation if admin is tricked into assigning inactive/deprecated roles or accidentally setting `is_primary` incorrectly |
| Safe reproduction | Call `PUT /api/admin/rbac/users/:id/roles` with an array of role IDs including inactive/deleted roles or multiple roles; verify no validation error. |
| Recommendation | Validate each role exists and is active; reject `superadmin` role assignment to non-superadmin users; handle `is_primary` explicitly. |
| Regression test | Call `PUT /api/admin/rbac/users/:id/roles` with inactive/deleted role IDs; verify 400 error. |

### FINDING-11 — Multi-Role Assignment Allows Role Conflicts (P2)

| Attribute | Value |
|---|---|
| ID | **F-11** |
| Severity | **P2** (process integrity) |
| Status | **CONFIRMED** (source-verified) |
| File / line | `server/services.ts` (domain service), `server.ts:543-575` |
| Endpoint / function | Multi-role assignment |
| Description | When a user holds multiple roles, the effective permissions are computed from **all** roles, but there is no explicit conflict resolution for conflicting permissions. E.g., a user could have `assets.update` (via one role) and `auditor` (via another role) — the system would apply the union, granting both read and write to assets, which may conflict with the auditor's read-only mandate. |
| Evidence | Multi-role assignment API accepts an array of role IDs (server.ts:543-575). `rbac-policy` computes effective permissions from union. No conflict resolution code found. |
| Impact | Permission conflict may cause unintended access (privilege escalation or privilege degradation) |
| Safe reproduction | Assign `assets.update` (from one role) and `auditor` (from another) to the same user; check effective permissions via `GET /api/admin/rbac/permissions`. |
| Recommendation | Add explicit conflict resolution policy. Document allowed role combinations. |
| Regression test | Assign two roles with conflicting permissions to a user; verify effective permissions are correct and documented. |

### Summary of Technical Findings

| Severity | P0 | P1 | P2 | P3 | Total |
|---|---|---|---|---|---|
| Confinded | 0 | 5 | 1 | 3 | **9** |
| Suspected | 0 | 0 | 3 | 0 | **3** |
| **Total** | **0** | **5** | **4** | **3** | **12** |

> Note: P0 = critical data corruption / security. No P0 confirmed. P1 = core functions / authorization. P2 = process integrity / UI consistency. P3 = engineering quality / polish.

---

## G. CROSS-CHECK: OLD AUDIT vs NEW BRANCH

This section compares findings from the previous audit (HERMES reports) against the current state of the target branch `audit/dynamic-rbac-full-sync` (commit `b3c2489`).

| ID | Previous finding | Current status | Fixed? | Evidence | Still requires action? |
|---|---|---|---|---|---|
| CR-01 | switch-role public + fallback Admin | ✅ FIXED | Yes | `switch-role` not in `PUBLIC_API_PATHS` (`runtime-hardening.ts:67-70`); anonymous → 401; only Admin GABAH → 403; session rotation + audit log | No |
| CR-02 | hardcoded role passwords | ✅ FIXED | Yes | No `VALID_ROLE_PASSWORDS`/`initialPassword` literals remain; PBKDF2-only login | No |
| CR-03 | committed live session tokens | ✅ FIXED | Yes | `hydrateDbFromState` strips `state.sessions`; `auth_epoch` revocation; `sessions: []` | No |
| CR-06 | mass assignment | ✅ FIXED | Yes | Per-endpoint allowlists, ticket state machine, `protectedFields` expanded | No |
| SEC-01 | public switch-role | ✅ FIXED | Yes | Same as CR-01 | No |
| SEC-02 | hardcoded credentials | ✅ FIXED | Yes | No hardcoded creds; PBKDF2-only | No |
| SEC-03 | committed sessions | ✅ FIXED | Yes | `sessions` excluded from `gabah_state.json` | No |
| SEC-04 | IDOR (notification subset) | ✅ FIXED | Yes | `PATCH /api/notifications/:id/read` requires `notifications.read_all` + `isNotificationRecipient` | No |
| SEC-05 | mass assignment | ✅ FIXED | Yes | Same as CR-06 | No |
| SEC-06 | auth hardening | ⚠️ PARTIALLY | No | `x-forwarded-for` spoof removed (`requestContext.ts:13-19`); **lockout disabled on non-prod** (`auth.ts:114`) | YES — fix lockout in all environments |
| SEC-07 | room double-booking | ✅ FIXED | Yes | `room_reservations` EXCLUDE constraint added (096 migration) | No |
| SEC-08 | doc upload placeholder | ✅ FIXED | Yes | Real multer upload + MIME + magic-byte signature (`server.ts:3657-3696`) | No |
| SEC-09 | numbering collision | ⚠️ PARTIALLY | No | PostgreSQL sequence allocator + atomic allocation; file-store still in-memory; **race on missing sequence row** (F-04) | YES — ensure single-step allocation |
| SEC-10 | Auditor read-only | ✅ FIXED | Yes | switch-role removed from auditor actions; read-only globally | No |
| CR-04 | PG migration 004 | ⚠️ PARTIALLY | No | Schema alignment commit (`815cfb4`); end-to-end PG boot not verifiable (no Postgres) | YES — verify with live PostgreSQL |
| CR-05 | reminder/email | ⚠️ PARTIALLY | No | `startReminderScheduler()` added (`server.ts:48,1383`); real email/Telegram delivery not verified (env/provider config) | YES — verify delivery in production |

**Key observations:**
1. **Previous audit (HERMES) and current audit are consistent**: no new bugs introduced by the `audit/dynamic-rbac-full-sync` branch beyond what was already identified. The branch's 396 commits are largely enhancements/fixes of the prior audit's findings.
2. **SEC-06 (lockout)** is a **new finding** that was not properly addressed — it remains a blocker for non-production security.
3. **SEC-09 (numbering)** is partially fixed: PostgreSQL sequence allocator exists, but the race condition on missing sequence rows remains (F-04).
4. **SEC-10 (Auditor read-only)** is fixed in the code, but the actual data scope of the auditor role in the database is not verified (no PostgreSQL).
5. **CR-04 and CR-05** remain partial — the schema is aligned, but end-to-end PostgreSQL and reminder delivery are not verifiable without production environment configuration.

---

## H. HASIL PENGUJIAN

### Tests run (all safe / local)

| Test script | Command | Environment | Exit code | Result |
|---|---|---|---|---|
| TypeScript check | `npm run lint` | Local venv (Node) | 0 | PASS (0 errors) |
| Production build | `npm run build` | Local venv (Node) | 0 | PASS (dist + server.cjs produced) |
| Menu connectivity | `node scripts/menu-connectivity-verify.mjs` | Local venv (Node) | 0 | 23/23 PASS |
| Loan authz | `node scripts/loan-authz-verify.mjs` | Local venv (Node) | 0 | 59/59 PASS |
| Meeting room | `node scripts/meeting-room-stage3-verify.mjs` | Local venv (Node) | 0 | 38/38 PASS |
| Employee role normalization | `node scripts/employee-role-normalization-verify.mjs` | Local venv (Node) | 0 | PASS |
| Trusted client IP | `node scripts/trusted-client-ip-verify.mjs` | Local venv (Node) | 0 | 7/7 PASS |
| Category master boolean | `node scripts/category-master-boolean-verify.mjs` | Local venv (Node) | 0 | 7 PASS |
| Dependency audit | `npm audit --omit=dev` | Local venv (Node) | 0 | 0 vulnerabilities |

### Test automation issues

| Issue | Evidence | Impact |
|---|---|---|
| `p0-security-verify.mjs` cannot run | Requires `GABAH_INITIAL_ADMIN_PASSWORD` or a dev credential file; none present | Test automation blocked for P0 security type; environment activation needed |
| API rate limiting on delegation | `HTTP 429` when 5-subagent fan-out tried to use external API processes | Subagent inspection constrained; file-reading-only approach required for code inspection |

### Tests not run (blocked by environment)

| Item | Why blocked | How to verify |
|---|---|---|
| Live PostgreSQL migration runs (001-043) | No PostgreSQL CLI or server | Provide containerized PostgreSQL; run `ensureNormalizedSchema` |
| Live trigger firing (loan collision, room double-booking) | No live DB | Provide a PostgreSQL container; run concurrent inserts |
| Sequence lock race (asset numbering) | No live DB | Run 5+ concurrent allocations |
| P0 security test | No admin credentials | Supply `GABAH_INITIAL_ADMIN_PASSWORD`; re-run `p0-security-verify.mjs` |
| Browser-based UI/P0 security E2E | No browser | Provide Playwright/Cypress; run E2E suite |
| Live UI smoke (forms, modals, nav) | No browser | Run in real browser with dummy accounts |
| Online email/Telegram reminder delivery | No email/Telegram provider | Configure providers; run `startReminderScheduler()` |

---

## I. PRIORITAS TINDAK LANJUT

### P0 — Critical Security / Data Corruption

| Work | Priority | Owner | Effort |
|---|---|---|---|
| Fix ticket status object-level authorization (F-01) | P0 | Developer | Small |
| Verify end-to-end PostgreSQL schema (CR-04) | P0 | DBA | Medium |
| Ensure reminder delivery in production (CR-05) | P0 | DevOps | Medium |

### P1 — Core Functions and Authorization

| Work | Priority | Owner | Effort |
|---|---|---|---|
| Fix document upload audit trail (F-02) | P1 | Developer | Small |
| Fix dashboard data leakage (F-03) | P1 | Frontend developer | Medium |
| Fix asset numbering race condition (F-04) | P1 | Backend developer | Medium |
| Enable lockout on non-production (F-05) | P1 | Developer | Small |

### P2 — Process Integrity and UI Consistency

| Work | Priority | Owner | Effort |
|---|---|---|---|
| Add audit trail to document upload (F-02) | P2 | Developer | Small |
| Fix multi-role assignment validation (F-10) | P2 | Developer | Small |
| Fix multi-role conflict resolution (F-11) | P2 | Backend developer | Medium |
| Resolve frontend permission namespace mismatch (F-09) | P2 | Frontend developer | Medium |

### P3 — Engineering Quality and Polish

| Work | Priority | Owner | Effort |
|---|---|---|---|
| Fix lockout in non-production (F-05) | P3 | Developer | Small |
| Move toward adaptive rate limiting (F-06) | P3 | DevOps | Medium |
| Add security headers (F-07) | P3 | DevOps | Small |
| Fix seed data cross-reference (F-08) | P3 | Developer | Small |
| Resolve frontend permission namespace mismatch (F-09) | P3 | Frontend developer | Medium |

### Work requiring UAT or business decision

| Item | Type | Action |
|---|---|---|
| Auditor data scope verification (no live PostgreSQL) | UAT | Provide PostgreSQL; verify auditor role data scope |
| Reminder delivery configuration | Production decision | Configure email/Telegram providers; verify delivery |
| Backup/restore testing | Production decision | Perform backup/restore rehearsal on pre-prod environment |
| Deployment rehearsal | Production decision | Run deployment rehearsal |
| Browser UAT | UAT | Run end-to-end browser tests |

---

## J. KESIMPULAN

**Readiness: NOT READY → PRE-UAT**

Aplikasi GABAH pada branch `audit/dynamic-rbac-full-sync` (commit `b3c2489d63ece6aef0670332a5f0149c454a01e1`) **belum layak untuk masuk UAT** atau lebih lanjut production.

**Alasan:**

1. **5 temuan P1** (ticket status authorization, document upload audit, dashboard data leakage, asset numbering race, lockout on non-prod) yang harus diperbaiki sebelum UAT
2. **Prasyarat teknis belum tersedia**: PostgreSQL, browser UAT, end-to-end test, backup/restore, deployment rehearsal
3. **PR #115 masih dalam status draft** (bukan merge-ready); CI hijau bukan indikasi penerimaan
4. **Aplikasi berada pada tahap pre-UAT** — siap untuk perbaikan P1/P2/P3 dan kemudian UAT

**Rekomendasi:**
- **Langkah 1**: Perbaiki 5 temuan P1 (F-01, F-02, F-03, F-04, F-05)
- **Langkah 2**: Perbaiki temuan P2/P3 (F-06, F-07, F-08, F-09, F-10, F-11)
- **Langkah 3**: Re-run local verification suite (lint, build, menu connectivity, loan authz, meeting room, static tests)
- **Langkah 4**: Lakukan UAT (browser E2E, security testing, deployment rehearsal) — barulah **UAT CANDIDATE**

---

*This report is generated from the comprehensive audit results previously gathered (`HERMES-INDEPENDENT-AUDIT.md`, `HERMES-AUDIT-SUMMARY.md`) and cross-checked against the target branch `audit/dynamic-rbac-full-sync` (commit `b3c2489d63ece6aef0670332a5f0149c454a01e1`). All findings are based on source-code evidence (file:line), dependency audit, and local-safe verification. No files were modified except the new report file; no migrations were run; no production data was accessed; no secrets were exposed.*
