# GABAH-GAS — UAT Checklist

**Status dokumen:** checklist disiapkan, UAT belum dijalankan.  
**Tanggal dibuat:** 2026-10-21  
**Aturan:** isi hasil aktual dan tautan/bukti saat pengujian; jangan ubah `NOT RUN` menjadi `PASS` tanpa bukti.

Status yang digunakan: `NOT RUN`, `PASS`, `FAIL`, `BLOCKED`.

| ID | Area | Prasyarat / langkah ringkas | Hasil yang diharapkan | Status | Bukti / catatan |
|---|---|---|---|---|---|
| UAT-001 | Login | Login dengan akun aktif dan kredensial benar | Login berhasil, sesi valid | NOT RUN | |
| UAT-002 | Login | Login dengan kata sandi salah | Ditolak tanpa membocorkan informasi sensitif | NOT RUN | |
| UAT-003 | Logout & sesi | Logout lalu akses endpoint terlindungi dengan sesi lama | Sesi berakhir dan akses ditolak | NOT RUN | |
| UAT-004 | Lockout | Gagal login berulang sesuai kebijakan | Proteksi pembatasan percobaan bekerja | NOT RUN | |
| UAT-005 | User management | Superadmin membuat, mengubah, menonaktifkan user | Perubahan tersimpan dan tercatat | NOT RUN | |
| UAT-006 | Dynamic roles | Buat role kustom, ubah nama/permission, lalu hapus role yang tidak terpakai | CRUD sesuai izin; tidak ada role/permission hardcoded yang diam-diam memberi akses | NOT RUN | |
| UAT-007 | User-role assignment | Assign dan cabut role kustom dari user | Assignment tersimpan; otorisasi berubah sesuai role baru | NOT RUN | |
| UAT-008 | Permission & scope | Uji permission tanpa scope, scope division, dan scope all | Akses mengikuti permission dan scope; default deny untuk yang tidak berwenang | NOT RUN | |
| UAT-009 | Isolasi divisi | Akun IT, GA, Supply Chain, PIBC, Auditor, Karyawan, dan custom role mengakses data lintas divisi | Data dibatasi sesuai kebijakan; tidak ada akses lintas divisi yang tidak sah | NOT RUN | |
| UAT-010 | Asset read/update | Baca dan update aset sendiri/divisi lain menggunakan role yang berbeda | Gate permission dan authority divisi konsisten | NOT RUN | |
| UAT-011 | Bulk import | Uji insert dan update aset, termasuk aset lintas divisi dan baris invalid | Update tidak melewati otorisasi; error per baris jelas; data tidak korup | NOT RUN | |
| UAT-012 | Maintenance read | Uji jadwal maintenance dengan role legacy dan custom, termasuk tanpa scope | Gate permission dan filter scope berlaku; jadwal tanpa aset rujukan ditangani fail-closed sesuai implementasi | NOT RUN | |
| UAT-013 | Maintenance create/update | Buat dan ubah jadwal dengan role diizinkan dan ditolak | Role/permission dan authority divisi ditegakkan | NOT RUN | |
| UAT-014 | Vendor | Buat/ubah vendor dengan role berizin dan tidak berizin | Permission, domain IT/GA, dan allowlist field ditegakkan | NOT RUN | |
| UAT-015 | Knowledge | Buat/ubah artikel dengan role berizin dan tidak berizin | Permission ditegakkan; validasi isi dan audit event berfungsi | NOT RUN | |
| UAT-016 | Contract | Buat/ubah kontrak, dokumen, dan tanggal pengingat | Otorisasi, validasi, dan pengingat sesuai konfigurasi bisnis | NOT RUN | |
| UAT-017 | Audit trail | Jalankan perubahan data penting lalu periksa log audit | Aktor, waktu, aksi, dan objek tercatat sesuai rancangan | NOT RUN | |
| UAT-018 | Input & error | Kirim input invalid, field tak diizinkan, ID tidak ada, dan request tanpa autentikasi | Ditolak aman dengan status/error yang tepat; tidak ada stack trace sensitif | NOT RUN | |
| UAT-019 | PostgreSQL | Jalankan migration pada DB uji; uji role, permission, scope, CRUD, dan isolasi divisi via HTTP | Migration idempotent dan otorisasi runtime benar pada mode PostgreSQL | BLOCKED | Belum ada bukti PostgreSQL live test dari pemeriksaan repo ini |
| UAT-020 | Regression file-store | Jalankan CI serta verifikasi HTTP yang tersedia pada file-store | Perilaku legacy tetap sesuai kebijakan dan tes lulus | NOT RUN | Catat run CI/commit aktual |
| UAT-021 | Backup/restore | Backup database dan berkas; pulihkan ke lingkungan uji dan verifikasi integritas | Pemulihan teruji, aplikasi bisa digunakan setelah restore | BLOCKED | Perlu akses lingkungan dan bukti restore |
| UAT-022 | Deployment/go-live | Deploy kandidat ke staging, cek konfigurasi, TLS, health, log, migrasi, rollback | Deployment/rollback terdokumentasi dan tervalidasi | BLOCKED | Belum diverifikasi melalui akses runtime |
| UAT-023 | User acceptance | Perwakilan pengguna tiap divisi menyelesaikan skenario kerja nyata dan menandatangani hasil | Semua kegagalan kritis diselesaikan atau diterima tertulis | NOT RUN | Isi nama peran penguji, tanggal, dan persetujuan |
| UAT-024 | Go-live decision | Review seluruh hasil, risiko terbuka, backup/restore, dan persetujuan pemilik proses | Keputusan READY / BLOCKED berbasis bukti | BLOCKED | Tidak boleh dianggap lulus hanya karena checklist dibuat |

## Exit criteria

Aplikasi tidak dinyatakan production-ready sebelum:
1. Seluruh kasus kritis yang relevan berstatus PASS atau ada penerimaan risiko tertulis.
2. UAT PostgreSQL live membuktikan permission dan scope pada runtime.
3. Backup/restore dan deployment/rollback sudah diuji.
4. Tidak ada bug keamanan kritis terbuka.
5. Pemilik proses menyetujui hasil UAT.


## Sesi preview kantor — smoke test terarah

**Tujuan:** memeriksa alur utama dan konsistensi role/scope sebelum UAT penuh. Jalankan pada preview/staging dengan database uji, bukan database produksi. Semua hasil awal tetap `NOT RUN` sampai benar-benar diuji.

| ID | Akun / skenario | Langkah | Hasil yang diharapkan | Status |
|---|---|---|---|---|
| PREV-001 | Superadmin | Login, buka Administrasi, buat role uji, atur permission, assign ke akun uji | Role dan assignment tersimpan; perubahan permission langsung tercermin setelah refresh/sesi diperbarui | NOT RUN |
| PREV-002 | Karyawan HO | Buka dashboard, aset, peminjaman, tiket, Knowledge Base | Hanya menu dan data yang diizinkan; tidak mendapat hak kelola hanya karena lokasi HO | NOT RUN |
| PREV-003 | Karyawan PIBC | Ulangi skenario Karyawan dari lokasi PIBC | Lokasi kerja PIBC tidak otomatis memberi role/owner aset PIBC atau akses kelola lintas domain | NOT RUN |
| PREV-004 | GA | Buka aset GA di HO dan lokasi cabang; coba aset IT | GA dapat mengelola sesuai permission + owner scope; aset IT tidak bisa diubah tanpa otorisasi | NOT RUN |
| PREV-005 | IT | Buka aset IT di semua lokasi; coba aset GA | IT tetap mengelola domain aset IT lintas lokasi; tidak otomatis mengelola aset GA | NOT RUN |
| PREV-006 | Supply Chain / RPC-SC | Buka data sesuai scope; coba akses kelola aset IT/GA | Nama unit/lokasi tidak otomatis menjadi role aplikasi atau owner domain | NOT RUN |
| PREV-007 | Auditor | Buka dashboard, aset, kontrak, tiket, audit log; coba aksi tulis | Data hanya sesuai scope Auditor; semua aksi tulis ditolak | NOT RUN |
| PREV-008 | Role custom create-only Knowledge | Buka Knowledge Base dan coba buat/edit artikel | Tombol buat tampil; tombol edit tidak tampil; API tetap menolak update tanpa permission | NOT RUN |
| PREV-009 | Role custom update-only Knowledge | Buka artikel yang dapat diakses | Tombol edit tampil; tombol buat tidak tampil; API tetap menolak create tanpa permission | NOT RUN |
| PREV-010 | Perpindahan aset | Pindahkan aset uji dari lokasi yang dinonaktifkan ke RPC/SC | Riwayat perpindahan tercatat; owner/pengelola aset tidak berubah hanya karena lokasi berubah | NOT RUN |
| PREV-011 | Helpdesk | Buat tiket sebagai Karyawan; proses sebagai petugas yang diberi permission | Pelapor melihat tiketnya; petugas melihat antrean sesuai scope; status dan audit trail konsisten | NOT RUN |
| PREV-012 | Sesi & refresh | Cabut permission/role dari akun uji, logout-login kembali, ulangi akses UI dan API | Akses lama tidak bertahan; menu, tombol, dan API mengikuti assignment terbaru | NOT RUN |

**Catatan penguji:** catat akun/role uji (tanpa kata sandi), waktu, URL preview, commit yang diuji, hasil aktual, screenshot, dan ID data uji. Jangan memasukkan data pegawai/aset produksi ke preview.
