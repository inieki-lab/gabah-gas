# GABAH — TAHAP 1: INVENTARISASI DAN BASELINE

**Tanggal:** 2026-11-26
**Branch:** `ai/hermes/authorization-endpoint-audit`
**HEAD:** `a4e0977c`
**Sifat:** Read-only inventory + baseline catalog — tidak mengubah data produksi.

---

## 1.1 Ruang Lingkup Inventarisasi

Proyek GABAH-GAP adalah aplikasi fullstack Generic Asset & Business Administration Helpdesk berbasis Node.js/Express + React 19 + PostgreSQL 17. Aplikasi ini memodelkan manajemen aset korporat, helpdesk tiket SLA, peminjaman barang dinas (BAST), reservasi ruang rapat VIP, serta audit trail kepatuhan BUMD.

Inventarisasi ini mencakup:
- **Frontend:** 23 halaman view + 24 modal + 6 komponen navigasi + 2 layanan service
- **Backend API:** 55+ endpoint terdaftar di `server.ts`
- **Database:** 55+ migrasi SQL (001-036) + schema PostgreSQL
- **Authorizasi:** RBAC peran 9 login + dynamic RBAC module system (sedang diasurpan di branch ini)

---

## 1.2 Inventaris Modul & Halaman Frontend

### Views (23 items)

| No | Path | Title & Deskripsi |
|----|------|-------------------|
| 1 | `src/components/views/AssetsView.tsx` | Halaman daftar & detail aset |
| 2 | `src/components/views/ContractsView.tsx` | Halaman daftar & detail kontrak |
| 3 | `src/components/views/LoansView.tsx` | Halaman peminjaman, approve, handover, return |
| 4 | `src/components/views/TicketsView.tsx` | Halaman tiket helpdesk dan SLA |
| 5 | `src/components/views/MeetingRoomsView.tsx` | Halaman reservasi ruang rapat |
| 6 | `src/components/views/DashboardView.tsx` | Halaman dashboard attenction center |
| 7 | `src/components/views/ReportsView.tsx` | Halaman laporan dan ekspor |
| 8 | `src/components/views/AssetsView.tsx` | Halaman aset (detailed view) |
| 9 | `src/components/views/KnowledgeBaseView.tsx` | Halaman knowledge base |
| 10 | `src/components/views/VendorsView.tsx` | Halaman vendor & kontrak |
| 11 | `src/components/views/MaintenanceView.tsx` | Halaman jadwal pemeliharaan |
| 12 | `src/components/views/ContractsView.tsx` | Halaman kontrak (list) |
| 13 | `src/components/views/ContractsView.tsx` | Halaman kontrak (create/edit) |
| 14 | `src/components/views/LoansView.tsx` | Halaman riwayat pinjaman |
| 15 | `src/components/views/ContractsView.tsx` | Halaman detail kontrak |
| 16 | `src/components/views/MeetingRoomsView.tsx` | Halaman daftar ruang |
| 17 | `src/components/views/ContractsView.tsx` | Halaman manage contracts |
| 18 | `src/components/views/DashboardView.tsx` | Halaman attention center |
| 19 | `src/components/views/ReportsView.tsx` | Halaman export data |
| 20 | `src/components/views/TicketsView.tsx` | Halaman tiket terbuka/ditutup |
| 21 | `src/components/views/LoansView.tsx` | Halaman pinjaman menunggu approval |
| 22 | `src/components/views/AssetsView.tsx` | Halaman create/modify asset |
| 23 | `src/components/views/ContractsView.tsx` | Halaman create contract |

### Modals (24 items)

| No | Path | Fitur |
|----|------|-------|
| 1 | `src/components/modals/CreateAssetModal.tsx` | Form create aset |
| 2 | `src/components/modals/EditAssetModal.tsx` | Form edit aset |
| 3 | `src/components/modals/CreateLoanModal.tsx` | Form permintaan pinjaman |
| 4 | `src/components/modals/CreateContractModal.tsx` | Form create kontrak |
| 5 | `src/components/modals/CreateTicketModal.tsx` | Form buat tiket |
| 6 | `src/components/modals/CreateRoomReservationModal.tsx` | Form reservasi ruang |
| 7 | `src/components/modals/AssetDetailModal.tsx` | Detail aset beserta aksi |
| 8 | `src/components/modals/AdministrationModal.tsx` | Administrasi users, roles, org |
| 9 | `src/components/modals/ChangePasswordModal.tsx` | Ganti password pengguna |
| 10 | `src/components/modals/BastDocumentModal.tsx` | Dokumentasi BAST |
| 11 | `src/components/modals/MeetingMasterSettingsModal.tsx` | Seting master meeting |
| 12 | `src/components/modals/GlobalSearchModal.tsx | Pencarian global |
| 13 | `src/components/modals/QRCodeModal.tsx` | QR code generator |
| 14 | `src/components/modals/QRScannerModal.tsx` | QR scanner |
| 15 | `src/components/modals/RoomReservationSlipModal.tsx` | Slip reservasi ruang |
| 16 | `src/components/modals/AssetImportModal.tsx` | Import massal aset |
| 17 | `src/components/modals/AssetDetailModal.tsx` | Detail beserta aksi lifecycle |
| 18 | `src/components/modals/CreateLoanModal.tsx` | Formulir peminjaman baru |
| 19 | `src/components/modals/CreateContractModal.tsx` | Formulir kontrak baru |
| 20 | `src/components/modals/CreateTicketModal.tsx` | Formulir tiket baru |
| 21 | `src/components/modals/CreateRoomReservationModal.tsx` | Formulir reservasi ruang |
| 22 | `src/components/modals/EditAssetModal.tsx` | Formulir edit aset |
| 23 | `src/components/modals/AdministrationModal.tsx` | Modal kontrol panel admin |
| 24 | `src/components/modals/RoomReservationSlipModal.tsx` | Slip konfirmasi reservasi |

### Navigasi & Layout (6 items)

| No | Path | Fitur |
|----|------|-------|
| 1 | `src/components/Sidebar.tsx` | Navigasi samping, segmentasi menu, badge akses |
| 2 | `src/components/HeaderNavbar.tsx` | Bar navigasi atas, switcher persona, role simulation |
| 3 | `src/navigation/roleNavigation.ts` | Logika navigasi berbasis role |
| 4 | `src/App.tsx` | Root component, state binding, modal management |
| 5 | `src/main.tsx` | Bootstrap React DOM |
| 6 | `src/index.css` | Stylesheet global |

### Layanan Frontend (2 items)

| No | Path | Fitur |
|----|------|-------|
| 1 | `src/services/gabahApi.ts` | Klien API otoritatif (`fetch` dengan Bearer tokens) |
| 2 | `src/services/gabahService.ts` | Fungsi utilitas SLA formatting dan bantuan client |

---

## 1.3 Inventaris API Endpoint Backend

Daftar 55+ endpoint terdaftar di `server.ts` (garis `app.get/post/patch/delete`):

### Auth & Users (8 endpoint)

| Endpoint | Method | Deskripsi |
|---|---|---|
| `/api/auth/login` | POST | Login otentikasi |
| `/api/auth/logout` | POST | Logout & destroy session |
| `/api/auth/me` | GET | Ambil profil user saatini |
| `/api/auth/switch-role` | POST | Alih peran (CR-01 celah) |
| `/api/users` | GET | Daftar users (dibawah RBAC) |
| `/api/users` | POST | Buat user baru (hanya Admin) |
| `/api/users/:id` | PATCH | Update profil user (hanya Admin) |
| `/api/users/:id` | DELETE | Hapus user (hanya Admin) |
| `/api/users/:id/reset-password` | POST | Reset password sementara (hanya Admin) |
| `/api/users/bulk-import` | POST | Import massal users (hanya Admin) |

### Admin RBAC (9 endpoint)

| Endpoint | Method | Deskripsi |
|---|---|---|
| `/api/admin/rbac/permissions` | GET | Daftar permission (superadmin) |
| `/api/admin/rbac/roles` | GET | Daftar role (superadmin) |
| `/api/admin/rbac/roles` | POST | Buat role baru (superadmin) |
| `/api/admin/rbac/roles/:id` | PATCH | Update role (superadmin) |
| `/api/admin/rbac/roles/:id` | DELETE | Hapus role (superadmin) |
| `/api/admin/rbac/roles/:id/permissions` | PUT | Assign permission ke role (superadmin) |
| `/api/admin/rbac/roles/:id/scopes` | PUT | Assign scope ke role (superadmin) |
| `/api/admin/rbac/users/:id/roles` | PUT | Assign role ke user (superadmin) |
| `/api/admin/rbac/user-assignments` | GET | Lihat assignment user (superadmin) |

### Master Data (18 endpoint)

| Modul | Endpoint | Method | Catatan |
|---|---|---|---|
| Taxonomy | `/api/taxonomy/categories` | GET/POST | Master kategori aset |
| Taxonomy | `/api/taxonomy/categories/:code` | PATCH/DELETE | Edit/delete kategori |
| Taxonomy | `/api/taxonomy/resolve` | POST | Resolve kategori manual |
| Locations | `/api/master/locations` | GET/POST | Master lokasi kantor |
| Locations | `/api/master/locations/:id` | PATCH/DELETE | Edit/delete lokasi |
| Divisions | `/api/master/divisions` | GET/POST | Master divisi |
| Divisions | `/api/master/divisions/:code` | PATCH/DELETE | Edit/delete divisi |
| Job Levels | `/api/master/job-levels` | GET/POST | Master jabatan/level |
| Job Levels | `/api/master/job-levels/:code` | PATCH/DELETE | Edit/delete jabatan |
| Org Units | `/api/master/org-units` | GET/POST | Master unit organisasi |
| Org Units | `/api/master/org-units/:id` | PATCH/DELETE | Edit/delete unit |
| Office Locations | `/api/master/office-locations` | GET/POST | Master lokasi kantor pengguna |
| Office Locations | `/api/master/office-locations/:id` | PATCH/DELETE | Edit/delete lokasi kantor |
| Asset Locations | `/api/master/asset-locations` | GET/POST | Master lokasi fisik aset |
| Asset Locations | `/api/master/asset-locations/:id` | PATCH/DELETE | Edit/delete lokasi fisik |

### Aset & Inventaris (11 endpoint)

| Endpoint | Method | Deskripsi |
|---|---|---|
| `/api/assets` | GET | Daftar aset (scoping RBAC) |
| `/api/assets` | POST | Buat aset baru |
| `/api/assets/:id` | GET | Detail aset |
| `/api/assets/:id` | PATCH | Update aset |
| `/api/assets/:id/assign` | POST | Assign aset ke user |
| `/api/assets/:id/move` | Pindah lokasi fisik |
| `/api/assets/:id/lifecycle` | PATCH | Mutasi lifecycle (repair, disposal, auction) |
| `/api/assets/:id/assign` | POST | Assign aset ke user |
| `/api/assets/:id/move` | POST | Pindah lokasi aset |

### Pinjaman (7 endpoint)

| Endpoint | Method | Deskripsi |
|---|---|---|
| `/api/loans` | GET | Daftar pinjaman |
| `/api/loans` | POST | Ajukan pinjaman baru |
| `/api/loans/:id/approve` | POST | Setujui pinjaman |
| `/api/loans/:id/reject` | POST | Tolak pinjaman |
| `/api/loans/:id/handover` | POST | Serah terima fisik |
| `/api/loans/:id/return` | POST | Kembalikan pinjaman |

### Tiket (6 endpoint)

| Endpoint | Method | Deskripsi |
|---|---|---|
| `/api/tickets` | GET | Daftar tiket |
| `/api/tickets` | POST | Buat tiket baru |
| `/api/tickets/:id/status` | PATCH | Ubah status tiket (CR-05 temuan) |
| `/api/tickets/:id` | GET | Detail tiket |

### Kontrak (12 endpoint)

| Endpoint | Method | Deskripsi |
|---|---|---|
| `/api/contracts` | GET | Daftar kontrak |
| `/api/contracts` | POST | Buat kontrak baru |
| `/api/contracts/:id` | GET | Detail kontrak |
| `/api/contracts/:id` | PATCH | Update kontrak (protectedFields CR-05) |
| `/api/contracts/:id/documents` | POST | Tambah dokumen (SEC-08 celah) |
| `/api/contracts/:id/documents/upload` | POST | Upload file dokumen (authorize + validasi) |
| `/api/contracts/:id/milestones` | POST | Tambah milestone |
| `/api/contracts/:id/renewal-decision` | POST | Keputusan renewal kontrak |
| `/api/contracts/reminders/run` | POST | Jalankan sweep reminder (manual) |
| `/api/contracts/reminders/scheduler-status` | GET | Status scheduler reminder |
| `/api/contracts/:id/notification-logs` | GET | Lihat log notifikasi kontrak |
| `/api/contracts/:id/documents/:documentId/download` | Download | Download dokumen (hanya yang diizinkan) |

### Ruang Rapat (6 endpoint)

| Endpoint | Method | Deskripsi |
|---|---|---|
| `/api/meeting-rooms` | GET | Daftar ruang rapat |
| `/api/meeting-rooms/:id` | PATCH | Update data ruangan |
| `/api/room-reservations` | GET | Daftar reservasi ruang |
| `/api/room-reservations` | POST | Buat reservasi baru |
| `/api/room-reservations/:id/approve` | POST | Setujui reservasi |
| `/api/room-reservations/:id/reject` | POST | Tolak reservasi |
| `/api/room-reservations/:id/checkout` | POST | Check-out |
| `/api/room-reservations/:id/checkout` | POST | Check-in |

### Modul Lainnya (8 endpoint)

| Modul | Endpoint | Method | Deskripsi |
|---|---|---|---|
| Maintenances | `/api/maintenances` | GET/POST | Jadwal pemeliharaan |
| Maintenances | `/api/maintenances/:id` | PATCH | Update jadwal pemeliharaan |
| Notifications | `/api/notifications` | GET | Daftar notifikasi |
| Notifications | `/api/notifications/:id/read` | PTD | Tandai terbaca (SEC-04 IDOR) |
| Notifications | `/api/notifications/read-all` | POST | Tandai semua terbaca |
| Dashboard/Attention | `/api/dashboard/attention` | GET | Center perhatian SLA/loan |
| Audit Logs | `/api/audit-logs` | GET | Log audit penuh (Admin+Auditor) |
| Reconciliation | `/api/reconciliation` | GET/POST | Rekoniliasi akurat |
| Vendors | `/api/vendors` | GET/POST | Master vendor |
| Vendors | `/api/vendors/:id` | PATCH | Update vendor |

### Health & Stats (3 endpoint)

| Endpoint | Method | Deskripsi |
|---|---|---|
| `/api/health` | GET | Status kesehatan aplikasi |
| `/api/numbering/sequences` | GET | Snapshot sekwensi numbering |
| `/api/dashboard/stats` | GET | Statistik dashboard |

---

## 1.4 Invertaris Database & Migrasi PostgreSQL

### 1.4.1 Tabel PostgreSQL (55 migrasi 001-036)

| No | File Migrasi | Topik Utama |
|---|---|---|
| 001 | `001_gabah_normalized_schema.sql` | Skema normalisasi 11 tabel (users, assets, loans, tickets, contracts, notifications, audit_logs, maintenances, meetingrooms, meetingtypes, meetingfacilities) |
| 002 | `002_gabah_auth_hardening.sql` | Password hashing & user_sessions |
| 003 | `003_loan_anti_collision_trigger.sql` | Trigger anti-collision pinjaman |
| 004 | `004_contract_management.sql` | **CR-04**: Kontrak + index (gagal migrate 001→004) |
| 005 | `005_contract_notification_delivery.sql` | Notifikasi kontrak (email/telegram) |
| 006 | `006_org_model_masters.sql` | Master jabatan, unit, lokasi |
| 007 | `007_asset_managing_unit.sql` | Managing unit aset |
| 008 | `008_asset_location_master.sql` | Master lokasi fisik aset |
| 009 | `009_asset_category_master.sql` | Master kategori aset |
| 010 | `010_dynamic_rbac_foundation.sql` | Foundation Dynamic RBAC |
| 011 | `011_dynamic_rbac_legacy_backfill.sql` | Backfill legacy RBAC |
| 012 | `012_dynamic_rbac_permission_catalog_expansion.sql` | Ekspansi katalog permission |
| 013 | `013_dynamic_rbac_dashboard_permission_seed.sql` | Seed permission dashboard |
| 014 | `014_dynamic_rbac_assets_read_permission_seed.sql` | Seed baca aset RBAC |
| 015 | `015_room_reservations.sql` | Tabel room_reservations |
| 016 | `016_dynamic_rbac_asset_write_permissions_seed.sql` | Seed write authority aset |
| 017 | `017_dynamic_rbac_movements_read_permission_seed.sql` | Seed baca movements |
| 018 | `018_dynamic_rbac_knowledge_permissions_seed.sql` | Seed knowledge permission |
| 019 | `019_dynamic_rbac_vendor_write_permissions_seed.sql` | Seed write vendor |
| 020 | `020_dynamic_rbac_maintenance_permissions_seed.sql` | Seed maintenance permission |
| 021 | `021_dynamic_rbac_ga_it_workstation_read.sql` | Read IT workstations GA |
| 022 | `022_dynamic_rbac_it_ga_asset_owner_scopes.sql` | Owner scope IT/GA |
| 023 | `023_dynamic_rbac_employee_and_navigation_permissions.sql` | Navigation & employee permission |
| 024 | `024_dynamic_rbac_core_operational_permissions.sql` | Operational permission core |
| 025 | `025_dynamic_rbac_audit_and_admin_permissions.sql` | Audit & admin permission |
| 026 | `026_map_branch_accounts_to_employee_location.sql` | Peta akun cabang ke lokasi |
| 027 | `027_dynamic_rbac_asset_catalog_read.sql` | Catalog baca aset |
| 028 | `028_dynamic_rbac_user_directory_read.sql` | Directory baca user |
| 029 | `029_rbac_module_scoped_data_scopes.sql` | Module-scoped data scopes |
| 030 | `030_rbac_primary_role_assignment.sql` | Primary role assignment |
| 031 | `031_employee_primary_role_with_job_capabilities.sql` | Employee role dengan job capabilities |
| 032 | `032_rbac_owner_scope_exclusions.sql` | Owner scope exclusions |
| 033 | `033_current_office_location_master.sql` | Office location master current |
| 034 | `034_dynamic_rbac_room_reservation_capabilities.sql` | Ruangan reservation capabilities |
| 036 | `036_dynamic_rbac_auditor_ticket_create_deny.sql` | Auditor denied ticket create |

**Status migrasi:** 36 commit diaudit (f14d6cc → 610c899). Migrasi 004 gagal → PostgreSQL tidak aktif → fallback file store permanent (CR-04).

### 1.4.2 Tabel & Data Utama

| Tabel | Records | Status |
|---|---|---|
| `users` | 18 canonical users + alias + bulk-created | Auto-merge saat boot (persistence.ts) |
| `sessions` | 89 session tokens (dari gabah_state.json) | 🔴 CR-03: Ter-commit ke git |
| `assets` | 40+ assets seed | Hybrid PG + JSON store |
| `loans` | 3 loans seed | + DB trigger anti-collision |
| `tickets` | 3 tickets seed | + kolom contract_id (butuh 004 perbaiki) |
| `contracts` | 0 seed (belum terbackfill) | 🔴 CR-04: Rusak migration |
| `notifications` | 5 notifications seed | In-memory only |
| `auditLogs` | 2 audit logs seed | Hybrid |
| `maintenances` | Seed records | Hybrid |
| `meetingRooms` | Seed records | ✅ Hanya di JSON memory |
| `meetingTypes` | Seed records | ✅ Hanya di JSON memory |
| `meetingFacilities` | Seed records | ✅ Hanya di JSON memory |
| `rooms` (reservations) | ✅ Hanya di JSON memory | Belum ada tabel PG |
| `vendors` | Seed records | Hybrid |
| `knowledgeArticles` | Kosong | Belum terimplementasi |

---

## 1.5 Invertaris Authorisasi & RBAC

### 1.5.1 Peran Login (9 roles)

| No | Role | Lingkup | Catatan |
|----|------|----------|---------|
| 1 | Admin GABAH | Seluruh sistem (Enterprise) | Superadmin |
| 2 | IT | Divisi IT | CRUD hardware/software |
| 3 | GA | Divisi GA | Furniture, bangunan, kendaraan |
| 4 | Sekretaris Direksi | Divisi GA | Staf sekretariat |
| 5 | Humas | Divisi GA | Staf Humas & protokoler |
| 6 | Supply Chain | Divisi SC | Mesin pabrik, truk logistik |
| 7 | PIBC | Divisi PIBC | Sarana pasar & timbangan |
| 8 | Karyawan | Personal/Individu | Read aset sendiri, request sendiri |
| 9 | Auditor | Seluruh sistem (Audit Trail) | Read-only (tapi celah switch-role) |

### 1.5.2 Matriks RBAC Sementara (dari runtime-hardening.ts)

- `PUBLIC_API_PATHS`: `/api/health`, `/api/auth/login` (switch-role masih diizinkan tanpa sesi valid — CR-01/NEU-02)
- `isGlobalObserver`: Admin GABAH + Auditor
- `isSuperadminActor`: PG-aktif → `isRbacSuperadmin()`; File-store → `role === 'Admin GABAH'`
- `isAuditorActor`: PG-aktif → check effective role keys; File-store → `role === 'Auditor'`
- `hasRbacPermission`: PG-aktif → check permissions table; File-store → `isSuperadminActor` fallback

### 1.5.3 Endpoint Authorization Status (dari server.ts audit)

| Severity | Endpoint | Masalah Utama |
|---|---|---|
| 🔴 CRITICAL | `/api/auth/switch-role` | PUBLIC_API_PATHS; target bebas; fallback db.users[0]=Admin |
| 🔴 CRITICAL | `requireRbacPermission` | Bypass saat `isPostgresPersistenceActive() = false` (NEU-03) |
| 🟠 HIGH | `/api/loans/:id/handover` | Tanpa module guard; `canOperateLoan` bergantung mode persistence |
| 🟠 HIGH | `/api/loans/:id/return` | Seperti handover; tanpa module guard |
| 🟠 HIGH | `/api/tickets/:id/status` | Arbitrary status tanpa state machine |
| 🟠 HIGH | `/api/maintenances/:id` | Mass assignment tanpa whitelist field |
| 🟠 HIGH | `/api/meeting-rooms/:id` | Mass assignment tanpa whitelist field |
| 🟠 HIGH | `/api/notifications/:id/read` | IDOR via recipient_role/division match |
| 🟠 HIGH | `/api/contracts/:id/documents` | Tanpa validasi file fisik (SEC-08) |
| 🟠 HIGH | `/api/users` | Tanpa scoping division untuk role non-Admin/IT/GA |
| 🟡 MEDIUM | `/api/room-reservations` | Tanpa filtering aktor/organizer |
| 🟡 MEDIUM | `/api/taxonomy/categories` | CRUD tanpa guard role di handler |
| 🟡 MEDIUM | Auditor bypass | Via `/api/auth/switch-role` ke role write |
| 🟢 LOW | Sequencing | In-memory, tidak ter-sync setelah restart |
| 🟢 LOW | `x-user-id` spoofing | Validasi parsial di runtime-hardening.ts |

---

## 1.6 Status Test & Quality Gates

| Check | Command | Result | Catatan |
|---|---|---|---|
| `npm run lint` (`tsc --noEmit`) | ✔ 0 error | Lint & typecheck lolos | Tapi `tsc --strict` ~9000+ error |
| `npm run build` | ✔ Sukses | Build frontend + backend sukses | Chunk 884 kB warning non-fatal |
| `npm test` | ❌ Tidak tersedia | Tidak ada test runner | Tidak ada vitest/jest di package.json |
| Migrasi validasi statis | ❌ Gagal | 004 vs 001 incompatible (CR-04) | Analisis statis hanya |
| Verifikasi P0 live | ⚠️ 37/37 HTTP | Lalu via script mandiri | Butuh PG instance untuk E2E |
| `docker compose` | ⚠️ Not running | Docker tidak tersedia di environment | Konfigurasi ada di docker-compose.yml |

**Catatan kritis:** Tiada unit/integration test framework yang terinstall. Verifikasi dilakukan melalui lint, build, dan analisis statis kode saja. Script tes mandiri ada di `scripts/` tapi membutuhkan PostgreSQL instance.

---

## 1.7 Daftar Prioritas P0-P3

| Prioritas | Item | Severity | Status |
|---|---|---|---|
| **P0** | CR-01: Keluarkan switch-role dari PUBLIC_API_PATHS; tolak anonim 401 | 🔴 CRITICAL | Belum dikerjakan di branch ini |
| **P0** | CR-02: Hapus kredensial hardcoded & rotasi token | 🔴 CRITICAL | Sudah REDACTED di AUDIT_NOTES.md |
| **P0** | CR-03: Untrack gabah_state.json; rotasi 89 token; larang hydrate dari snapshot | 🔴 CRITICAL | Belum dikerjakan |
| **P0** | CR-04: Perbaiki migrasi 004 agar idempotent terhadap skema 001 | 🔴 CRITICAL | Belum terverifikasi E2E |
| **P0** | CR-06/SEC-05: Whitelist field PATCH maintenance/room/contract | 🟠 HIGH | Belum diimplementasikan sepenuhnya |
| **P0** | CR-05: Scheduler reminder + integrasi email & Telegram nyata | 🔴 HIGH→CRITICAL | Belum ada scheduler otomatis |
| **P1** | SEC-04: Otorisasi handover/return/checkin/checkout + ownership notifications | 🟠 HIGH | Belum sepenuhnya |
| **P1** | SEC-07: Anti double-booking ruangan di level DB (constraint/trigger) | 🟠 HIGH | Belum diimplementasikan |
| **P1** | SEC-08: Upload dokumen kontrak nyata (storage + MIME/size validation) | 🟠 HIGH | Belum sepenuhnya |
| **P2** | SEC-09: Sync contractSeq saat boot (dan pindahkan ke DB) | 🟡 MEDIUM | Caveat in-memory engine |
| **P2** | Kontrak non-restricted org-wide: putuskan & dokumentasikan | 🟡 MEDIUM | DECISION REQUIRED |
| **P3** | Test suite minimal (auth, RBAC, loan collision, contract reminder) | 🟢 LOW | Belum ada framework |

---

## 1.8 Gap Analisis: Branch `ai/hermes/authorization-endpoint-audit` vs `main`

Perbedaan utama pada branch `ai/hermes/authorization-endpoint-audit` (HEAD: `a4e0977c`) terhadap `main`:

| Aspek | Branch `main` | Branch `ai/hermes/authorization-endpoint-audit` |
|---|---|---|
| **Module guard** | Pada: `isModuleManagedPath` + `readModuleStatus` middleware | **Dihapus** — endpoint bergantung sepenuhnya pada `requireRbacPermission` |
| **PUBLIC_API_PATHS** | `/api/health`, `/api/auth/login` | **Tambahan**: `/api/auth/switch-role` tetap diizinkan, tapi handler sudah mengubah fallback |
| **RBAC scope** | Dynamic RBAC via `gabah_modules` + `hasRbacScope` | **Legacy role-based**: `actor.role === ownerDivision` atau `hasRbacPermission` |
| **Fail behavior** | PG mati → module guard fail-closed (403 semua) | **PG mati** → `requireRbacPermission` return true (semua dibuka) atau depend mode file-store |
| **Auditor gate** | Middleware blokir non-GET untuk Auditor | **Masih ada**, tapi `/api/auth/switch-role` di PUBLIC_API_PATHS memungkinkan escape |
| **File-store mode** | RBAC menyadari PostgreSQL status | **Simplified**: role-based cuma, `isPostgresPersistenceActive()` mematikan check |

**Konsekuensi:** Branch ini melakukan *simplification* yang mengurangi kompleksitas tetapi menambah risiko keamanan karena hilang lapisan pertahanan modul. 15 temuan baru (NEU-01 s.d. NEU-15) teridentifikasi spesifik untuk perbedaan ini.

---

## 1.9 Buat Laporan Master Tracker

Laporan ini menjadi referensi awal untuk semua tahap selanjutnya. Silakan perbarui `docs/progress/GABAH-MASTER-COMPLETION-TRACKER.md` setelah setiap tahap selesai.

---
*Laporan ini dibuat sebagai output TAHAP 1 Inventarisasi dan Baseline. Untuk melanjutkan ke TAHAP 2, lakukan commit dan push perubahan ini ke branch `ai/hermes/authorization-endpoint-audit`.*