# Audit RBAC, Struktur Organisasi, dan Data Scope GABAH

Tanggal audit: 8 November 2026  
Branch: `fix/role-based-navigation`  
Status: temuan awal terverifikasi dari source code; belum merupakan pernyataan bahwa seluruh endpoint telah diaudit.

> **Pembaruan status 8 November 2026:** Bagian 2 di bawah adalah snapshot temuan awal, bukan seluruhnya kondisi kode terkini. Perbaikan lanjutan pada branch stabilisasi sudah mengubah beberapa poin. Gunakan pembaruan ini sebagai status terkini; temuan historis dipertahankan untuk jejak audit.

### Koreksi status implementasi pada branch stabilisasi

- `getScopedAssets()` dan resolver detail aset telah diselaraskan pada kebijakan owner domain dinamis: IT mengelola owner IT lintas lokasi; GA mengelola owner GA; akses baca tambahan GA ke Laptop/PC owner IT memerlukan `assets.read.it_workstations` dan tidak memberi hak mutasi.
- Owner domain aset tidak lagi dimaksudkan sebagai enum tetap IT/GA/SC/PIBC. Scope owner dinamis mendukung domain operasional tambahan serta pengecualian seperti `division_except`.
- Lokasi kerja pegawai, unit organisasi, owner aset, lokasi fisik, dan custodian diperlakukan sebagai dimensi terpisah. Supply Chain dan PIBC adalah unit/lokasi, bukan role aplikasi permanen.
- Migration `026_map_branch_accounts_to_employee_location.sql` saat ini sengaja tidak melakukan perubahan data. Draft migrasi lama yang mengubah role/assignment berdasarkan label cabang tidak boleh dijalankan ulang atau dianggap sebagai pemetaan produksi yang disetujui.
- Humas dan Sekretaris Direksi mengikuti baseline Karyawan dengan capability fungsi tambahan yang eksplisit; bukan alasan untuk menggabungkan lokasi kerja dengan role.
- Auditor read-only kini ditentukan dari role efektif yang terpasang, termasuk ketika Auditor menjadi role tambahan. Enforcement berada di middleware dan domain/API, bukan hanya UI.
- CI PostgreSQL 17 fresh database dan persistence integration telah lulus pada head sebelumnya. CI head terbaru tetap harus diperiksa; ini belum menggantikan UAT browser, pengujian upgrade dari snapshot legacy, atau rehearsal backup/restore.
- **Belum selesai:** audit menyeluruh seluruh endpoint, rekonsiliasi data historis per user/aset, UAT tiap persona, deployment staging, backup/restore, dan persetujuan pemilik proses.


### Temuan lanjutan — Riwayat perpindahan aset

- `GET /api/movements` sebelumnya memanggil `getScopedAssets(actor)`, lalu menyaring ulang hasilnya berdasarkan daftar role primer lama (`Karyawan`, `Sekretaris Direksi`, `Humas`, `Supply Chain`, `PIBC`).
- Filter kedua tersebut menghapus aset yang terlihat melalui scope dinamis ketika pengguna beridentitas pegawai memiliki role tambahan yang sah. Dampaknya, katalog/detail aset dapat menampilkan aset, tetapi riwayat perpindahannya kosong atau tidak lengkap.
- Perbaikan pada branch `ai/codex/movement-scope-consistency` menghapus filter duplikat. Resolver kanonis tetap bertanggung jawab menggabungkan aset personal dan seluruh scope eksplisit.
- Regression contract memeriksa bahwa endpoint menggunakan hasil resolver tanpa klasifikasi ulang berdasarkan label role primer.
- CI exact head belum dijalankan; perubahan belum dinyatakan lulus build atau UAT.

## 1. Keputusan bisnis yang menjadi acuan

GABAH adalah aplikasi internal perusahaan untuk HO dan seluruh cabang/lokasi operasional. Lokasi Supply Chain dan PIBC bukan role aplikasi dan bukan otomatis pemilik aset.

Setiap pengguna harus memiliki atribut yang terpisah:
- identitas akun;
- role aplikasi (satu atau lebih paket fungsi);
- permission tindakan: read, create, update, delete, approve, assign, administer;
- data scope: own, unit, lokasi, domain pemilik aset, atau global;
- jabatan/level (Direksi, Kadiv, Kadep, Kasi, Staf);
- unit organisasi/departemen;
- lokasi kerja/kantor.

Jabatan, unit, dan lokasi tidak boleh otomatis memberikan permission. Super Admin mengelola master, role, permission, assignment, dan scope. Struktur dapat berkembang tanpa menambah role baru hanya karena ada cabang baru.

### Kebijakan aset yang tidak boleh berubah

| Pengguna | Read | Mutasi |
|---|---|---|
| Super Admin | Semua aset, semua lokasi | Semua tindakan administratif yang diizinkan |
| IT | Semua aset owner IT, semua lokasi | Aset owner IT |
| GA | Semua aset owner GA, semua lokasi | Aset owner GA |
| GA terhadap aset IT | Hanya Laptop dan PC/Desktop, jika permission baca khusus diaktifkan | Tidak boleh |
| Pegawai biasa | Aset yang ditugaskan kepadanya; katalog pinjaman hanya sesuai kebijakan | Tidak mendapat hak kelola aset hanya karena jabatan/lokasi |
| Auditor | Semua data sesuai mandat audit | Read-only |

Supply Chain dan PIBC adalah atribut lokasi kerja/unit organisasi. Lokasi aset tidak menentukan owner_division atau siapa yang boleh memutasi aset.

## 2. Temuan source code terverifikasi

### P0 — Otorisasi backend dan kebocoran scope

1. `server/services.ts`, `GabahDomainService.getScopedAssets()`:
   - IT masih mendapat aset owner IT **dan GA**.
   - GA melihat aset GA dan sebagian workstation IT, tetapi akses workstation belum dikendalikan oleh permission khusus Super Admin.
   - Role Supply Chain dan PIBC masih mendapat aset karena `owner_division === SC/PIBC` atau kecocokan teks lokasi/departemen. Ini mencampur lokasi dengan kepemilikan dan scope.
   - Humas mendapat daftar aset kosong, bertentangan dengan fungsi dasar pegawai untuk melihat aset yang ditugaskan.
   - Karyawan/Sekretaris Direksi melihat seluruh aset loanable tanpa pembuktian bahwa katalog tersebut memang boleh terlihat untuk semua pengguna.
2. `server/runtime-hardening.ts` memiliki resolver aset kedua yang tidak konsisten:
   - IT juga melihat owner GA.
   - GA melihat workstation IT tanpa permission toggle.
   - Supply Chain/PIBC memperoleh akses berdasarkan owner SC/PIBC dan teks lokasi.
   - Guard detail aset ini dapat menghasilkan keputusan berbeda dari `getScopedAssets()`; policy harus dipusatkan agar list dan direct-ID tidak berbeda.
3. Dashboard/API agregat harus diperiksa agar tidak menghitung raw seluruh pinjaman, tiket, reservasi, dan aset sebelum scope diterapkan.
4. `GET /api/loans`, tickets, reservations, notifications, reconciliation, audit logs, serta endpoint mutasi perlu audit per endpoint. Filter frontend tidak dianggap sebagai kontrol keamanan.

### P1 — Model role dan navigasi

1. `src/navigation/roleNavigation.ts` memakai daftar menu statis berdasarkan sembilan nama role. Ini membuat role, fungsi, dan menu terikat kaku.
2. `src/components/modals/AdministrationModal.tsx` masih memiliki `SYSTEM_ROLES`, `DEFAULT_PERMISSIONS`, dan `PERMISSION_TEMPLATE_FIELDS` statis. Matriks tersebut memuat konsep lama seperti Divisi SC/PIBC sebagai pemilik aset.
3. `server/migrations/010_dynamic_rbac_foundation.sql` sudah membuat tabel role, permission, role-permission, scope, dan user-role. Namun komentar migrasi secara eksplisit menyatakan `users.role` tetap authoritative sampai tahap migrasi berikutnya.
4. `server/rbac-policy.ts` memuat permission dan scope dari PostgreSQL, tetapi kebijakan legacy masih dipertahankan di banyak tempat. Role custom tanpa policy/scope harus tetap deny-by-default.
5. `server/migrations/006_org_model_masters.sql` sudah memisahkan jabatan, unit, dan lokasi, tetapi seed `org_units` masih memasukkan Supply Chain dan PIBC sebagai unit dengan `division_code` SC/PIBC. Ini perlu dipetakan ulang sebagai struktur organisasi/lokasi tanpa otomatis menjadi domain kepemilikan aset.
6. `PRD.md`, `docs/product/REQUIREMENTS.md`, `PROJECT-RULES.md`, komentar source, dan UAT masih mengandung aturan lama yang menyebut SC/PIBC sebagai owner aset. Dokumen ini harus diselaraskan setelah inventaris data dan aturan migrasi dipastikan.

## 3. Prinsip target arsitektur

- Satu policy resolver backend menjadi sumber keputusan akses. Resolver yang sama digunakan oleh list, detail, dashboard, export, pencarian, dan aksi.
- Permission tindakan dipisahkan dari scope data. Contoh: GA dapat memiliki `assets.read` pada scope GA dan permission baca terbatas IT workstation, tetapi tidak memiliki `assets.update` untuk aset IT.
- Scope `location` hanya menyaring lokasi fisik/penempatan yang memang menjadi batas kerja; tidak pernah menyimpulkan ownership.
- Scope `unit` memakai relasi unit organisasi yang valid; nama teks bebas tidak boleh dipakai sebagai otorisasi.
- Super Admin global ditentukan oleh capability stabil `is_superadmin`, bukan semata-mata nama tampilan role.
- Role adalah template fungsi yang dapat dikelola. Penambahan cabang/lokasi tidak memerlukan role baru.
- Frontend menyusun navigasi dari permission efektif pengguna, tetapi setiap endpoint tetap memeriksa permission dan scope di backend.
- Migrasi data owner SC/PIBC tidak boleh dilakukan massal berdasarkan lokasi. Setiap aset perlu klasifikasi owner yang dapat dipertanggungjawabkan; data ambigu masuk antrean review Super Admin.

## 4. Urutan pengerjaan dan acceptance criteria

### Tahap A — Inventarisasi
- Petakan semua route API, permission gate, scope resolver, domain mutation, dashboard counter, search, export, dan menu.
- Identifikasi semua pemeriksaan langsung `actor.role`, `actor.division`, `owner_division`, `location`, dan pencocokan teks.
- Petakan nilai owner SC/PIBC pada data existing dan klasifikasi aset terkait tanpa mengubah data.

### Tahap B — Backend policy tunggal
- Super Admin dapat melihat dan mengelola semua aset.
- IT hanya melihat/mengelola owner IT.
- GA hanya melihat/mengelola owner GA; akses IT Laptop/PC adalah permission baca terpisah yang dapat diaktifkan/nonaktifkan Super Admin.
- GA tidak dapat memutasi aset IT meskipun aset terlihat.
- Lokasi Supply Chain/PIBC tidak memberi hak kelola aset.
- Pegawai termasuk Sekretaris Direksi dan Humas memiliki akses dasar personal yang sesuai, bukan akses aset global.
- Auditor tetap read-only.
- List endpoint dan direct-ID endpoint menghasilkan keputusan yang sama.

### Tahap C — Role dan navigasi berbasis permission
- Tidak ada role aplikasi yang dibuat hanya karena lokasi/cabang.
- Role template dapat ditambah/nonaktifkan dan permission/scope dapat diatur Super Admin.
- Menu dan aksi ditampilkan dari permission efektif; route guard frontend bukan pengganti backend.
- Pengguna tanpa permission tidak melihat menu, tidak dapat membuka route, dan mendapat 403 dari API.

### Tahap D — Konsistensi semua domain
- Scope pinjaman, tiket, reservasi, maintenance, kontrak, vendor, knowledge, notifikasi, laporan, pencarian, dashboard, dan export konsisten.
- Data agregat tidak menghitung data di luar scope.
- Aksi approve/assign/update/delete memeriksa permission tindakan dan scope objek, bukan hanya nama role.

### Tahap E — Migrasi dan UAT
- Tidak menghapus role/user lama sebelum pemetaan dan verifikasi.
- Data owner SC/PIBC yang ambigu ditandai untuk review; tidak diubah hanya berdasarkan lokasi.
- Uji backend untuk setiap kombinasi role-permission-scope, termasuk akses list dan detail, direct API, mutasi, export, dashboard, dan regresi.
- PR tidak boleh di-merge sebelum CI dan UAT role kritis lulus.

## 5. Test matrix minimum

1. Super Admin: seluruh owner dan lokasi terlihat; dapat melakukan administrasi aset.
2. IT: owner IT terlihat di HO, Supply Chain, PIBC, dan lokasi lain; owner GA tidak terlihat/terkelola.
3. GA: owner GA terlihat lintas lokasi; owner IT selain Laptop/PC tidak terlihat.
4. GA dengan toggle IT workstation ON: hanya Laptop/PC IT terlihat; semua operasi mutasi atas aset itu ditolak.
5. GA dengan toggle OFF: tidak ada aset IT yang terlihat.
6. Pegawai Supply Chain/PIBC: lokasi kerja tersimpan sebagai atribut; lokasi tidak memberi akses owner atau mutasi aset.
7. Humas/Sekretaris Direksi/Karyawan: aset yang ditugaskan sendiri dan fungsi dasar sesuai permission; tidak mendapat katalog aset global.
8. Auditor: read lintas data sesuai mandat; seluruh mutasi ditolak.
9. Custom role: tanpa permission/scope tidak mendapat akses; grant eksplisit berlaku hanya pada modul dan scope yang ditetapkan.
10. Semua kasus di atas diuji untuk endpoint list, detail ID, dashboard, search, export, dan aksi mutasi.

## 6. Batasan perubahan aman

- Jangan mengubah `owner_division`, nomor aset, nomor ERP, atau histori hanya berdasarkan nama lokasi.
- Jangan menghapus role Supply Chain/PIBC atau akun existing sebelum mapping user ke jabatan/unit/lokasi dan role aplikasi tervalidasi.
- Jangan menganggap seluruh aset owner SC/PIBC otomatis milik GA atau IT. Klasifikasi per aset harus direview.
- Jangan mengaktifkan akses baca lintas divisi melalui frontend saja.
- PR #18 tetap draft sampai tahap backend, UI, migrasi, CI, dan UAT lulus.


## 6. Progress implementation — 8 November 2026

### Perubahan yang sudah masuk branch (belum dianggap production/UAT selesai)

1. **Supply Chain/PIBC sebagai lokasi kerja:** migration 026 memetakan akun legacy dengan role Supply Chain/PIBC menjadi Karyawan, mengisi office_location_id (Supply Chain → OFF-RPC, PIBC → OFF-PIBC bila belum terisi), membersihkan unit legacy UNIT-SC/UNIT-PIBC dari penempatan aktif, dan menonaktifkan role/unit legacy tanpa menghapus record historis. Seed akun dev juga memakai Karyawan + office_location_id. Nilai division lama dipertahankan untuk kompatibilitas notifikasi, bukan untuk otorisasi aset.
2. **Aset:** Super Admin tetap global; IT hanya owner IT; GA owner GA dan opsional read-only Laptop/PC IT via permission assets.read.it_workstations. Aset owner SC/PIBC historis tidak dimigrasikan; mutasi hanya Super Admin sampai review per aset. Pembuatan aset baru dibatasi ke owner IT/GA.
3. **Pegawai dan role tambahan:** resolver aset PostgreSQL menggabungkan baseline personal pegawai dengan dynamic role scopes yang ditetapkan eksplisit. Dynamic scope non-Super Admin dibatasi ke owner IT/GA; aset legacy owner SC/PIBC tidak masuk inventaris dinamis. Karyawan dapat memperoleh role fungsi tambahan tanpa mengganti atribut lokasi/jabatan.
4. **Data turunan aset:** riwayat mutasi dan jadwal maintenance mengikuti asset scope. Pegawai biasa hanya melihat maintenance/movement aset yang ditugaskan kepadanya; IT/GA mengikuti owner masing-masing; Auditor/Super Admin dapat membaca lintas scope.
5. **Peminjaman:** approve/reject/handover/return oleh pengelola dibatasi owner IT/GA dengan permission dan scope; peminjam tetap dapat mengembalikan pinjaman miliknya sendiri. Pinjaman owner legacy SC/PIBC menjadi Super Admin review-only.
6. **Vendor:** read/create/update mengikuti permission dan owner scope IT/GA, bukan nama lokasi/cabang. Super Admin/Auditor sesuai mandat dapat membaca lintas domain.
7. **Navigasi:** permission assets.catalog.read dipisah dari assets.read untuk Aset Saya; menu inventaris penuh tidak muncul hanya karena pegawai memiliki akses personal. Super Admin capability mengirim wildcard menu permission agar semua menu administrasi tampil.
8. **Data seed:** relasi maintenance IT/GA yang sebelumnya menunjuk ID aset yang tidak ada sudah disejajarkan dengan asset ID kanonikal. Jadwal timbang legacy tetap tidak terhubung ke aset aktif dan tidak dibuka untuk pengguna non-Super Admin.
9. **Scope per modul:** migration 029 menambahkan kolom module pada role scopes. IT/GA seed scopes dipisah untuk assets, loans, tickets, vendors, dan contracts. Role manager kini mengatur scope per modul; scope satu modul tidak otomatis berlaku pada modul lain.
10. **Role primer/tambahan:** migration 030 menandai satu role primer per user. Pembuatan/perubahan user dan bulk import menyinkronkan role primer, sementara role tambahan tetap dipertahankan. Backfill startup hanya mengganti role primer yang usang, bukan menghapus role tambahan.
11. **Frontend dashboard:** dashboard dan workspace memakai koleksi API yang sudah di-scope backend. Filter role-name lama yang dapat menyembunyikan data role tambahan telah dilepas; helper lama juga tidak lagi memberikan scope aset/pinjaman/maintenance berdasarkan label Supply Chain/PIBC.

### Batasan yang masih harus dituntaskan

- Migration 026 dan 027 **belum dijalankan pada database produksi**. Perlu backup, dry-run, pemeriksaan jumlah akun yang akan berubah, verifikasi office_location_id, lalu persetujuan sebelum eksekusi.
- Owner SC/PIBC pada aset/kontrak/pinjaman historis tidak diubah. Super Admin perlu review satu per satu dan menetapkan owner IT atau GA berdasarkan bukti kepemilikan/pengelolaan.
- Endpoint lain masih harus diaudit secara sistematis: users/master data, taxonomy, dashboard aggregates, search, export, license, contract document/milestone/renewal, room actions, notification delivery, audit/reconciliation, dan semua direct-ID paths.
- Model role multi-assignment perlu UAT: Karyawan + role fungsi tambahan, jabatan (Direksi/Kadiv/Kadep/Kasi/Staf), unit organisasi, dan lokasi kerja harus tetap terpisah.
- Workflow permintaan dokumentasi Humas yang terhubung agenda/reservasi masih berupa keputusan PRD; antrean Humas, PIC, status, assignment, dan audit trail belum selesai dibangun.
- Semua kombinasi role/permission/scope harus diuji melalui akun nyata di UI dan API. CI hijau saja tidak cukup untuk menyatakan GABAH siap produksi.


## Temuan lanjutan — dashboard attention scope (8 November 2026)

### P1 — Kebocoran detail lintas scope pada attention center

- Endpoint `GET /api/dashboard/attention` sebelumnya mengirim seluruh hasil `GabahDomainService.getAttentionCenter()` kepada setiap user yang memiliki `dashboard.read`.
- Query sumber membentuk kartu SLA tiket, pinjaman menunggu persetujuan/jatuh tempo, dan aset dengan garansi mendekati akhir tanpa menerapkan scope record pengguna.
- Risiko: pengguna dapat membaca judul/deskripsi tiket, nama peminjam, tujuan pinjaman, nomor aset, dan detail operasional di luar scope modulnya meskipun daftar utama sudah dibatasi.

### Perbaikan yang diajukan pada PR follow-up #19

- Tiket: reporter, assigned agent, atau owner scope eksplisit modul `tickets`.
- Pinjaman: borrower sendiri atau owner scope eksplisit modul `loans`.
- Aset: hanya ID yang lolos resolver server `getScopedAssets()`.
- Super Admin dan Auditor mempertahankan akses baca global sesuai mandat.
- Record yang hilang dan tipe tautan yang tidak dikenal ditolak secara default.
- Regression test khusus ditambahkan ke CI.

Status: implementasi berada di PR #19 dan belum dianggap selesai sampai verifikasi CI serta review. Temuan ini tidak mengubah status keseluruhan PR #18 yang tetap NO-GO sampai UAT dan release gates lain terpenuhi.


## 5. Temuan lanjutan — resolver aset ganda pada direct-ID middleware (8 November 2026)

### Temuan
Middleware `server/runtime-hardening.ts` sebelumnya memiliki implementasi `canSeeAsset()` tersendiri. Implementasi tersebut tidak identik dengan `GabahDomainService.getScopedAssets()`: role GA dan IT dapat menerima scope owner tambahan melalui role tambahan di katalog, tetapi direct-ID guard masih menerapkan cabang role primer GA/IT dan menolak sebagian akses tersebut. Akibatnya, aset dapat tampil pada katalog namun gagal dibuka melalui detail/direct URL/API. Ini melanggar acceptance criterion bahwa list dan direct-ID harus memakai keputusan scope yang sama.

### Perbaikan
- Middleware direct-ID sekarang memanggil `GabahDomainService.getScopedAssets(actor)` sebagai resolver kanonis.
- Menghapus resolver visibility GA/IT/custom-role kedua dari middleware.
- Regression contract diperbarui agar mengunci penggunaan resolver kanonis.
- Permission mutasi tetap diperiksa terpisah oleh route/domain service; visibilitas tidak otomatis memberi hak update/assign/move.

### Status verifikasi
Perubahan sudah diajukan pada branch `ai/codex/unify-asset-scope-guard`. CI belum dijalankan pada exact head; jangan menganggap pemeriksaan lulus sebelum workflow CI selesai.


## 6. Temuan — privasi antrean dokumentasi reservasi Humas (8 November 2026)

### Temuan
Endpoint `GET /api/room-reservations` sudah membatasi Humas ke reservasi dengan `documentation_requested`, tetapi mengembalikan objek reservasi secara utuh. Antrean dokumentasi tidak memerlukan nomor telepon penyelenggara, daftar peserta, kebutuhan/fasilitas IT, rincian konsumsi, catatan internal, alasan penolakan, atau alasan interupsi. Pengiriman seluruh objek merupakan paparan data berlebih (excessive data exposure).

### Perbaikan
- Humas tetap melihat reservasi yang meminta dokumentasi saja.
- Respons non-milik Humas mempertahankan jadwal/ruangan dan brief dokumentasi (`documentation_type`, `documentation_notes`), tetapi meredaksi kontak, daftar peserta, fasilitas, konsumsi, dan catatan operasional/internal.
- Reservasi milik Humas sendiri tetap dapat dilihat penuh.
- Regression test API ditambahkan ke skenario meeting-room Stage 3.

### Status verifikasi
Perubahan diajukan pada branch `ai/codex/room-documentation-privacy`; CI exact head belum berjalan. Tidak ada perubahan data atau migrasi produksi.

## 7. Temuan — integritas keputusan renewal kontrak (8 November 2026)

### Temuan
Endpoint keputusan renewal menerima nilai `outcome` dari request dan menyimpan `replacement_contract_id` tanpa validasi relasi yang memadai. TypeScript type tidak melindungi request HTTP saat runtime. ID pengganti yang tidak ada, menunjuk kontrak itu sendiri, atau menunjuk kontrak owner division lain dapat tersimpan sebagai relasi yang tidak valid dan berpotensi melintasi batas data antar-divisi.

### Perbaikan
- Validasi runtime terhadap seluruh nilai `RenewalOutcome` yang didukung.
- Keputusan `replaced_by_new_contract` wajib menunjuk kontrak pengganti yang benar-benar ada.
- Kontrak pengganti harus dapat dilihat oleh aktor, bukan kontrak yang sama, dan memiliki owner division ternormalisasi yang sama.
- ID pengganti ditolak untuk outcome lain.
- Regression contract ditambahkan ke CI.

### Status verifikasi
Perubahan diajukan pada branch `ai/codex/contract-renewal-integrity`; CI exact head belum berjalan. Tidak ada migrasi atau perubahan data produksi.

## 8. Temuan — filter ganda Dashboard Attention tidak konsisten untuk loan owner scope (8 November 2026)

### Temuan
Endpoint dashboard sudah memfilter kartu pinjaman dengan borrower sendiri atau scope owner modul `loans`. Namun response middleware `scopedAttention()` menjalankan filter kedua yang hanya mengizinkan owner division berdasarkan label role primer IT/GA atau borrower sendiri. Pengguna dengan custom/additional role dan explicit owner scope yang valid dapat kehilangan kartu yang sebenarnya berhak dilihat. Ini adalah false denial akibat dua policy resolver yang berbeda.

### Perbaikan
- Borrower tetap dapat melihat kartu pinjamannya sendiri.
- Pada PostgreSQL, kartu pinjaman milik divisi lain mengikuti `hasRbacScope(user, 'division', owner, 'loans')`.
- Fallback label IT/GA hanya dipertahankan untuk file-store legacy.
- Regression check middleware ditambahkan ke CI.

### Status verifikasi
Perubahan diajukan pada branch `ai/codex/dashboard-loan-scope-consistency`; CI exact head belum berjalan.


## Pembaruan audit — 18 November 2026: legacy SC/PIBC masih tertanam di domain

Pemeriksaan ulang source pada head PR #120 menemukan bahwa keputusan organisasi di atas belum sepenuhnya tercermin dalam implementasi:

- `server/migrations/006_org_model_masters.sql` masih men-seed `UNIT-SC` dengan `division_code='SC'` dan `UNIT-PIBC` dengan `division_code='PIBC'`.
- `server/db.ts` masih memuat dua unit tersebut dan tipe `OrgUnit.division_code` masih mencakup `SC | PIBC`.
- `server/managing-unit.ts` masih memiliki aturan backfill owner-domain SC → UNIT-SC dan PIBC → UNIT-PIBC.
- `src/types.ts` masih mendefinisikan `TicketCategory = IT | GA | SC | PIBC`; `CreateTicketModal.tsx` menampilkan Supply Chain dan PIBC sebagai pilihan Departemen Penanganan dan otomatis memilih kategori itu dari `asset.owner_division`.
- `server.ts` masih memiliki alias login berbasis role Supply Chain/PIBC pada jalur file-store non-PostgreSQL. Jalur ini harus tetap terbatas pada kompatibilitas development dan tidak boleh menjadi sumber identitas/otorisasi production.

Ini bukan bukti bahwa semua data SC/PIBC harus langsung dihapus atau dipindahkan. Nilai lama mungkin masih dipakai oleh aset, kontrak, notifikasi, dan histori. Migrasi massal berdasarkan lokasi dilarang. Namun, **target organisasi belum tercapai**: unit/lokasi SC dan PIBC masih beririsan dengan kode divisi/owner domain di seed, tipe, dan routing tiket.

### Tindakan wajib sebelum release

1. Inventarisasi seluruh pemakaian kode SC/PIBC pada user, org_units, asset owner, managing_unit, kategori tiket, kontrak, notifikasi, numbering, laporan, dan audit.
2. Tetapkan secara eksplisit domain pemilik/penangan operasional yang sah. Lokasi RPC/SC dan PIBC tidak otomatis menjadi domain otorisasi.
3. Buat migration additive dan idempotent yang memisahkan atribut unit/lokasi dari owner-domain; pertahankan histori dan tandai data ambigu untuk review Super Admin.
4. Perbarui resolver, validasi API, UI, dashboard, notification routing, search/export, serta laporan secara konsisten.
5. Uji fresh database dan upgrade database berisi data legacy, termasuk list/detail/mutasi dan negative cross-scope tests.

**Status: RELEASE BLOCKER.** Jangan menonaktifkan atau menghapus kode SC/PIBC sebelum mapping aset/transaksi historis disetujui. Jangan mengklaim model organisasi sudah sepenuhnya dinamis hanya berdasarkan CI hijau.


## Update 18 November 2026 — ticket routing branch

PR #121 (`fix/ticket-routing-me-unit-scope`) implements a first selective correction for the ticket-domain conflation recorded above. It introduces a separate ME operational unit at PIBC, exact ticket-module scope enforcement, explicit GA/ME requester and operator roles, scoped dispatch endpoints, and unit-aware dashboard filtering. Legacy SC/PIBC ticket categories and asset owners are retained without automatic migration.

This does **not** resolve every SC/PIBC legacy asset/contract ownership record. It only prevents those labels/locations from becoming new ticket categories or implicit ticket queue grants. Full asset/contract classification remains a separate review. CI #2197 passed 67/67 steps, including PostgreSQL 17 fresh database/persistence, Docker runtime, P0 security, and ticket-routing regressions. Upgrade rehearsal against a copy of legacy data and browser UAT/sign-off remain open; do not mark the audit or release gate complete yet.


## Follow-up source scan — remaining SC/PIBC asset, dashboard, and contract references (18 November 2026)

A second source scan on the consolidated PR #121 branch found the following remaining references. These are not all authorization bypasses; several are legacy-data display or file-store compatibility. They must nevertheless be reconciled before claiming the organization model is complete.

| Source | Remaining behavior | Risk / required follow-up |
|---|---|---|
| `src/components/modals/CreateAssetModal.tsx` | Category visibility is still filtered by primary role labels IT/GA/Supply Chain/PIBC. Unknown/non-IT/non-GA roles fall through to the full static taxonomy. | UI does not yet reflect effective owner-domain create permission/scope. Server-side create guard remains authoritative, but the form can expose invalid options or hide valid custom-role options. Replace with server-calculated allowed owner domains and filter subcategories by taxonomy owner. |
| `server/taxonomy.ts` | Initial taxonomy still contains SC/PIBC owner-domain seeds and legacy categories such as KDR-SC/MSN/MSN-PIBC. | Do not mass-reassign these rows. Mark legacy owner values as review-required and prevent new use until an approved owner-domain map exists. |
| `server/db.ts` | Seed/sample assets still contain owner_division SC/PIBC; `UNIT-SC` and `UNIT-PIBC` still have `division_code=SC/PIBC`. | Historical examples and managing-unit mappings still conflate legacy owner values with organizational units. Needs additive data classification and explicit mapping, not location-based rewrite. |
| `src/components/views/AssetsView.tsx` | Asset filter still labels SC/PIBC owner values as division filters. | Rename as legacy owner classification / review queue; it must not imply these are current application divisions. |
| `src/components/views/DashboardView.tsx` | Dashboard still calculates SC/PIBC owner counts; permission fallback includes old profile labels for file-store mode. | Production permission path is dynamic, but labels and aggregates need to distinguish legacy owner data from current organization. |
| `src/components/views/ContractsView.tsx` | File-store fallback arrays still include Supply Chain/PIBC for contract actions. | PostgreSQL permission checks remain authoritative; remove legacy profile fallback and test file-store deny-by-default. |
| `src/components/modals/CreateLoanModal.tsx` | Loan pool summary still counts SC-owned legacy assets. | Preserve historical loanable assets, but label as legacy owner classification; do not derive loan authorization from this count. |

### Follow-up priority

1. Add a server endpoint that returns effective asset-create owner domains for the authenticated user; make CreateAssetModal consume that result instead of primary role labels.
2. Create a Superadmin review queue for assets with owner values SC/PIBC and unresolved managing-unit mapping. Do not mutate owner/history until each record is classified.
3. Relabel SC/PIBC dashboard and asset filters as legacy owner values, not divisions.
4. Remove file-store contract permission fallback for Supply Chain/PIBC and add negative tests.
5. Only after asset and contract ownership mapping is approved, add an additive migration to move records into canonical owner domains and preserve audit history.

**Status: OPEN.** PR #121 resolves ticket category/queue routing only. It does not yet complete asset taxonomy, asset create UI, contract ownership, or historical data classification.


### CI refresh — 18 November 2026

- Exact head: `d1f9fd93b1a5f5864270a813d35d28717b406010`.
- GitHub Actions run #2204: 67/67 steps passed, including `npm run lint`, production build, Docker runtime smoke, PostgreSQL 17 fresh-database/persistence (migration 098 is present in the migration ledger), P0 live HTTP security, ticket reporter ownership (22/22), ticket routing/unit-scope contract (37/37), and related-asset scope regression.
- This refresh does not change the remaining release blockers: upgrade rehearsal against a copied legacy database and browser UAT/sign-off per persona remain BLOCKED/not yet evidenced.


### Additional routing hardening — 18 November 2026

Source review found two operational edge cases and added regression coverage:

- When there is not exactly one eligible IT assignee, queue notifications are now sent only to active IT-scope users who also have `notifications.read`; ticket-read permission alone is insufficient to receive notification records.
- New ME requests now fail closed with HTTP 409 if the configured `UNIT-PIBC-ME` operational unit is inactive or missing.
- The ticket-routing contract suite now verifies both rules; CI #2204 passed 37/37 checks.


### CI refresh after rehearsal procedure + Compose isolation — 18 November 2026

- Exact head: `900a0a36e04385cb3aad8ab5d3f127e25522c2dd`.
- GitHub Actions CI run #2211 (run ID `44294634254`): **67/67 steps passed**. The new first-step Compose validation checks both the normal stack and the isolated rehearsal override.
- The rehearsal override uses a separate Compose project name, project-scoped volumes/networks, unique host ports, and removes fixed container names so the copy can coexist with the normal GABAH stack.
- The rehearsal procedure is documented at `docs/ops/LEGACY-DATABASE-UPGRADE-REHEARSAL.md`; it remains **NOT EXECUTED** until an operator supplies a verified pre-098 backup and captures pre/post row-identity evidence.
- CI success proves configuration validation and the fresh-database migration path; it does **not** prove upgrade safety against a legacy database. Browser UAT, backup/restore rehearsal, and business-owner sign-off remain release blockers.

## 18 November 2026 — follow-up hardening on release candidate

### Asset creation owner-domain options
- Added `GET /api/assets/creation-categories`, which requires `assets.create` and filters active category master rows by the actor's effective `assets` owner-domain scope. License categories additionally require `licenses.manage`.
- `CreateAssetModal` no longer derives create authority from primary role labels such as IT, GA, Supply Chain, or PIBC. The selected category's configured `owner_division` is authoritative; non-Superadmin users cannot override it in the browser.
- Owner-domain options are derived from the authorized category master rather than a fixed IT/GA/SC/PIBC dropdown. Empty or failed responses fail closed and do not fall back to static role-based category choices.
- Added CI contract coverage in `scripts/asset-creation-scope-verify.mjs`.

### Durable persistence and rollback
- Asset PATCH now awaits persistence before success and restores the asset plus audit entry if the write fails.
- Maintenance create/update now await persistence and roll back the schedule and audit entry on failure.
- Vendor create/update and Knowledge Base create/update/vote/view now await persistence; failed writes restore the in-memory record/counter and remove the associated audit event where applicable.
- Self-service password change now persists the new password hash before revoking sessions. On persistence failure, the prior credentials remain in force and sessions are not revoked.
- The legacy post-response persistence safety net now catches and logs rejected writes rather than producing an unhandled promise rejection. It remains a compatibility fallback, not proof that a route's own write is durable.
- Added source regression coverage in `scripts/domain-persistence-verify.mjs`, and extended asset/maintenance regression checks.

### Verification status
- These changes are committed to the PR #121 head. A fresh exact-head CI run is required; no pass is claimed yet.
- Browser UAT, legacy database upgrade rehearsal, backup/restore rehearsal, and real-user role assignment remain separate release gates.

### SC/PIBC location-vs-owner separation
- Removed Supply Chain and PIBC legacy labels from fallback role navigation and dashboard legacy permission grants. They no longer receive application access merely because a user profile contains one of those old labels.
- New asset-category creation and new asset creation reject SC/PIBC/Supply Chain as owner-domain values. Existing historical categories/assets are retained; the change does not mass-reclassify records.
- Administration user, category, unit, and numbering forms now source active owner choices from the owner-domain master while excluding legacy SC/PIBC values. Existing legacy user/category values remain visible as explicitly marked review options so records can be corrected deliberately.
- Asset and contract screens expose historical SC/PIBC records only through an “Owner lama (perlu review)” filter/label, not as active divisions. Dashboard summary groups them into one legacy-review count.
- `ASSET_OWNER_DIVISIONS` now seeds only IT and GA; taxonomy aliases remain available for historical data compatibility.
- Added `scripts/legacy-owner-presentation-verify.mjs` to CI.

### Exact-head CI
- A fresh CI run is in progress for the latest PR #121 head. Earlier failures exposed and were corrected: malformed static-test regex, owner guard placed before owner resolution, outdated Knowledge Base async-route expectation, and the AdministrationModal memo-hook namespace.
- No CI pass is claimed until the latest exact-head run completes successfully.

### Durable domain-service writes
- Added an awaited persistence/rollback helper to `GabahDomainService`.
- Asset create, assign/unassign, move, and lifecycle mutations now commit before success; failed writes restore asset state, movement history, and audit entries.
- Room reservation create/approve/reject/check-in/check-out/cancel and meeting-room master updates now commit before success; failed writes restore reservation/room state, notifications, and audit entries.
- Meeting type and meeting facility create/update/delete now use the same durable-write contract.
- Service audit events for these operations are included in the same awaited commit; the guarded audit fallback remains only for older handlers that have not yet been migrated.
- Corresponding Express handlers now await the asynchronous service methods.
- Added `scripts/domain-service-persistence-verify.mjs`; the existing asset assignment fixture was updated to await asynchronous service results.

### Loan and helpdesk transaction durability
- Loan request, approval, rejection, physical handover, and return now await durable persistence. A failed write restores loan state, linked asset state, notifications, and audit entries.
- Bulk loan requests retain one atomic persistence boundary: each candidate is validated without an intermediate commit; the batch commits once, and a failed batch restores the complete pre-request snapshot.
- Ticket creation now awaits persistence and rolls back the new ticket, notifications, and audit trail if the write fails.
- Express routes await these asynchronous domain services; duplicate post-service persistence calls were removed from the single-item paths.
- Expanded `scripts/domain-service-persistence-verify.mjs` to cover asset, loan, ticket, room reservation, meeting room, meeting type, and facility service/route contracts.

### Remaining direct mutation handlers
- Login now awaits audit/credential persistence before issuing a session; failed persistence destroys the newly created session and restores any legacy temporary-password migration.
- Individual and bulk notification-read mutations now await persistence and restore prior read state on failure.
- Accurate reconciliation linking now awaits persistence and rolls back the asset reference and audit entry if the write fails.
- Remaining mutating routes without a local snapshot commit are PostgreSQL transaction-backed RBAC/module registry handlers; taxonomy resolve is a read-only POST.
