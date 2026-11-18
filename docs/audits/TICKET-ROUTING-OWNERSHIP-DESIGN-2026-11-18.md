# GABAH Ticket Routing & Ownership Design

Tanggal: 18 November 2026  
Basis pemeriksaan: branch `fix/ticket-status-reporter-scope-guard`, head sebelum dokumen ini  
Status: desain teknis untuk menghilangkan pencampuran lokasi, owner aset, dan antrean penanganan. Belum merupakan migrasi data atau perubahan runtime.

## 1. Temuan source yang terverifikasi

1. `src/types.ts` mendefinisikan `TicketCategory = 'IT' | 'GA' | 'SC' | 'PIBC'` dan komentarnya menyebut kategori bersifat divisional.
2. `CreateTicketModal.tsx` masih menampilkan SC dan PIBC sebagai Departemen Penanganan. Saat aset terkait memiliki `owner_division=SC/PIBC`, kategori tiket otomatis mengikuti kode tersebut.
3. Prefill dari kontrak juga mengubah `contract.owner_division` langsung menjadi kategori tiket SC/PIBC.
4. `GabahDomainService.createTicket()` menerima empat kategori tetap IT/GA/SC/PIBC, menyimpan kategori sebagai kategori tiket, lalu mengirim notifikasi dengan `recipient_role` dan `recipient_division` yang sama dengan kategori.
5. `GET /api/tickets`, detail tiket, `canSeeTicket()`, dan `canManageTicket()` menggunakan kategori sebagai nilai scope `division`. Jalur file-store juga masih memiliki fallback `actor.role === category`.
6. Dengan demikian, kategori tiket saat ini sekaligus dipakai sebagai label UI, target notifikasi, dan kunci otorisasi. Mengganti pilihan UI saja tidak cukup dan berisiko menghilangkan akses ke tiket lama.

## 2. Prinsip yang sudah ditetapkan untuk GABAH

- IT adalah fungsi/owner domain IT lintas semua lokasi; tiket IT diarahkan langsung ke petugas IT Support yang ditetapkan.
- GA mengelola fungsi/aset GA; antrean GA tidak boleh disimpulkan dari lokasi kerja pelapor.
- ME adalah fungsi operasional Mechanical/Electrical/Perawatan di PIBC. ME bukan divisi organisasi baru dan bukan sinonim lokasi PIBC.
- RPC/SC dan PIBC adalah unit/lokasi kerja, bukan role aplikasi atau owner domain otomatis.
- Lokasi pelapor/aset, owner aset, unit pengelola, pelapor, petugas yang ditugaskan, dan antrean penangan harus menjadi dimensi berbeda.
- Permission dan scope PostgreSQL adalah sumber otorisasi. Label jabatan, role lama, nama departemen, atau lokasi tidak boleh memberikan akses.
- Superadmin dapat mengatur role, capability, permission, scope, dan penugasan; tidak boleh ada grant implisit untuk semua pegawai di satu lokasi.

## 3. Rancangan target (tidak mengubah data legacy secara otomatis)

### 3.1 Pisahkan klasifikasi dan routing

Untuk tiket baru, simpan secara terpisah:
- `category`: klasifikasi pekerjaan yang stabil (IT, GA, fasilitas/ME, dan kategori bisnis lain hanya jika disetujui).
- `routing_target_type` + `routing_target_id`: antrean/unit operasional yang menerima pekerjaan; contoh IT Support user/team atau unit ME PIBC.
- `related_asset_id`: aset terkait, bila ada; owner aset tetap di data aset.
- `request_location_id`: lokasi kejadian/permintaan; bukan otorisasi.
- `reporter_id` dan `assigned_agent_id`: identitas pemohon dan petugas aktual.

Jangan gunakan `category` sebagai `division` scope bila targetnya adalah unit ME. Untuk ME, gunakan scope unit operasional yang eksplisit, misalnya `unit:UNIT-PIBC-ME`, setelah master unit tersebut disahkan dan diaktifkan.

### 3.2 Authorization

- Reporter: dapat membaca tiket miliknya; tidak otomatis boleh mengubah status.
- Assigned agent: dapat membaca/menangani tiket yang ditugaskan sesuai permission tindakan.
- IT Support: antrean IT hanya melalui permission dan target penugasan IT yang eksplisit.
- Admin GA: antrean GA hanya melalui permission dan target penugasan GA yang eksplisit.
- Admin ME: antrean ME hanya melalui permission dan scope unit ME PIBC yang eksplisit; lokasi PIBC saja tidak cukup.
- Superadmin: akses global.
- Auditor: read-only sesuai mandat dan scope.
- PostgreSQL production harus deny-by-default; jangan gunakan fallback `actor.role === category` untuk memberi akses.

List, detail ID, update status, assign, attachment, dashboard, search, export, dan notifikasi wajib memakai resolver record-level yang sama.

### 3.3 Notifikasi

Notifikasi antrean harus mengarah ke target operasional yang eksplisit, bukan menganggap `recipient_role` sama dengan kategori. Untuk IT, target awal adalah satu akun IT Support yang ditetapkan admin. Untuk GA dan ME, target berasal dari konfigurasi antrean/assignment yang aktif. Perubahan target harus diaudit.

## 4. Migrasi dan kompatibilitas

- Pertahankan nilai kategori SC/PIBC pada tiket historis sampai ada mapping yang disetujui; jangan mengubahnya massal berdasarkan lokasi.
- Tiket lama dengan kategori SC/PIBC harus masuk antrean review Superadmin atau mapping eksplisit, bukan otomatis dibuka ke seluruh user RPC/PIBC.
- Aset owner SC/PIBC dan kontrak owner SC/PIBC tidak boleh otomatis menjadi tiket ME atau GA.
- Migrasi harus additive/idempotent: tambahkan target routing dan lokasi permintaan; backfill hanya bila relasi yang dapat dibuktikan tersedia; sisanya ditandai unresolved.
- Uji fresh install dan upgrade database dengan data legacy, serta rollback/backup restore.
- UI tidak boleh menampilkan SC/PIBC sebagai departemen penangan baru setelah transisi, tetapi histori tetap dapat dibaca sesuai akses.

## 5. Release tests wajib

1. Pelapor di RPC/SC tidak mendapat antrean semua tiket SC hanya karena office_location.
2. Pelapor di PIBC tidak mendapat antrean semua tiket PIBC hanya karena office_location.
3. IT Support dapat menangani tiket IT lintas HO/RPC/PIBC/Pangsub sesuai permission.
4. GA dapat menangani antrean GA sesuai permission/scope, tanpa akses mutasi ke owner IT.
5. Admin ME di PIBC dapat menangani tiket ME yang ditargetkan ke unit ME; pegawai PIBC lain tanpa scope tidak dapat.
6. Reporter dapat membaca tiketnya tetapi tidak dapat mengubah status kecuali juga assigned/authorized.
7. Assigned agent dapat menangani tiket sesuai permission dan assignment.
8. Direct ID, list, dashboard, search, export, attachment, dan notifikasi menghasilkan scope yang sama.
9. User inactive, role inactive, permission dicabut, scope dicabut, dan unit inactive langsung kehilangan akses.
10. Tiket historis kategori SC/PIBC tetap terjaga; data unresolved tidak bocor dan tidak hilang.

## 6. Keputusan operasional yang sudah tercatat pada rancangan PR #36

Pemeriksaan riwayat PR #36 (`fix/user-menu-location-rbac-audit`, head `2a83eae`) menemukan keputusan Helpdesk yang sebelumnya sudah dirumuskan dan perlu dipakai sebagai acuan desain, bukan mengulang keputusan dari nol:

- Kategori tiket baru: IT, GA, ME. Kategori SC/PIBC hanya dipertahankan untuk histori tiket lama.
- IT: tiket otomatis diarahkan langsung kepada satu petugas IT aktif yang memiliki `tickets.update` dan scope IT. Jika kandidat tidak ada atau lebih dari satu, tiket tetap di antrean IT; jangan memilih acak.
- GA: tiket masuk antrean GA. Dispatcher yang memiliki `tickets.assign` dan scope GA mendelegasikan kepada petugas aktif yang memiliki permission dan scope sesuai. Kasi GA tidak otomatis menjadi operator hanya karena jabatan.
- ME: antrean unit `UNIT-PIBC-ME`. Dispatcher memilih petugas aktif yang berada di unit tersebut dan memiliki `tickets.update` serta scope unit ME.
- Template role Admin Tiket ME tidak otomatis diberikan ke akun; Superadmin menetapkan unit dan permission/scope kepada pegawai yang ditunjuk.
- Permission `tickets.assign` dipisahkan dari `tickets.update`.
- Tiket historis SC/PIBC tetap tersimpan; aset owner SC/PIBC tidak dipindahkan berdasarkan lokasi.

Keputusan tersebut terlihat pada deskripsi PR #36, tetapi branch implementasinya tidak boleh digabung mentah-mentah. Audit sebelumnya sudah menemukan migration 035 pada branch itu menyimpan `UNIT-PIBC-ME` dengan `division_code='PIBC'`, yang kembali mencampur fungsi ME dengan kode divisi/lokasi PIBC; migration 039 juga mengubah permission role GA dan perlu direkonsiliasi dengan matriks role terkini. Perlu port selektif ke head terbaru, migration additive setelah 097, dan regression tests baru.

Satu keputusan operasional yang masih belum tersedia dari catatan sebelumnya: identitas akun aktif yang ditunjuk sebagai petugas IT Support tunggal. Sampai akun itu ditetapkan, tiket IT tetap di antrean IT dan tidak boleh dipilih otomatis secara acak.


## 7. Implementation slice opened on 18 November 2026

Branch: `fix/ticket-routing-me-unit-scope` (stacked on PR #120; not merged).

Implemented in source for CI review:
- Additive migration 098 adds a separate `office_location_id` to operational units, models `UNIT-PIBC-ME` as `division_code='Umum'` at `OFF-PIBC`, and adds unit targets to tickets/notifications.
- Seed opt-in requester roles for GA/ME, a GA helpdesk operator role, and an Admin Tiket ME role with unit scope. Generic GA role no longer receives ticket update/dispatch grants; no operator/requester role is auto-assigned to a user.
- New ticket categories are IT, GA, ME. SC/PIBC remain valid only for historical rows; the create endpoint rejects them.
- IT auto-assignment occurs only for exactly one active user with `tickets.update` and explicit IT ticket scope; otherwise the ticket remains in queue.
- GA and ME dispatch endpoints validate `tickets.assign`, target `tickets.update`, active status, and matching explicit scope. ME targets `UNIT-PIBC-ME`.
- List, direct detail, status guard, and assignee routes share the queue-scope resolver. Reporter visibility does not grant status mutation.
- Notification routing for ticket queues uses explicit authorized user recipients; ME unit-recipient support is also persisted.
- Client form hides SC/PIBC for new requests, exposes IT/GA/ME only when requester capability is present, and blocks linking a new ticket to a legacy SC/PIBC-owned asset pending classification review.
- Added a static regression contract and CI step; UAT scenarios now cover requester, dispatcher, assignee, location-only denial, and legacy-history preservation.

**Not yet verified:** this implementation branch has not completed CI, fresh PostgreSQL migration, upgrade-from-legacy migration, or browser UAT. No merge or production readiness is claimed. Review the migration ordering and normalized persistence before approving.


### Scope boundary for this implementation slice

The current ticket schema does not yet capture a dedicated `request_location_id`. This slice deliberately uses the operational queue target for authorization and does not infer it from the reporter's office location. A later additive change may record the incident/request location as descriptive workflow data, but it must never be an authorization grant. Do not treat this PR as completion of location-based reporting or cross-location analytics.


### Additional authorization hardening

- Ticket queue access now requires an exact `tickets` module scope. A legacy `module='*'` scope from an unrelated module cannot silently grant ticket-queue visibility.
- ME queue access requires both `user.unit_id='UNIT-PIBC-ME'` and the exact `unit:UNIT-PIBC-ME` scope for module `tickets`.
- IT/GA queue staffing is based on explicit `tickets` module scopes and permissions, not `user.division` or job title.
- The generic GA role loses its ticket dispatcher/update grants and its ticket-module owner scope; the separate GA helpdesk operator role must be explicitly assigned.
- In file-store compatibility mode, only IT has the legacy IT queue fallback. GA/ME/SC/PIBC profile labels do not grant queue-wide access; GA/ME requester/dispatcher capabilities require PostgreSQL RBAC.
- Dashboard ticket metrics and attention cards use the same unit-aware queue resolver. Reporter-name fallback is allowed only for legacy rows that lack `reporter_id`.
