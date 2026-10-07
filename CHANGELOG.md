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
- **Skrip verifikasi** `scripts/p1-features-verify.mjs` — 16 tes end-to-end:
  anonim 401, sandi lama salah 401, sandi baru pendek 400, sukses + token baru,
  token lama mati 401, token baru hidup 200, login sandi lama ditolak / baru berhasil,
  vendor role-guard 403 + create 201 + update rating, KB create/update,
  assign aset → entry movement tercatat.

### Changed
- `docs/ops/OFFICE-VM-RUNBOOK.md` — menghapus referensi hash commit basi `dbedf08`.

### Catatan penting untuk AI/skrip berikutnya
- Bug environment: `.env.local` (berisi `GABAH_TEST_PASSWORD`) ter-load otomatis ke
  semua proses terminal. Skrip verify **harus** menetralisir env saat spawn
  (`GABAH_TEST_PASSWORD: ''`) dan men-set `GABAH_INITIAL_ADMIN_PASSWORD` **dan**
  `GABAH_INITIAL_USER_PASSWORD` terpisah — user non-admin tidak ikut sandi boot admin.
  Patch ini sudah ada di `p1-features-verify.mjs`, `bulk-import-verify.mjs`,
  `menu-connectivity-verify.mjs`.
- Verifikasi: `tsc --noEmit` 0 error; `npm run build` pass; **16/16 PASS** (exit 0).

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
| Import CSV aset (setelah users) | P2 | Belum mulai |

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
```
Skrip boot `dist/server.cjs` di port acak 39000+, backup/restore state file,
dan self-terminating (aman dijalankan berulang).
