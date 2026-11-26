# GABAH — TAHAP 6: P0 REMEDIATION — LAPORAN KOREKSI

**Tanggal:** 2026-11-26  
**Branch:** `ai/hermes/authorization-endpoint-audit`  
**Commit kode yang diaudit:** `ca4c4db0`  
**Tip branch sebelum commit dokumen ini:** `039fa80d`  
**Commit dokumen koreksi:** `03354494`  
**Sifat:** Koreksi dokumentasi setelah audit independen. Tidak ada perubahan kode aplikasi pada commit dokumen ini.

> **Kesimpulan utama:** TAHAP 6 **belum selesai**. Perbaikan NEU-01 justru menimbulkan regresi runtime pada mode file-store, NEU-30 diimplementasikan dengan aturan yang salah, dan NEU-25 baru terverifikasi sebagian. Lint dan build lulus, tetapi itu **bukan** bukti otorisasi runtime atau E2E.

---

## 0. Ringkasan Status P0 (Koreksi)

| Item | Status sebenarnya | Boleh diklaim selesai? |
|------|-------------------|------------------------|
| **NEU-01** — `requireRbacPermission` saat PostgreSQL mati | ❌ **FAIL / REGRESI / OPEN** — semua endpoint ber-guard menolak semua user, termasuk Admin GABAH, ketika PostgreSQL tidak aktif | Tidak |
| **NEU-22** — validasi `owner_division` create asset | ⚠️ **DEFENSIF SAJA** — blok `else` yang ditambahkan praktis tidak terjangkau karena taxonomy selalu menghasilkan `owner_division` | Tidak |
| **NEU-25** — sinkronisasi numbering setelah restart | ⚠️ **PARTIAL** — jalur kode ada untuk aset, tiket, loan, dan kontrak; verifikasi restart runtime belum dilakukan | Tidak |
| **NEU-30** — validasi kategori tiket | ❌ **IMPLEMENTASI SALAH / OPEN** — membandingkan kategori dengan departemen reporter; aturan bisnis yang benar adalah kategori menentukan tim penanganan, bukan departemen pelapor | Tidak |
| **NEU-33** — `read_at` notifikasi | ⚠️ **TERIMPLEMENTASI, BELUM DIUJI RUNTIME** | Belum |
| **Migration 004 / CR-04** | ❌ **BLOCKED** — PostgreSQL 17 tidak tersedia | Tidak |
| **TAHAP 6 keseluruhan** | ❌ **BELUM SELESAI / MERGE DITAHAN** | Tidak |

---

## 1. Ruang Lingkup dan Metode

Koreksi ini didasarkan pada:

1. Pembacaan ulang kode aktual pada commit `ca4c4db0` (bukan hanya diff atau laporan sebelumnya).
2. `npm run lint` — pemeriksaan tipe (`tsc --noEmit`).
3. `npm run build` — bundling Vite + esbuild server.
4. Satu uji runtime yang tersedia: `npm run test:loan-authz` (menjalankan server hasil build pada port terisolasi, mode file-store, lalu memanggil endpoint HTTP nyata).

**Batasan yang harus dinyatakan eksplisit:**

- `npm run lint` dan `npm run build` hanya membuktikan tipe dan bundling berhasil. Keduanya **tidak** membuktikan perilaku otorisasi, RBAC, numbering, atau notifikasi saat runtime.
- Tidak ada PostgreSQL 17 pada environment ini, sehingga migration 004 dan seluruh E2E berbasis PostgreSQL tetap **BLOCKED**.
- Tidak ada test runner lengkap (`npm test` tidak tersedia). Yang tersedia hanyalah beberapa skrip verifikasi terarah; salah satunya dijalankan dan hasilnya dicatat di §8.
- Tidak ada perubahan kode aplikasi pada commit dokumen ini. Seluruh temuan kode di bawah mengacu pada `ca4c4db0`.

---

## 2. P0-A — Keamanan Autentikasi & Otorisasi

### 2.1 NEU-01 — `requireRbacPermission` saat PostgreSQL mati

**Temuan awal:** ketika `isPostgresPersistenceActive()` bernilai `false`, `requireRbacPermission` langsung mengembalikan `true`, sehingga endpoint ber-guard dapat diakses tanpa pemeriksaan permission.

**Perubahan di `ca4c4db0`:** `server.ts:113` sekarang selalu memanggil `hasRbacPermission(actor.id, permissionKey)`, termasuk ketika PostgreSQL tidak aktif.

**Rantai perilaku aktual (diverifikasi dari kode):**

1. `server/rbac-policy.ts:25-28` — `refreshRbacPolicy()` memanggil `policiesByUser.clear()`, lalu `if (!isPostgresPersistenceActive()) return;`.
2. `server/rbac-policy.ts:99-102` — `hasRbacPermission()` hanya membaca `policiesByUser` (dan `isRbacSuperadmin`, yang juga membaca map tersebut).
3. Akibatnya, ketika PostgreSQL tidak aktif, cache policy **kosong**. `hasRbacPermission()` mengembalikan `false` untuk **semua** user, termasuk `Admin GABAH`.
4. `server.ts:113-136` kemudian mengembalikan **403** untuk setiap endpoint yang memakai `requireRbacPermission` — bukan hanya menutup bypass, tetapi menutup akses seluruhnya.

**Bukti runtime:** `npm run test:loan-authz` dijalankan pada server hasil build dengan mode file-store (tanpa PostgreSQL).

| Hasil | Angka |
|-------|-------|
| Total skenario | 37 |
| PASS | 12 |
| FAIL | 25 |

Kegagalan utama:

- Pembuatan fixture aset: **0 ID** (endpoint `assets.create` menolak dengan 403).
- Pembuatan loan: **0 ID**.
- Approval loan oleh kustodian divisi: `403, 403, 403, 403`.
- Handover/return yang seharusnya sah: **403**, bukan 200.
- Audit trail untuk aksi yang seharusnya berhasil tidak terbentuk karena aksi tidak pernah mencapai domain service.

**Status:** ❌ **FAIL / REGRESI / OPEN — tidak boleh diklaim diperbaiki.**

**Arah perbaikan yang diperlukan (belum dikerjakan pada tugas dokumentasi ini):**

- Saat PostgreSQL tidak aktif, gunakan fallback eksplisit ke permission/role legacy yang memang menjadi sumber otorisasi mode file-store; **jangan** memakai `hasRbacPermission()` yang cache-nya kosong.
- Contoh pola yang sudah benar: `GET /api/users` (`server.ts:466-473`) hanya memakai `requireRbacPermission` ketika PostgreSQL aktif, dan memakai cek role legacy ketika mode file-store. Pola ini dapat dijadikan acuan.
- Atau refaktor `refreshRbacPolicy()` agar membedakan "policy belum dimuat" dari "policy kosong", dan buat `hasRbacPermission()` fail-closed hanya untuk sumber policy yang benar-benar aktif.
- Tambahkan uji runtime yang membuktikan: (a) user tanpa permission ditolak, (b) user ber-permission diizinkan, baik saat PostgreSQL aktif maupun tidak.
- Sampai itu selesai, perubahan `server.ts:113` sebaiknya dianggap **regresi yang harus diperbaiki atau di-revert** sebelum merge.

### 2.2 Inventaris endpoint ber-guard

Secara statis terdapat 50+ pemanggilan `requireRbacPermission(req, res, ...)` di `server.ts` (assets, loans, tickets, maintenance, vendors, knowledge, notifications, dashboard, reconciliation, audit, contracts, users, numbering). Guard-nya memang terpasang, tetapi karena NEU-01, pada mode file-store guard tersebut menolak **semua** aktor. Inventaris ini tidak boleh dibaca sebagai bukti otorisasi yang benar.

---

## 3. P0-B — Database & Migrasi

| Item | Status | Catatan |
|------|--------|---------|
| **Migration 004** | ❌ **BLOCKED** | PostgreSQL 17 tidak tersedia di environment audit. Tidak ada klaim berhasil. Riwayat migrasi 004 vs 001 masih perlu diverifikasi pada instance nyata. |
| **Investigasi penyebab** | ❌ **BLOCKED** | Tidak dapat dijalankan tanpa PostgreSQL. Hanya bisa dianalisis statis. |

Migrasi 004 tetap menjadi blocker utama untuk production deployment dan untuk seluruh E2E otorisasi berbasis PostgreSQL.

---

## 4. P0-C — Mass Assignment & Integritas Data

### 4.1 NEU-22 — validasi `owner_division` create asset

**Perubahan di `ca4c4db0`:** `server/services.ts:376-383` menambahkan cabang `else` yang melempar error `Owner divisi wajib dipilih untuk kategori ...` ketika kategori bukan IT/GA dan `payload.owner_division` tidak diisi.

**Verifikasi kode:** blok tersebut praktis **tidak terjangkau** pada alur saat ini:

- `resolvedOwnerDivision` diinisialisasi dari `taxonomy.owner_division`.
- `CANONICAL_TAXONOMY` selalu memiliki `owner_division` (IT/GA/SC/PIBC).
- Master kategori kustom wajib mengisi `owner_division` saat dibuat (`server.ts` POST `/api/taxonomy/categories`), dan normalisasi kategori kustom memakai fallback `GA` (`server/taxonomy.ts:104`).
- Karena itu, `taxonomy.owner_division` tidak kosong, sehingga cabang `else` baru tidak pernah dieksekusi pada kategori yang valid.

**Status:** ⚠️ **Defensif saja, bukan perbaikan yang terbukti.** Perilaku nyata tetap: kategori menentukan `owner_division`, lalu `canMutateAssetOwner()` menegakkan scope. Belum ada uji runtime untuk skenario ini.

### 4.2 NEU-30 — validasi kategori tiket

**Perubahan di `ca4c4db0`:** `server/services.ts:956-968` membandingkan `payload.category` dengan `actor.department` dan melempar error 400 jika tidak cocok.

**Masalah:** aturan ini **salah** dan melanggar kebutuhan bisnis.

- Kategori tiket (`IT`, `GA`, `SC`, `PIBC`) menentukan **tim/divisi penanganan**, bukan departemen pelapor.
- Karyawan Finance tetap harus bisa membuat tiket kategori IT (mis. laptop rusak).
- Pelapor dari divisi mana pun harus bisa membuat tiket GA/SC/PIBC sesuai kebutuhan.
- Membandingkan kategori dengan `actor.department` akan memblokir tiket lintas departemen yang sah.

**Status:** ❌ **IMPLEMENTASI SALAH / OPEN.** Pemeriksaan kesamaan departemen pelapor harus dihapus. Validasi yang benar cukup: kategori termasuk daftar resmi, lalu routing/notifikasi diarahkan ke tim penanganan kategori tersebut. Perbaikan kode **tidak** dilakukan pada commit dokumen ini.

### 4.3 NEU-23 — mass assignment pada update asset

Whitelist field sudah ada di handler `PATCH /api/assets/:id` (antara lain `name`, `brand`, `model`, `serial_number`, `specifications`, `location`, `condition`, `notes`, `is_loanable`, `status`, `corporate_asset_number`). Namun belum ada uji end-to-end yang membuktikan field di luar whitelist benar-benar tidak tersimpan.

**Status:** ⚠️ **Kode ada, belum diuji runtime.**

### 4.4 NEU-25 — sinkronisasi numbering setelah restart

Status per jenis nomor (diverifikasi dari kode, bukan dari klaim):

| Numbering | Jalur sinkronisasi | Status |
|-----------|--------------------|--------|
| **Asset** | `syncFromExistingAssets(db.assets)` di `server/db.ts:1958` dan `server/persistence.ts:663, 692, 732` | ✅ Jalur kode ada (pre-existing, bukan hasil TAHAP 6) |
| **Contract** | `syncFromExistingRecords({ contracts })` baru ditambahkan di `server/db.ts:1964`; `server.ts:41` juga mengirim `db.contracts` | ✅ Jalur kode ada (ditambahkan TAHAP 6) |
| **Ticket** | `server.ts:41` mengirim `db.tickets`; tetapi `seedInitialData()` sendiri mengirim `tickets: undefined` di `server/db.ts:1965` | ⚠️ Tergantung pemanggilan startup `server.ts:41`; tidak ada di `seedInitialData()` |
| **Loan** | `server.ts:41` mengirim `db.loans`; `seedInitialData()` mengirim `loans: undefined` di `server/db.ts:1966` | ⚠️ Sama seperti tiket |

Catatan penting:

- `syncFromExistingRecords()` hanya mengenali format kanonik `TKT-YYYY-N`, `LOAN-YYYY-N`, dan `CTR-YYYY-N` (`server/numbering.ts:27-42`). Nomor dengan format lain akan dilewati.
- Belum ada uji restart runtime yang membuktikan counter tidak mengulang nomor yang sudah ada.
- Klaim "asset/ticket/loan/contract numbering selesai" **tidak boleh** dibuat. Yang benar: jalur kode tersedia untuk keempat jenis, tetapi verifikasi restart/E2E belum dilakukan.

**Status:** ⚠️ **PARTIAL — bukan selesai.**

---

## 5. P0-D — Notifikasi

### NEU-33 — `read_at` pada notifikasi

**Perubahan di `ca4c4db0`:**

- `server/db.ts:309` — menambahkan `read_at?: string` pada `ServerNotification`.
- `server.ts:2801` — `PATCH /api/notifications/:id/read` menyetel `read_at`.
- `server.ts:2816` — `POST /api/notifications/read-all` menyetel `read_at` untuk setiap notifikasi milik penerima.

**Verifikasi:** hanya statis (pembacaan kode). Belum ada uji runtime yang memeriksa nilai `read_at` setelah kedua endpoint dipanggil. Perlu diingat bahwa endpoint notifikasi juga terkena regresi NEU-01 pada mode file-store, sehingga uji runtime saat ini tidak dapat membuktikan perilaku normal.

**Status:** ⚠️ **Terimplementasi, belum diuji runtime.**

---

## 6. CR-03 — Session Token & `gabah_state.json`

| Item | Status | Catatan |
|------|--------|---------|
| **Session token ter-commit** | ✅ Tidak ter-track | `git ls-files server/data/gabah_state.json` tidak mengembalikan apa pun. `.gitignore:15-16` mencakup `server/data/gabah_state.json` dan `.tmp`. |
| **Rotasi token** | ⚠️ Tidak diperlukan untuk repo | Karena file tidak pernah masuk tree Git pada branch ini, tidak ada token repo yang perlu dirotasi. Pengawasan tetap diperlukan untuk environment production. |
| **Kredensial di file state** | ⚠️ Ada di mode file-store | File development menyimpan hash/salt. Ini bukan bukti keamanan production; jangan menambah kredensial sensitif ke file state. |

---

## 7. File yang Diubah pada `ca4c4db0` (Kode)

| File | Perubahan | Catatan status |
|------|-----------|----------------|
| `server.ts` | `requireRbacPermission` fail-closed; `read_at` pada dua handler notifikasi | NEU-01 **regresi**; NEU-33 belum diuji runtime |
| `server/db.ts` | `read_at` pada interface; sinkronisasi nomor kontrak di `seedInitialData()` | NEU-33 static; NEU-25 partial |
| `server/services.ts` | Validasi `owner_division` (NEU-22); validasi kategori vs departemen (NEU-30) | NEU-22 defensif; NEU-30 **salah** |

**Tidak ada perubahan kode aplikasi pada commit dokumen koreksi ini.**

---

## 8. Hasil Pengujian (Dibedakan: Build vs Runtime)

### 8.1 Pemeriksaan build/tipe

| Perintah | Hasil | Arti |
|----------|-------|------|
| `npm run lint` (`tsc --noEmit`) | ✅ Lulus, tanpa error | Tipe konsisten; **bukan** bukti runtime |
| `npm run build` (`vite build` + `build-server.cjs`) | ✅ Lulus; 1712 modul; bundle server terbentuk | Bundling berhasil; **bukan** bukti runtime |

### 8.2 Uji runtime yang dijalankan

| Perintah | Hasil | Catatan |
|----------|-------|---------|
| `npm run test:loan-authz` | ❌ **FAIL — 12 PASS / 25 FAIL** | Server mode file-store; regresi NEU-01 membuat `assets.create`, `loans.approve`, `loans.handover`, `loans.return`, dan audit terkait gagal 403 |

### 8.3 Yang masih BLOCKED / NOT TESTED

- Migration 004 E2E — **BLOCKED** (tidak ada PostgreSQL 17).
- Uji otorisasi dengan PostgreSQL aktif — **BLOCKED**.
- Uji restart numbering (aset/tiket/loan/kontrak) — **NOT TESTED**.
- Uji E2E notifikasi `read_at` — **NOT TESTED** (dan saat ini terhalang regresi NEU-01 di mode file-store).
- Uji E2E mass assignment aset — **NOT TESTED**.
- Uji persona lengkap (Superadmin, IT, GA, Karyawan, Humas, Sekretaris Direksi, Auditor) — **NOT TESTED**.

---

## 9. Sisa P0 yang Masih Terbuka

| ID | Status | Alasan / langkah berikutnya |
|----|--------|-----------------------------|
| **NEU-01** | ❌ OPEN / REGRESI | Fallback permission legacy atau refaktor status policy; revert bila tidak segera diperbaiki |
| **NEU-30** | ❌ OPEN / SALAH | Hapus perbandingan kategori vs departemen reporter; kategori = tim penanganan |
| **NEU-25** | ⚠️ PARTIAL | Tambahkan uji restart untuk keempat numbering; lengkapi `seedInitialData()` bila perlu |
| **NEU-22** | ⚠️ DEFENSIF | Buktikan skenario yang ingin ditutup; jika tidak terjangkau, jangan klaim sebagai perbaikan |
| **NEU-33** | ⚠️ BELUM DIUJI | Uji runtime kedua endpoint setelah NEU-01 diperbaiki |
| **NEU-23** | ⚠️ BELUM DIUJI | Uji end-to-end whitelist field |
| **CR-04 / Migration 004** | ❌ BLOCKED | Butuh PostgreSQL 17 |
| **CR-05** | ❌ BLOCKED | Scheduler butuh lingkungan live untuk verifikasi |
| **CR-01** | ⚠️ Sebagian | 401 tanpa sesi sudah ada; UAT persona belum dilakukan |
| **CR-06** | ⚠️ Sebagian | Whitelist ada di beberapa endpoint; belum menyeluruh/E2E |

---

## 10. Kesimpulan TAHAP 6

**TAHAP 6 BELUM SELESAI dan belum layak di-merge.**

Alasannya:

1. NEU-01 menimbulkan regresi runtime yang terbukti: seluruh endpoint ber-guard menolak semua user saat PostgreSQL tidak aktif.
2. NEU-30 diimplementasikan dengan aturan yang bertentangan dengan kebutuhan bisnis.
3. NEU-25 hanya memiliki jalur kode, tanpa verifikasi restart.
4. Migration 004 dan seluruh E2E PostgreSQL masih BLOCKED.
5. Lint/build lulus, tetapi tidak menggantikan uji runtime/E2E.

Langkah berikutnya sebelum TAHAP 7:

1. Perbaiki atau revert perubahan `requireRbacPermission`; pastikan mode file-store tetap berfungsi dan user tanpa permission tetap ditolak.
2. Hapus pemeriksaan departemen reporter pada NEU-30; pertahankan validasi kategori dan routing tim penanganan.
3. Tambahkan uji restart numbering untuk aset, tiket, loan, dan kontrak.
4. Jalankan migration 004 pada PostgreSQL 17 dan ulangi uji otorisasi runtime.
5. Baru setelah itu dokumentasikan TAHAP 7.

---

## 11. Commit & Push

| Commit | Isi |
|--------|-----|
| `ca4c4db0` | Implementasi P0 (kode) + laporan TAHAP 6 awal |
| `2d7769cb` | Catatan NEU-01 pada tracker |
| `039fa80d` | Koreksi HEAD dan status NEU-01 (sebelum koreksi menyeluruh) |
| `03354494` | Koreksi menyeluruh dokumen ini dan tracker |
| commit sinkronisasi setelah `03354494` | Hanya memperbarui baris SHA dokumen (tanpa perubahan isi lain); SHA-nya dapat dilihat dengan `git log -1` |

**Catatan self-reference:** sebuah commit tidak dapat memuat SHA-nya sendiri secara eksak. Karena itu `03354494` adalah commit yang memuat isi koreksi ini, sedangkan commit sinkronisasi setelahnya hanya memperbarui baris SHA. Tip branch setelah push adalah commit sinkronisasi tersebut; SHA final juga dilaporkan di jawaban chat dan dapat diverifikasi dengan `git log -1`.

**Aturan yang tetap dipegang:** tidak merge ke `main`, tidak force-push, tidak reset/rebase, tidak menghapus perubahan lokal, dan tidak memulai TAHAP 7.


---

## Update implementasi lanjutan — 26 November 2026

**Branch:** `ai/hermes/authorization-endpoint-audit`  
**Baseline sebelum update:** `547ab6bd`  
**Catatan:** perubahan kode di bawah sudah dipush langsung ke branch. Hasil runtime/CI belum boleh dianggap PASS sampai workflow selesai.

### Perubahan kode yang sudah dipush

| Area | Perubahan | Status |
|---|---|---|
| NEU-30 — tiket lintas departemen | Menghapus pembandingan `actor.department` dengan kategori tiket. Kategori resmi IT/GA/SC/PIBC tetap divalidasi dan tetap menjadi penentu antrean. | IMPLEMENTED — runtime test menunggu CI |
| NEU-01 — RBAC saat PostgreSQL mati | Guard tidak lagi memperlakukan cache kosong sebagai keputusan 403. Endpoint yang membutuhkan Dynamic RBAC mengembalikan HTTP 503 `RBAC_POLICY_UNAVAILABLE` saat PostgreSQL/policy store tidak aktif. Tidak ada fallback allow. | SAFETY MITIGATION — file-store belum menyediakan Dynamic RBAC |
| NEU-25 — numbering test hygiene | `_resetForTesting()` kini juga membersihkan counter kontrak. Startup server sudah memanggil sinkronisasi tiket, loan, dan kontrak setelah `initializePersistence()`; sinkronisasi aset dilakukan pada seed/hydration. | PARTIAL — belum membuktikan multi-instance/concurrency PostgreSQL |

### CI PostgreSQL 17

Workflow `.github/workflows/ci.yml` sebelumnya hanya berjalan pada push/PR ke `main`. Trigger diperluas agar branch audit ini juga menjalankan pipeline yang sudah ada, termasuk PostgreSQL 17, migration 004/CR-04/CR-05, P0 security, loan authorization, dan regresi modul.

- Run: [GitHub Actions #45798367854](https://github.com/inieki-lab/gabah-gas/actions/runs/45798367854)
- Commit pemicu: `e0167d127a4f8a4ecc9fa047724de67c16555971`
- Status saat pencatatan: IN_PROGRESS — bukan PASS.

### Batasan dan pekerjaan terbuka

1. NEU-01: HTTP 503 adalah fail-closed yang eksplisit, bukan implementasi Dynamic RBAC file-store. Mode tanpa PostgreSQL tidak dapat memakai endpoint yang bergantung pada policy database. Perlu keputusan/implementasi policy source lokal yang aman bila mode itu memang harus didukung.
2. NEU-30: kode reporter-department gate sudah dihapus; bukti runtime lintas departemen masih menunggu hasil CI dan/atau test khusus.
3. NEU-25: counter masih in-memory. Sinkronisasi saat startup membantu restart satu instance, tetapi belum menjamin keunikan lintas instance. Solusi produksi harus memakai sequence/transactional allocator PostgreSQL dan unique constraints.
4. NEU-22, NEU-23, NEU-33, CR-04, CR-05, CR-06: belum dinyatakan selesai oleh update ini. Status lama tetap terbuka/partial sampai bukti test tersedia.
5. Tidak ada klaim lint/build/runtime PASS dari perubahan ini; pipeline sedang berjalan ketika catatan dibuat.

**Merge:** tetap ditahan. **TAHAP 7:** belum dimulai.
