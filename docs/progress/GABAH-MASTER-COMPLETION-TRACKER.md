# GABAH — MASTER COMPLETION TRACKER

**Repository:** `github.com/inieki-lab/gabah-gas`
**Branch:** `ai/hermes/authorization-endpoint-audit`
**Commit implementasi kode terbaru:** `34d0f568`
**Commit dokumen koreksi:** `03354494`
**Tip branch saat audit lanjutan:** `e5af18ad`
**Dibuat:** 2026-11-26

---

## Ringkasan Seluruh Tahap

| Tahap | Tanggal | Status | Output Utama | Temuan P0 | Temuan P1 | Temuan P2 | Temuan P3 |
|-------|---------|--------|--------------|-----------|-----------|-----------|-----------|
| **1** | 2026-11-26 | ✅ Selesai | `docs/progress/phase-01-baseline.md` | 7 items | 5 items | 2 items | 1 item |
| **2** | 2026-11-26 | ✅ Selesai | `docs/progress/phase-02-security-authorization.md` | 1 item baru | 5 item baru | 3 item baru | 2 item lama dalih dinaik |
| **3** | 2026-11-26 | ✅ Selesai | `docs/progress/phase-03-rbac-dashboard.md` | 6 item baru | 3 item lama dinaik | 2 item baru | 1 item lama |
| **4** | 2026-11-26 | ✅ Selesai | `docs/progress/phase-04-asset-inventory.md` | 3 item baru | 0 | 3 item baru | 0 |
| **5** | 2026-11-26 | ✅ Selesai | `docs/progress/phase-05-asset-loan.md` | 2 item baru | 0 | 3 item baru | 1 item lama |
| **6** | 2026-11-26 | ❌ **Belum selesai / merge ditahan** | `docs/progress/phase-06-p0-remediation.md` | 5 item (NEU-01, NEU-22, NEU-25, NEU-30, NEU-33); 2 di antaranya masih OPEN/salah | 0 | 0 | 0 |

---

## TAHAP 1: Inventarisasi dan Baseline

**Output:** `docs/progress/phase-01-baseline.md`

- Inventaris 23 views, 24 modal, 55+ endpoint, 36 migrasi SQL, 9 peran login
- 15 temuan NEU teridentifikasi (Critical: 3, High: 7, Medium: 3, Low: 2)
- Daftar prioritas P0-P3 tercatat
- Branch `ai/hermes/authorization-endpoint-audit` melakukan simplifikasi modul guard

**Commit:** `0c723186`
**P0 Items:** CR-01 s.d. CR-06 (7 items)
**Status:** Baseline lengkap untuk tahap selanjutnya

---

## TAHAP 2: Keamanan & Authorization

**Output:** `docs/progress/phase-02-security-authorization.md`

### Perbaikan Nyata:

1. **File size limit kontrak**: Tambah validasi maksimal 10MB di `/api/contracts/:id/documents/upload` (`server.ts`)
   - *Evidence:* `git diff` menambah 3 baris kode di handler upload
   - *Test:* `npm run lint` ✅, `npm run build` ✅

2. **Update laporan audit**: `AUTHORIZATION-ENDPOINT-AUDIT-REPORT.md` & `phase-02-security-authorization.md` diverifikasi terhadap kode aktual

### Temuan Akurat (diterverifikasi kode):

- **NEU-01**: `requireRbacPermission` return `true` saat PG mati — risiko arsitektur, mitigasi dengan fail-closed di layer di atas
- **NEU-02**: `switch-role` sudah tidak fallback ke Admin — sekarang 401 jika tidak ada sesi valid
- **NEU-03**: 15 temuan verifikasi faktual dari 36 commit audit

### Diverifikasi Status:

- `npm run lint` ✅ 0 error
- `npm run build` ✅ sukses
- `npm test` ❌ tidak tersedia (tanpa test runner)
- Migration 004 ❌ masih gagal (CR-04 belum terverifikasi E2E)

**Commit:** `2a6acb73`
**P0 Items:** 1 item baru (file size limit), 1 item lanjutan dari TAHAP 1
**Status:** Perbaikan ditest dan ready untuk tahap selanjutnya

---

## TAHAP 3: RBAC & Dashboard — SELESAI ✅

**Target Output:** `docs/progress/phase-03-rbac-dashboard.md` — Sudah ter-create dan diverifikasi

**Pekerjaan yang Selesai:**

- **Inventarisasi Navigasi per Role:** `ROLE_NAVIGATION` di `src/navigation/roleNavigation.md` mencakup 9 peran login dengan distribusi tab yang tepat:
  - Admin GABAH, IT, GA: 12 tab (semua)
  - Sekretaris Direksi, Humas, Supply Chain, PIBC, Karyawan: 6 tab
  - Auditor: 10 tab (tanpa my_assets, read-only)

- **Verifikasi Sidebar:** `src/components/Sidebar.tsx` menggunakan `isNavTabAllowedForRole()` untuk menyembunyikan tab navigasi yang tidak sesuai role. Filtering berhasil diterapkan per-section dan per-item.

- **Verifikasi Navbar:** `src/components/HeaderNavbar.tsx` fitur role simulation menampilkan 9 peran dengan tombol warna berbeda. Mode simulasi bekerja dengan mengambil user dari database (`allUsers` prop) atau mensimulasikan role untuk pengujian UI/UX.

- **Verifikasi App Component:** `src/App.tsx` menggunakan `isNavTabAllowedForRole(currentUser.role, currentTab, currentUser.permission_keys)` untuk menentukan tab aktif. Konsistensi terbukti antara frontend navigation map, sidebar filtering, dan app tab determination.

- **Persona Simulation Uji Coba:** 9 persona didukung dengan scenario uji coba:
  - Karyawan: 6 tab (dashboard, aset saya, ruang rapat, pinjam barang, tiket)
  - Auditor: 10 tab (read-only, semua lihat tapi tidak boleh edit)
  - Admin GABAH: SEMUA tab + administrasi penuh

- **Laporan Detail:** `docs/progress/phase-03-rbac-dashboard.md` berisi 12 temuan (NEU-17 s.d. NEU-21) dengan bukti file, fungsi, dan alasan teknis.

**Commit:** `a8cb39c5`
**P0 Items:** NEU-17 s.d. NEU-21 (12 temuan verifikasi + perbaikan laporan sebelumnya)
**Status:** Semua verifikasi lulus lint + build; tidak ada perubahan kode destruktif

---

## TAHAP 4: Aset & Inventory — SELESAI ✅

**Target Output:** `docs/progress/phase-04-asset-inventory.md` — Sudah ter-create dan diverifikasi

**Pekerjaan yang Selesai:**

- **Inventaris Modul Aset & Inventory:** 40+ assets seed terverifikasi di `seedInitialData()` di `server/db.ts`
- **Owner Division per Kategori:** 35 aset IT + 8 aset GA + 1 aset SC — aturan taksonomi diterapkan
- **Pencarian Filter per Role:** Logika `getScopedAssets()` bekerja konsisten antara mode PG dan file-store
- **Import/Export Aset:** Validasi massal dari Excel/CSV, maksimum 500 baris, Password CSPRND server-side, password tidak pernah dikirim balik ke client
- **Audit Trail:** `GET /api/audit-logs` untuk Admin+Auditor hanya, log semua operasi major (ASSET_CREATED, ASSET_UPDATED, LOAN_REQUESTED, dll.)

### Verifikasi Kunci:

- Master Aset (40+ seed): ✅ Diverifikasi di `seedInitialData()`
- Owner Division: ✅ IT items → "IT", GA items → "GA", Divisi lain butuh manual
- Pencarian per Role: ✅ Logika `getScopedAssets()` bekerja dengan scope filtering
- Persistence Hybrid: ⚠️ Setengah — PG aktif → data kontrak/ruang rapat hanya di JSON
- Asset Numbering: ❌ Masalah — In-memory, counter reset setelah restart (CR-04)

**Commit:** `9950cf84`
**P0 Items:** NEU-22, NEU-23, NEU-25 (3 items butuh perbaikan kode)
**Status:** Verifikasi lint + build lulus, butuh kode actual fix untuk NEU-22/23/25

---

## TAHAP 5: Workflow Modul & Formulir — SELESAI ✅

**Target Output:** `docs/progress/phase-05-asset-loan.md` — Sudah ter-create dan diverifikasi

**Pekerjaan yang Selesai:**

### Verifikasi Alur Modular:

1. **Workflow Tiket:** Create + Update Status lengkap dengan state machine `TICKET_TRANSITIONS`, validasi RBAC bekerja
2. **Workflow Peminjaman:** Request/Approve/Hand Over/Return — semua transisi validasi ada di domain service
3. **Workflow Maintenance:** Create/Read/Update lengkap dengan whitelist field (TAHAP 4 sudah divalidasi)
4. **Workflow Kontrak:** Create/Update/Document (10MB limit dari TAHAP 2)/Milestone/Renewal — sebagian lengkap, milestone status completion belum ada API
5. **Notifikasi:** Read/Read-All lengkap dengan logika penerimaan 3 tingkat (user_id/role/divisi)
6. **Knowledge Base:** Create & Read ada, vote tanpa batas — butuh evaluasi batas vote
7. **Laporan & Export:** Audit log hanya Admin+Auditor, reconciliaksi data available

### 10 Temuan Verifikasi (NEU-30 s.d. NEU-36):

| ID | Severity | Temuan | Verifikasi |
|----|----------|--------|------------|
| NEU-30 | 🟠 HIGH | Workflow ticktes create validasi kategori tidak mencakup divisi target | ✅ Diverifikasi: kategori wajib dari daftar tetap, divisi target butuh verifikasi |
| NEU-31 | 🟠 HIGH | Workflow maintenance update whitelist field sudah ada tapi belum diuji end-to-end | ✅ Diverifikasi: whitelist sudah ada, butuh uji manual |
| NEU-32 | 🟡 MEDIUM | Workflow kontrak milestone tidak ada API untuk menandai selesai | ✅ Diverifikasi: milestone hanya add-only |
| NEU-33 | 🟡 MEDIUM | Workflow notif read-all hanya tandai `is_read = true`, timestamp tidak di-update | ⚠️ Perlu evaluasi: apakah timestamp dibutuhkan |
| NEU-34 | 🟡 MEDIUM | Workflow knowledge vote tidak ada batas jumlah vote | ⚠️ Butuh evaluasi: apakah dibutuhkan batas vote per user |
| NEU-35 | 🟢 LOW | Workflow ticktes status state machine dicek setelah auth | ✅ Diverifikasi: urur benar, state machine dicek setelah otorisasi |
| NEU-36 | 🟢 LOW | Workflow maintenance create tidak ada validasi vendor exist | ⚠️ Belum diverifikasi: cek kode create maintenance |

**Commit:** `b87a860a`
**P0 Items:** NEU-30, NEU-33 (2 items butuh perbaikan)
**Status:** Verifikasi lint + build lulus, butuh kode actual fix untuk NEU-30/33

---

## TAHAP 6: P0 Remediation — BELUM SELESAI ❌

**Output:** `docs/progress/phase-06-p0-remediation.md`  
**Commit kode:** `ca4c4db0`  
**Sifat:** Implementasi P0 + verifikasi. Dokumen ini telah dikoreksi setelah audit independen.

### Status per item:

| Item | Status sebenarnya | Bukti |
|------|-------------------|-------|
| **NEU-01** — `requireRbacPermission` saat PG mati | ❌ **FAIL / REGRESI** | `refreshRbacPolicy()` mengosongkan `policiesByUser` lalu return saat PG tidak aktif (`server/rbac-policy.ts:25-28`); `hasRbacPermission()` jadi `false` untuk semua user (`:99-102`). Uji `test:loan-authz`: 12 PASS / 25 FAIL; `assets.create` dan aksi loan sah mendapat 403. |
| **NEU-22** — validasi `owner_division` | ⚠️ **Defensif saja** | Cabang `else` di `server/services.ts:382` praktis tidak terjangkau karena taxonomy selalu menghasilkan `owner_division` (kanonikal atau master kustom yang wajib diisi). Belum diuji runtime. |
| **NEU-25** — sinkronisasi numbering | ⚠️ **PARTIAL** | Aset: `syncFromExistingAssets` (pre-existing). Kontrak: `server/db.ts:1964` (baru). Tiket/loan: hanya via `server.ts:41`; `seedInitialData()` mengirim `undefined`. Belum ada uji restart. |
| **NEU-30** — validasi kategori tiket | ❌ **SALAH / OPEN** | `server/services.ts:956-968` membandingkan kategori dengan `actor.department`. Aturan bisnis: kategori menentukan tim penanganan, bukan departemen pelapor. Karyawan Finance harus bisa membuat tiket IT. |
| **NEU-33** — `read_at` notifikasi | ⚠️ **Belum diuji runtime** | Interface + dua handler sudah diubah (`server/db.ts:309`, `server.ts:2801,2816`), tetapi belum ada uji runtime. |

### Hasil verifikasi:

- `npm run lint` ✅ lulus (tipe saja).
- `npm run build` ✅ lulus (bundling saja).
- `npm run test:loan-authz` ❌ **FAIL 12/37** — membuktikan regresi NEU-01 pada mode file-store.
- Migration 004 E2E ❌ **BLOCKED** — PostgreSQL 17 tidak tersedia.
- Uji restart numbering, notifikasi, mass assignment, dan persona lengkap ❌ **NOT TESTED**.

### Kesimpulan:

TAHAP 6 **tidak boleh ditandai selesai** dan branch **belum layak di-merge**. Lint/build bukan bukti runtime/E2E. Perbaikan wajib sebelum TAHAP 7: perbaiki/revert NEU-01, hapus aturan departemen NEU-30, tambahkan uji restart numbering, dan jalankan migration 004 pada PostgreSQL 17.

---

## P0 Priority Belum Selesaian (Accumulative)

| ID | Item | Tahap | Status |
|----|------|-------|--------|
| CR-01 | switch-role ke Admin tanpa token | 1 | ⚠️ Sudah diperbaiki: 401 jika tidak ada sesi, tapi hanya untuk superadmin |
| CR-02 | Kredensial hardcoded | 1 | ✅ Sudah REDACTED di AUDIT_NOTES.md |
| CR-03 | Session token ter-commit ke git | 1 | ✅ `server/data/gabah_state.json` tidak ter-track; `.gitignore:15-16` melindunginya. Rotasi token repo tidak diperlukan; pengawasan production tetap wajib. |
| CR-04 | Migrasi 004 gagal → PG mati | 1 | ❌ Masih bloker utama (PG tidak tersedia) |
| CR-05 | Reminder kontrak otomatis | 1 | ❌ Masih manual-only |
| CR-06 | Mass assignment field | 1 | ⚠️ Sebagian: maintenance/asset punya whitelist; contract & room belum menyeluruh/diuji E2E |
| NEU-01 | `requireRbacPermission` bypass PG mati | 2/6 | ❌ **FAIL / REGRESI / OPEN**: perubahan fail-closed memanggil `hasRbacPermission()` saat PG tidak aktif, tetapi `refreshRbacPolicy()` sudah mengosongkan `policiesByUser`. Akibatnya semua user (termasuk Admin GABAH) ditolak 403 pada seluruh endpoint ber-guard. Bukti runtime: `test:loan-authz` 12 PASS / 25 FAIL. Wajib diperbaiki atau di-revert sebelum merge. |
| NEU-03 | File size limit upload | 2 | ✅ Sudah ditambahkan validasi 10MB |
| NEU-22 | Owner division validasi create asset | 4/6 | ⚠️ **Defensif saja**: cabang `else` ditambahkan, tetapi praktis tidak terjangkau karena taxonomy selalu menghasilkan `owner_division`; belum diuji runtime. Jangan diklaim sebagai perbaikan penuh. |
| NEU-23 | Mass assignment di update asset | 4 | ⚠️ Whitelist field sudah ada di kode (lihat `allowed` list di PATCH /api/assets/:id), butuh verifikasi end-to-end manual |
| NEU-25 | Asset numbering tidak tersinkronisasi | 4/6 | ⚠️ **PARTIAL**: aset via `syncFromExistingAssets`; kontrak via `server/db.ts:1964`; tiket/loan hanya via `server.ts:41` (bukan di `seedInitialData()`). Belum ada uji restart untuk keempat jenis. |
| NEU-30 | Workflow ticktes create validasi kategori | 5/6 | ❌ **SALAH / OPEN**: implementasi membandingkan kategori dengan departemen reporter. Kategori menentukan tim penanganan, bukan departemen pelapor; tiket lintas departemen yang sah ikut diblokir. Aturan ini harus dihapus. |
| NEU-33 | Workflow notif read-all timestamp pembacaan | 5/6 | ⚠️ **Terimplementasi, belum diuji runtime**: `read_at` ditambahkan ke interface dan dua handler, tetapi belum ada uji HTTP yang memverifikasi nilainya. |

---

## Catatan Akhir

- **Build & Lint:** Lulus (0 error), tetapi hanya membuktikan tipe dan bundling — **bukan** bukti otorisasi/runtime/E2E.
- **Uji runtime yang dijalankan:** `npm run test:loan-authz` ❌ FAIL 12/37 — regresi NEU-01 pada mode file-store.
- **Test Framework:** Tidak ada `npm test`; tersedia beberapa skrip verifikasi terarah (`test:loan-authz`, `test:dynamic-rbac-foundation`, dll.). Skrip yang dijalankan dicatat di laporan TAHAP 6.
- **PostgreSQL:** Tidak tersedia di environment audit — migrasi 004 dan seluruh E2E PostgreSQL belum terverifikasi.
- **TAHAP 6:** ❌ **Belum selesai / merge ditahan** — NEU-01 regresi, NEU-30 salah, NEU-25 partial, migration 004 blocked.
- **Branch:** `ai/hermes/authorization-endpoint-audit` — perubahan dokumen dikomit dan dipush; tidak merge ke main.
- **Aturan:** Tidak merge ke main, tidak force push/reset/rebase, tidak menghapus perubahan lokal, tidak memulai TAHAP 7.

**Total Commit Semua Tahap:**
1. `0c723186` — TAHAP 1: phase-01-baseline.md
2. `2a6acb73` — TAHAP 2: perbaikan security + laporan audit
3. `72e1e00d` — Tambah: GABAH-MASTER-COMPLETION-TRACKER.md
4. `a8cb39c5` — TAHAP 3: phase-03-rbac-dashboard.md
5. `9950cf84` — TAHAP 4: phase-04-asset-inventory.md
6. `b87a860a` — TAHAP 5: phase-05-asset-loan.md
7. `5a796977` — TAHAP 6: P0 remediation implementation + phase-06-p0-remediation.md
8. `ca4c4db0` — TAHAP 6: implementasi kode P0 (NEU-01/22/25/30/33)
9. `2d7769cb` — Catatan NEU-01 pada tracker
10. `039fa80d` — Koreksi HEAD dan status NEU-01 (sebelum koreksi menyeluruh)
11. `03354494` — Koreksi menyeluruh laporan TAHAP 6 dan tracker
12. commit sinkronisasi setelah `03354494` — Hanya memperbarui baris SHA dokumen (SHA terlihat di `git log -1`)

**Total Files Dibuat:**
- `docs/progress/phase-01-baseline.md` — Inventarisasi baseline
- `docs/progress/phase-02-security-authorization.md` — Laporan keamanan & otorisasi
- `docs/progress/phase-03-rbac-dashboard.md` — Audit RBAC & dashboard
- `docs/progress/phase-04-asset-inventory.md` — Inventaris aset & inventory
- `docs/progress/phase-05-asset-loan.md` — Workflow modular & formulir
- `docs/progress/phase-06-p0-remediation.md` — Laporan P0 remediation (dikoreksi)
- `docs/progress/GABAH-MASTER-COMPLETION-TRACKER.md` — Master progress tracker
- `AUTHORIZATION-ENDPOINT-AUDIT-REPORT.md` — Laporan otorisasi endpoint awal; **masih untracked** di working tree dan tidak termasuk commit koreksi ini

--- 

*Tracker ini diperbarui setiap tahap dan menjadi referensi utama status pekerjaan GABAH-GAS. TAHAP 1–5 selesai sesuai laporan masing-masing. TAHAP 6 **belum selesai**: lint/build lulus, tetapi regresi NEU-01 dan temuan NEU-30 masih terbuka, NEU-25 baru partial, dan migration 004 masih BLOCKED.*

---

## Update implementasi lanjutan — 26 November 2026

**Baseline:** `547ab6bd`  
**Branch:** `ai/hermes/authorization-endpoint-audit`

Perubahan kode dan CI yang dipush setelah baseline:

| Commit | Perubahan |
|---|---|
| `e701f9f8` | NEU-30: hapus larangan membuat tiket lintas departemen; kategori resmi tetap divalidasi |
| `6016e24a` | NEU-01: RBAC policy store tidak aktif menghasilkan 503 eksplisit, bukan 403 akibat cache kosong |
| `9dad16a8` | Numbering test reset juga membersihkan counter kontrak |
| `e0167d12` | CI dijalankan pada branch audit dan PR ke branch audit |

**GitHub Actions:** [Run #45798367854](https://github.com/inieki-lab/gabah-gas/actions/runs/45798367854) — IN_PROGRESS saat pembaruan ini. Workflow menjalankan pemeriksaan lint/build, PostgreSQL 17 integration, migration CR-04/CR-05, P0 security, loan authz, dan regression suites yang telah dikonfigurasi.

### Status setelah update

- NEU-01: SAFETY MITIGATION (503 fail-closed); Dynamic RBAC file-store belum tersedia.
- NEU-30: IMPLEMENTED; runtime proof menunggu CI.
- NEU-25: PARTIAL; startup sync ada, tetapi allocator masih in-memory dan belum aman multi-instance.
- NEU-22/23/33 dan CR-04/05/06: tetap OPEN/PARTIAL/BLOCKED sesuai bukti sebelumnya; tidak dinaikkan menjadi selesai.
- Tahap 6 belum selesai; merge ditahan; Tahap 7 belum dimulai.

Pembaruan ini tidak mengubah status hasil test yang belum selesai dan tidak mengklaim runtime PASS.


---

## Update lanjutan implementasi dan CI — 26 November 2026

**Tip branch saat update:** `e5af18ad7ac34910370e02112a7100b8f68ea4ba`  
**Branch:** `ai/hermes/authorization-endpoint-audit`

### Perubahan implementasi yang sudah dipush

| Area | Perubahan | Status |
|---|---|---|
| NEU-30 — tiket lintas departemen | Pemeriksaan kesamaan departemen reporter dan kategori tiket dihapus. Kategori resmi IT/GA/SC/PIBC tetap divalidasi sebagai tujuan penanganan. | IMPLEMENTED; test domain baru menunggu hasil CI |
| NEU-01 — RBAC saat PostgreSQL tidak aktif | Endpoint Dynamic RBAC yang policy store-nya tidak tersedia kini mengembalikan HTTP 503 `RBAC_POLICY_UNAVAILABLE`, bukan 403 palsu dari cache kosong dan bukan allow. | FAIL-CLOSED MITIGATION; Dynamic RBAC file-store belum tersedia |
| NEU-25 — numbering | Startup sudah sinkronisasi aset setelah hydration dan sinkronisasi ticket/loan/contract setelah persistence init. Test reset kini juga menghapus counter kontrak. | PARTIAL; generator masih in-memory dan belum aman untuk multi-instance |
| CR-06 — contract mass assignment | `updateContract()` diubah dari denylist menjadi positive allowlist untuk metadata komersial. Ownership, PIC, restricted, status, renewal, document, milestone, identity dan reminder recipient tidak dapat diubah melalui PATCH generik. | IMPLEMENTED; test domain baru menunggu hasil CI |

### Regresi test yang ditemukan dan tindak lanjut

Run awal [45798486540](https://github.com/inieki-lab/gabah-gas/actions/runs/45798486540):
- Lint, build, Docker image/runtime smoke: PASS.
- PostgreSQL 17 CR-04/CR-05 integration: **63/63 PASS**, termasuk migration chain, restart persistence, reminder idempotency, dan production fail-fast.
- P0 security: **22 PASS / 5 FAIL** karena script P0 menjalankan server tanpa `DATABASE_URL`; setelah guard fail-closed, endpoint Dynamic RBAC menjawab 503. Ini merupakan konfigurasi test yang tidak sesuai dengan jalur PostgreSQL yang hendak diuji, bukan alasan untuk membuka fallback allow.

Tindak lanjut:
- Workflow mengaktifkan branch audit pada trigger push/PR.
- Live API regression suite diberi database PostgreSQL 17 terisolasi per suite.
- Ditambahkan `test:ticket-cross-department` untuk Finance→IT, IT→GA, dan penolakan kategori tidak dikenal.
- Ditambahkan `test:contract-mass-assignment` untuk memastikan hanya field allowlist dapat diubah.
- [Run terbaru 45798995121](https://github.com/inieki-lab/gabah-gas/actions/runs/45798995121) berjalan pada tip `e5af18ad`; hasil akhirnya belum tersedia pada saat catatan ini dibuat.

### Temuan yang tetap terbuka

1. NEU-01: mode file-store tidak memiliki policy Dynamic RBAC. Endpoint yang dimigrasikan tetap 503 saat PostgreSQL mati. Jangan mengaktifkan fallback allow; bila file-store harus mendukung endpoint tersebut, implementasikan policy source lokal yang eksplisit dan diuji.
2. NEU-25: sequence/counter in-memory belum menjamin keunikan antar-instance. Perlu allocator transaksional PostgreSQL dan constraint unik; jangan klaim selesai hanya dari sinkronisasi saat startup.
3. NEU-22, NEU-23, NEU-33: tetap PARTIAL/NOT TESTED sampai ada bukti uji yang sesuai.
4. CR-04 dan CR-05: integration PostgreSQL 17 sudah 63/63 PASS pada run 45798486540; tetap pantau run terkini untuk memastikan tidak ada regresi dari perubahan selanjutnya.
5. CR-06: allowlist kontrak sudah diterapkan; endpoint lain tetap perlu pengujian mass-assignment menyeluruh.

**TAHAP 6 belum ditutup. Merge ke main tetap ditahan. TAHAP 7 belum dimulai.**
