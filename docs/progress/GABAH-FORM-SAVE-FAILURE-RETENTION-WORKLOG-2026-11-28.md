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




## Temuan tambahan — Permohonan Peminjaman dan pesan collision

`CreateLoanModal` sudah menahan modal ketika callback gagal, tetapi `App.handleRequestLoan` menelan exception dan mengembalikan `void`. Akibatnya form tetap terbuka namun pesan validasi/collision dari API hanya muncul sebagai toast dan tidak melekat pada form; pengguna dapat kehilangan konteks saat mengganti tanggal/aset.

Perbaikan:
- Callback sekarang mengembalikan `Promise<string | null>`: null untuk transaksi sukses, pesan server untuk kegagalan.
- Modal menampilkan pesan validasi/collision otoritatif dari API di dalam form.
- Isian aset, periode, tujuan, dan nomor telepon tetap dipertahankan ketika server mengembalikan 4xx/5xx.
- Pesan error dibersihkan ketika pengguna mengubah aset/tanggal/tujuan/telepon.
- Kegagalan refresh setelah transaksi sukses dipisahkan agar tidak membuat permohonan yang sudah tersimpan dianggap gagal dan dikirim ulang.
- Regression assertions ditambahkan ke test UI.

Catatan: ini meningkatkan visibilitas dan pemulihan form untuk kasus collision/validation. Ini tidak mengubah aturan collision atau menghapus konflik yang memang sah; untuk mendiagnosis kasus Agus/MacBook tertentu tetap diperlukan pesan HTTP aktual dan status pinjaman terkait pada database uji.



## Temuan tambahan — Penyelesaian Tiket

Dialog “Selesaikan Tiket Helpdesk” juga memanggil `onUpdateTicketStatus()` tanpa menunggu hasil, lalu menutup dialog dan menghapus catatan solusi. Parent handler menangkap kegagalan API dan tidak meneruskan error ke dialog.

Perbaikan:
- `App.handleUpdateTicketStatus` sekarang mengembalikan `Promise<string | null>`: null setelah status berhasil disimpan, pesan server saat gagal.
- Dialog penyelesaian tiket menunggu hasil dan hanya ditutup setelah sukses.
- Saat API gagal, catatan solusi tetap tersimpan di form dan error ditampilkan.
- Tombol/textarea dikunci selama request; catatan wajib tetap bisa diedit setelah kegagalan.
- Direct status buttons tetap menerima toast dari parent; perubahan ini menambah pemulihan inline khusus dialog penyelesaian.
- Regression assertions ditambahkan pada test UI.


## File yang diubah

- `src/App.tsx`
- `src/components/modals/CreateTicketModal.tsx`
- `src/components/modals/CreateAssetModal.tsx`
- `src/components/views/MaintenanceView.tsx`
- `src/components/views/LoansView.tsx`
- `src/components/modals/CreateLoanModal.tsx`
- `src/components/views/TicketsView.tsx`
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
- `003245494e5f363adfc3f2ab67e8936849b87628` — App meneruskan pesan API permohonan pinjaman ke form.
- `022c1db6cfda4183af74fbf0a1270dc217f7a943` — form pinjaman menampilkan pesan collision/validation dan mempertahankan isian.
- `2a72baf4d6a94a4cc0b0fe241dbf533e9939d818` — regression contract untuk pesan error pinjaman.
- `8c9fbe5c4f8fa3ae346a5d58b6296b49baa69d47` — App meneruskan hasil status tiket ke dialog.
- `1f7b6a70b3d69e7c11318e48fe6408e233d46fe3` — dialog penyelesaian tiket menahan catatan sampai API sukses.
- `5031d988c1d4e15cd7de8f2b00100e1354b6afdc` — regression contract untuk dialog penyelesaian tiket.
- `90b7c878b746777a7fe2384b81205e7c9ed52af7` — declaration state untuk dialog penyelesaian tiket.
- `30a0300d2d1e78b7c22282fea8b1f3908a385c76` — letakkan handler penyelesaian tiket di scope komponen.

## Validasi

| Pemeriksaan | Status |
|---|---|
| Source inspection modal, App handlers, dan caller | DONE |
| Regression assertions untuk ticket + asset save result | ADDED; belum dieksekusi lokal |
| `npm run test:effective-permission-ui` | NOT RUN locally — no repository checkout/runtime in this session; additional source assertions for Maintenance are included |
| TypeScript `npm run lint` | NOT RUN |
| Production build | NOT RUN |
| Exact-head GitHub Actions | PASS — #3979 on code head `efdf124...` and #3981 on latest head `d73f4d...`; both 120/120 workflow steps passed |
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



## CI feedback — ticket resolution state declarations

- CI #3973 (`46115012176`) failed during TypeScript typecheck because the new ticket resolution handler/modal referenced `isResolving` and `resolveError` state without declarations.
- Added both state declarations adjacent to `resolutionNotes` in `TicketsView`.
- Fix commit: `90b7c878b746777a7fe2384b81205e7c9ed52af7`.
- This is a compile-time correction; no workflow or business-rule behavior changed. Exact-head CI after the correction is pending.



## CI feedback — ticket resolution handler scope

- CI #3976 (`46115149746`) failed TypeScript because `handleResolveTicket` had been inserted inside the `filteredTickets` callback, so it was not visible to the modal JSX.
- Moved the handler to the component scope, immediately before the ticket capability/action derivations.
- Fix commit: `30a0300d2d1e78b7c22282fea8b1f3908a385c76`.
- Exact-head CI after the scope correction is pending.



## Final exact-head CI result

- CI run #3979 (`46115275355`) completed **SUCCESS** on exact head `efdf124f4d63fd81abea81667e0b93062551248e`.
- All 120/120 workflow steps passed, including TypeScript, effective-permission UI regressions, navigation/role checks, PostgreSQL integration, production build, Docker runtime smoke, P0 HTTP security, and loan/ticket checks.
- Browser UAT remains NOT RUN; user-facing success/failure flows still require local browser verification.



## Final exact-head CI result

- CI #3981 (`46115489030`) completed **SUCCESS** on latest PR head `d73f4d35929cf9506174d3e18acd5066d6abf86e`.
- All 120/120 workflow steps passed. This includes the final worklog-only commit after the code-head pass #3979.
- Browser UAT remains NOT RUN; test the API failure and success paths in the local browser with representative roles.

## Batasan dan risiko

- Cakupan perubahan hanya create form Aset dan Tiket. Form lain belum otomatis dianggap sudah diaudit.
- Tidak mengubah validasi backend, endpoint, permission, scope, database, migration, atau data operasional.
- Pengujian browser tetap diperlukan untuk membuktikan isian bertahan pada HTTP 4xx/5xx dan modal menutup setelah API sukses.
- Tidak ada akun, role assignment, permission assignment, atau data bisnis yang diubah.

## Next

1. Tunggu exact-head CI; perbaiki semua kegagalan pada branch ini.
2. Lanjutkan pola audit yang sama ke form create/edit lainnya (kontrak, vendor, knowledge, maintenance, reservasi) tanpa menganggap semuanya memiliki bug yang sama.
3. Uji browser per role dan per status API, termasuk permohonan pinjaman dengan collision 409, validasi 400, network failure, sukses, serta penyelesaian tiket dengan API gagal/sukses, sebelum PR dinyatakan siap merge.
4. Jangan merge ke `main` tanpa persetujuan eksplisit pemilik proyek.
