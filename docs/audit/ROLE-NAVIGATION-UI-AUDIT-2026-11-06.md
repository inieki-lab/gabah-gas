# GABAH-GAS — Role Navigation & User Administration UI Audit

**Tanggal:** 2026-11-06  
**Branch:** `fix/phase-1-user-role-audit`  
**Scope:** Sidebar, App shell/tab rendering, AdministrationModal user management, Dynamic RBAC assignment UI.  
**Sifat:** repository review; bukan UAT browser dan bukan pengujian runtime.

## 1. Temuan terkonfirmasi

### 1.1 User Management masih mengubah role legacy tunggal

`src/components/modals/AdministrationModal.tsx`:
- Form tambah user menyimpan satu `newUserData.role` dari `SYSTEM_ROLES`.
- Form edit user menyimpan satu `editUserData.role`.
- Handler create/update meneruskan nilai tersebut ke callback user management.
- Import CSV juga memuat kolom role tunggal.
- Bagian Dynamic Role Management mengelola definisi role, permission, dan scope, tetapi belum menyediakan assignment Dynamic RBAC ke user.

Backend/API client:
- `GET /api/admin/rbac/user-assignments` tersedia dan dilindungi Superadmin.
- `PUT /api/admin/rbac/users/:id/roles` tersedia untuk mengganti set role dinamis secara transaksional.
- `gabahApi.getRbacUserAssignments()` dan `gabahApi.setRbacUserRoles()` tersedia.
- AdministrationModal belum memanggil dua API tersebut. Dengan demikian, user-role assignment UI belum selesai.

**Risiko:** administrator dapat mengira mengubah dropdown role pada user editor sudah mengubah Dynamic RBAC. Saat ini keduanya adalah model berbeda. UI harus menampilkan legacy role dan dynamic assignments secara terpisah sampai kontrak migrasi/kompatibilitas ditetapkan.

### 1.2 Matriks menu Sidebar saat audit

Sumber: `src/components/Sidebar.tsx`. Ini adalah allowlist tampilan legacy, bukan bukti otorisasi backend.

| Menu | Role yang ditampilkan |
|---|---|
| Dashboard | Semua 9 role canonical |
| Aset Saya | Semua 9 role canonical |
| Ruang Rapat | Semua 9 role canonical |
| Peminjaman Barang | Semua 9 role canonical |
| Helpdesk & Tiket | Semua 9 role canonical |
| Aset | Admin GABAH, IT, GA, Supply Chain, PIBC, Sekretaris Direksi, Humas, Auditor |
| Maintenance | Semua 9 role canonical |
| Software & SaaS | Admin GABAH, IT, Auditor |
| Vendor Rekanan | Admin GABAH, IT, GA, Supply Chain, PIBC, Auditor |
| Contract Management | Admin GABAH, IT, GA, Supply Chain, PIBC, Sekretaris Direksi, Humas, Auditor |
| Knowledge Base | Semua 9 role canonical |
| Laporan & Audit | Admin GABAH, IT, GA, Supply Chain, PIBC, Auditor |

Catatan:
- Menu Maintenance ditampilkan ke seluruh role, walaupun create/update endpoint hanya memberi jalur legacy kepada Admin GABAH, IT, dan GA. Tampilan menu tidak menjelaskan hak baca/tulis secara eksplisit.
- Humas masih mendapat menu Aset dan Aset Saya pada konfigurasi Sidebar, tetapi App shell memiliki redirect khusus untuk Humas dari kedua tab tersebut ke Ruang Rapat. Ini menunjukkan aturan role tersebar di dua tempat.
- Sekretaris Direksi dan Humas mendapat Contract Management; kebutuhan bisnis dan tingkat akses dokumen perlu dikonfirmasi.
- Supply Chain dan PIBC mendapat Vendor, Contract, Asset, dan Maintenance. Cakupan data harus tetap dibatasi backend berdasarkan divisi/scope.

### 1.3 App shell belum menunjukkan satu guard terpusat untuk semua tab

`src/App.tsx`:
- Portal menggunakan state `currentTab` dan merender view melalui conditional render untuk dashboard, my assets, meeting rooms, assets, maintenance, loans, tickets, licenses, vendors, knowledge, reports, dan contracts.
- Tidak ditemukan satu fungsi pusat yang memvalidasi `currentUser.role`/permission sebelum setiap view dirender.
- Ada redirect khusus Humas untuk tab `my_assets` dan `assets`; aturan tersebut tidak membentuk matriks route/permission umum.
- Karena Sidebar hanya mengatur navigasi, backend wajib tetap memeriksa setiap API. Namun, frontend perlu route/tab guard konsisten agar tab yang tidak berhak tidak dapat tertinggal/terbuka melalui state atau navigasi lain.

### 1.4 Fail-closed Sidebar sudah diterapkan pada branch kerja

Commit `701ac750dda924e9fa69a9cc7c76eeb732a73e8d`:
- Menghapus fallback role kosong menjadi `Admin GABAH`.
- Filter menu sekarang menghasilkan daftar kosong bila identitas role tidak tersedia.

Commit `0a28c6b8a0caafae3ce4fcb9e740f8dc3bfe34c8`:
- Menambah dua static contract checks ke `scripts/dynamic-rbac-foundation-verify.mjs` untuk memastikan fallback Admin tidak kembali dan filter menu fail-closed.

Status pengujian: perubahan belum dijalankan melalui lint/build/CI pada audit ini. Static checks telah ditambahkan, tetapi belum diklaim PASS.

## 2. Rencana perbaikan berurutan

1. **Selesaikan identitas dan assignment user-role**
   - Buat panel assignment terpisah di User Management.
   - Tampilkan legacy role, dynamic roles, status aktif, dan role Superadmin secara eksplisit.
   - Pilih user, pilih satu atau lebih role dinamis aktif, lalu simpan menggunakan endpoint assignment.
   - Jelaskan bahwa penyimpanan mengganti seluruh set dynamic role user.
   - Refresh inventory setelah berhasil; tampilkan loading/error/empty/validation state.
   - Jangan diam-diam mengubah legacy `users.role` ketika mengubah Dynamic RBAC.

2. **Tetapkan satu katalog kebijakan menu**
   - Setiap menu memiliki: role/permission untuk melihat, permission untuk membuat, mengubah, menyetujui, menghapus, serta scope data.
   - Bedakan akses menu, akses halaman, dan akses API.
   - Jangan mengasumsikan semua orang yang bisa membaca dapat mengubah atau menyetujui.

3. **Tambahkan route/tab guard**
   - Gunakan satu policy helper untuk memutuskan akses tab.
   - Jalankan guard saat tab berubah dan saat identitas user berubah.
   - Bila akses ditolak, arahkan ke landing page yang sah dan beri pesan yang jelas.
   - Backend tetap sumber otorisasi final.

4. **Susun landing page per role setelah kebijakan disetujui**
   - Dashboard bukan sekadar mengganti judul; konten, tindakan utama, antrean, dan shortcut harus relevan dengan pekerjaan role.
   - Jangan menambah menu baru sebelum fungsi menu yang ada dibuktikan berjalan.

5. **Uji akun per role**
   - Minimal: Superadmin, IT, GA, Supply Chain, PIBC, Karyawan, Auditor, Sekretaris Direksi, Humas.
   - Uji akun tanpa role, role tidak aktif, multi-role, dan role custom.
   - Uji menu, tab langsung, API read/write, scope lintas divisi, dan approval.

## 3. Hal yang tidak boleh dilakukan

- Jangan menganggap label jabatan/divisi otomatis menjadi permission.
- Jangan menyamakan legacy `users.role` dengan `gabah_user_roles`.
- Jangan menghapus localStorage `gabah_role_permissions` sebelum seluruh pembacaan/penulisannya ditelusuri dan penggantinya diuji.
- Jangan menganggap menyembunyikan menu sudah mengamankan endpoint.
- Jangan mengubah assignment user produksi sebelum inventory, mapping, backup/export, dan rollback plan disetujui.

## 4. Batas audit

- Pemeriksaan berbasis source GitHub pada branch kerja.
- Tidak ada browser automation, login akun role, PostgreSQL live, lint, build, atau UAT yang dijalankan pada sesi audit ini.
- Daftar menu adalah konfigurasi Sidebar, bukan hasil pengamatan UI live.
