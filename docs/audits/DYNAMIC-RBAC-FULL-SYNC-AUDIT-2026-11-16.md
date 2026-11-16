# GABAH — Audit Baseline Dynamic RBAC & UI Synchronization

Tanggal: 16 November 2026
Basis audit: `preview/green-enterprise-theme-laptop`
Branch tindak lanjut: `audit/dynamic-rbac-full-sync`
Status: audit awal terverifikasi; bukan sertifikasi keamanan final.

## Keputusan arsitektur yang wajib dipertahankan

GABAH memakai Dynamic RBAC sebagai satu-satunya sumber otorisasi produksi. Permission tidak diturunkan otomatis dari jabatan, unit organisasi, divisi, atau lokasi kerja. Role adalah paket permission dan scope yang dapat dibuat/diubah/dinonaktifkan Super Admin. User dapat menerima beberapa role/capability. Jabatan, unit, office location, owner domain, lokasi fisik aset, dan custodian adalah atribut terpisah.

Lokasi RPC/SC dan PIBC bukan role. Nama jabatan seperti Direksi/Kadiv/Kadep/Kasi/Staf bukan role. Sekretariat Direksi, Humas, Admin ME, IT Support, GA Helpdesk, Asset Operator, Approver, dan Ticket Dispatcher harus dimodelkan sebagai role/capability dinamis yang dapat diberikan sesuai kebutuhan—bukan hard-coded sebagai persona wajib.

Role Super Admin adalah pengecualian tata kelola yang dilindungi: akses administrasi global hanya berasal dari role yang ditandai `is_superadmin` di database dan harus tetap melindungi Super Admin aktif terakhir. Auditor read-only merupakan kebijakan deny-write eksplisit yang harus diuji pada semua endpoint mutasi.

## Temuan kode terverifikasi

### P0 — Frontend masih terikat pada label role lama

- `src/types.ts`: `UserRole` masih union statis sembilan label. Ini membuat identitas user dan katalog role dinamis tidak sepenuhnya terpisah di tipe frontend.
- `src/navigation/roleNavigation.ts`: masih ada `ROLE_NAVIGATION` statis dan fungsi navigasi mensyaratkan `role` tidak null sebelum memeriksa `permissionKeys`. Pada PostgreSQL, permission seharusnya menjadi penentu menu; label role tidak boleh menjadi prasyarat.
- `src/components/Sidebar.tsx`: pengelompokan menu, label dashboard, status staf, dan badge masih memakai `activeRole === 'IT'/'GA'/'Humas'/'Sekretaris Direksi'` serta daftar label legacy. Ini perlu diganti dengan metadata menu dan permission/capability efektif.
- `src/App.tsx`: tab awal dan validasi tab aktif harus sepenuhnya diturunkan dari permission efektif dan modul aktif; tidak boleh mengandalkan role primer untuk memilih landing page.
- `src/components/modals/AdministrationModal.tsx`: masih memiliki `SYSTEM_ROLES`, `DEFAULT_PERMISSIONS`, dan `PRIMARY_PROFILE_ROLES` statis. UI administrasi role harus mengambil katalog role, permission, scope, dan assignment dari API PostgreSQL; tidak boleh menawarkan matriks otorisasi hard-coded sebagai sumber kebenaran.

### P0 — Backend masih membawa jalur kompatibilitas berbasis role

- `server/services.ts`: `LEGACY_SCOPED_ROLES` dan beberapa cabang `actor.role === ...` masih ada. Setiap jalur tersebut harus dipastikan hanya aktif pada mode file-store non-produksi; PostgreSQL harus menolak akses tanpa permission dan scope eksplisit.
- `server/runtime-hardening.ts`: sebagian policy sudah memakai Dynamic RBAC untuk tiket/aset/attention, tetapi seluruh endpoint dan resolver detail harus diaudit agar list, detail-by-ID, pencarian, export, dashboard, agregasi, dan mutasi menggunakan policy resolver yang sama.
- `server/rbac-policy.ts`: policy cache memuat role, permission, dan scope dari PostgreSQL. Perlu pengujian cache invalidation, assignment multi-role, role nonaktif, user nonaktif, permission nonaktif, scope module-specific, dan restart.
- `server.ts`: seluruh route perlu inventory endpoint-by-endpoint; middleware global saja tidak membuktikan semua operasi domain telah memakai permission + scope yang tepat.

### P1 — Tema saat ini hanya lapisan override parsial

- `src/index.css` sudah memuat token hijau, tetapi pendekatannya banyak meng-override utility Tailwind tertentu (`bg-slate-50`, `text-slate-900`, `bg-emerald-600`, dan lainnya). Itu tidak menjamin konsistensi untuk seluruh komponen yang memakai warna hard-coded lain.
- Tema tidak boleh dibangun dengan mengganti seluruh aplikasi atau menambahkan dependensi besar. Pertahankan modul, alur, tabel padat, form, modal, dan perilaku GABAH; bangun design tokens dan komponen shell konsisten lalu migrasikan halaman secara bertahap.

## Target sinkronisasi yang harus dicapai

1. Database PostgreSQL adalah sumber tunggal role templates, permissions, scopes, user-role assignments, dan module lifecycle.
2. Jabatan/unit/lokasi hanya atribut organisasi; tidak ada grant implisit atau fallback berdasarkan atribut tersebut.
3. Sidebar dan submenu hanya tampil berdasarkan permission efektif, scope yang relevan, dan status modul aktif.
4. Route/halaman langsung tanpa menu tetap harus memeriksa izin; akses ditolak jika tidak ada permission.
5. Tombol, aksi, form create/edit/approve/delete/export mengikuti permission masing-masing, tetapi enforcement tetap di backend.
6. Landing page ditentukan dari halaman aktif pertama yang diizinkan; user tanpa permission mendapat halaman akses terbatas yang informatif, bukan Dashboard default.
7. Label dashboard dan kelompok menu tidak boleh menebak jabatan/role. Gunakan label produk netral atau metadata capability.
8. Assignment multi-role bersifat additive, transaksional, diaudit, dan tidak hilang saat rekonsiliasi/restart.
9. Scope data konsisten antara list, detail, relasi, pencarian, export, dashboard, KPI, notifikasi, dan laporan.
10. Uji positif dan negatif untuk setiap modul: tanpa permission, permission tanpa scope, scope tanpa permission, scope lintas modul, role nonaktif, user nonaktif, multi-role, Auditor, dan Super Admin.

## Matriks audit wajib per modul

Untuk setiap modul yang ditemukan di `App.tsx`, Sidebar, API client, dan backend:
- Menu dan submenu
- Route/page direct access
- Dashboard/widget/count/notification
- List/search/filter/sort/export
- Detail dan relasi record
- Create/update/delete
- Approve/reject/assign/close/handover
- Attachment/upload/download
- Scope per record dan owner domain
- Module lifecycle active/inactive
- Audit log dan regression tests

Modul awal yang harus dicakup: Dashboard, Aset Saya, Inventaris, Mutasi, Peminjaman, Helpdesk/Tiket, Maintenance, Lisensi, Vendor, Kontrak, Ruang Rapat/Reservasi, Knowledge Base, Laporan, User Administration, Dynamic RBAC, Organization Masters, Master Data, Numbering, Notification Rules, Audit Log, Settings, Data Administration, Health, dan Module Lifecycle.

## Tema visual yang dipilih untuk evaluasi

Evaluasi pola visual Shadcn Dashboard / Tailwind Admin yang berlisensi MIT sebagai referensi layout dan komponen, bukan mengganti aplikasi GABAH. Pilihan awal: enterprise workspace modern, hijau Food Station yang lebih matang, sidebar collapsible, header ringkas, typography tegas, tabel profesional, status badges semantik, form konsisten, dan dukungan layar laptop. Semua data dan aksi tetap menggunakan API GABAH yang ada.

## Gate sebelum UAT/merge

- Tidak ada akses produksi yang bergantung pada label role lama.
- Tidak ada grant implisit dari jabatan, unit, divisi, atau lokasi.
- Semua menu dan halaman sinkron dengan permission efektif dan module lifecycle.
- Endpoint list/detail/mutasi/export diuji dengan akun per capability.
- Uji regresi multi-role, Auditor deny-write, Super Admin terakhir, scope exclusion, dan role/module inactive lulus.
- Build, typecheck, seluruh suite test relevan, Docker fresh DB, upgrade DB existing, dan runtime smoke lulus.
- Backup/restore dan UAT browser per persona selesai.
- Jangan merge ke main sebelum semua gate lulus.

## Catatan CI yang diketahui pada saat audit

GitHub Actions run 1509 pada commit `ecf0ccc56b6ec74084ec4828eb962882501c0222` gagal pada langkah `Asset numbering rule integrity and deletion safeguards`. Langkah-langkah sebelumnya, termasuk typecheck, Dynamic RBAC foundation, role navigation, dashboard scope, build, Docker smoke, PostgreSQL integration, P0 security, dan sebagian regression checks, lulus. Run 1508 sebelumnya sukses. Run 1509 perlu diperbaiki sebelum branch dijadikan basis rilis.
