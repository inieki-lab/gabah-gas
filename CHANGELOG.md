# Changelog — GABAH

Portal Aset & Helpdesk PT Food Station Tjipinang Jaya (BUMD DKI Jakarta).

Format mengikuti [Keep a Changelog](https://keepachangelog.com/) — dicatat per tanggal kerja,
bukan per versi rilis. Catatan ini ditulis agar manusia maupun AI lain bisa memahami
apa yang sudah dikerjakan, di mana kodenya, dan bagaimana memverifikasinya.

> Cara membaca: setiap entri berisi ringkasan fitur, lokasi implementasi (file + endpoint),
> dan skrip verifikasi yang membuktikannya. Semua skrip verifikasi membutuhkan
> `npm run build` terlebih dahulu karena mereka men-boot `dist/server.cjs`.

---

## [2026-10-07] — P1: Self-service & CRUD Vendor/KB + Jejak Mutasi Aset

### Added
- **P1-3 — Ganti kata sandi mandiri** (semua peran):
  - Endpoint `POST /api/auth/change-password` (`server.ts`, setelah endpoint logout).
    Validasi: sandi lama harus cocok (`verifyPassword`, PBKDF2 via `server/crypto.ts`),
    sandi baru min. 8 karakter, tidak boleh sama dengan yang lama.
    Setelah sukses: `revokeUserSessions()` untuk semua sesi, lalu sesi baru dibuat
    khusus perangkat pemanggil → respons `{ user, token, expires_at }`.
    Audit: `USER_PASSWORD_SELF_CHANGED` via `GabahDomainService.recordAudit`.
  - `gabahApi.changePassword()` (`src/services/gabahApi.ts`) — otomatis `setToken`
    dari respons, jadi pengguna tidak perlu login ulang.
  - Modal baru `src/components/modals/ChangePasswordModal.tsx`: strength meter
    4 level, show/hide sandi, konfirmasi sandi kedua.
  - Tombol **"Ganti Kata Sandi"** di dropdown profil `HeaderNavbar.tsx`
    (prop `onChangePassword`, ikon `KeyRound`).
- **P1-1 — CRUD Vendor penuh** (peran: Admin GABAH, GA):
  - `src/components/views/VendorsView.tsx` ditulis ulang: tombol **Tambah Vendor**,
    tombol **Edit** per kartu, modal form (nama, kontak, email, telepon, kategori,
    rating, status, catatan). Role-gate via `canManage`.
  - Handler `handleCreateVendor` / `handleUpdateVendor` di `src/App.tsx`.
  - Endpoint sudah ada sebelumnya (`server.ts` ~1535–1585) dengan role-guard 403
    dan allowlist field PATCH (CR-06).
- **P1-2 — Penulisan artikel Knowledge Base** (peran: Admin GABAH, IT, GA):
  - `src/components/views/KnowledgeBaseView.tsx` ditulis ulang: tombol **Tulis Artikel**,
    **Edit** di tampilan detail, editor textarea dengan format ringan
    (`##` heading, `-` list, `**tebal**`, `` `kode` ``), tags dipisah koma,
    kategori Policy/IT/GA. Role-gate per kategori.
  - Handler di `App.tsx` dengan cast `as KnowledgeArticle['category']`.
  - Endpoint CRUD sudah ada (`server.ts` ~1587–1650) dgn role-guard & allowlist.
- **P1-4 — Riwayat mutasi aset terlihat di UI**:
  - `App.tsx`: state `movements` + fetch `gabahApi.getMovements()` di `refreshData`
    (Promise.all), diteruskan sebagai `assetMovements` ke `AssetDetailModal`.
  - `AssetDetailModal.tsx`: timeline tab *history* kini menampilkan entri `kind: 'movement'`
    (warna amber, ikon Truck) — mutasi lokasi/pengguna/status aset.
  - Endpoint `GET /api/movements` mendukung `?assetId=` untuk filter per aset.
- **Import massal aset via CSV** (peran IT, GA, Supply Chain, PIBC, Admin GABAH):
  - Endpoint `POST /api/assets/bulk-import` (`server.ts` ~1142) — setiap baris diproses
    individual via `GabahDomainService.createAsset` sehingga resolusi taxonomi kategori,
    authority divisi, deteksi duplikat SN/No. Accurate, dan **penomoran aset resmi**
    tetap server-authoritative. Maks 500 baris. Satu baris buruk tidak menggagalkan batch.
  - Upsert opsional `allow_update: true` → baris dengan Serial Number / Nomor Accurate
    yang sudah terdaftar DIPERBARUI (allowlist identik dengan PATCH /api/assets/:id,
    CR-06) — `asset_number` & `owner_division` tetap server-owned.
  - Perbaikan middleware `server/runtime-hardening.ts`: path `/api/assets/bulk-import`
    tidak lagi dianggap asset id oleh scope-guard (sebelumnya 403).
  - API client `gabahApi.bulkImportAssets(rows, allowUpdate)`.
  - Parser + template CSV di `gabahService.ts`: `parseAssetsImportCsv()` (header
    Indonesia, kondisi `baik/rusak/...` dipetakan ke `good/broken/...`) dan
    `downloadAssetsImportTemplate()`.
  - Modal baru `src/components/modals/AssetImportModal.tsx`: pilih file, unduh template,
    preview tabel, checkbox upsert, ringkasan hasil (Baru/Diperbarui/Gagal + daftar
    error/warning). Tombol **Import CSV** di toolbar `AssetsView.tsx` (prop
    `onOpenImportModal`) untuk peran yang berwenang.
  - Audit: `ASSET_BULK_CREATED` / `ASSET_BULK_UPDATED` via `recordAudit`.
- **Skrip verifikasi** `scripts/asset-import-verify.mjs` — 20 tes end-to-end:
  anonim 401, batch kosong/oversize 400, created=2 + failed=1 (baris tanpa nama),
  nomor aset `IT-HLT-*` & `GA-INV-F-*` otomatis, kondisi tak dikenal → warning,
  harga & is_loanable tersimpan, duplikat SN ditolak, `allow_update` memperbarui,
  duplikat SN dalam satu berkas ditolak, authority per baris (IT impor kendaraan SC
  → row error), Karyawan → 403.
- **Skrip verifikasi** `scripts/p1-features-verify.mjs` — 16 tes end-to-end:
  anonim 401, sandi lama salah 401, sandi baru pendek 400, sukses + token baru,
  token lama mati 401, token baru hidup 200, login sandi lama ditolak / baru berhasil,
  vendor role-guard 403 + create 201 + update rating, KB create/update,
  assign aset → entry movement tercatat.

### Fixed
- **Layar "Memulihkan sesi…" mengurung pengguna** (`src/App.tsx` `initAuth`): bila
  request `/api/auth/me` menggantung (mis. dev server restart via tsx watch di
  tengah request — koneksi yatim), pengguna terjebak di loading tanpa batas.
  Kini `getMe()` di-race dengan timeout 10 detik → token dibersihkan dan pengguna
  diantar ke halaman login; jalur exception juga kini dijamin mendarat di login.

### Changed
- `docs/ops/OFFICE-VM-RUNBOOK.md` — menghapus referensi hash commit basi `dbedf08`.

### Catatan penting untuk AI/skrip berikutnya
- Bug environment: `.env.local` (berisi `GABAH_TEST_PASSWORD`) ter-load otomatis ke
  semua proses terminal. Skrip verify **harus** menetralisir env saat spawn
  (`GABAH_TEST_PASSWORD: ''`) dan men-set `GABAH_INITIAL_ADMIN_PASSWORD` **dan**
  `GABAH_INITIAL_USER_PASSWORD` terpisah — user non-admin tidak ikut sandi boot admin.
  Patch ini sudah ada di `p1-features-verify.mjs`, `bulk-import-verify.mjs`,
  `menu-connectivity-verify.mjs`.
- Verifikasi: `tsc --noEmit` 0 error; `npm run build` pass; **16/16 PASS** (exit 0);
  asset-import **20/20 PASS**; regresi menu-connectivity **23/23**, bulk-import users
  **14/14** setelah perubahan middleware.
- Catatan domain: furniture INV-F **sengaja** dapat dibuat peran mana pun
  (otomatis jadi milik GA) — konsisten dengan alur create aset tunggal.

---

## [2026-10-05] — Import massal, laporan, kredensial UAT, runbook

### Added
- **Import massal pegawai via CSV**: endpoint `POST /api/users/bulk-import`
  (`server.ts` ~97–230) — maks 500 baris, upsert by email, password CSPRNG
  (tidak pernah di-echo ke respons), peran dibatasi ke whitelist.
  Skrip verifikasi `scripts/bulk-import-verify.mjs` — **14/14 PASS**.
- **Laporan dengan filter divisi/departemen + export** (`ReportsView.tsx`):
  filter divisi & departemen pada laporan, tab **Rekap Divisi**, tombol
  **Cetak PDF** (window.print). Export CSV untuk aset, peminjaman, tiket,
  dan pemeliharaan.
- **Skrip audit menu** `scripts/menu-connectivity-verify.mjs` — 23 cek koneksi
  menu ↔ data ↔ endpoint, RBAC 9 peran: **23/23 PASS**.
- **Runbook setup dev lokal** `docs/ops/LOCAL-DEV-RUNBOOK.md`: Node 20+ & Git
  wajib, Docker opsional, penjelasan `GABAH_TEST_PASSWORD`, `docker compose up -d
  database`, alur sinkronisasi via git push/pull.

### Changed
- Kredensial UAT: 10 akun kanonik `@foodstation.co.id` memakai satu sandi UAT
  yang diset via `GABAH_TEST_PASSWORD` (non-produksi saja). Urutan provisioning
  (`server/persistence.ts`): `GABAH_TEST_PASSWORD` > `GABAH_INITIAL_ADMIN_PASSWORD` /
  `GABAH_INITIAL_USER_PASSWORD` > CSPRNG acak. *Never clobber*: hash yang sudah ada
  tidak pernah ditimpa ulang saat boot. Dev lokal menulis
  `server/data/initial_credentials_dev.txt` (gitignored).
- Perbaikan alur login UAT (akun admin & non-admin).

### Security (dilanjutkan dari hardening 2026-09-22, tag `backup/security-hardening-20260922`)
- Rate limiting per-IP+route dengan header `X-RateLimit-*` (`server/auth.ts`,
  `server/runtime-hardening.ts`).
- Sesi in-memory 7 hari (`SESSION_DURATION_MS`); reboot server = semua sesi logout
  (disengaja, epoch security).
- `revokeUserSessions()` dipanggil saat reset sandi admin & ganti sandi mandiri.
- Audit log terpusat via `GabahDomainService.recordAudit(...)`.
- Allowlist field pada semua endpoint PATCH (CR-06).

---

## Roadmap / Keputusan tertunda

| Item | Prioritas | Status |
|---|---|---|
| PostgreSQL produksi (Tiger Cloud) — ganti fallback file-store | P0 | **Menunggu `DATABASE_URL` dari user** |
| Notifikasi email / Telegram (CR-05) | P2 | **Ditunda** sampai aplikasi ready 100% |
| Lampiran dokumen pada tiket/aset | P2 | Belum mulai |
| Custom fields aset | P2 | Belum mulai |

### Kredensial UAT (non-produksi)
Semua akun kanonik domain `@foodstation.co.id` memakai sandi yang sama, diset lewat
env `GABAH_TEST_PASSWORD` (lihat `.env.local` / mekanisme Keys milik platform).
Akun: `admin@`, `it.support@`, `ga@`, `sc.warehouse@`, `pibc.admin@`,
`sekretariat.direksi@`, `humas@`, `auditor@`, `karyawan@` (+ domain admin).
**Wajib** diganti di produksi via `GABAH_INITIAL_ADMIN_PASSWORD` /
`GABAH_INITIAL_USER_PASSWORD`.

### Cara menjalankan verifikasi (lokal)
```bash
npm install
npm run build
node scripts/menu-connectivity-verify.mjs   # 23 cek menu & RBAC
node scripts/bulk-import-verify.mjs         # 14 tes import CSV
node scripts/p1-features-verify.mjs         # 16 tes fitur P1
node scripts/asset-import-verify.mjs        # 20 tes import aset
```
Skrip boot `dist/server.cjs` di port acak 39000+, backup/restore state file,
dan self-terminating (aman dijalankan berulang).
