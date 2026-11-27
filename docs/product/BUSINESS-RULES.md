# GABAH — Business Rules and Decisions Register

**Dokumen:** `docs/product/BUSINESS-RULES.md`  
**Sistem:** GABAH (*General Asset, Business & Automated Helpdesk*)  
**Organisasi:** PT Food Station Tjipinang Jaya (Perseroda)  
**Status:** Register aturan bisnis dan keputusan pemilik proses. Setiap aturan harus memiliki status persetujuan; kesesuaian implementasi dicatat terpisah dan diverifikasi terhadap kode serta UAT.  
**Terakhir Ditinjau untuk tata kelola dokumen:** 23 November 2026 (isi aturan historis masih memerlukan rekonsiliasi per aturan)  

---

> **Penting:** Dokumen ini tidak otomatis membuktikan bahwa semua aturan di bawah masih disetujui atau sudah diterapkan. Aturan lama harus ditandai APPROVED, IMPLEMENTED, TESTED, DECISION REQUIRED, atau HISTORICAL sesuai bukti. Jangan gunakan matriks lama sebagai izin untuk mengubah perilaku tanpa verifikasi. Pisahkan owner aset, unit pengelola, lokasi fisik, jabatan, application role, permission, dan data scope.

## 0. Model Identitas Pegawai dan Dynamic RBAC (BR-00)

- **Profil utama** di `users.role` hanya `Admin GABAH` (administrator sistem) dan `Karyawan` (seluruh pegawai).
- IT, GA, Auditor, Humas, Sekretariat Direksi, Admin ME, dan fungsi lain adalah role/capability tambahan yang ditetapkan melalui Dynamic RBAC, bukan profil utama yang ditanam di kode.
- RPC/SC dan PIBC adalah lokasi/unit operasional, bukan role aplikasi dan bukan owner aset otomatis.
- Permission menentukan tindakan; scope menentukan data yang dapat dijangkau. Jabatan, unit, divisi, dan lokasi tidak memberi izin secara implisit.
- Akun dengan label role lama dinormalisasi melalui migration `048_dynamic_employee_profile_normalization.sql`. Assignment fungsi IT/GA/Auditor/Humas/Sekretariat Direksi dipertahankan sebagai role tambahan; assignment Supply Chain/PIBC dinonaktifkan sebagai role karena keduanya adalah lokasi/unit.

---

## 1. Aturan Kepemilikan Aset & Batas Wewenang Divisi (BR-01)

### BR-01.1: Kepemilikan Barang IT (IT-H & IT-S)
- **Aturan**: Aset hardware komputasi (termasuk laptop, PC, server, jaringan, storage, UPS) dan software/lisensi yang ditetapkan sebagai owner IT dikelola oleh fungsi IT lintas seluruh lokasi. Lokasi fisik tidak mengubah owner.
- **Akses GA**: GA hanya dapat diberi akses baca tambahan untuk kategori Laptop/PC owner IT melalui permission/scope yang eksplisit dan dapat dikonfigurasi. Akses tersebut tidak memberikan hak create, update, assign, move, lifecycle, atau approval. Jangan memperluas akses baca ke seluruh aset IT atau software/lisensi tanpa keputusan dan grant khusus.
- **Enforcement Kode**: Kandidat implementasi tercatat pada `server/services.ts`, `server/taxonomy.ts`, `server/rbac-policy.ts`, dan `server/runtime-hardening.ts`; nama baris dapat berubah. Verifikasi list dan direct-ID dengan test sebelum menyatakan aturan telah ditegakkan.

### BR-01.2: Kepemilikan Sentral Furniture (INV-F)
- **Aturan**: Seluruh perabot kantor (`INV-F`: meja kerja, kursi rapat, lemari arsip, rak dokumen) adalah **hak milik mutlak Divisi GA**, di manapun lokasi fisik penempatannya di seluruh kantor atau pergudangan BUMD.
- **Enforcement yang ditemukan**: `server/services.ts` memaksa owner `GA` untuk kategori `INV-F`; `server/taxonomy.ts` menyediakan mapping kategori. Uji create dan update agar owner tidak dapat dipalsukan dari request body.
- **Konsekuensi**: Pendaftaran kategori furniture secara otomatis dialokasikan ke divisi pemilik `GA`.

### BR-01.3: Kepemilikan Aset Operasional di RPC dan PIBC
- **Aturan**:
  - RPC dan PIBC adalah lokasi/unit operasional, bukan divisi owner atau role aplikasi otomatis.
  - Data aset lama dengan owner code SC/PIBC dipertahankan sebagai histori sampai ditinjau satu per satu oleh Superadmin dan pemilik fungsi terkait.
  - Aset baru harus memakai owner yang telah disahkan pada master owner; lokasi fisik RPC/PIBC tidak boleh menentukan owner.
  - Kendaraan dinas operasional kantor (KDR) yang ditetapkan sebagai aset umum dikelola GA.
- **Enforcement yang ditemukan pada baseline**: `GabahDomainService.createAsset()` di `server/services.ts` menolak `SC`, `PIBC`, dan `UNASSIGNED` sebagai owner aset baru (409), memerlukan owner aktif pada master `db.divisions`, serta permission `assets.create` dan scope owner. Catatan: `server/taxonomy.ts` masih memuat entri kategori legacy SC/PIBC dan fallback resolver lama; guard `createAsset()` yang menolak owner tersebut adalah lapisan pencegah utama. Uji regresi diperlukan agar kategori legacy tidak dapat lolos melalui jalur lain/import.

---

## 2. Aturan Penomoran Aset & Rekonsiliasi ERP Accurate (BR-02)

### BR-02.1: Format Nomor Kanonikal
- **Aturan**: Pola nomor aset dikelola Superadmin melalui master Aturan Penomoran. Format belum dianggap standar final sampai perusahaan mengesahkannya. Aturan baru hanya memengaruhi nomor yang diterbitkan setelah perubahan; nomor historis tidak ditulis ulang.
- **Catatan**: Prefix SC/PIBC pada nomor historis bukan izin untuk membuat nomor baru dengan owner tersebut. Owner baru harus dipilih dari master owner yang disahkan.
- **Enforcement Kode**: `server/numbering.ts` (`AssetNumberingEngine.generateAssetNumber()`) dan `server/migrations/043_asset_numbering_rules.sql`.

### BR-02.2: Integritas Nomor Seri & Accurate ERP
- **Aturan**:
  - Nomor Seri Fisik (`serial_number`) wajib unik di seluruh sistem. Duplikasi ditolak dengan pesan error yang menyebutkan aset pemilik sebelumnya.
  - Nomor Aset Accurate ERP (`corporate_asset_number`) bersifat opsional, namun jika diisi wajib unik dan tidak boleh menimpa format kanonikal GABAH.
- **Enforcement Kode**: `server/services.ts` (baris 146-164), `server/migrations/001_gabah_normalized_schema.sql` (baris 78-80).

---

## 3. Aturan Sirkulasi Peminjaman Barang & Deteksi Tabrakan Jadwal (BR-03)

### BR-03.1: Kriteria Barang Pinjaman (Loanable Pool)
- **Aturan**: Hanya aset dengan flag `is_loanable: true` yang dapat diajukan permohonan peminjaman oleh karyawan.
- **Enforcement Kode**: `server/services.ts` (baris 396-397).

### BR-03.2: Validasi Anti-Bentrok Jadwal (Per-Asset Anti-Collision)
- **Aturan**: Tabrakan jadwal dievaluasi secara **ketat per unit aset** terhadap permohonan yang berstatus disetujui (`approved`) atau masih dalam penguasaan peminjam (`borrowed`, `active`, `overdue`). Pinjaman terlambat (`overdue`) tetap mengunci unit fisik sampai pengembalian tercatat.
  $$\text{Tabrakan} \iff (\text{start\_date} < \text{existing\_due\_date}) \land (\text{due\_date} > \text{existing\_start\_date})$$
- **Peminjaman Simultan Aset Berbeda**: Pengguna yang sama diizinkan meminjam aset berbeda pada rentang waktu yang sama (misal laptop IT dan mobil dinas GA) tanpa bentrok.
- **Enforcement Kode**: `server/services.ts` (baris 405-419), `server/migrations/003_loan_anti_collision_trigger.sql`.

### BR-03.3: Otoritas Persetujuan & Serah Terima Pinjaman
- **Aturan**: Approval/rejection/handover/return ditentukan oleh permission operasi (`loans.approve`, `loans.reject`, dan seterusnya) ditambah scope owner aset pada modul Loans. Superadmin memiliki kewenangan global; role label IT/GA dan lokasi kantor bukan otorisasi dengan sendirinya. Data legacy SC/PIBC harus direview per record dan tidak boleh diasumsikan punya approver otomatis.
- **Enforcement yang ditemukan pada baseline**: `GabahDomainService.canOperateLoan()` dan `approveLoan()`/`rejectLoan()` di `server/services.ts`; route API juga memerlukan permission. Uji per operasi, owner, dan status transisi.
- **Transisi Status Aset**:
  1. Pinjaman disetujui (`approved`) $\to$ status aset menjadi `reserved`.
  2. Serah terima fisik (`handoverLoan`) $\to$ status aset menjadi `assigned` (borrowed).
  3. Pengembalian barang (`returnLoan`) $\to$ status aset kembali menjadi `available` (atau `damaged` jika kondisi fisik rusak).

---

## 4. Aturan Helpdesk SLA & Eskalasi Insiden (BR-04)

### BR-04.1: Matriks Prioritas & Target Waktu Resolusi (SLA Hours)
- **Aturan**: Waktu tenggat penyelesaian (*sla_resolution_deadline*) dihitung secara otomatis saat tiket dibuat:
  | Prioritas Tiket | SLA Resolusi | Tingkat Keparahan Notifikasi | Kategori Masalah Utama |
  |:---|:---|:---|:---|
  | `urgent` | **4 Jam** | `critical` | Server down, jaringan kantor pusat terputus, jembatan timbang eror |
  | `high` | **8 Jam** | `action_required` | Laptop pimpinan bermasalah, AC ruang server mati |
  | `medium` | **24 Jam** | `info` | Printer macet, kendala aplikasi SAP / Accurate |
  | `low` | **48 Jam** | `info` | Permintaan instalasi software non-kritis, penggantian mouse |
- **Enforcement Kode**: `server/services.ts` (baris 585-592 & 629-640).

---

## 5. Aturan Kategori Helpdesk Ticket (BR-04b)
- Kategori tiket baru adalah `IT`, `GA`, dan `ME` (Mechanical, Electrical & Tim Perawatan). `SC`/`PIBC` hanya dipertahankan untuk histori lama; keduanya bukan kategori layanan baru karena merupakan unit/lokasi organisasi.
- Software/License/SaaS (Accurate, M365, VPN), hardware, jaringan, server, dan akun → `IT`.
- Fasilitas gedung, kendaraan dinas, dan sarana-prasarana umum → `GA`.
- Mesin, mekanikal, elektrikal, dan perawatan teknis lingkup Tim Perawatan PIBC → `ME`, diarahkan ke antrean unit `UNIT-PIBC-ME`.
- Tiket IT diarahkan langsung ke satu petugas aktif yang memiliki `tickets.update` dan scope IT; jika kandidat tidak tunggal, tiket tetap di antrean IT.
- **Contract Management adalah domain tersendiri. Contract bukan kategori Helpdesk.** Ticket dapat ditautkan ke Contract apabila terdapat pekerjaan/action yang perlu ditindaklanjuti.
- Data tiket lama berkategori `License`/`General` tetap dinormalisasi otomatis saat server boot (License→IT, General→GA); histori SC/PIBC tetap dapat dibaca.

## 6. Aturan Contract Management (BR-06)
- Contract = record bisnis: nomor `CTR-YYYY-NNNN`, tipe, vendor, divisi pemilik (tidak terbatas GA/IT/SC/PIBC), PIC, periode, notice period, nilai, auto-renewal, status, dokumen append-only, notes.
- Reminder kedaluwarsa menggunakan threshold **configurable** (default 60/35/7 hari): >60 normal; ≤60 warning; ≤35 urgent; ≤7 critical; kedaluwarsa = expired. Tampilan selalu menyertakan teks status + sisa hari (bukan warna saja).
- Reminder dikirim ke PIC + divisi pemilik (bukan broadcast), dengan eskalasi opsional pada threshold 35/7 hari; seluruh penerima di-resolve **server-side** dari data kontrak/user (input klien tidak pernah menentukan penerima/kanal).
- Channel notifikasi: in-app, email, telegram — semuanya melalui satu engine reminder dengan log `contract_notification_logs` (notification_type, channel, recipient, status, error_message, attempts). Idempoten per (kontrak, tipe, kanal, penerima, due-day) — UNIQUE index di PostgreSQL + guard in-memory. Status jujur: `sent` (terkirim nyata), `failed` (provider gagal + alasan), `skipped` (provider belum dikonfigurasi / penerima tanpa alamat) — tidak pernah ada sukses palsu.
- Notice date dihitung `end_date − notice_period_days` dan remndernnya terpisah dari reminder kedaluwarsa.
- Renewal outcome wajib disimpan (pending/renewed/not_renewed/terminated/replaced) beserta alasan; kontrak lama dipertahankan (audit & versioning-ready).

## 5. Aturan Reservasi Ruang Rapat & Notifikasi Multi-Divisi (BR-05)

### BR-05.1: Jalur Cepat Direksi (VIP Auto-Approval)
- **Aturan**:
  - Setiap permohonan reservasi ruang rapat yang diajukan oleh pegawai dengan capability/permission Sekretariat Direksi yang sah (atas nama Direksi & Dewan Komisaris) secara otomatis berstatus disetujui (`approved`), memiliki prioritas `high`, dan mengunci ruangan dari jadwal lain.
  - Permohonan dari karyawan/divisi lain berstatus `pending_approval` dan memerlukan persetujuan manual Divisi GA.
- **Enforcement yang ditemukan**: `server/services.ts` dan `server/role-capabilities.ts`; cek capability efektif dan backend route. Nomor baris tidak dijadikan acuan tetap; UAT harus memverifikasi user Karyawan dengan capability dan user tanpa capability.

### BR-05.2: Perutean Notifikasi Fasilitas & Layanan
- **Aturan**:
  1. **Kebutuhan IT**: Jika pemohon mencentang fasilitas berkategori IT (Polycom Video Conference, Smart TV 85", Laser Projector, HDMI, WiFi), sistem wajib mengirim notifikasi aksi ke Divisi IT Support.
  2. **Kebutuhan GA Sarpras**: Jika terdapat kebutuhan fisik (Sound System, Mic Wireless, Whiteboard, Kursi Tambahan), sistem mengirim notifikasi ke Divisi GA Sarpras.
  3. **Pesanan Konsumsi Pantry**: Jika opsi konsumsi dicentang (Snack box, Lunch box, Coffee break, VIP Buffet), sistem mengirim notifikasi rincian menu dan jumlah pax ke Divisi GA Pantry.
  4. **Dokumentasi & Publikasi Humas**: Jika opsi dokumentasi dicentang (Foto, Video, Press Release), sistem wajib mengirim notifikasi peliputan eksklusif ke Staf Humas & Protokoler.
- **Enforcement Kode**: `server/services.ts` (baris 1001-1063).

---

## 6. Aturan Siklus Hidup Aset & Penghapusan Final (BR-06)

### BR-06.1: Alur Penghapusan Aset BUMD (*Disposal*)
- **Aturan**: Mutasi aset menuju status `disposed` (dihapuskan dari buku aset) harus melalui tahapan usulan (`propose_disposal` $\to$ status `pending_disposal`).
- **Otoritas Tunggal**: Hanya akun dengan kapabilitas administrasi global Superadmin yang berwenang mengeksekusi `approve_disposal`. Identitas profil utamanya adalah `Admin GABAH`; otorisasi backend menggunakan resolver Superadmin, bukan pencocokan label tampilan.
- **Enforcement Kode**: `server/services.ts` melalui `isSuperadminActor(actor)`; lifecycle permission dan owner scope tetap diperiksa sebelum aksi.

---

## 7. Aturan Pengawasan Satuan Pengawas Internal / Auditor (BR-07)

### BR-07.1: Strict Read-Only Capability
- **Aturan**: Pegawai dengan capability audit/read-only yang ditetapkan secara eksplisit memperoleh akses inspeksi hanya pada data sesuai scope audit, tetapi **diblokir dari segala bentuk mutasi data**. Capability ini dapat menjadi assignment tambahan pada profil Karyawan; Auditor bukan profil utama dan bukan alasan membuat katalog role primer terpisah.
- **Enforcement**: permission marker `security.read_only` dapat dipasang pada role Dynamic RBAC apa pun. Role template Auditor lama menerima marker yang sama melalui migrasi kompatibilitas. Backend memfilter permission efektif menjadi read-only, menolak seluruh mutasi (selain logout dan penandaan notifikasi terbaca), meniadakan elevasi Superadmin, dan mencegah kombinasi read-only + Superadmin.
- **Pemisahan visibilitas**: marker read-only tidak otomatis memberi akses global. Role custom tetap melihat data sesuai scope eksplisitnya. Assignment Auditor lama tetap menjadi global observer read-only; identitas Auditor dipisahkan dari kebijakan read-only generik.
- **Pengecualian runtime saat ini**: Middleware mengizinkan `/api/auth/logout`, `/api/notifications/read-all`, dan `/api/notifications/:id/read` untuk tindakan non-GET yang terbatas. `/api/auth/switch-role` bukan pengecualian. Verifikasi ulang setelah perubahan auth.

---

## 8. Aturan Pencatatan Audit Trail BUMD (BR-08)

### BR-08.1: Rekam Jejak Audit yang Tidak Dapat Dihapus (*Immutable*)
- **Aturan**: Setiap aksi yang mengubah keadaan sistem (*state-changing action*) wajib dicatat ke tabel `audit_logs` dengan informasi: aksi, nama entitas, ID entitas, nama aktor, peran aktor, rincian perubahan, serta timestamp presisi.
- **Enforcement Kode**: `server/services.ts` (`GabahDomainService.recordAudit()`), `server.ts` (baris 40-49).
