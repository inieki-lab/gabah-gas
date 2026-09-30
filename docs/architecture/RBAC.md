# GABAH — Role-Based Access Control (RBAC) Specification

**Dokumen:** `docs/architecture/RBAC.md`  
**Sistem:** GABAH (*General Asset, Business & Automated Helpdesk*)  
**Organisasi:** PT Food Station Tjipinang Jaya (Perseroda)  
**Status:** Authoritative RBAC Specification (Tersinkronisasi Penuh dengan Source Code Aktual)  
**Terakhir Diperbarui:** 28 September 2026  

---

## 1. Definisi 9 Peran Pengguna Kanonikal

Sistem GABAH mendefinisikan **9 peran pengguna resmi** pada `src/types.ts` dan `server/db.ts`:

1. **Admin GABAH (Super Admin)**: Memiliki hak akses penuh (*unrestricted*) ke seluruh modul sistem, master data, konfigurasi organisasi, manajemen pengguna, approval peminjaman darurat, dan eksekusi penghapusan aset final (*disposal*).
2. **IT (IT Support & MIS)**: Penanggung jawab penuh atas aset hardware komputasi (`IT-H`), server data center, perangkat jaringan, serta lisensi software/SaaS (`IT-S`). Memiliki wewenang approval pinjaman aset IT, penyelesaian tiket IT, dan penyiapan fasilitas IT ruang rapat.
3. **GA (General Affairs & Sarpras)**: Penanggung jawab fasilitas gedung, kantor pusat, furniture kantor (`INV-F`), peralatan umum (`INV-P`), dan armada kendaraan dinas kantor (`KDR`). Memiliki wewenang approval pinjaman mobil kantor, approval reservasi ruang rapat umum, dan koordinasi konsumsi pantry.
4. **Sekretaris Direksi**: Peran protokoler eksekutif sekretariat Direksi & Dewan Komisaris. Memiliki fasilitas **reservasi ruang rapat otomatis disetujui (VIP auto-approval)**, peminjaman barang rapat dinas, dan pelaporan kendala ruang pimpinan.
5. **Humas (Humas & Protokoler)**: Peran fungsional komunikasi korporat dan protokoler. Menerima notifikasi otomatis untuk permintaan dokumentasi media (foto, video, liputan). Akses katalog aset disembunyikan agar fokus pada tugas protokoler.
6. **Supply Chain (SC)**: Penanggung jawab aset pabrik penggilingan beras (*rice milling plant*), mesin conveyor kemasan, armada truk logistik beras (`KDR-SC`), dan tiket operasional pergudangan pangan.
7. **PIBC (Pasar Induk Beras Cipinang)**: Penanggung jawab pengawasan aset fisik kawasan Pasar Induk Beras Cipinang, mesin jembatan timbang truk 60 ton (`MSN-PIBC`), serta kalibrasi tera berkala.
8. **Karyawan (Staf Umum)**: Karyawan operasional dari seluruh divisi BUMD. Berwenang melihat aset yang ditugaskan kepadanya (*Aset Saya*), mengajukan permohonan pinjaman dari pool aset, membuat tiket kendala bantuan kerja, dan mengajukan reservasi ruang rapat.
9. **Auditor (Satuan Pengawas Internal / SPI)**: Pengawas tata kelola dan kepatuhan BUMD. Memiliki hak akses **Read-Only menyeluruh** ke seluruh katalog aset, riwayat pergerakan, log peminjaman, tiket, laporan rekonsiliasi Accurate, dan riwayat audit trail. **Terkunci dari operasi mutasi data (HTTP 403)**.

> **Contract Management (domain tersendiri):** Contract bukan kategori Helpdesk dan tidak memerlukan peran baru. Akses mengikuti divisi pemilik/PIC; Auditor membaca sesuai kewenangan audit; Admin GABAH mengelola sesuai kebijakan. Kontrak tertentu dapat diberi flag `restricted` untuk pembatasan lebih ketat di masa depan. Software License/SaaS merupakan domain IT — seluruh Helpdesk Ticket terkait software/license menggunakan kategori IT.

> **Catatan Peran Legacy / Non-Login:**
> 1. Role `Management` **bukan** akun login terpisah; fungsi pengawasan eksekutif diakomodasi oleh akun `Auditor` (read-only) atau `Admin GABAH`.
> 2. Role `Vendor` **bukan** akun login pengguna sistem; vendor dikelola murni sebagai entitas data master rekanan servis/kontrak pada tabel `contracts` dan modul Master Data.

---

## 2. Matriks Izin Akses Menyeluruh (RBAC Permissions Matrix)

| Modul & Tindakan | Admin GABAH | IT | GA | Sekdir | Humas | Supply Chain | PIBC | Karyawan | Auditor |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Katalog Aset (View All)** |  Full | IT Only | GA + Read IT | Assigned/Loanable |  None | SC Only | PIBC Only | Assigned/Loanable |  Read All |
| **Pendaftaran Aset (Create)** |  Semua | IT Only | GA Only (Non-IT) |  |  | SC Only | PIBC Only |  |  |
| **Penugasan Aset (Assign)** |  Semua | IT Only | GA Only (Non-IT) |  |  | SC Only | PIBC Only |  |  |
| **Mutasi Lokasi (Move)** |  Semua | IT Only | GA Only (Non-IT) |  |  | SC Only | PIBC Only |  |  |
| **Mutasi Siklus Hidup** |  Semua | IT Only | GA Only (Non-IT) |  |  | SC Only | PIBC Only |  |  |
| **Setujui Penghapusan (Disposal)**|  Eksklusif |  |  |  |  |  |  |  |  |
| **Ajukan Pinjaman (Loan Req)** |  |  |  |  |  |  |  |  |  |
| **Approval Pinjaman** |  Semua | IT Aset | GA Aset |  |  | SC Aset | PIBC Aset |  |  |
| **Serah Terima (Handover)** |  Semua | IT Aset | GA Aset |  |  | SC Aset | PIBC Aset |  |  |
| **Pengembalian (Return)** |  Semua | IT Aset | GA Aset |  |  | SC Aset | PIBC Aset |  |  |
| **Cetak BAST Digital** |  |  |  |  |  |  |  |  |  |
| **Buat Tiket Helpdesk** |  |  |  |  |  |  |  |  |  |
| **Kelola/Selesaikan Tiket** |  Semua | IT/License | GA Tiket |  |  | SC Tiket | PIBC Tiket | Own Only |  Read Only |
| **Preventive Maintenance** |  CRUD | IT Aset | GA Aset |  |  | SC Aset | PIBC Aset |  |  Read Only |
| **Reservasi Ruang Rapat** |  |  |  |  VIP Auto |  |  |  |  Pending GA |  Read Only |
| **Approval Ruang Rapat** |  |  |  GA Auth |  |  |  |  |  |  |
| **Notifikasi Fasilitas IT** |  |  Terima |  |  |  |  |  |  |  |
| **Notifikasi Pantry Konsumsi** |  |  |  Terima |  |  |  |  |  |  |
| **Notifikasi Liputan Humas** |  |  |  |  |  Terima |  |  |  |  |
| **Contract Register (View)** |  Semua | Own Div | Own Div |  |  | Own Div | Own Div |  |  Audit Read |
| **Contract Create/Edit** |  Semua | Own Div | Own Div |  |  | Own Div | Own Div |  |  |
| **Contract Reminder & Log** |  Kelola | PIC/Div | PIC/Div |  |  | PIC/Div | PIC/Div |  |  Read |
| **Administration Control Panel**|  Eksklusif |  |  |  |  |  |  |  |  |
| **Kelola Pengguna (Users)** |  CRUD |  |  |  |  |  |  |  |  |
| **Kelola Master Lokasi/Divisi** |  CRUD |  |  |  |  |  |  |  |  |
| **Lihat Audit Trail** |  Full |  |  |  |  |  |  |  |  Full |
| **Rekonsiliasi Accurate** |  Full |  |  |  |  |  |  |  |  Full |

---

## 3. Titik Penegakan RBAC di Kode Sumber (Enforcement Points)

### 3.1 Penegakan Backend (Server-Side Enforcement)
1. **Middleware Keamanan (`server/runtime-hardening.ts`)**:
   - Baris 108-118: Menolak seluruh HTTP non-GET dari peran `Auditor` dengan status HTTP `403 Forbidden`.
   - Baris 120-125: Membatasi akses `/api/audit-logs` dan `/api/reconciliation` hanya untuk `Admin GABAH` dan `Auditor`.
   - Baris 127-130: Membatasi akses rincian aset `/api/assets/:id` berdasarkan lingkup divisi (`canSeeAsset`).
   - Baris 132-135: Membatasi wewenang update status tiket `/api/tickets/:id/status` berdasarkan kategori divisi (`canManageTicket`).
2. **Domain Service Logic (`server/services.ts`)**:
   - Baris 61-85: `getScopedAssets()` membatasi pengembalian daftar aset berdasarkan peran pengguna.
   - Baris 127-144: `createAsset()` memvalidasi bahwa hanya divisi terkait yang dapat mendaftarkan aset kategorinya, dan menolak staf biasa / auditor.
   - Baris 228-243: `assignAsset()` membatasi penugasan aset agar tidak disalahgunakan oleh divisi lain (misal GA menugaskan aset IT ditolak).
   - Baris 313-317: `moveAsset()` menolak mutasi lokasi barang IT jika dilakukan oleh GA.
   - Baris 348-350: `mutateLifecycle()` menolak mutasi lifecycle barang IT jika dilakukan oleh GA.
   - Baris 368-370: `approve_disposal` dikunci mutlak hanya untuk `Admin GABAH`.
   - Baris 470-480: `approveLoan()` memastikan hanya divisi pemilik aset yang berwenang menyetujui peminjaman unit miliknya.
   - Baris 945-976: `requestRoomReservation()` otomatis menyetujui (`isAutoApproved = true`) permohonan dari `Sekretaris Direksi`.
   - Baris 1071-1073: `approveRoomReservation()` membatasi persetujuan reservasi ruang rapat hanya untuk `Admin GABAH` dan `GA`.

### 3.2 Penegakan Antarmuka (UI Role Guards)
1. **Navigasi Sidebar (`src/components/Sidebar.tsx`)**:
   - Baris 94-224: Menyaring menu navigasi tab berdasarkan daftar `item.roles.includes(activeRole)`.
   - Baris 283-319: Tombol **Administration Control Panel** hanya dirender jika `activeRole === 'Admin GABAH'`.
2. **Modal Administrasi (`src/components/modals/AdministrationModal.tsx`)**:
   - Terkunci untuk pengguna non-admin melalui pengecekan `currentUser.role === 'Admin GABAH'`.
3. **Formulir Peminjaman & Tiket**:
   - Formulir memilih aset pinjaman hanya menampilkan aset berkategori `is_loanable: true` yang tersedia.

---

## 4. Akun Kanonikal (Kredensial Tidak Dipublikasikan)

> **SECURITY (CR-02):** Tidak ada password default yang ditulis di dokumentasi.
> Kredensial awal diprovision dari environment secrets saat boot:
> `GABAH_INITIAL_ADMIN_PASSWORD` (akun Admin GABAH) dan
> `GABAH_INITIAL_USER_PASSWORD` (akun non-admin), atau di-generate acak CSPRNG
> per akun pada mode development (disimpan sekali di file yang di-gitignore).
> Placeholder dalam tabel di bawah hanyalah penanda, bukan nilai nyata.

| Peran | Nama Pegawai | Email Kanonikal | Password | Divisi & Jabatan |
|:---|:---|:---|:---|:---|
| **Admin GABAH** | Budi Santoso | `admin@foodstation.co.id` | `<INITIAL_ADMIN_PASSWORD>` | IT / Super Administrator |
| **IT** | Dani Setiawan | `it.support@foodstation.co.id` | `<INITIAL_USER_PASSWORD>` | IT / IT Technical Support |
| **GA** | Siti Rahmawati | `ga@foodstation.co.id` | `<INITIAL_USER_PASSWORD>` | GA / General Affairs & Sarpras |
| **Sekretaris Direksi** | Dewi Anggraini, S.Sos | `sekretariat.direksi@foodstation.co.id` | `<INITIAL_USER_PASSWORD>` | GA / Staf Sekretariat Direksi |
| **Humas** | Rina Kartika, M.I.Kom | `humas@foodstation.co.id` | `<INITIAL_USER_PASSWORD>` | GA / Staf Humas & Protokoler |
| **Supply Chain** | Agus Pratama | `sc.warehouse@foodstation.co.id` | `<INITIAL_USER_PASSWORD>` | SC / Logistik Pergudangan Beras |
| **PIBC** | Bambang Hermawan | `pibc.admin@foodstation.co.id` | `<INITIAL_USER_PASSWORD>` | PIBC / Pengawas Pasar Induk |
| **Karyawan** | Hendra Wijaya | `hendra.w@foodstation.co.id` | `<INITIAL_USER_PASSWORD>` | Komersial / Staf Komersial |
| **Auditor** | Maya Indriani, SE, Ak, CA | `auditor@foodstation.co.id` | `<INITIAL_USER_PASSWORD>` | Audit / Auditor Internal (SPI) |
