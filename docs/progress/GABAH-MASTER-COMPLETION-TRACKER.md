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

---

## Update perbaikan ruang rapat — 26 November 2026

**Branch:** `ai/hermes/authorization-endpoint-audit`  
**Commit implementasi:** `5b7db99897049a2d4091577d92c36c721af660de`

### Temuan CI dan tindakan

Pada GitHub Actions run `45799447862`, pemeriksaan sebelumnya menunjukkan 14/18 PASS dan 4 FAIL pada skenario ruang rapat:

- Organizer yang sah gagal check-in (403).
- Rapat yang sedang berlangsung tidak terlindungi dari override jadwal (201, seharusnya 409).
- Organizer yang sah gagal check-out (403).
- Percobaan check-out kedua menghasilkan 403, bukan konflik status 409.

Akar masalah: route check-in/check-out menerapkan permission gate global sebelum domain service, padahal aturan domain mengizinkan organizer melakukan aksi atas reservasinya sendiri. Domain service sudah memeriksa kepemilikan/izin GA dan state transition.

### Perubahan kode

- Menghapus permission gate global `room_reservations.checkin` dan `room_reservations.checkout` pada dua route.
- Tetap mewajibkan autentikasi melalui session middleware dan `getActor()`.
- Otorisasi kepemilikan reservasi/izin GA dan status reservasi tetap ditegakkan di `checkinRoomReservation()` / `checkoutRoomReservation()`.
- Dengan check-in organizer berhasil, status menjadi `in_use`; pemeriksaan benturan yang sudah ada di `requestRoomReservation()` akan menolak override jadwal yang bertabrakan dengan status `in_use`.

### Verifikasi

- Belum ada hasil CI untuk commit perbaikan saat catatan ini ditulis.
- Tidak mengklaim 18/18 PASS sebelum workflow terbaru selesai.
- Uji anon check-in tetap harus 401; pengguna lain tetap harus 403; organizer check-out kedua harus 409.
- TAHAP 6 tetap OPEN sampai seluruh pemeriksaan CI dan temuan P0 lain dituntaskan.

**Status merge:** ditahan; tidak ada merge ke `main`.


## 2026-11-26 — CI PostgreSQL isolation: organization-model regression

- Branch: `ai/hermes/authorization-endpoint-audit`
- Finding: CI run `45807458028` passed meeting-room regression (18/18), but organization-model regression reported 4 asset-scope/owner failures. Job logs showed PostgreSQL password-authentication failures immediately before the org-model test. The workflow step did not provision a dedicated database or explicitly set `DATABASE_URL` / `PGPASSWORD`, unlike adjacent live integration tests; the test server therefore could fall back to file-store mode while its assertions expected PostgreSQL Dynamic RBAC.
- Change: `.github/workflows/ci.yml` now creates isolated `gabah_org_ci` and supplies `postgresql://postgres:postgres@127.0.0.1:5432/gabah_org_ci` plus `PGPASSWORD=postgres` to the organization-model regression.
- Commit: `6242b8ea5df97233499ebb9f3ea1f524ff4f477f`
- Validation: workflow rerun triggered by this commit; outcome pending. Do not interpret prior 4 asset assertions as confirmed application defects until this test runs against the intended PostgreSQL-backed policy store.
- Meeting-room authorization fix remains validated by CI run `45807458028`: 18/18 PASS. Overall workflow remains failed due organization-model step before this CI harness correction.
- No merge to `main`.


## 2026-11-26 — CI isolation for asset master regression suites

- Branch: `ai/hermes/authorization-endpoint-audit`
- CI run `45809903599`: lint, build, Docker runtime smoke, PostgreSQL 17 CR-04/CR-05, P0 security, directory scope, loan authorization, cross-department tickets, contract mass-assignment, meeting room (18/18), and organization model (15/15) all passed. The workflow then stopped at T2B-1.
- T2B-1 result on that run: 3/18 PASS, 15 FAIL. The test runner spawned its application without `DATABASE_URL`; Dynamic RBAC endpoints therefore ran without PostgreSQL policy persistence and returned 503/403. Its assertions include privileged CRUD operations and restart/persistence checks, so the execution environment did not match the intended PostgreSQL integration path.
- Change in `.github/workflows/ci.yml`: provision three independent databases and pass explicit `DATABASE_URL` + `PGPASSWORD` to T2B-1 managing-unit, T2B-2 asset-location, and T2B-3 category-master suites. Each suite now has isolated database state.
- Commit: `ebaf4e295c1d398e30cd00cf098d7a170d3bab99`.
- Validation: new workflow run pending. No application behavior is claimed fixed by this CI-only change; actual T2B assertions must pass on the rerun.
- Latest verified business suites remain organization model 15/15 and meeting room 18/18 on run `45809903599`.
- No merge to `main`.


## 2026-11-26 — Koreksi mode uji restart T2B-2

- Branch: `ai/hermes/authorization-endpoint-audit`
- CI run [45810605563](https://github.com/inieki-lab/gabah-gas/actions/runs/45810605563): T2B-1 managing-unit 18/18 PASS; T2B-2 asset-location 21/22 PASS. Satu kegagalan pada 12a: pengujian mengklaim memverifikasi JSON fallback, tetapi kedua fase proses mewarisi `DATABASE_URL` sehingga fase restart justru kembali memakai PostgreSQL.
- Perubahan: helper boot T2B-2 menerima environment overrides; fase kedua menghapus `DATABASE_URL` agar benar-benar menguji hydrate dari `gabah_state.json`. Tidak ada perubahan perilaku aplikasi atau data.
- Commit: `d0d5ed4c3e31edb7033a606d261c7cafd81ce3bb`.
- Verifikasi: menunggu CI baru. Jangan menyatakan T2B-2 lulus sebelum 22/22.
- Job CI sebelumnya juga membuktikan lint, build, Docker runtime smoke, CR-04/CR-05 PostgreSQL, P0 security, user-directory scope, loan auth, cross-department ticket, contract mass-assignment, meeting room 18/18, organization model 15/15, dan T2B-1 18/18 PASS.
- T2B-3, menu connectivity, dan maintenance authorization belum dijalankan karena workflow berhenti pada T2B-2.
- Tidak ada merge ke `main`.


## 2026-11-26 — Konsistensi mode restart T2B-1/2/3

- Branch: `ai/hermes/authorization-endpoint-audit`
- Temuan: ketiga suite T2B mendeskripsikan fase kedua sebagai verifikasi JSON fallback, tetapi proses kedua sebelumnya tetap mewarisi `DATABASE_URL` dari CI. T2B-2 memperlihatkan ketidaksesuaian tersebut: 21/22 PASS, dengan perbedaan relasi lokasi pada restart PostgreSQL.
- Perubahan test harness: fungsi `boot()` pada T2B-1, T2B-2, dan T2B-3 kini menerima environment overrides; fase restart kedua secara eksplisit mengosongkan `DATABASE_URL`, sehingga menguji hydrate dari file JSON seperti yang tertulis di test plan. Tidak mengubah kode aplikasi.
- Commit T2B-2: `d0d5ed4c3e31edb7033a606d261c7cafd81ce3bb`.
- Commit T2B-1: `64cfafa8582d9041a51dd48c084e47c80c4c8c2a`.
- Commit T2B-3: `4ab947bf5923efde1469f0285617ddc7d5ae18c6`.
- CI untuk perubahan ini sedang berjalan; hasil baru belum tersedia. Run sebelumnya: T2B-1 18/18 PASS, T2B-2 21/22 PASS; T2B-3 belum tercapai karena workflow berhenti pada T2B-2.
- Tidak ada merge ke `main`.


## 2026-11-26 — Isolasi PostgreSQL fase JSON restart (lanjutan)

- Temuan dari CI run `45819443903`: T2B-1 13/18 PASS, lima assertion fase restart gagal (19 aset menjadi 0 setelah boot kedua). Bukan kehilangan data yang sudah terbukti di aplikasi: harness hanya mengosongkan `DATABASE_URL`, sementara resolver koneksi juga menganggap `PGHOST` sebagai konfigurasi database independen. Nilai `PGHOST` dari dotenv dapat membuat fase kedua tetap mencoba PostgreSQL.
- Perubahan: fase restart T2B-1/2/3 kini mengosongkan **keduanya** `DATABASE_URL` dan `PGHOST`, sehingga mode file-store dipilih secara deterministik. Kode aplikasi tidak diubah.
- Commit T2B-1: `529cacab9debfbca3cd269baa8317976720556bb`.
- Commit T2B-2: `fc2c8ddc7e9b462d3bf09a31d9b12dc83e0c99f4`.
- Commit T2B-3: `9e0c1469d3babba7bc0278cfe5980b6b2a2a7fea`.
- CI untuk ketiga suite pada exact HEAD masih menunggu. Jangan menyatakan roundtrip lulus sebelum seluruh assertion fase restart hijau.
- Paralel: pemeriksaan source RBAC/navigation menemukan pemisahan yang disengaja antara `assets.read` (ruang kerja personal) dan `assets.catalog.read`/`assets.audit.read` (katalog penuh); tidak mengubah policy ini karena sesuai desain dan permission seed.
- Tidak ada merge ke `main`.


## 2026-11-26 — Efisiensi CI dan audit paralel

- Commit `86d7dab764000b75a812c678bc6ec33a5dd2a97c`: workflow CI kini memakai concurrency group per workflow/ref dan membatalkan run lama yang tertinggal saat commit baru masuk. Tujuannya menghindari beberapa run identik yang menghabiskan runner setelah rangkaian commit perbaikan test harness.
- Run exact HEAD workflow: `45827461098` (sedang berjalan saat catatan dibuat).
- Audit source paralel: route check-in/check-out reservasi ruang memang tidak memakai permission gate generik; service domain tetap memvalidasi organizer/otorisasi GA dan status reservasi. Ini dipertahankan karena regresi meeting-room 18/18 PASS.
- Maintenance GET mengikuti asset scope; mutasi create/update memerlukan permission + owner scope dan PATCH memakai allowlist field. Tidak ada perubahan aplikasi dari pemeriksaan ini.
- Risiko yang masih terbuka: numbering engine masih menggunakan counter in-memory (asset/ticket/loan/contract), sehingga belum aman untuk beberapa worker/instance bersamaan. Format nomor tidak diubah karena standar perusahaan belum ditetapkan.
- Tidak ada merge ke `main`.


## 2026-11-26 — Dashboard mengikuti role tambahan (UI persona)

- Temuan audit: `DashboardView` menentukan tampilan operasional hanya dari `currentUser.role`, padahal API mengirim `role_keys` untuk role/job-function tambahan. Akibatnya user dengan role primer `Karyawan` + role tambahan `IT`/ `GA` dapat memperoleh permission dan menu operasional tetapi tetap masuk dashboard staf; label/antrean IT/GA juga salah.
- Perubahan: helper `resolveDashboardPersona()` sekarang menyelesaikan persona dari role primer + `role_keys`, termasuk Superadmin/Auditor, IT/GA, Humas/Sekdir, dan staf. Dashboard menggunakan hasil helper untuk layout, deskripsi, quick actions read-only, label divisi, dan panel lisensi/helpdesk.
- Regression test ditambah untuk Karyawan+IT, Karyawan+Humas, dan Karyawan+Auditor.
- Commits: `b1289278906c963567b8e263620e22a1c3bf3ce7` (helper), `c5fb7676a7c75c8ebf4968c3e947b581f644b5a8` (dashboard), `067f222de080476a026ff0b25ee65c09494a6451` + `b63b562017e8442afd96d2b6dce179325d12acb7` (tests/import).
- CI typecheck/build/dashboard-scope pada exact HEAD masih pending; jangan klaim lulus sebelum workflow selesai.
- Ini hanya mengubah presentasi dashboard; otorisasi tetap di backend dan tidak diturunkan dari jabatan/lokasi.
- Tidak ada merge ke `main`.


## 2026-11-26 — Konsistensi persona dashboard dan sidebar

- Audit lanjutan menemukan Sidebar masih menentukan label/section/badge dari role primer saja, walau DashboardView telah diperbaiki untuk membaca role tambahan. User Karyawan dengan capability IT/GA berpotensi melihat menu berlabel staf walau memiliki akses operasional.
- Perubahan: Sidebar kini menerima `role_keys` dari session API dan memakai resolver persona yang sama dengan DashboardView. Section title, label layanan, badge antrean IT/GA, dan visibilitas administrasi memakai persona efektif; menu permission tetap memakai permission keys dari backend.
- Commits: `d8609181220696b78d7f5b1bdd367253cc2d03f1`, `aaaef1a676a9571f541e2fc283165805800633f1`, `55228837bd7de8ddea714d3ffc61af16def6e5b1`, `bbc6a93a5ccbee60d4175b90fde2fafea27f69a8`.
- Typecheck/build dan regression persona menunggu CI exact HEAD.
- Tidak ada perubahan backend authorization; tidak ada merge ke `main`.


## 2026-11-26 — Quick action dashboard mengikuti permission efektif

- Temuan lanjutan: beberapa tombol quick action di Dashboard hanya disembunyikan berdasarkan label Auditor/staf, bukan permission efektif. User custom/Karyawan tanpa `loans.create`, `tickets.create`, atau `assets.create` masih dapat melihat tombol yang akhirnya ditolak backend; sebaliknya role tambahan yang sah tidak selalu memperoleh affordance yang sesuai.
- Perubahan: helper `canShowDashboardAction()` memeriksa wildcard/permission keys saat tersedia, memakai fallback legacy hanya saat permission keys undefined, dan selalu menolak aksi untuk persona Auditor. Tombol quick action dan empty-state peminjaman/tiket kini memakai helper yang sama.
- Regression test mencakup permission granted, permission absent, wildcard pada Auditor, dan fallback staf legacy.
- Commits: `05728d384175d27db1cc56122c4062936810d6e6`, `3ceb04a8db0fe3ada45b28f1f9f6a71d899a787d`, `99543f6417adaf339f7ccfa5860acc26cd9fa3aa`, `92be72c417373b3b908e24d59e7605ab78c5bfe8`.
- Typecheck/build/dashboard regression menunggu CI exact HEAD.
- Backend authorization tidak berubah; tombol UI bukan pengganti server-side permission guard.


## 2026-11-26 — Landing page mengikuti modul yang benar-benar diizinkan

- Temuan audit: App selalu fallback ke tab `dashboard` bila tab aktif tidak diizinkan. Custom role yang hanya memiliki permission modul tertentu (mis. `assets.read` atau `tickets.read`) tetap dipaksa membuka Dashboard yang tidak memiliki permission; bila tidak ada permission sama sekali, UI juga tidak menjelaskan kondisi tersebut.
- Perubahan: `getDefaultNavTabForRole()` memilih modul pertama yang diizinkan menurut urutan landing yang konsisten (Dashboard, Aset Saya, Ruang Rapat, Tiket, Peminjaman, lalu modul operasional lainnya). Jika tidak ada permission, portal menampilkan pesan bahwa akun belum diberi akses modul, bukan menyamarkan akses dengan Dashboard.
- Regression tests: custom role dengan assets.read → Aset Saya; tickets.read → Tiket; dashboard.read → Dashboard; permission kosong → null; wildcard → Dashboard.
- Commits: `5b751aef8b62d009eb928a8c8286f3f7df56b306`, `e841eab8889fb20100c2243c1a53c0e237df8c33`, `b1b61e3a98bdb12477a727fe9b2227b228bd969e`.
- Typecheck/build/navigation regression menunggu CI exact HEAD.
- Tidak mengubah backend authorization atau data; tidak merge ke `main`.


## 2026-11-26 — Notifikasi: role tambahan, self-read, dan persistensi

- Audit perbandingan menemukan branch kerja dan `main` sudah divergen besar: perbandingan GitHub melaporkan branch kerja 551 commit ahead dan 439 commit behind dari `main` (status diverged). Tidak dilakukan merge/rebase/sinkronisasi otomatis karena akan membawa ratusan perubahan lintas fitur ke branch ini.
- Pada source branch ini ditemukan tiga masalah di notifikasi: penerima role dicocokkan hanya ke `actor.role` primer (mengabaikan role tambahan), PATCH satu notifikasi salah mensyaratkan `notifications.read_all`, dan perubahan status baca tidak dipersistenkan. Filter kata kunci Humas juga dapat menimpa metadata penerima eksplisit.
- Perbaikan: helper penerima terpusat menghormati user-id → role efektif (termasuk role tambahan) → division; PATCH satu notifikasi memakai `notifications.read`; read-all tetap memakai `notifications.read_all`; kedua operasi menunggu `persistDataStore()`; akses tidak lagi ditebak dari kata kunci judul/pesan.
- Test kontrak baru `scripts/notification-recipient-rbac-verify.mjs`, package script dan CI step ditambahkan.
- Commits: `0cd2f7f53fa4d5291f96bf55d1fb0346620fc1d9` (server), `96ecf9e6b5cccf11032de7e25d569cc49b5221ac` (test), `baeade220cce5169ab541f22b0ba9245f05d9896` (package), `b922f3328844351302bba0281e1cdfd3be2c5166` (CI).
- Ini merupakan port perbaikan spesifik ke branch kerja, bukan merge dari `main`. CI exact HEAD belum selesai.
- Tidak ada merge ke `main`.


## 2026-11-26 — Koreksi compile no-access landing

- CI run `45828391750` berhenti pada TypeScript lint: `src/App.tsx(795,16): Cannot find name 'ShieldCheck'`. UI fallback no-access menggunakan ikon yang belum diimpor.
- Perbaikan: menambahkan import `ShieldCheck` dari `lucide-react` pada commit `62f71e3eaed5f72e207f3ea28828785ee1240c7b`.
- CI exact commit baru sedang antre; build/typecheck belum dinyatakan lulus.


## 2026-11-26 — Rekonsiliasi aset: persistensi dan duplikasi nomor ERP

- Audit endpoint menemukan `POST /api/reconciliation/link` mengubah `corporate_asset_number` dan mencatat audit, tetapi tidak memanggil persistensi. Perubahan dapat hilang setelah restart. Input juga langsung memanggil `.trim()` tanpa memastikan tipe string dan tidak menolak nomor ERP duplikat.
- Perbaikan: handler menjadi async; validasi asset ID dan tipe nomor ERP, batas panjang 120 karakter, deteksi duplikasi case-insensitive (409), lalu `await persistDataStore()` sebelum sukses. Permission `reconciliation.link` + owner scope aset tetap diwajibkan.
- P0 security regression ditambah: nomor ERP unik tersimpan dan terbaca ulang, nomor duplikat ditolak, input non-teks ditolak.
- Commits: `1094a3238d8ff98568437652e2436b36cfe89f3b` (server), `eacd5f232538e2b03533b5b9c746bf1095627fd1` (P0 test).
- CI exact HEAD masih pending; belum mengklaim lulus.


## 2026-11-26 — Penyesuaian regression setelah perubahan notifikasi

- CI run `45829149118`: test kontrak notifikasi baru 5/5 PASS, tetapi asset-scope static regression lama 62/63 karena masih mengharuskan pencocokan penerima dengan `actor.role` primer. Test tersebut diperbarui agar memverifikasi helper penerima multi-role dan pemisahan `notifications.read` vs `notifications.read_all`.
- Commit test: `ed077f7feb4319ad734556213f21e60d2a5df8f9`.
- Koreksi catatan rekonsiliasi: sebelumnya disebut tidak ada persistensi. Pemeriksaan lebih teliti menunjukkan `recordAudit()` memicu `persistDataStore()` secara asynchronous; masalahnya handler tidak menunggu penyelesaian persistensi sebelum mengembalikan sukses. Handler kini menunggu promise, sekaligus menambah validasi tipe/duplikasi nomor ERP.
- CI exact HEAD masih menunggu.


## 2026-11-26 — Domain services mengikuti role tambahan, bukan label role primer

- Audit lanjutan menemukan tiga hard-code yang bertentangan dengan model primary role + job capabilities: GA workstation read exception hanya aktif jika `user.role === 'GA'`; pengelolaan meeting facilities memeriksa `actor.role` IT/GA; auto-approval agenda Direksi memeriksa label primer Sekretaris Direksi.
- Perbaikan: IT workstation read-only ditentukan permission efektif `assets.read.it_workstations`; create/update/delete meeting facilities memakai `meeting_facilities.manage` melalui helper `hasRoomPermission` (legacy fallback GA/IT tetap dipertahankan); auto-approval reservasi mengikuti capability `room_reservations.override_priority` yang sudah menjadi dasar prioritas/interupsi.
- Static regression ditambah untuk memastikan tidak kembali ke pemeriksaan label role primer.
- Commits: `c7f1d6d70a1b6c3b01df29cc35fddb196efc2258` (service), `98bee040447f56fcc7a72d655120da675d396799` (test).
- CI exact HEAD belum selesai.


## 2026-11-26 — Instrumentasi tambahan JSON restart T2B

- Koreksi hipotesis sebelumnya: CI `45829480828` tetap menunjukkan T2B-1 fase restart 19→0 meski `DATABASE_URL` dan `PGHOST` sudah dikosongkan. Jadi pengosongan dua variabel itu saja belum membuktikan child process masuk file-store.
- Perubahan test harness lanjutan: fase restart kini juga menetapkan `DOTENV_CONFIG_PATH=/dev/null` agar file `.env` tidak dapat mengaktifkan ulang konfigurasi PostgreSQL, dan T2B-1 mencatat/mengassert nilai `/api/health.persistence` pada fase kedua.
- Diterapkan konsisten pada T2B-1/2/3.
- Commits: `6762f888f46c20274a7432baba18f13c66468599`, `7c7ae19dd7882582989ecae236f3cbf5e495344b`, `cd4774d0457ff62dd42e5b75ca630594602fe621`.
- Ini masih diagnosis harness; hasil baru diperlukan untuk membedakan konfigurasi DB yang tersisa dari masalah path/hydration JSON.


## 2026-11-26 — Sinkronisasi assertion test role-capability

- CI run `45829932237`: dynamic RBAC foundation 124/125. Satu assertion lama masih mensyaratkan GA read-only workstation ditentukan oleh `user.role === 'GA'`; implementasi baru memang sengaja mengubahnya menjadi permission efektif agar role tambahan pada Karyawan dapat bekerja.
- Assertion diperbarui untuk memverifikasi `assets.read.it_workstations` tanpa ketergantungan pada role primer. Commit: `e047c0c50526fbea73776d0744de3c111b1d19ca`.
- T2B JSON restart tetap menunggu hasil instrumentation baru.


## 2026-11-26 — T2B JSON roundtrip: verifikasi tidak lagi memakai endpoint RBAC saat PostgreSQL off

- Akar masalah terkonfirmasi dari desain keamanan: file-store fallback aktif, tetapi `requireRbacPermission` sengaja fail-closed saat PostgreSQL tidak aktif. Karena itu `GET /api/assets` mengembalikan 503 pada fase restart; test mengubah 503 menjadi array kosong dan salah menyimpulkan 19→0 aset. Ini bukan bukti file JSON kehilangan aset.
- Keputusan: tidak melonggarkan RBAC atau membuat endpoint bypass untuk tes. Persistence kini mencatat fingerprint SHA-256 non-sensitif untuk snapshot aset, master lokasi, kategori, dan unit saat file-store berhasil hydrate.
- T2B-1/2/3 fase kedua membandingkan fingerprint startup dengan snapshot fase pertama, dan memeriksa health memastikan benar-benar file-store. Endpoint bisnis tetap fail-closed.
- Commits: `5d617266971a7a036b3795e8a669f3fef0c43b05` (fingerprint startup), `e6bbdf8d09bdb4283d4ce4cdd7b376ba8b16583e` + `a2e8f9b24d40eeed5bc1750fa94ea3a68cd27ddb` (T2B-1), `1654cd05ee6848355b82ae0fdcbe8e8fb3e21ce4` (T2B-2), `c661fc2acf5497a2f909d49e894b84ef5bccbebc` (T2B-3).
- Ini mempertahankan kebijakan fail-closed; CI exact HEAD diperlukan untuk membuktikan seluruh fingerprint cocok.


## 2026-11-26 — Konsistensi permission di seluruh view operasional

- Audit frontend lanjutan menemukan sejumlah view masih memeriksa role primer langsung walau backend sudah memakai permission keys/role tambahan: Assets, Loans, Tickets, Meeting Rooms, Maintenance, dan Vendors.
- Perubahan: Assets create/report, Vendors create/update, Maintenance create/update dipisah per permission; Loans dan Tickets memakai persona efektif sehingga Karyawan+IT/GA tidak terjebak filter staf; Meeting Rooms memakai permission terpisah untuk create/approve/reject/cancel/update, serta capability IT facilities dan Humas documentation untuk antrean spesialis.
- Sidebar dan Dashboard berbagi resolver persona; Auditor tetap read-only melalui helper permission UI.
- Regression static baru `scripts/role-capability-ui-verify.mjs` (8 kontrak) ditambahkan ke package dan CI.
- Commits utama: `a7aae95545fad6a5199138ebdab63461fcfd5fae`, `4caca0fac57939a5a450360b569b6e1c69fb993f`, `976aca61acced1f2857090d566cbf5e4bcd0a27b`, `de4b40098e2c79ccd7d4d34c8abdf82189c97cd8`, `c4d0b8e443c8e513b2c31e9d21697da42e6bd082`, `171e0da9ec36dd779215f26b0c0bce6e17dcb3e3`, `eacec6161bf9fde927bf79484e7eb8b9a203fbf5`, `ef34ed8694b5c9a3a3e97355a02f957f59a00e74`, `35f77aa65ac291f62e3e877dc244e2ff385fa9b4`, `dc7e68b3e517652111167c478e53bdce8c1ab6e3`, `e99a0f07db96eb03698f275d0620c312d0348a6c`, `dc5b92431f7c0af0229ae70c108741f6fd7029d8`, `fb8d99bdf346dd40cdf335dc6dd79e6b6feb7233`, `5a6878dce699c537757836a4e9e92a86fa937871`, `c5811ee61014d188196e5b608b9887a6a95b2412`.
- CI exact HEAD pending; backend authorization remains authoritative.


## 2026-11-26 — Koreksi duplikasi deklarasi pada T2B-1 harness

- CI run `45831683951` berhenti saat typecheck karena fase T2B-1 sempat memiliki deklarasi ganda `phase2Health`, `phase2Persistence`, dan `createdInFile` setelah instrumentation fingerprint ditambahkan. Tidak ada kegagalan aplikasi yang diuji pada run tersebut.
- Deklarasi ganda dan variabel snapshot lama yang tidak lagi dipakai dibersihkan pada commit `977bc7f3e87b39bdfc2b2b2fcd437aeed29d5b86`.
- CI exact HEAD baru diperlukan.


## 2026-11-26 — Perbaikan filter tiket frontend yang menimpa RBAC backend

- Temuan tambahan: `GabahService.isTicketVisibleToUser()` masih memfilter berdasarkan `user.role` primer setelah API mengembalikan tiket yang sudah dibatasi oleh permission/scope PostgreSQL. Karyawan dengan role tambahan IT/GA/custom scope dapat kehilangan tiket yang sebenarnya sudah diizinkan backend.
- Perbaikan: pada session dengan `permission_keys`, UI mempercayai daftar tiket hasil scope server (tetap mensyaratkan `tickets.read` atau wildcard). Fallback role lama hanya dipakai saat permission keys tidak tersedia. Auditor tetap tidak dapat melakukan mutasi.
- `canManageTicket` sekarang membedakan `tickets.update` dan `tickets.close`; tombol mulai kerja dan selesaikan tiket memakai permission masing-masing. Filter create ticket tetap memakai `tickets.create`.
- Loans create/return juga kini memakai `loans.create` dan `loans.return`; Maintenance create/update telah dipisah.
- Commits: `960fb7c084189870f36781f016d6c6627ad562af`, `1286efe193212307483a5009188554685139265a`, `e99c9b721e88825c2b460e4f7169ef049b9e5ea5`, `0749ecb79802bc6a11b9c83451821b21cf3bbe16`, `36914c7d483a20548b2605dc5b4d5c486d7138ea`, `aa195b62ac73d11f8521fbc436814269d8d2d858`, `edf215dfbb1549d489428ed49db8b41b9eb8e0c5`, `39384600e24f226ad90c9cdd53c1cdf97c136311`.
- CI exact HEAD pending.


## 2026-11-26 — Peminjaman: approval dan return mengikuti capability efektif

- Audit lanjutan menemukan `GabahService.canApproveLoan()` masih menentukan approver dari `user.role` primer IT/GA/SC/PIBC. Karyawan dengan role tambahan IT/GA mendapat permission dari RBAC tetapi tombol approval tersembunyi.
- Perbaikan: pada session PostgreSQL, UI mengikuti `loans.approve` efektif dan membiarkan endpoint tetap memvalidasi owner write scope; fallback legacy tetap berbasis persona IT/GA dan label SC/PIBC lama. Tombol create/return memakai `loans.create` dan `loans.return`; Auditor tetap tidak dapat melakukan mutasi.
- Regression static ditambah untuk approval/create/return permission.
- Commits: `5864a16f7fad998332177683f717decd9c6d3c40`, `338c5a917221e8da77e6c5c9c46e08ae00a92cca`, `7a86bc672b147b48e2bb0341c3d14ef6ba5ae05f`.
- CI exact HEAD pending.


## 2026-11-26 — Sinkronisasi assertion vendor UI

- CI run `45832620263`: asset-scope static suite 65/66. Satu assertion vendor UI masih memeriksa ekspresi permission lama secara inline, sementara implementasi kini memakai helper bersama `hasEffectivePermission()`.
- Assertion diperbarui untuk kontrak helper baru. Commit: `70af872b784a46604243017a4a03972dcc95a048`.


## 2026-11-26 — T2B-3 fixture diselaraskan dengan model lokasi/divisi

- CI run `45833151574`: T2B-1 20/20 PASS dan T2B-2 24/24 PASS. T2B-3 berhenti pada fixture test yang membuat kategori DRN dengan `owner_division='SC'`, lalu mengakses `drnAsset.id` tanpa guard. SC/RPC adalah lokasi, bukan owner division; fixture tersebut sudah usang.
- Perbaikan: kategori DRN memakai owner division GA dan ekspektasi test diperbarui; akses detail aset kini guarded agar kegagalan create menghasilkan assertion FAIL yang jelas, bukan crash script.
- Commits: `25a974d4e62501ef0b15cdca85d50312bb8664b6`, `eee9e44235355e7268d7e35b971cea037594587d`.
- Pada run yang sama, seluruh static checks, typecheck, build, Docker smoke, CR-04/05 63/63, P0 security 40/40, user directory scope, loan auth, meeting room 18/18, organization 15/15, T2B-1 20/20, dan T2B-2 24/24 lulus. T2B-3 perlu run ulang.

## 2026-11-26 — View tambahan memakai permission efektif

- Audit tambahan menemukan Knowledge Base dan Licenses masih memeriksa role primer. Knowledge Base sekarang memisahkan `knowledge.create` dan `knowledge.update`; Licenses memakai `licenses.manage`.
- Regression UI ditambah untuk kedua modul. Commits: `70cd7688799ef4a8b22980d07f23e615cff7a528`, `c6b45a62dab80c4c5755a8179a59a15c0679feca`, `34bbdc76d9a3f60a95db30aa8e1ffe281e1d3870`, `33b3d7e585ed8ef7bdc3a51c0883d6b9ec89ea1a`.
- Dashboard persona sekarang juga menganggap wildcard dan permission operasional custom sebagai persona operasional, bukan staf biasa. Commits: `e546067b2db03802800042c6508c007b46ec33bd`, `f91e7c99870c9984bc5297ca9aea5539f2e59bd8`, `59c84faed31e486d8c5dafa9dd6b9ebf0d51af09`, `0547d8f446fe21acb42e95f0c17f6f406a94c3c7`.
- CI exact HEAD setelah perbaikan T2B-3 masih berjalan.


## 2026-11-26 — Import helper pada LicensesView

- CI run `45833613725` berhenti di TypeScript karena `LicensesView` memakai `hasEffectivePermission` tetapi import helper tidak masuk akibat anchor import yang berbeda dari asumsi patch pertama.
- Import diperbaiki pada commit `9e218dfab477d7c95982458758f02887ab68d2d8`. Tidak ada perubahan perilaku tambahan.


## 2026-11-26 — Meeting type CRUD mengikuti permission migration

- Audit menemukan migrasi 024 memberikan `meeting_types.manage` kepada Superadmin dan GA, tetapi tiga method domain (create/update/delete) masih menolak semua actor selain Superadmin. Permission dan domain policy tidak konsisten.
- Perbaikan: ketiga method sekarang memeriksa `hasRoomPermission(actor, 'meeting_types.manage', 'Admin GABAH')`; PostgreSQL mengikuti permission efektif, file-store mempertahankan fallback Admin GABAH. Regression static ditambahkan.
- Commits: `614484bb558d41d155e74165ed8e0c8cc19cbc6a`, `3d8379e427aa289a90b73ca7e640e804347bac5e`.


## 2026-11-26 — Maintenance visibility tidak lagi memotong role tambahan

- Audit endpoint `GET /api/maintenances` menemukan filter kedua berdasarkan primary role `Karyawan` yang hanya mengizinkan aset assigned_to sendiri, sehingga menghapus IT/GA schedules yang sudah diizinkan dynamic asset scope. Selain itu GA dapat menerima IT workstation sebagai read-only asset, tetapi exception tersebut tidak boleh membuka maintenance IT.
- Perbaikan: `getScopedAssets()` menerima opsi `includeReadOnlyItWorkstations`; route maintenance mematikannya. Pada PostgreSQL, daftar maintenance mengikuti dynamic asset scopes tanpa filter primary-role employee/GA. Fallback file-store mempertahankan filter legacy.
- Regression static memverifikasi pemisahan scope ini. Commits: `56ae83b617263d09c462e935564bfc39823ac9f2` (domain service), `919527da89a0f06be6fb01dfb5710c0dfe92d1f3` (route), `934823e7a78d0ffce9404fce6cf75bfdb201fe9e` (test).
- Live maintenance auth suite tetap memverifikasi legacy fallback; PostgreSQL dynamic behavior diuji melalui static contract dan akan diverifikasi lagi di CI.


## 2026-11-26 — Maintenance tidak mewarisi visibilitas pool peminjaman

- Review lanjutan menemukan `getScopedAssets()` juga memasukkan aset loanable pool untuk baseline Karyawan. Setelah filter primary-role maintenance dihapus agar IT tambahan dapat melihat jadwal IT, pool loanable yang tidak ditugaskan berpotensi ikut terlihat.
- Perbaikan: opsi `includeLoanablePoolForEmployee` ditambahkan ke `getScopedAssets()`; maintenance mematikannya bersama exception workstation read-only. Aset personal yang ditugaskan dan seluruh dynamic owner/unit/location scopes tetap dipertahankan.
- Static regression ditambah. Commits: `375ff497c4c90aec0aa1c173f658efffc35da1ea`, `70efa3a734b5990816bb15f9ed08d8cab6309c1c`, `546bc73334c29a04358d05168d3373c5c942a424`.


## 2026-11-26 — Sinkronisasi assertion scope setelah opsi maintenance

- CI run `45834689485`: dynamic RBAC foundation 124/125. Assertion lama mengharapkan `if (canReadItWorkstations)`; implementasi kini sengaja mensyaratkan `options.includeReadOnlyItWorkstations !== false` agar maintenance dapat mengecualikan workstation IT read-only. Assertion diperbarui sesuai kontrak baru.
- Commit: `2fb2ef13d400898d61c9f52924205fff296dc09a`.


## 2026-11-26 — Assertion kedua untuk exception workstation GA

- CI run `45835072169`: asset-scope policy 68/69. Assertion tambahan di `asset-scope-policy-verify.mjs` masih mengharapkan bentuk lama `if (canReadItWorkstations)`; assertion dynamic-RBAC sudah diperbarui, tetapi duplikat assertion di suite asset-scope belum.
- Assertion disinkronkan ke `if (canReadItWorkstations && options.includeReadOnlyItWorkstations !== false)` pada commit `bdd8a7c29824086dc115aef2f4e2236070467d8b`.


## 2026-11-26 — Maintenance auth live test mengikuti kebijakan fail-closed

- Review CI mengungkap `maintenance-authz-verify.mjs` masih menguji allowlist legacy IT/GA pada file-store, padahal semua endpoint maintenance sudah wajib memakai `requireRbacPermission` PostgreSQL dan secara eksplisit mengembalikan 503 saat policy store tidak aktif. Test lama pasti salah secara kontrak.
- Test diganti untuk mematikan PostgreSQL secara eksplisit (termasuk dotenv), memastikan health menunjukkan file-store, login canonical berhasil, request anonim tetap 401, dan GET/POST/PATCH maintenance dari Admin/IT/GA/Karyawan/Auditor semuanya mendapat 503 `RBAC_POLICY_UNAVAILABLE`. Tidak ada fallback allowlist yang dibuka.
- Commit: `e0e9c2dc1965c16e00fc727b12a8763e16a609b7`.
- Dynamic owner-scope behavior PostgreSQL tetap diperiksa melalui static RBAC contract dan live PostgreSQL asset/loan/ticket suites; maintenance fail-closed test hanya memverifikasi saat policy store tidak tersedia.


## 2026-11-26 — T2B-3: ownership aset mengikuti master kategori

- Akar masalah T2B-3: `createAsset()` mengambil owner dari master kategori sebagai nilai awal, tetapi untuk kategori selain IT/GA justru mewajibkan `payload.owner_division` dan menimpanya. Akibatnya kategori baru seperti DRN (owner GA) gagal dibuat walaupun master kategori valid; kegagalan ini ikut menyebabkan pengujian historis, guard hapus, loanable default, dan roundtrip master gagal secara berantai.
- Perbaikan: owner untuk kategori non-IT/GA sekarang tetap berasal dari `taxonomy.owner_division` pada master. Payload tidak boleh menimpa owner kategori. Aturan khusus IT/IT-S dan INV-F tetap dipertahankan.
- Commit: `9208e20ab93a808858bcab7d9201179ac9ad3b63` pada branch `ai/hermes/authorization-endpoint-audit`.
- Status tes: menunggu CI untuk commit ini; belum menyatakan lulus.
- Berikutnya: verifikasi seluruh 28 assertion T2B-3, lalu lanjut audit terpisah untuk persistence/RBAC dan regresi aset/peminjaman tanpa menunggu semua area hijau.


## 2026-11-26 — Asset PATCH tidak dapat melewati lifecycle

- Audit paralel menemukan endpoint umum `PATCH /api/assets/:id` masih menerima field `status` langsung. Ini melewati workflow lifecycle khusus (repair, damaged, cannibalize, disposal, auction) dan pemeriksaan permission `assets.lifecycle`.
- Perbaikan: `status` dikeluarkan dari whitelist PATCH umum; perubahan status tetap melalui endpoint lifecycle dan workflow pinjaman/penugasan yang memang berwenang mengelola state terkait.
- Regression static ditambahkan pada `scripts/asset-scope-policy-verify.mjs` untuk memastikan whitelist umum tidak memuat `status`.
- Commits: `cae6c88610e94a9fba6a917bd70c3abafc3a553b` (server), `34f5547d9e26daaaa5a3d600a9c6fbe881f22fc3` (test).
- Status CI: menunggu hasil run terbaru; belum dinyatakan lulus.


## 2026-11-27 — Maintenance write endpoints fail-closed

- CI run `45839442103` menunjukkan T2B-3 kategori aset sudah lulus `28/28`, tetapi suite Maintenance auth gagal `10/25`. GET sudah memakai `requireRbacPermission`, sedangkan POST/PATCH masih memakai allowlist role legacy saat PostgreSQL/RBAC tidak aktif.
- Ini inkonsistensi otorisasi nyata: role-name fallback memungkinkan Admin/IT melakukan write pada file-store, sementara kontrak endpoint maintenance mensyaratkan policy RBAC PostgreSQL dan fail-closed. Respons 201/200 pada Admin/IT membuktikan fallback berjalan; 403 untuk role lain juga tidak konsisten dengan fail-closed 503.
- Perbaikan: POST `maintenances.create` dan PATCH `maintenances.update` sekarang selalu melewati `requireRbacPermission`; ketika policy store tidak tersedia, request ditolak 503 `RBAC_POLICY_UNAVAILABLE`, tanpa allowlist role legacy.
- Commit: `e0e33f7003102f29f396d91cee6934576ef8bb0a`.
- Status tes: menunggu CI baru; belum dinyatakan lulus.


## 2026-11-27 — Sinkronisasi kontrak tes Maintenance fail-closed

- CI setelah perubahan endpoint gagal pada Dynamic RBAC foundation `124/125`: satu assertion lama masih mewajibkan allowlist file-store Admin/IT/GA untuk POST/PATCH Maintenance. Ini bertentangan dengan kebijakan fail-closed yang sudah diuji oleh `maintenance-authz-verify.mjs` dan dengan GET Maintenance.
- Assertion diperbarui untuk memastikan POST/PATCH wajib memakai `requireRbacPermission` dan tidak lagi mengandung allowlist role legacy.
- Commit test: `5a61f38ac32b79f5eb70b89406e73fb15423c04d`.
- Tes ulang menunggu CI baru; belum dinyatakan lulus.


## 2026-11-27 — Maintenance CI: precedence Auditor read-only

- CI run `45895072731` gagal hanya pada dua assertion terakhir suite Maintenance (23/25 PASS). Request Auditor POST/PATCH mendapat HTTP 403 dari global security middleware read-only sebelum route-level `requireRbacPermission` dievaluasi; GET tetap mendapat 503 ketika PostgreSQL/RBAC tidak aktif.
- Implementasi 403 adalah perilaku keamanan yang benar. Test diperbaiki agar mengharapkan 403 untuk write Auditor dan tetap mengharapkan 503 untuk GET Auditor serta GET/POST/PATCH role lain ketika policy store tidak tersedia. Middleware tidak dilonggarkan.
- Commit test: `59157ee079256467b8cc23663b6c093ad5268c22`.
- CI untuk commit baru menunggu; belum diklaim lulus.
- Audit paralel peminjaman menemukan POST batch `/api/loans` memanggil `requestLoan()` satu per satu. Karena setiap pemanggilan langsung menambah loan, notification, audit, dan sequence, aset valid yang diproses lebih dulu berpotensi tertinggal bila aset berikutnya gagal. Perlu pre-validasi seluruh batch sebelum mutasi; belum diubah pada catatan ini.
- Numbering UI masih localStorage dan belum menjadi konfigurasi server; format final tetap ditahan sampai standar perusahaan disetujui.


## 2026-11-27 — Parallel: atomic loan batch, numbering UI truthfulness, endpoint review

### Peminjaman multi-aset
- `server/services.ts`: menambahkan `requestLoansBatch()`. Semua asset ID, duplikasi, status loanable, borrower self-service, tanggal, dan konflik jadwal divalidasi terlebih dahulu sebelum service membuat loan/notifikasi/audit atau memakai sequence.
- `server.ts`: POST `/api/loans` untuk `asset_ids` kini memakai service batch tersebut, bukan loop mutasi langsung.
- `scripts/loan-authz-verify.mjs`: menambah regresi HTTP untuk batch berisi satu aset valid dan satu ID tidak valid; memastikan HTTP 400 dan jumlah loan/audit tidak berubah.
- Commits: `1a55c4a` (service preflight), `601c3cc` (route), `0cfdece` (regression test).
- Catatan: atomicity ini mencakup validasi bisnis dalam proses aplikasi; transaksi database lintas penyimpanan tetap perlu diverifikasi pada arsitektur persistence PostgreSQL.

### Penomoran
- `AdministrationModal.tsx`: konfigurasi yang disimpan di browser kini secara eksplisit disebut preview lokal; toast tidak lagi mengklaim mengubah sequence server. Menu diberi status Preview, dan ada peringatan bahwa perubahan belum memengaruhi nomor produksi.
- Tidak ada format atau sequence nomor produksi yang diubah. Standar perusahaan masih menunggu persetujuan.
- Commit: `1439359`.

### Audit keamanan paralel
- Ditemukan fallback berbasis nama role pada vendor POST/PATCH dan knowledge POST/PATCH ketika PostgreSQL tidak aktif, sedangkan route GET memakai permission RBAC. Belum diubah karena perlu matriks kompatibilitas file-store dan tes regresi tersendiri; tandai sebagai kandidat hardening berikutnya, jangan dianggap sudah fail-closed.
- GET `/api/users` juga memakai fallback role eksplisit di file-store; POST user tetap dibatasi Superadmin.

### CI dan status
- Run `45907144668` menguji branch setelah perubahan loan dan numbering; pada saat catatan ini dibuat masih berjalan. Belum ada klaim PASS.
- Branch: `ai/hermes/authorization-endpoint-audit`. Tidak ada merge ke `main`.
