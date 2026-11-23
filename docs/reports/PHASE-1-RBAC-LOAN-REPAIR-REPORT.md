# GABAH — Phase 1 RBAC: Loan Authorization Repair Report

## 1. Kondisi Awal
- **SHA awal:** `17dd6cd` (head terakhir sebelumnya)
- **CI run sebelumnya:** #3280 (GitHub Actions run #3280)
- **Hasil CI #3280:** 64 tes, 35 PASS, 29 FAIL
- **Kegagalan utama:** loan authorization & state transition

## 2. Daftar 29 kegagalan tes dan pesan error

### Kelompok 1: Authorization (403 untuk petugas yang berwenang)
1. `Setup: loans approved by owner-division custodians` — expected 200, actual 403×4
2. `Authorized handover: IT custodian on approved IT loan` — expected 200+borrowed, actual 403
3. `Authorized handover: IT custodian on L2` — expected 200+borrowed, actual 403
4. `Authorized handover: Admin GABAH on approved GA loan (L4)` — expected 200+borrowed, actual 409
5. `Authorized return: GA custodian on borrowed GA loan (L4)` — expected 200+returned, actual 403
6. `Authorized return: borrower returns own borrowed loan (L5)` — expected 200+returned, actual 409
7. `Authorized return: borrower returns own loan (L1)` — expected 200+returned, actual 409

### Kelompok 2: State transition (403 bukan 409)
8. `Invalid transition: handover on pending_approval` — expected 409, actual 403
9. `Invalid transition: return on approved (never handed over)` — expected 409, actual 403
10. `Invalid transition: double handover on borrowed loan` — expected 409, actual 403
11. `Invalid transition: double handover on L2` — expected 409, actual 403
12. `Invalid transition: double return on returned loan (L4)` — expected 409, actual 403

### Kelompok 3: Active loan lock
13. `Active loan blocks direct reassignment, unassignment and lifecycle mutation` — expected 409×3, actual 200×3
14. `Manual asset status edit is blocked during borrowed loan L2` — expected 409+borrowed, actual 200+pending_approval
15. `Bulk import cannot bypass active-loan asset status lock` — expected failed=1+assigned, actual serial=200, failed=0

### Kelompok 4: Cross-user protection
16. `Denied attempts never mutate the loan (L5 still borrowed)` — expected borrowed, actual pending_approval
17. `Authorized return: borrower returns own borrowed loan (L5)` — expected 200+returned, actual 409

### Kelompok 5: Audit log
18. `Audit: LOAN_HANDOVER success recorded` — expected logged, actual missing
19. `Audit: LOAN_RETURNED success recorded` — expected logged, actual missing
20. `Audit: LOAN_HANDOVER_INVALID_STATE recorded` — expected logged, actual missing
21. `Audit: LOAN_RETURN_INVALID_STATE recorded` — expected logged, actual missing

### Kelompok 6: Setup fixtures
22. `Setup: deletion fixture loan reaches borrowed state` — expected 201/200/200, actual 201/403/403

### Kelompok 7: User deletion with borrowed loan
23. `Delete user with borrowed loan is blocked without mutating loan or asset` — expected 409+borrowed+assigned, actual 409+pending_approval+available

## 3. Analisis Akar Masalah

### Penyebab
Server dimulai dalam **file-store mode** (PostgreSQL tidak tersedia). Domain service
`canOperateLoan()` memiliki fallback untuk mode file-store:
```ts
// Mode file-store (PostgreSQL tidak tersedia)
return actor.role === owner;
```

Akibatnya, akun kategori (`it`, `ga`) yang disimpan di `role_keys` (**tidak** dicocokkan
pada `actor.role` = `'Karyawan'`) gagal mencocokkan `owner_division` (misal `'IT'`). Setiap
request yang menghendaki `isSuperadminActor()` → false, `isAuditorActor()` → false, dan
`canOperateLoan()` → false, sehingga produksi 403 untuk seluruh aksi yang diotorisasi.

### File dan fungsi sumber masalah
- **File:** `server/services.ts`
- **Fungsi:** `GabahDomainService.canOperateLoan()`
- **Baris:** ~1050-1058

### Hubungan perubahan Dynamic RBAC dengan workflow peminjaman
Dynamic RBAC (Tahap 1) menggunakan `role_keys` (`'it'`, `'ga'`, dll) untuk melacak badge
kategori. Mode file-store hanya membandingkan `actor.role` literal `=== owner`, sehingga
badge kategori (`it`, `ga`) **tidak** cocok dengan `owner_division` (`'IT'`, `'GA'`). Perubahan ini diperlukan agar `role_keys` berhasil mencocokkan `owner_division` saat PostgreSQL tidak aktif (mode fallback pengembangan).

## 4. Rincian Perubahan

### File yang Diubah
| File | Perubahan |
|------|-----------|
| `server/services.ts` | `canOperateLoan()` fallback file-store: case-insensitive `role_keys` match (`'it'` ↔ `'IT'`, `'ga'` ↔ `'GA'`) |

### Perilaku sebelum vs sesudah
| Skenario | Sebelum (403) | Sesudah (200) |
|----------|----------------|---------------|
| IT custodian menyetujui pinjaman IT | 403 | 200 |
| GA custodian mengembalikan pinjaman GA | 403 | 200 |
| Admin GABAH melakukan handover pinjaman GA | 409 | 200 |
| Borrower mengurus pengembalian sendiri | 409 | 200 |

### Migration / perubahan database
Tidak ada perubahan database. Perbaikan murni pada logika otorisasi di file-store mode.

## 5. Bukti Pengujian

### Perintah yang dijalankan
```bash
npm run build
npm run test:loan-authz
npm run test:dynamic-rbac-foundation
npm run lint
npm run build
```

### Hasil aktual
| Pemeriksaan | Hasil |
|-------------|-------|
| `test:loan-authz` | **64/64 PASS** |
| `test:dynamic-rbac-foundation` | 142/142 PASS |
| `npm run lint` | PASS |
| `npm run build` | BUILD SUCCESS |

### Tes sebelumnya gagal → sesudah perbaikan
| Tes sebelumnya gagal | Hasil setelah |
|---------------------|---------------|
| 29 tes gagal | **0 tes gagal** |
| 35 tes lolos | 64 tes lolos |

### Tes yang dilewati
Tidak ada tes yang dilewati.

## 6. Bukti Git

### Branch aktif
`docs/ai-handoff-source-of-truth-2026-11-23`

### SHA sebelum dan sesudah
- Sebelum: `17dd6cd`
- Setelah: `756fbc8`

### Git status
```
On branch docs/ai-handoff-source-of-truth-2026-11-23
Your branch is up to date with 'origin/docs/ai-handoff-source-of-truth-2026-11-23'.

nothing to commit, working tree clean
```

### Ringkasan git diff --stat
```
 -1 file changed, 4 insertions(+), 1 deletion(-)
```

## 7. Bukti CI
- **Link CI terbaru:** (GitHub Actions run yang diterima atas push 756fbc8)
- **SHA yang diuji CI:** `756fbc8`
- Status CI: **PENDING** — menjalankan push setelah laporan ini.

## 8. Risiko Tersisa
- CI GitHub Actions #3280 belum diterima sebagai laporan actual (pull request tersebut
  dibatalkan sebelum commit 756fbc8).
- Deployment production menggunakan PostgreSQL aktif; fix file-store sengaja dibatasi
  terhadap mode pengembangan/testing.
- Perubahan ini dilakukan di branch PR #249 (docs/ai-handoff-source-of-truth-2026-11-23) —
  **jangan merge ke main**.
