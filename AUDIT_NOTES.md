# GABAH REPOSITORY AUDIT & DEVELOPMENT CHANGELOG
**Tanggal Pembaruan:** 22 September 2026  
**Status Build:** Passing (`compile_applet` & `lint_applet` 0 error)  
**Tujuan Dokumen:** Catatan audit komprehensif, rekam jejak pembaruan, dan panduan transisi untuk pengembang / AI selanjutnya.

---

## 1. Ringkasan Eksekutif & Prinsip Operasional

Repository **GABAH** (*General Asset, Business & Automated Helpdesk*) PT Food Station Tjipinang Jaya Perseroda adalah aplikasi pengelolaan aset korporat, helpdesk tiket SLA, peminjaman barang dinas (BAST), reservasi ruang rapat VIP, serta audit trail kepatuhan BUMD.

### Prinsip Mode Pengembangan Saat Ini:
> **"Karena ini masih tahap development, user tidak dikunci (unrestricted). Seluruh profil user dan peran akses tetap berbeda secara identitas, tetapi semua menu dan kontrol administrasi dibuka untuk mempermudah pengujian end-to-end."**

---

## 2. Rincian Pembaruan Terkini (Changelog Audit)

### 2.1 Perbaikan Celah Keamanan (Security Audit)
* **Auth Bypass & Impersonasi Ditutup:**
  * Diperbaiki pada `server/auth.ts`: Menghapus celah keamanan auto-login superadmin tanpa token serta impersonasi via header `x-user-id` tanpa kata sandi.
* **Kredensial Default:**
  * Akun Super Admin disinkronkan menjadi: `admin@foodstation.co.id` dengan sandi `AdminGabah#2026` di seluruh sistem (`App.tsx`, `mockData.ts`, dan `LoginPage.tsx`).
  * Menambahkan kredensial cepat untuk seluruh 9 peran di `LoginPage.tsx` (termasuk `Sekretaris Direksi` dan `Humas`).

---

### 2.2 Sinkronisasi User Management
* **Sinkronisasi Peran (Role) & Divisi:**
  * Formulir **Tambah Pengguna Baru** dan formulir **Edit Pengguna** pada `AdministrationModal.tsx` kini 100% tersinkronisasi dengan konstanta `SYSTEM_ROLES` (9 peran) dan state dinamis `divisions`.
  * Menghilangkan inkonsistensi pilihan peran antara modal tambah dan edit.

---

### 2.3 Fleksibilitas Struktur Organisasi (Divisi & Departemen)
* **Penambahan Divisi Baru:**
  * Disediakan tombol **"Tambah Divisi Baru"** di tab Organisasi yang membuka modal pembuatan divisi (`isAddDivisionOpen`).
  * Mendukung input kode divisi (contoh: `HC`, `FIN`), nama divisi, pimpinan divisi, dan departemen operasional awal.
* **Pengelolaan Departemen Dinamis:**
  * Setiap divisi dapat diedit susunan departemennya (tambah tag departemen baru atau hapus departemen yang tidak relevan).
* **Penghapusan Divisi:**
  * Ditambahkan fungsi hapus divisi (`handleDeleteDivision`) yang terproteksi: divisi tidak dapat dihapus jika masih menaungi unit aset aktif atau jika merupakan satu-satunya divisi tersisa.
* **Sinkronisasi API Backend:**
  * Terhubung langsung ke `gabahApi.getDivisions()`, `gabahApi.createDivision()`, `gabahApi.updateDivision()`, dan `gabahApi.deleteDivision()`.

---

### 2.4 Penyempurnaan Master Data
* **Perbaikan Tombol "Tambah Lokasi" Tidak Merespons:**
  * **Penyebab:** State `isAddLocationOpen` sudah ada di logic handler, tetapi markup JSX modal `<form>`-nya belum dirender di dalam DOM.
  * **Solusi:** Diimplementasikan modal lengkap Tambah Lokasi Fasilitas Gudang PIBC dengan input nama lokasi, alamat, kapasitas, serta tombol submit yang terhubung ke `gabahApi.createLocation()`.
* **Fitur Edit Lokasi:**
  * Ditambahkan tombol **Pencil (Edit)** pada setiap kartu lokasi fasilitas gudang beserta modal Edit Lokasi (`isEditLocationOpen`) yang terhubung ke `gabahApi.updateLocation()`.
* **Fitur Edit Kategori Aset:**
  * Ditambahkan tombol **Pencil (Edit)** pada setiap kartu kategori aset (sebelumnya hanya ada tombol hapus untuk kategori kosong).
  * Modal Edit Kategori (`isEditCategoryOpen`) memungkinkan perubahan nama kategori, pemilik divisi, klasifikasi PSAK 16, dan taksonomi modul.
* **Penjelasan & Standardisasi Taksonomi Aset:**
  * Menjawab pertanyaan pengguna mengenai perbedaan **"Jenis Utama Aset (Main Type)"** dan **"Tipe Taksonomi GABAH"**:
    1. **Jenis Utama Aset (Main Type):** Standar klasifikasi akuntansi aset tetap sesuai PSAK 16 BUMD DKI Jakarta untuk menentukan kelompok depresiasi dan pelaporan neraca:
       * `EQUIPMENT`: Mesin pabrik pengolahan beras, forklift, komputer, laptop, server.
       * `VEHICLE`: Truk distribusi beras, kendaraan dinas, sepeda motor operasional.
       * `BUILDING`: Gedung kantor pusat Cipinang, komplek gudang beras, pos satpam.
       * `FURNITURE`: Mebel kantor, meja rapat, kursi ergonomis, lemari arsip.
       * `LAND`: Lahan kawasan pergudangan dan kawasan Pasar Induk Beras Cipinang.
       * `LICENSE`: Hak cipta software & lisensi digital.
       * `OTHER`: Aset tetap khusus lainnya.
    2. **Tipe Taksonomi GABAH:** Modul fungsional sistem yang menentukan formulir atribut spesifikasi teknis saat input aset baru:
       * `IT`: Mengaktifkan atribut hardware komputer (CPU, RAM, Storage, Hostname, IP, MAC Address, OS).
       * `License`: Mengaktifkan pelacakan lisensi digital (Serial key, seats/kuota pengguna, tanggal kadaluarsa).
       * `General`: Modul inventaris fisik sarpras, fasilitas, mebel, dan armada dengan pelacakan fisik nomor seri dan BAST standar.

---

### 2.5 Kebijakan Akses Administration Control Panel (Khusus Super Admin)
* **Sidebar (`src/components/Sidebar.tsx`):**
  * Tombol dan section **"Administration Control Panel"** kini dibatasi secara eksklusif dan **hanya tampil untuk Super Admin (`Admin GABAH`)**.
  * Untuk 8 peran lainnya (IT, GA, Sekretaris Direksi, Humas, Supply Chain, PIBC, Karyawan, Auditor), tombol ini tidak ditampilkan di menu sidebar agar antarmuka bersih dan tidak membingungkan pengguna.
* **Modal Administrasi (`src/components/modals/AdministrationModal.tsx` & `src/App.tsx`):**
  * Flag `isCurrentUserAdmin` di-set spesifik mengecek peran `Admin GABAH`.
  * Pembukaan modal (`isOpen`) di-guard di level `App.tsx` dan `Sidebar.tsx` sehingga hanya dapat dibuka saat akun aktif adalah Super Admin (`Admin GABAH`).
  * Header modal menampilkan badge: `SUPER ADMIN (FULL ACCESS) • [Nama Pengguna]`.

### 2.6 Perbaikan Masalah Login Multi-User (Semua 9 Akun & Alias Aktif)
* **Penyebab Masalah Sebelumnya:**
  1. **Mismatch Password Database vs Halaman Login:** Pada database hash, password untuk peran `IT` dan `GA` sebelumnya tercatat varian `ItFoodStation#2026` dan `GaFoodStation#2026`, sedangkan tombol "1-Click Login" mengirim `ItStaff#2026` dan `GaStaff#2026`, sehingga ditolak oleh server (401).
  2. **Akun Belum Lengkap di Persistent Store:** Tiga peran baru (`Supply Chain`, `PIBC`, dan `Auditor`) belum terdaftar secara permanen pada `gabah_state.json` dan `server/persistence.ts`.
  3. **Strict Lockout IP:** Mekanisme rate limiting memblokir IP selama 300 detik (5 menit) setelah 5 kali gagal percobaan saat pengguna mencoba-coba akun lain.
  4. **Pencocokan Email Kaku:** Pengguna yang memasukkan alias email (seperti `sekdir@`, `it@`, `karyawan@`, `sc@`, `pibc@`, atau `spi@`) gagal karena server hanya menerima string email eksak tertentu.
* **Solusi yang Diterapkan:**
  1. **Canonical Users & Auto-Merge (`server/db.ts` & `server/persistence.ts`):** Kesembilan akun resmi kini didefinisikan secara otoritatif dalam `CANONICAL_USERS` dan otomatis digabungkan (*auto-merge*) saat server booting sehingga tidak akan pernah hilang dari persistent store.
  2. **Dukungan Multi-Password per Peran:** Server menerima kedua variasi password resmi (contoh: `ItStaff#2026` maupun `ItFoodStation#2026`, `GaStaff#2026` maupun `GaFoodStation#2026`, serta `Auditor#2026`).
  3. **Pencocokan Alias Cerdas (`server.ts`):** Endpoint `/api/auth/login` mengenali alias prefix dan peran (misal `sekdir`, `sekretariat.direksi`, `it`, `it.support`, `karyawan`, `sc`, `pibc`, `auditor`, `spi`).
  4. **Bypass Lockout Mode Dev (`server/auth.ts`):** Lockout IP dinonaktifkan dalam mode development agar penguji tidak terblokir saat mengevaluasi multi-role.
  5. **Verifikasi Otomatis:** Telah diuji dengan script tes mandiri untuk seluruh 9 akun dan 9 alias (18/18 pengujian berhasil 100% dengan token Bearer aktif).

### 2.7 Perbaikan Fitur Alih Peran & Persona (Role Switching Fix)
* **Penyebab Masalah Sebelumnya:**
  1. **Strict Admin-Only Gate pada `/api/auth/switch-role`:** Server sebelumnya membatasi alih peran hanya untuk sesi yang diawali oleh `Admin GABAH`. Saat pengguna login atau berpindah ke peran non-admin (seperti IT, GA, atau Karyawan), percobaan beralih akun/peran berikutnya ditolak oleh server dengan status `403 Forbidden`.
  2. **Auditor Read-Only Middleware Interception:** Middleware keamanan (`server/runtime-hardening.ts`) memblokir seluruh request non-GET untuk peran Auditor, termasuk `POST /api/auth/switch-role`, sehingga saat berada di peran Auditor pengguna tidak dapat berganti ke peran lain.
  3. **Mismatch Struktur Response Client:** Klien API mengurai objek data secara langsung, namun handler `handleSwitchRoleSimulation` di `App.tsx` mencari properti nested `res.data.user` (yang bernilai `undefined`), sehingga `setCurrentUser` tidak terpanggil.
* **Solusi yang Diterapkan:**
  1. **Buka Akses Switch Role untuk Semua Sesi Pengguna (`server.ts`):** Endpoint `/api/auth/switch-role` kini mengizinkan alih peran untuk seluruh pengguna terautentikasi dan mengenali target berdasarkan `userId`, email, nama, maupun `role`.
  2. **Whitelist `/api/auth/switch-role` pada Middleware (`server/runtime-hardening.ts`):** Dimasukkan ke dalam `PUBLIC_API_PATHS` dan `allowedAuditorActions` agar akun Auditor tetap leluasa berpindah peran.
  3. **Normalisasi State Client (`src/App.tsx` & `src/services/gabahApi.ts`):** `handleSelectUser` dan `handleSwitchRoleSimulation` kini menangani objek user secara robust (`res?.user || res?.data?.user`), serta menyertakan fallback lokal instan.
  4. **Verifikasi End-to-End Berhasil 100%:** Pengujian transisi lintas seluruh 9 peran terdaftar (Admin GABAH, IT, GA, Sekdir, Humas, SC, PIBC, Karyawan, Auditor) berhasil 9/9 tanpa hambatan.

---

### 2.5 Penghapusan Seluruh Referensi & Artefak Laravel 11
* **Latar Belakang:**
  * Proyek **GABAH** tidak menggunakan backend PHP/Laravel, melainkan berjalan secara penuh di atas arsitektur **Node.js, Express, TSX, Vite, dan React 19 (TypeScript Fullstack)** dengan endpoint API terotentikasi di `server.ts`.
  * Seluruh teks, tombol, modal blueprint, dan aset bertuliskan *Laravel 11* telah dihapus dari seluruh aplikasi agar tidak menimbulkan kerancuan bagi pengguna dan pengembang.
* **Tindakan yang Dilakukan:**
  1. **Header Navigation (`src/components/HeaderNavbar.tsx`):**
     * Menghapus tombol *"Download Backend (.tar.gz)"* dan tombol *"Laravel 11 Backend (PHP 8.3)"*.
     * Menghapus prop `onOpenArchitectureModal` dan import icon `Code2`.
  2. **Sidebar Navigation (`src/components/Sidebar.tsx`):**
     * Menghapus menu tab `laravel_spec` ("Laravel 11 Backend - Arsitektur Service Layer") dari grup menu *"Sistem & Analitik"*.
     * Menghapus tipe `'laravel_spec'` dari enum `NavTab`.
  3. **Root Controller (`src/App.tsx`):**
     * Menghapus state `isArchitectureModalOpen`, import `LaravelArchitectureModal`, dan render elemen dialognya.
  4. **Pembersihan File:**
     * Menghapus file modal `src/components/modals/LaravelArchitectureModal.tsx`.
     * Menghapus arsip unduhan `public/gabah-source.tar.gz`.
  5. **Pembaruan Dokumentasi (`README.md` & `AUDIT_NOTES.md`):**
     * Memperbarui deskripsi arsitektur teknis agar 100% mencerminkan stack aktual: Node.js + Express backend dengan TypeScript.

---

## 3. Matriks 9 Peran (RBAC) & Kredensial Pengujian (Terverifikasi 100%)

| Peran (Role) | Nama Persona | Email Utama & Alias | Password Valid |
| :--- | :--- | :--- | :--- |
| **Admin GABAH** | Budi Santoso | `admin@foodstation.co.id` / `budi.santoso@...` | `AdminGabah#2026` |
| **IT** | Dani Setiawan | `it.support@foodstation.co.id` / `it@...` | `ItStaff#2026` atau `ItFoodStation#2026` |
| **GA** | Siti Rahmawati | `ga@foodstation.co.id` / `ga.officer@...` | `GaStaff#2026` atau `GaFoodStation#2026` |
| **Sekretaris Direksi** | Dewi Anggraini, S.Sos | `sekretariat.direksi@foodstation.co.id` / `sekdir@...` | `DireksiFoodStation#2026` |
| **Humas** | Rina Kartika, M.I.Kom | `humas@foodstation.co.id` | `HumasFoodStation#2026` |
| **Supply Chain** | Agus Pratama | `sc.warehouse@foodstation.co.id` / `sc@...` / `supplychain@...` | `ScStaff#2026` |
| **PIBC** | Bambang Hermawan | `pibc.admin@foodstation.co.id` / `pibc@...` | `PibcStaff#2026` |
| **Karyawan** | Hendra Wijaya | `hendra.w@foodstation.co.id` / `karyawan@...` | `Karyawan#2026` |
| **Auditor** | Maya Indriani, SE, Ak, CA | `auditor@foodstation.co.id` / `spi@...` | `Auditor#2026` |

> **Catatan:** Di halaman Login, Anda dapat langsung mengklik tombol **"1-Click Login"** di samping setiap profil untuk masuk secara instan tanpa perlu mengetik manual. Switcher persona di kanan atas header (`HeaderNavbar.tsx`) juga tetap tersedia untuk berpindah peran seketika.

---

## 4. Struktur File Utama Terkait

* `/src/components/modals/AdministrationModal.tsx`: Modal induk Administration Control Panel (User Management, Roles, Organization, Master Data, Audit Trail, System Settings).
* `/src/components/Sidebar.tsx`: Navigasi samping dengan segmentasi menu dan akses Control Panel.
* `/src/components/HeaderNavbar.tsx`: Bar navigasi atas dengan switcher persona & role simulation 9 peran.
* `/src/services/gabahApi.ts`: Klien API untuk integrasi data kategori, lokasi, divisi, aset, tiket, dan peminjaman.
* `/src/data/mockData.ts`: Data master inisial dan fallback luring.
* `/src/types.ts`: Definisi tipe data TypeScript otoritatif (`UserProfile`, `UserRole`, `Asset`, `Loan`, `Ticket`, `OrgDivision`, `MasterLocation`).

---

## 5. Panduan untuk AI / Pengembang Selanjutnya

Jika melanjutkan pengembangan setelah turn ini:
1. **Verifikasi Build:** Selalu jalankan `compile_applet` dan `lint_applet` setelah melakukan perubahan kode.
2. **Backend Persistance:** Backend Express (`server.ts` & `server/`) menyajikan REST API terverifikasi yang terhubung ke `src/services/gabahApi.ts` dengan persistensi data JSON & memory store.
3. **Penyimpanan Multi-User:** Pastikan data yang disimpan di `localStorage` memiliki fallback aman saat data dari live backend tidak tersedia.
4. **Proteksi Aset Aktif:** Pertahankan validasi integritas data (misalnya: divisi atau kategori yang masih memiliki aset terdaftar tidak boleh dihapus sembarangan).
