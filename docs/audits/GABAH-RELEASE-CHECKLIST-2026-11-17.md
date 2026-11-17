# GABAH — Checklist Audit & Release

**Diperbarui:** 17 November 2026  
**Status keseluruhan:** belum production-ready; seluruh perubahan tetap di PR Draft sampai CI, UAT, dan release gate terbukti.

Dokumen ini adalah checklist kerja berjalan. Item hanya dicentang jika ada implementasi atau bukti pengujian yang dapat ditelusuri; CI hijau tidak menggantikan UAT browser maupun rehearsal operasional.

## 1. Fondasi aplikasi dan akses

- [x] Model role aplikasi dipisahkan dari jabatan, unit, dan lokasi kerja.
- [x] Dynamic RBAC menjadi sumber otorisasi PostgreSQL; menu mengikuti permission efektif dan backend tetap menjadi enforcement utama.
- [x] Dasar scope aset IT/GA, pegawai, Auditor, Sekdir, dan Humas memiliki regression coverage.
- [x] Auditor read-only dan menu dasar Auditor didokumentasikan.
- [x] Global module lifecycle dipisahkan dari permission per-role.
- [ ] Audit endpoint menyeluruh: list, detail, search, dashboard, notification, export, attachment, download, dan seluruh mutation.
- [ ] Uji langsung seluruh persona dan kombinasi multi-role di browser.

## 2. Keamanan dan integritas data

- [x] Ticket status PATCH memeriksa object-level ownership/scope dan menolak aktor di luar cakupan.
- [x] Kegagalan persistensi perubahan status tiket memulihkan status, catatan, timestamp, dan audit event.
- [x] Login lockout memakai pasangan IP + email ternormalisasi; akun lain di balik NAT yang sama tidak ikut terkunci.
- [x] Upload dokumen kontrak mengikat metadata dan audit event dalam satu alur persistensi dengan rollback file/metadata saat gagal.
- [x] Runtime PostgreSQL fail-closed: koneksi database yang sempat aktif tidak boleh diam-diam turun ke JSON file-store setelah pool/write error.
- [x] Snapshot lokal hanya diperbarui setelah write PostgreSQL berhasil; startup tidak menerbitkan snapshot sebelum sinkronisasi PostgreSQL berhasil.
- [ ] Rollback state in-memory untuk SEMUA mutasi saat PostgreSQL gagal; saat ini sebagian endpoint masih dapat mengubah objek memori sebelum persistensi gagal.
- [ ] Satu transaksi PostgreSQL atomik untuk state blob dan seluruh tabel normalized; saat ini persistensi blob dan backfill normalized masih memiliki batas transaksi terpisah.
- [ ] Fault injection untuk koneksi putus, statement gagal, disk penuh, dan restart di tengah operasi.
- [ ] Uji konkurensi multi-process/multi-instance untuk asset numbering, contract numbering, ticket, loan, dan operasi lain yang saling bertabrakan.
- [ ] Verifikasi konsistensi audit trail untuk semua create/update/delete/approval/rejection/export/download.

## 3. Modul dan workflow bisnis

- [x] Penomoran aset dan kontrak memakai allocator PostgreSQL dengan row lock; migration dan regression dasar tersedia.
- [x] Reservasi ruang memiliki exclusion constraint PostgreSQL untuk mencegah overlap pada status aktif.
- [x] Modul lisensi mengikuti lifecycle dan permission lisensi.
- [ ] Workflow ME (Mechanical/Electrical/Perawatan) PIBC: definisikan owner domain, role capability, routing, UI, API, dan audit; ME tidak boleh dibuat sebagai lokasi/divisi palsu.
- [ ] Verifikasi penuh alur peminjaman aset lintas status, approval, handover, pengembalian, dan benturan aset.
- [ ] Verifikasi kontrak: create/edit, dokumen, milestone, renewal, reminder, escalation, dan pembatasan dokumen.
- [ ] Verifikasi maintenance/vendor/knowledge base dari sisi UI dan API per scope.

## 4. UI, persona, dan aksesibilitas

- [ ] Browser UAT Superadmin, IT Support, GA, Karyawan, Auditor, Humas, Sekretariat Direksi, staf PIBC/ME, dan staf RPC/SC.
- [ ] Inventory semua sidebar menu/submenu: tidak ada menu kosong, halaman blank, loading tanpa akhir, atau route tanpa aksi.
- [ ] Uji form/modal create/edit/view/approve/reject pada desktop, tablet, dan mobile; cek scroll, safe-area, dan konten terpotong.
- [ ] Uji dashboard tiap role dengan data PostgreSQL yang benar-benar ter-scope.
- [ ] Uji akses langsung URL dan API untuk menu yang disembunyikan; UI hiding bukan kontrol keamanan.

## 5. Operasional dan release

- [ ] Fresh install Docker Compose + PostgreSQL 17.
- [ ] Upgrade database existing/legacy tanpa kehilangan relasi, file upload, atau histori.
- [ ] Backup dan restore PostgreSQL + uploads; verifikasi integritas hasil restore.
- [ ] Deployment staging rehearsal dan rollback rehearsal.
- [ ] TLS/reverse proxy/trusted proxy chain, secrets, least privilege, dan rotasi credential.
- [ ] Monitoring, health/alerting, log retention, dan prosedur incident recovery.
- [ ] Pengiriman email dan Telegram nyata: konfigurasi, retry, kegagalan provider, dan audit status.
- [ ] Sign-off pemilik proses dan UAT; baru setelah itu ajukan merge/release.

## 6. Bukti branch/CI yang sedang dikerjakan

- PR #115 — Dynamic RBAC foundation: https://github.com/inieki-lab/gabah-gas/pull/115 (Draft; jangan merge otomatis).
- PR #118 — ticket ownership, login lockout, contract document audit: https://github.com/inieki-lab/gabah-gas/pull/118 (Draft; CI #1822 sukses pada exact head sebelumnya).
- PR runtime persistence fail-closed — perubahan lanjutan berbasis PR #118; CI exact head masih menunggu.
- PR #116 persistence hardening adalah lead audit terpisah, bukan bukti rollback lengkap. Temuan bahwa mutasi in-memory belum universal di-rollback tetap terbuka.

**Aturan status:** centang implementasi tidak otomatis berarti pengujian browser/produksi lulus. Catat SHA dan run CI exact-head sebelum memindahkan status menjadi verified.

## 7. Temuan lanjutan — persistensi domain service (17 November 2026)

- [ ] **Audit trail masih memiliki jalur fire-and-forget:** `GabahDomainService.recordAudit()` menambahkan event ke `db.auditLogs`, lalu memanggil `persistDataStore().catch(...)` tanpa menunggu hasil. Pemanggil tidak dapat mengetahui apakah audit event durable.
- [ ] **Reservasi ruang dan master fasilitas/rapat** pada branch PR #119 masih memiliki beberapa pemanggilan `persistDataStore().catch(...)` sebelum mengembalikan hasil: create/approve/reject/check-in/check-out/cancel reservasi, update room, serta CRUD meeting type/facility. Ini berisiko mengembalikan sukses sebelum write PostgreSQL selesai.
- [ ] PR #116 memiliki implementasi lanjutan yang mengubah sebagian domain mutation menjadi async/await dan menunggu persistensi. Namun PR #116 adalah jalur branch terpisah; perubahan itu belum boleh dianggap sudah masuk ke PR #119. Rekonsiliasi diff wajib dilakukan agar tidak menimpa perbaikan security di PR #118.
- [ ] Perbaikan harus mengikat perubahan data + audit event dalam satu persistensi yang ditunggu, dengan pemulihan state/file bila write gagal. Jangan sekadar mengganti `.catch()` menjadi `await` tanpa rollback atau strategi transaksi.
- [ ] Regression test harus membuktikan: (a) API tidak merespons sukses sebelum write selesai, (b) write gagal menghasilkan error yang tepat, (c) state in-memory dan audit log tidak tertinggal berubah setelah kegagalan, dan (d) tidak ada duplikasi audit akibat persistensi ganda.

**Bukti inspeksi:** `server/services.ts` pada branch `audit/runtime-persistence-fail-closed` (17 Nov 2026) masih memuat fire-and-forget pada `recordAudit` dan beberapa metode reservasi/room/meeting type/facility. Versi `server/services.ts` pada commit PR #116 `a2901a0635b47e2d5e797d1a6dc327ce57038508` sudah mengurangi pola tersebut di sebagian besar metode, tetapi tetap menyisakan fire-and-forget di `recordAudit`. Status ini adalah temuan audit, bukan klaim bahwa seluruh jalur sudah diperbaiki.
