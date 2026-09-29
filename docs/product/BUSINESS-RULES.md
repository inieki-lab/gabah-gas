# GABAH — Authoritative Business Rules Matrix

**Dokumen:** `docs/product/BUSINESS-RULES.md`  
**Sistem:** GABAH (*General Asset, Business & Automated Helpdesk*)  
**Organisasi:** PT Food Station Tjipinang Jaya (Perseroda)  
**Status:** Authoritative Rules Matrix (100% Sesuai Source Code Aktual)  
**Terakhir Diperbarui:** 28 September 2026  

---

## 1. Aturan Kepemilikan Aset & Batas Wewenang Divisi (BR-01)

### BR-01.1: Kepemilikan Barang IT (IT-H & IT-S)
- **Aturan**: Seluruh aset hardware komputasi (`IT-H`: Laptop `HLT`, PC `HPC`, Server `HSV`, Workstation `HWS`, Monitor `HMON`, Printer `HPRN`, Jaringan `HNET`, Firewall `HFW`, Storage `HSTG`, UPS `HUPS`, Rack `HRCK`) dan software/lisensi (`IT-S`: `SLIC`) adalah **hak milik mutlak Divisi IT**.
- **Enforcement Kode**: `server/services.ts` (baris 117-120 & 131-134), `server/taxonomy.ts` (baris 33-50).
- **Konsekuensi**: Divisi General Affairs (GA) hanya memiliki hak akses lihat (*read-only*). Pengguna peran `GA` ditolak jika mencoba mendaftarkan, menugaskan, memutasi lokasi, atau mengubah status siklus hidup barang IT.

### BR-01.2: Kepemilikan Sentral Furniture (INV-F)
- **Aturan**: Seluruh perabot kantor (`INV-F`: meja kerja, kursi rapat, lemari arsip, rak dokumen) adalah **hak milik mutlak Divisi GA**, di manapun lokasi fisik penempatannya di seluruh kantor atau pergudangan BUMD.
- **Enforcement Kode**: `server/services.ts` (baris 120-123 & 135-137), `server/taxonomy.ts` (baris 51-53).
- **Konsekuensi**: Pendaftaran kategori furniture secara otomatis dialokasikan ke divisi pemilik `GA`.

### BR-01.3: Kepemilikan Armada & Mesin Pabrik (SC & PIBC)
- **Aturan**:
  - Truk muatan beras (`KDR-SC`) dan mesin pabrik/forklift (`MSN`) adalah hak milik Divisi Supply Chain.
  - Mesin jembatan timbang truk 60 ton (`MSN-PIBC`) dan sarana pasar induk adalah hak milik Divisi PIBC.
  - Kendaraan dinas operasional kantor (`KDR`) adalah hak milik Divisi GA.
- **Enforcement Kode**: `server/services.ts` (baris 138-144), `server/taxonomy.ts` (baris 57-64).

---

## 2. Aturan Penomoran Aset & Rekonsiliasi ERP Accurate (BR-02)

### BR-02.1: Format Nomor Kanonikal
- **Aturan**: Format nomor aset resmi sistem adalah:
  `{OWNER_DIVISION}-{ASSET_CODE}-{YEAR}-{SEQUENCE}`
  - Contoh: `IT-HLT-2026-0001`, `GA-INV-F-2026-0001`, `SC-KDR-SC-2026-0001`, `PIBC-MSN-2026-0001`.
- **Enforcement Kode**: `server/numbering.ts` (`AssetNumberingEngine.generateAssetNumber()`).
- **Ketentuan Sequence**: Nomor urut (*sequence*) dimulai dari `0001` dan mereset setiap pergantian tahun takwim per kombinasi unik `owner_division` dan `asset_code`.

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
- **Aturan**: Tabrakan jadwal dievaluasi secara **ketat per unit aset** terhadap permohonan yang berstatus disetujui (`approved`) atau sedang dipinjam (`borrowed`).
  $$\text{Tabrakan} \iff (\text{start\_date} < \text{existing\_due\_date}) \land (\text{due\_date} > \text{existing\_start\_date})$$
- **Peminjaman Simultan Aset Berbeda**: Pengguna yang sama diizinkan meminjam aset berbeda pada rentang waktu yang sama (misal laptop IT dan mobil dinas GA) tanpa bentrok.
- **Enforcement Kode**: `server/services.ts` (baris 405-419), `server/migrations/003_loan_anti_collision_trigger.sql`.

### BR-03.3: Otoritas Persetujuan & Serah Terima Pinjaman
- **Aturan**:
  - Peminjaman aset IT wajib disetujui oleh personel `IT` atau `Admin GABAH`.
  - Peminjaman aset GA (mobil dinas) wajib disetujui oleh personel `GA` atau `Admin GABAH`.
  - Peminjaman aset SC wajib disetujui oleh personel `Supply Chain` atau `Admin GABAH`.
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
- Kategori tiket **terbatas pada**: `IT`, `GA`, `SC`, `PIBC`. Tidak ada kategori `License`, `General`, atau `Contract`.
- Software/License/SaaS (Accurate, M365, VPN) adalah domain IT → seluruh tiket terkait menggunakan kategori `IT`.
- Hardware/jaringan/server/akun → `IT`; fasilitas gedung → `GA`; permintaan SC → `SC`; PIBC → `PIBC`.
- **Contract Management adalah domain tersendiri. Contract bukan kategori Helpdesk.** Ticket dapat ditautkan ke Contract apabila terdapat pekerjaan/action yang perlu ditindaklanjuti.
- Data tiket lama berkategori `License`/`General` dinormalisasi otomatis saat server boot (License→IT, General→GA).

## 6. Aturan Contract Management (BR-06)
- Contract = record bisnis: nomor `CTR-YYYY-NNNN`, tipe, vendor, divisi pemilik (tidak terbatas GA/IT/SC/PIBC), PIC, periode, notice period, nilai, auto-renewal, status, dokumen append-only, notes.
- Reminder kedaluwarsa menggunakan threshold **configurable** (default 60/35/7 hari): >60 normal; ≤60 warning; ≤35 urgent; ≤7 critical; kedaluwarsa = expired. Tampilan selalu menyertakan teks status + sisa hari (bukan warna saja).
- Reminder dikirim ke PIC + divisi pemilik (bukan broadcast), dengan eskalasi opsional pada threshold 35/7 hari.
- Channel notifikasi: in-app, email, telegram — semuanya melalui satu engine reminder dengan log `contract_notification_logs` (notification_type, channel, recipient, status, error_message).
- Notice date dihitung `end_date − notice_period_days` dan remndernnya terpisah dari reminder kedaluwarsa.
- Renewal outcome wajib disimpan (pending/renewed/not_renewed/terminated/replaced) beserta alasan; kontrak lama dipertahankan (audit & versioning-ready).

## 5. Aturan Reservasi Ruang Rapat & Notifikasi Multi-Divisi (BR-05)

### BR-05.1: Jalur Cepat Direksi (VIP Auto-Approval)
- **Aturan**:
  - Setiap permohonan reservasi ruang rapat yang diajukan oleh `Sekretaris Direksi` (atas nama Direksi & Dewan Komisaris) secara otomatis berstatus disetujui (`approved`), memiliki prioritas `high`, dan mengunci ruangan dari jadwal lain.
  - Permohonan dari karyawan/divisi lain berstatus `pending_approval` dan memerlukan persetujuan manual Divisi GA.
- **Enforcement Kode**: `server/services.ts` (baris 945-976).

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
- **Otoritas Tunggal**: Hanya peran `Admin GABAH` yang berwenang mengeksekusi `approve_disposal`. Peran lain yang mencoba menyetujui penghapusan akan ditolak oleh sistem.
- **Enforcement Kode**: `server/services.ts` (baris 367-372).

---

## 7. Aturan Pengawasan Satuan Pengawas Internal / Auditor (BR-07)

### BR-07.1: Strict Read-Only Mode
- **Aturan**: Akun dengan peran `Auditor` memiliki hak inspeksi penuh ke seluruh data sistem (katalog aset, tiket, log peminjaman, rekonsiliasi Accurate, log audit), tetapi **diblokir dari segala bentuk mutasi data**.
- **Enforcement Kode**: `server/runtime-hardening.ts` (baris 108-118).
- **Pengecualian**: Endpoint `/api/auth/logout`, `/api/auth/switch-role` (untuk dev), dan `/api/notifications/:id/read`. Percobaan `POST`, `PATCH`, `PUT`, `DELETE` lainnya menghasilkan status HTTP `403 Forbidden`.

---

## 8. Aturan Pencatatan Audit Trail BUMD (BR-08)

### BR-08.1: Rekam Jejak Audit yang Tidak Dapat Dihapus (*Immutable*)
- **Aturan**: Setiap aksi yang mengubah keadaan sistem (*state-changing action*) wajib dicatat ke tabel `audit_logs` dengan informasi: aksi, nama entitas, ID entitas, nama aktor, peran aktor, rincian perubahan, serta timestamp presisi.
- **Enforcement Kode**: `server/services.ts` (`GabahDomainService.recordAudit()`), `server.ts` (baris 40-49).
