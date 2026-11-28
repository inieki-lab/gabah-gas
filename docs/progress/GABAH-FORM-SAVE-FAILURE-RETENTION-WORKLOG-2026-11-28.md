# GABAH Form Save-Failure Retention Worklog

**Tanggal:** 2026-11-28  
**Repository:** `inieki-lab/gabah-gas`  
**Base:** `main` @ `4f10d7a3aada9f41cd9e6cd2abe980b52054839e`  
**Branch:** `fix/forms-preserve-input-on-save-failure-2026-11-28`  
**Status:** IMPLEMENTATION COMMITTED — exact-head CI pending; browser UAT not run.

## Temuan yang dibuktikan dari source

### Create Ticket
- `CreateTicketModal.handleSubmit()` memanggil `onCreateTicket()` tanpa `await`, lalu langsung memanggil `onClose()`.
- `App.handleCreateTicket()` menangkap kegagalan API dan hanya menampilkan toast; ia tidak melempar error atau mengembalikan status hasil.
- Karena itu modal dapat tertutup walaupun `POST /api/tickets` gagal, sehingga isian pengguna hilang.

### Create Asset
- `CreateAssetModal.handleSubmit()` memiliki pola yang sama: memulai `onCreateAsset()`, lalu langsung menutup modal.
- `App.handleCreateAsset()` menangkap kegagalan API dan tidak meneruskan status gagal ke form.
- Kegagalan `POST /api/assets` berisiko menghilangkan seluruh isian aset.

## Perbaikan

- Callback create aset dan tiket sekarang mengembalikan `Promise<boolean>`: `true` hanya setelah API create berhasil; `false` bila API gagal.
- Kedua modal menunggu hasil callback sebelum menutup.
- Bila penyimpanan gagal, modal tetap terbuka, input tetap ada, dan pesan error tampil di form.
- Tombol submit dinonaktifkan selama request berjalan untuk mencegah double-submit.
- Parent memisahkan kegagalan penyimpanan dari kegagalan refresh: bila record sudah tersimpan tetapi refresh daftar gagal, pengguna tetap diberi status sukses penyimpanan dan tidak didorong mengirim record duplikat.
- Menambahkan regression source-contract ke `test:effective-permission-ui`, yang sudah terdaftar dalam workflow CI.



## Temuan tambahan — Jadwal Maintenance

Audit lanjutan menemukan pola yang sama pada form jadwal pemeliharaan:

- `MaintenanceView.handleCreateSubmit()` memanggil callback `onAddSchedule()` tanpa menunggu hasil, lalu langsung menutup modal, mengosongkan form, dan menampilkan toast sukses.
- Caller di `App.tsx` menjalankan request dalam async IIFE yang tidak dikembalikan ke pemanggil; kegagalan API hanya menampilkan warning.
- Akibatnya kegagalan `POST /api/maintenance` tetap membuat form hilang dan UI sempat menampilkan pesan sukses palsu.

Perbaikan:
- `onAddSchedule` sekarang mengembalikan `Promise<boolean>`; caller mengembalikan true/false sesuai hasil API.
- Form menunggu hasil server, menampilkan error, dan mempertahankan isian ketika gagal.
- Modal hanya ditutup dan di-reset setelah server mengonfirmasi penyimpanan.
- Tombol submit dikunci selama request berjalan.
- Toast sukses hanya berasal dari caller setelah API berhasil; toast sukses lokal yang sebelumnya selalu muncul telah dihapus.
- Regression checks tambahan mengunci callback asynchronous, retensi form, dan larangan pesan sukses sebelum konfirmasi backend.

Pemeriksaan lanjutan:
- `CreateContractModal`, `VendorsView`, dan `KnowledgeBaseView` sudah menunggu Promise dan menahan form di dalam catch saat callback menolak; tidak ditemukan pola tutup-modal langsung yang sama pada jalur tersebut.
- `EditAssetModal` juga menunggu callback; caller `onSaveAsset` melempar ulang error setelah toast sehingga modal tetap terbuka ketika penyimpanan gagal.
- Audit ini merupakan source inspection, bukan browser UAT.



## Temuan tambahan — Penolakan Peminjaman

Audit aksi persetujuan menemukan dialog Tolak Peminjaman langsung menutup dan menghapus alasan setelah memanggil `onRejectLoan()`, tanpa menunggu API. Parent handler menangkap kegagalan API dan tidak meneruskan hasilnya, sehingga alasan penolakan dapat hilang walaupun transaksi gagal.

Perbaikan:
- `App.handleRejectLoan` kini mengembalikan `Promise<boolean>`: false untuk kegagalan API, true setelah penolakan tersimpan.
- Kegagalan refresh setelah penolakan sukses dipisahkan dari hasil transaksi agar pengguna tidak mengulang penolakan yang sudah commit.
- `LoansView` menunggu hasil callback; dialog hanya ditutup dan alasan dihapus setelah server mengonfirmasi sukses.
- Saat gagal, alasan tetap ada, pesan error ditampilkan, dan tombol submit terkunci selama request.
- Alasan wajib diisi sebelum mengirim.
- Regression assertions ditambahkan pada test UI yang sudah terdaftar di CI.


## File yang diubah

- `src/App.tsx`
- `src/components/modals/CreateTicketModal.tsx`
- `src/components/modals/CreateAssetModal.tsx`
- `src/components/views/MaintenanceView.tsx`
- `src/components/views/LoansView.tsx`
- `scripts/effective-permission-ui-verify.mjs`
- Dokumen worklog ini.

## Commit implementasi

- `cb52876a136560f0b24cefb9fb21fde92d22f498` — App mengembalikan hasil create aset/tiket.
- `d1f7d5dbac94ee0165a0f95b66e3af81d493a1aa` — modal tiket menunggu hasil dan mempertahankan isian saat gagal.
- `00cd8b56ee9c0331608353790154ad3c091cd10a` — modal aset menunggu hasil dan mempertahankan isian saat gagal.
- `63ad22320f9623cb46402e17235c4779a4c6c953` — regression assertions awal.
- `3c0822a1b7bb92ee5515ccc647010aa602fc77df` — koreksi matcher regression.
- `80322aa85ed71d5a1816553821102ed1cab1b094` — bedakan hasil create yang sudah commit dari kegagalan refresh.
- `be3dbcc6b9db94e01bff5d0c2ce7b58f3e8d9949` — maintenance parent callback mengembalikan hasil API.
- `3cfd9f1c00ba8043d4666e42514e2807d3399b57` — maintenance form menunggu hasil dan mempertahankan isian saat gagal.
- `32d1162fc14434b98d3c7b34b7cbaedd7fbd0178` — mempertahankan parsing checklist per baris.
- `7efc57e82d0fe564667901f80c439f35104c5cff` — regression test menolak false-success maintenance toast.
- `897075b089cd13e729cb006c3493f3f227241be6` — App mengembalikan hasil API penolakan pinjaman.
- `494584abfd6fb0b320506168b7cc8b50620d88d1` — dialog penolakan menahan alasan sampai API sukses.
- `15fc12871a616d85fdb36609ec1aea7da0a8be93` — regression matcher untuk dialog penolakan.

## Validasi

| Pemeriksaan | Status |
|---|---|
| Source inspection modal, App handlers, dan caller | DONE |
| Regression assertions untuk ticket + asset save result | ADDED; belum dieksekusi lokal |
| `npm run test:effective-permission-ui` | NOT RUN locally — no repository checkout/runtime in this session; additional source assertions for Maintenance are included |
| TypeScript `npm run lint` | NOT RUN |
| Production build | NOT RUN |
| Exact-head GitHub Actions | #3949 failed on stale ME matcher (fixed `9d16fbc...`); #3955 failed on a false-positive maintenance matcher (fixed `fd80ab1...`); exact-head rerun pending |
| Browser UAT saat API sukses/gagal | NOT RUN |



## CI feedback and correction

- CI run #3949 (`46113581439`) failed at step 81, `PIBC ME ticket queue and unit-scope regression`.
- The only failing assertion was the existing source matcher for the ME-only ticket submit button. The form now also disables submit while `isSubmitting`; the old matcher expected the previous `disabled={category ...}` expression.
- The permission/category behavior itself remained unchanged. Updated the source-contract matcher to require both the existing ME-vs-IT/GA permission condition and the new submit lock.
- Fix commit: `9d16fbc057264b97bb8f841e757a888637ba99e9`.
- New exact-head CI after this test correction: PENDING.



## CI feedback — maintenance assertion precision

- CI #3955 (`46114276302`) reached `test:effective-permission-ui` and failed only on the maintenance regression assertion.
- The assertion used a substring pattern that also matched the correct `await onAddSchedule(newObj)` path, so it produced a false positive even though the form awaited the callback.
- Replaced the pattern with an explicit source-order assertion: await callback → false-result guard → modal close.
- Fix commit: `fd80ab1c4800f17eaf76c5660c44c851f4519750`.
- All earlier steps in #3955 passed, including lint, asset-scope policy (105/105), PIBC ME ticket queue (28/28), and runtime persistence/security checks. New exact-head CI after the matcher correction: PENDING.

## Batasan dan risiko

- Cakupan perubahan hanya create form Aset dan Tiket. Form lain belum otomatis dianggap sudah diaudit.
- Tidak mengubah validasi backend, endpoint, permission, scope, database, migration, atau data operasional.
- Pengujian browser tetap diperlukan untuk membuktikan isian bertahan pada HTTP 4xx/5xx dan modal menutup setelah API sukses.
- Tidak ada akun, role assignment, permission assignment, atau data bisnis yang diubah.

## Next

1. Tunggu exact-head CI; perbaiki semua kegagalan pada branch ini.
2. Lanjutkan pola audit yang sama ke form create/edit lainnya (kontrak, vendor, knowledge, maintenance, reservasi) tanpa menganggap semuanya memiliki bug yang sama.
3. Uji browser per role dan per status API, termasuk penolakan pinjaman dengan API sukses/gagal, sebelum PR dinyatakan siap merge.
4. Jangan merge ke `main` tanpa persetujuan eksplisit pemilik proyek.
