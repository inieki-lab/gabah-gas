# Audit Aplikasi GABAH — Pemetaan Menyeluruh Berbasis Source

**Basis source:** commit `19dab19b1f9160342c274b4aecc4bbbfc0b5ae0a` pada `main`  
**Cakupan:** inventarisasi repository untuk memahami keseluruhan produk; pembacaan jalur utama frontend, navigasi, tipe domain, API client, route Express, policy RBAC, dokumentasi, dan nama suite verifikasi.  
**Jenis audit:** static architecture/product inventory, bukan pengujian fungsional menyeluruh atau penilaian keamanan independen.

## Ringkasan

GABAH adalah portal operasional internal PT Food Station Tjipinang Jaya. UI React/TypeScript memakai Express REST API; business rules dan otorisasi berada di backend/domain services, dengan PostgreSQL sebagai persistence produksi menurut dokumentasi/runtime. Frontend menampilkan navigasi berdasarkan capability dan status modul, tetapi penyembunyian UI tidak menggantikan enforcement server.

## Peta aplikasi

### Navigasi utama (12 area)

- Dashboard KPI/attention
- Aset Saya
- Ruang Rapat
- Katalog Aset
- Maintenance
- Pinjaman/BAST
- Tiket Helpdesk/SLA
- Software & SaaS/Lisensi
- Kontrak
- Vendor
- Knowledge Base
- Laporan & Audit

Role-navigation dan permission-key memengaruhi tampilan menu; modul juga difilter oleh registry modul aktif. Peran legacy yang tampak di tipe/kompatibilitas meliputi Admin GABAH, IT, GA, Sekretaris Direksi, Humas, Supply Chain, PIBC, Karyawan, dan Auditor. Dokumen RBAC menekankan bahwa nama/fungsi/lokasi legacy tidak sama dengan role aplikasi dinamis.

### Panel administrasi (12 area + overview)

- Pengguna
- Role & Hak Akses
- Owner Domain
- Struktur Pegawai
- Referensi Aset & Layanan
- Penomoran Aset
- Aturan Notifikasi
- Riwayat Aktivitas
- Pengaturan Sistem
- Ekspor & Rekonsiliasi
- Kesehatan Sistem
- Siklus Hidup Modul
- Dashboard Overview

Panel diberikan lewat navigasi Superadmin. Backend menyediakan API khusus untuk manajemen pengguna, Dynamic RBAC, master organisasi, notification rules, system settings, numbering, audit, dan lifecycle modul. Hak akses tetap harus ditentukan server.

### Domain/backend yang dipetakan

Route Express mencakup autentikasi dan user; roles/permissions/scopes; master job-level, unit, kantor, lokasi aset, divisi, kategori; asset CRUD/import/assignment/movement/lifecycle; loans; tickets/assignees/comments/status; maintenance; vendors; knowledge; notifications; dashboard/attention; reconciliation/audit logs; contracts/documents/milestones/reminders; meeting rooms/reservations/types/facilities; health dan module lifecycle.

Alur domain penting yang terlihat dari spesifikasi/source: pemisahan owner aset, unit organisasi, lokasi kerja, lokasi fisik dan custodian; check otorisasi/scope pada server; pinjaman anti-collision dan transisi handover/return; tiket SLA dan assignment; reservasi dengan approval/layanan pendukung; dokumen kontrak melalui API terotorisasi; perubahan data diaudit dan keberhasilan mutasi digate oleh persistence.

## Temuan lintas aplikasi

1. **Dokumentasi tidak seragam/ada yang historis.** README, API Design, dan Architecture masih mendeskripsikan Bearer/localStorage untuk auth, sementara client/server pada basis source sudah menggunakan cookie sesi untuk browser. `AUDIT_NOTES.md` memuat narasi mode development unrestricted dan fallback role-switch yang tidak boleh dianggap sebagai kebijakan runtime terkini tanpa verifikasi. Gunakan source + dokumen progres terbaru, lalu rekonsiliasi dokumen lama.
2. **Metadata sumber data pada Administration UI terlihat usang/tidak konsisten dengan API client.** Kartu panel melabeli notification rules dan system settings sebagai “konfigurasi masih lokal”, serta numbering “format masih lokal; sequence dari API”. Namun API client dan server memiliki endpoint GET/PATCH untuk notification rules dan system settings serta API untuk numbering rules. Perlu telusuri handler UI/state per section sebelum menyimpulkan sumber persistensi; koreksi label setelah perilaku aktual diverifikasi.
3. **Model role dan role persona perlu dibedakan jelas.** User CRUD membatasi primary profile role ke role built-in tertentu; assignment role fungsi dinamis dikelola terpisah melalui RBAC. Itu konsisten dengan target pemisahan identitas, role primer, additional roles, job-level, unit, office location, dan owner. UAT perlu menguji pembuatan/edit pengguna beserta role assignment dan sinkronisasi primary role.
4. **UI permission bukan kontrol server.** Sidebar memakai permission dan active module untuk menentukan menu, sedangkan route/domain layer harus menjadi otoritas. Penilaian lengkap membutuhkan pengujian negatif per endpoint dan kombinasi permission/scope; audit ini tidak mengeksekusi semua kombinasi.
5. **Kompleksitas aturan bisnis tinggi.** Modul asset/loan/ticket/room/contracts melibatkan batas otorisasi, state-transition, konsistensi transaksi/persistence, dan notifikasi. Perubahan nanti harus mengikuti pola layanan, validasi, audit, migrasi, API client, UI, dan skrip verifikasi yang sudah ada—hindari perubahan hanya di frontend.

## Verifikasi dan batas audit

Repository memiliki banyak skrip verifikasi terarah untuk RBAC, scope, menu, asset mutations, loan collisions/transitions, room reservations, contracts, maintenance, imports, notifications, dan persistence. Keberadaan skrip bukan bukti bahwa semua skrip dijalankan atau semua perilaku lolos pada audit ini.

Audit ini tidak melakukan klik-through setiap layar, login dengan setiap role, menjalankan seluruh suite UAT/regression, menguji data PostgreSQL aktif, memeriksa browser console/network, menguji integrasi email/Telegram, menguji restore backup, atau mengakses deployment/host production. Tidak ada klaim bahwa seluruh fitur telah lulus pengujian.

## Cara memakai catatan ini

Dokumen ini adalah peta awal agar perubahan berikutnya tidak mengasumsikan GABAH sekadar dashboard aset atau hanya isu keamanan. Sebelum mengubah fitur tertentu, telusuri alur UI → API client → route/middleware → domain service → persistence/migration → test, dan validasi skenario pemilik bisnis/UAT yang relevan. Catatan ini tidak menggantikan source-of-truth requirement atau persetujuan pemilik proses.
