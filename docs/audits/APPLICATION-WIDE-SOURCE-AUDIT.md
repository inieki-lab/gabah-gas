# Audit Aplikasi GABAH — Pemetaan Source dan Catatan Lanjutan

**Basis source:** commit `19dab19b1f9160342c274b4aecc4bbbfc0b5ae0a` pada `main`  
**Cakupan:** inventarisasi seluruh menu dan domain, pembacaan wiring UI/API, navigasi, tipe domain, jalur admin/user/RBAC, route Express terkait, dokumentasi dan skrip verifikasi.  
**Jenis audit:** static architecture/product review; bukan UAT menyeluruh, pentest, atau penilaian production-readiness.

## Ringkasan

GABAH adalah portal operasional internal PT Food Station Tjipinang Jaya. UI React/TypeScript memakai Express REST API; aturan domain dan otorisasi berada di backend/domain services, dengan PostgreSQL sebagai persistence produksi menurut dokumentasi/runtime. Frontend menyajikan navigasi berdasar role/permission efektif dan status modul, tetapi backend tetap otoritas keamanan.

## Peta aplikasi

### Navigasi utama — 12 area

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

Role-navigation, permission-key, dan module lifecycle registry memengaruhi menu/halaman yang terlihat. Tipe dan kompatibilitas lama menyebut Admin GABAH, IT, GA, Sekretaris Direksi, Humas, Supply Chain, PIBC, Karyawan, Auditor. Model RBAC yang dimaksud memisahkan user identity, primary/additional application roles, permissions, scopes, job level, organizational unit, office location, owner domain, asset location, dan custodian.

### Panel administrasi — overview + 12 bagian

Pengguna; Role & Hak Akses; Owner Domain; Struktur Pegawai; Referensi Aset & Layanan; Penomoran Aset; Aturan Notifikasi; Riwayat Aktivitas; Pengaturan Sistem; Ekspor & Rekonsiliasi; Kesehatan Sistem; Siklus Hidup Modul.

### Domain/backend yang dipetakan

Auth/session dan users; Dynamic RBAC roles/permissions/scopes; job-level/unit/office/asset-location/division/category masters; assets/import/assignment/movement/lifecycle; loans; tickets/assignees/comments/status; maintenances; vendors; knowledge articles; notifications; dashboard/attention; reconciliation/audit logs; contracts/documents/milestones/reminders; meeting rooms/reservations/types/facilities; health/module lifecycle.

Domain-domain ini memerlukan verifikasi di lapisan UI → API → route/middleware → business service → persistence/migration. Keberadaan route atau tombol saja tidak membuktikan aturan bisnis berjalan benar.

## Catatan wiring UI dan pengguna

- `App.tsx` menghubungkan semua 12 tab ke view khusus dan callback API. Login memulihkan sesi dari profil server; role switch mengubah sesi melalui endpoint server.
- Refresh data menggunakan kumpulan request paralel. Sebagian request memakai fallback ketika gagal; daftar user dapat jatuh ke `INITIAL_USERS`, sedangkan maintenance/vendor/knowledge mempertahankan seeded state ketika respons kosong. Ini berpotensi menyamarkan perbedaan antara data kosong, request gagal, dan data demo/stale. Validasi mode runtime serta perilaku produksi; jangan menganggap mock/fallback sebagai sumber data otoritatif.
- CRUD pengguna dan reset sandi berada di Admin panel; route server memeriksa otoritas superadmin, melakukan validasi input, menangani status aktif/primary role, dan menghubungkan role assignment dinamis ke jalur RBAC terpisah. Alur perubahan role, assignment tambahan, demosi superadmin terakhir, dan revoke session perlu UAT serta tes database.
- Route `POST /api/auth/switch-role` pada basis source mensyaratkan superadmin dan menolak principal lain. Karena dokumentasi historis (termasuk `AUDIT_NOTES.md`) berisi klaim yang berbeda tentang role switching/unrestricted development, dokumentasi historis tidak boleh dianggap sebagai bukti kebijakan aktual.
- Header/Navbar dan Sidebar menampilkan notifikasi, aksi, atau menu berdasar capability. Itu presentasi; endpoint dan object-level scope backend harus diuji langsung.

## Temuan lintas aplikasi

1. **Dokumentasi drift.** README, API Design, dan Architecture masih mendeskripsikan Bearer/localStorage untuk auth, sementara basis source client/server sudah memakai cookie sesi browser. `AUDIT_NOTES.md` berisi narasi development/role switching lama yang bertentangan dengan guard server sekarang. Rekonsiliasi dokumen sebelum menyebut satu dokumen sebagai gambaran runtime terkini.
2. **Label sumber data Admin tampak tertinggal.** Kartu Admin melabeli notification rules dan system settings sebagai konfigurasi lokal, serta format numbering lokal. API client/server pada basis source menyediakan endpoint untuk notification settings, system settings, dan numbering rules. Telusuri state/handler section secara end-to-end; setelah dikonfirmasi, koreksi label agar operator tahu mana data tersimpan di server.
3. **Fallback refresh memerlukan audit data nyata.** Empty response dan request error tidak ditangani seragam antar-domain. Uji production dengan database kosong/record kosong, API 401/503, dan jaringan putus agar seeded/demo state tidak keliru tampil sebagai data perusahaan dan kegagalan tidak tersamarkan.
4. **Primary role ≠ additional role.** User CRUD menerima built-in primary roles; Dynamic RBAC mengelola roles/permissions/scopes terpisah. UAT harus mencakup tambah/edit/nonaktif/reset user, role primer, role tambahan, role Auditor read-only, scope, dan revoke session.
5. **Nav bukan kontrol akses.** Sidebar memfilter permission dan modul aktif, tetapi akses langsung ke API/ID harus tetap deny-by-default pada backend. Uji negatif setiap domain untuk list, detail, mutasi, approval, import/export, dashboard, dan agregasi.
6. **Aturan bisnis berisiko tinggi.** Anti-collision loan, workflow tiket/SLA, approval room/VIP, owner-scope asset/vendor/contract, upload/download dokumen, notifikasi reminder, serta persistence/audit memerlukan test server-level dan UAT; audit ini tidak memverifikasi setiap transisi atau hasil transaksi.
7. **Temuan auth transport legacy** dicatat lebih lengkap pada [catatan migrasi cookie](../security/SESSION-COOKIE-MIGRATION-AUDIT.md): server masih menerima Bearer dan x-auth-token; proxy-origin/TLS/CSP perlu pembuktian di lingkungan target.

## Inventaris skrip verifikasi

Repository memuat banyak skrip terarah untuk navigation, Dynamic RBAC, object scopes, users, asset atomicity/import, loans, tickets, maintenance, meeting rooms, contracts, notifications, upload security, persistence, serta browser storage. Ini menunjukkan cakupan regression yang bermakna, tetapi tidak membuktikan seluruh script dijalankan pada audit ini. Cocokkan setiap perubahan dengan script yang relevan dan catat hasil nyata.

## Yang belum diverifikasi

Tidak dilakukan click-through tiap screen, login sebagai semua role, menjalankan semua suite/UAT, pengujian langsung DB aktif, inspeksi browser console/network, pengujian email/Telegram, simulasi restore backup, penetration test, atau akses host/proxy production. Dokumen ini adalah pemetaan sumber dan daftar risiko/validasi, bukan pernyataan bahwa semua fitur telah lulus.

## Cara menggunakan

Untuk perubahan berikutnya: telusuri seluruh jalur UI → API client → middleware/route → service → persistence/migration → regression tests. Ubah hanya setelah memahami dampak per role, data scope, state transitions, audit, dan business owner sign-off. Validasi di branch terpisah; jangan mengedit langsung ke `main`.
