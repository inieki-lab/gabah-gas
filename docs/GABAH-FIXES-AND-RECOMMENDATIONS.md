# GABAH — Laporan Perbaikan & Rekomendasi Produk

**Tanggal:** 29 September 2026
**Basis:** Commit `de83074` (28 Sep 2026) + hasil audit menyeluruh per tanggal ini
**Status Typecheck:** ✅ `tsc --noEmit` — 0 error

---

## 1. Ringkasan Audit (Sebelum Perbaikan)

Audit dilakukan terhadap 9 peran resmi, 11 menu navigasi, seluruh modals, service layer
(`gabahApi.ts`, `gabahService.ts`), dan backend (`server.ts`, `server/services.ts`,
`server/runtime-hardening.ts`) terhadap spesifikasi `docs/architecture/RBAC.md` dan `PRD.md`.

### Temuan Kritis (diperbaiki pada sesi ini)

| # | Temuan | Lokasi | Dampak |
|---|--------|--------|--------|
| 1 | Tombol **Tolak** pinjaman tidak memanggil API — hanya toast + refresh, data tidak tersimpan | `src/App.tsx` `handleRejectLoan` | Alur persetujuan pinjaman tidak lengkap |
| 2 | Backend **tidak memiliki endpoint reject** pinjaman sama sekali | `server.ts`, `server/services.ts` | Frontend tidak punya cara menolak pinjaman secara otoritatif |
| 3 | **PIBC tidak berwenang** approve/handle aset PIBC di helper frontend | `gabahService.ts` `canApproveLoan` | Aset PIBC (jembatan timbang, los/kios) tidak bisa dikelola pemiliknya |
| 4 | **Supply Chain & PIBC tidak bisa mengelola tiket divisinya** | `gabahService.ts` `canManageTickets`/`canManageTicket` | Matriks RBAC "SC Tiket, PIBC Tiket" tidak terpenuhi |
| 5 | **Auditor tidak melihat semua tiket** (hanya tiket sendiri) | `gabahService.ts` `isTicketVisibleToUser` + `server.ts` GET /api/tickets | Spec RBAC: Auditor = Read All |
| 6 | Pengguna tidak bisa **mengajukan tiket ke divisi SC/PIBC** | `CreateTicketModal.tsx`, `types.ts` | Tiket kategori SC/PIBC mustahil tercipta |

### Temuan Non-Kritis (belum diperbaiki, lihat §4)

- Jadwal Maintenance hanya state lokal (belum ada endpoint `/api/maintenances` GET/POST dari frontend)
- Vendors & Knowledge Base masih mock statis
- Fallback `.catch(() => [])` membuat kegagalan backend terlihat sebagai data kosong
- Auto-login Super Admin saat boot aplikasi (nyaman untuk dev, wajib dimatikan untuk produksi)

---

## 2. Perbaikan yang Dilakukan

### 2.1 Bug Fix — Tolak Pinjaman (full-stack)

**Server (`server/services.ts`)**
- Menambahkan `GabahDomainService.rejectLoan(loanId, reason, actor)`:
  - Hanya pinjaman berstatus `pending_approval` yang dapat ditolak
  - Otoritas identik dengan `approveLoan`: IT untuk aset IT, GA untuk aset GA,
    Supply Chain untuk aset SC, PIBC untuk aset PIBC, Admin GABAH untuk semua
  - Auditor ditolak (read-only)
  - Mencatat audit log `LOAN_REJECTED` dan mengirim notifikasi ke peminjam

**Server (`server.ts`)**
- Endpoint baru: `POST /api/loans/:id/reject` (body: `{ reason }`)

**Client (`src/services/gabahApi.ts`)**
- Metode baru: `gabahApi.rejectLoan(loanId, reason)`

**Client (`src/App.tsx`)**
- `handleRejectLoan` kini benar-benar memanggil API dan memperbarui data.

### 2.2 RBAC Frontend (`src/services/gabahService.ts`)

- `canApproveLoan()`: + `PIBC` (aset PIBC)
- `canManageTickets()`: + `Supply Chain`, `PIBC`
- `canManageTicket()`: + SC (kategori SC), PIBC (kategori PIBC)
- `isTicketVisibleToUser()`:
  - Auditor → lihat semua tiket (read-only tetap ditegakkan oleh `canManageTicket`)
  - Supply Chain → tiket kategori SC + tiket sendiri
  - PIBC → tiket kategori PIBC + tiket sendiri

### 2.3 RBAC Server (sinkronisasi penuh dengan frontend)

- `server.ts` GET `/api/tickets`: cabang khusus untuk Auditor (all read),
  Supply Chain (kategori SC + milik sendiri), PIBC (kategori PIBC + milik sendiri)
- `server/runtime-hardening.ts` `canManageTicket()`: + PIBC (kategori PIBC);
  Supply Chain sudah ada sebelumnya

### 2.4 Tipe & Formulir Tiket

- `src/types.ts`: tipe baru `TicketCategory = AssetCategoryType | 'SC' | 'PIBC'`
- `CreateTicketModal.tsx`: tombol kategori baru **Supply Chain** dan **PIBC**
  (grid diperluas menjadi 3/5 kolom responsif)

---

## 3. Hasil Verifikasi

| Pemeriksaan | Hasil |
|---|---|
| `npx tsc --noEmit` | ✅ 0 error |
| Konsistensi RBAC frontend ↔ backend (tiket & pinjaman) | ✅ sinkron |
| Matriks RBAC vs `docs/architecture/RBAC.md` | ✅ selaras (untuk lingkup yang diperbaiki) |

---

## 4. Rekomendasi Berikutnya (Prioritas)

1. **P1 — Persistence Maintenance**: endpoint GET/POST/PATCH `/api/maintenances` + wiring `MaintenanceView` ke backend. Saat ini jadwal hilang saat reload.
2. **P1 — Matikan auto-login Super Admin** sebelum UAT/produksi; arahkan ke halaman login.
3. **P2 — Error surface**: ganti `.catch(() => [])` di `refreshData()` dengan banner error + tombol retry.
4. **P2 — CRUD Vendors & Knowledge Base** via API (saat ini mock).
5. **P2 — Notifikasi in-app**: badge sidebar sudah ada, tapi daftar notifikasi per-user (`getNotifications`) belum dipakai di UI.
6. **P3 — Laporan ekspor**: tambah PDF (BAST & slip reservasi sudah cetak; laporan agregat masih CSV).

---

## 5. Masukan Produk — Benchmark dari Aplikasi Sejenis

> **Update 29 Sep 2026 (sesi kedua):** Dua rekomendasi teratas sudah diimplementasikan ✅:
> 1. **SLA Timer visual** — komponen `<SlaTimer />` (countdown hidup, refresh 30 detik, amber < 25% window, rose + pulse saat breach) dipasang di tampilan list & kanban `TicketsView`.
> 2. **Timeline riwayat per aset** — tab baru "Riwayat Lengkap" di `AssetDetailModal` yang menggabungkan pendaftaran, seluruh peminjaman (dengan status & alasan penolakan), dan tiket terkait dalam satu garis waktu kronologis.

Referensi: **Freshservice / ServiceNow (ITSM)**, **Snipe-IT & Asset Panda (asset management)**,
**Skedulo / UpKeep (maintenance)**, **Robin / Skedda (room booking)**, **Jira Service Management**.

### 5.1 Dari Freshservice / Jira SM (Helpdesk)
- ✅ **Visual SLA timer** per tiket — *SELESAI 29 Sep: `<SlaTimer />` live countdown di list & kanban tiket.*
- **Trikage otomatis**: routing tiket berdasarkan kata kunci/aset terkait (mis. tiket terkait laptop → otomatis kategori IT).
- **CSAT otomatis**: kirim survei rating begitu tiket `resolved` (field `rating` sudah ada, belum ada alurnya).

### 5.2 Dari Snipe-IT / Asset Panda (Aset)
- ✅ **Riwayat per aset dalam satu timeline** — *SELESAI 29 Sep: tab "Riwayat Lengkap" di `AssetDetailModal` (pendaftaran + pinjaman + tiket, kronologis). Kanban: integrasi movement log & maintenance berikutnya.*
- **Bulk action** untuk stock opname: pilih banyak aset → ubah lokasi/kondisi sekaligus (pendukung hasil scan QR massal).
- **Depresiasi & laporan nilai buku** per divisi untuk kebutuhan PSAK 16 — kalkulator sudah ada, tampilkan agregat di `ReportsView`.

### 5.3 Dari Skedda / Robin (Ruang Rapat)
- **Tampilan kalender grid ruangan** (kolom = ruangan, baris = jam) selain daftar — jauh lebih cepat menemukan slot kosong.
- **Floor plan sederhana** dengan status ruangan real-time (hijau/merah).
- **No-show policy**: auto-release ruangan jika check-in tidak dilakukan X menit setelah jadwal mulai.

### 5.4 Dari UpKeep / Skedulo (Maintenance)
- **Checklist interaktif** saat eksekusi servis (field `checklist` sudah ada di model, buat bisa dicentang di UI).
- **Notifikasi pra-jadwal** (H-3/H-1) untuk frekuensi berkala.
- **Biaya kumulatif per aset**: total estimasi vs realisasi biaya servis — dasar keputusan repair vs replace.

### 5.5 Keamanan & Tata Kelola (semua benchmark)
- **2FA/TOTP** untuk peran Admin GABAH.
- **Retensi & ekspor audit log** (immutable, siap untuk SPI).
- **Session management**: daftar sesi aktif per user + logout paksa.
- **Rate limit per user** (sudah ada per IP) untuk endpoint sensitif.

---

*Dokumen ini dibuat otomatis dari sesi perbaikan 29 September 2026. Verifikasi build: typecheck 0 error; uji manual alur tolak pinjaman & visibilitas tiket disarankan sebelum UAT.*
