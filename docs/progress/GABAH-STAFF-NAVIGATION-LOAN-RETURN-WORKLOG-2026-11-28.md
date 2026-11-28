# GABAH Staff Navigation — Own-Loan Return Capability Worklog

**Tanggal:** 2026-11-28  
**Repository:** `inieki-lab/gabah-gas`  
**Base:** `main` @ `4f10d7a3aada9f41cd9e6cd2abe980b52054839e`  
**Branch:** `fix/staff-navigation-loan-return-capability-2026-11-28`  
**Status:** IMPLEMENTATION COMMITTED — exact-head CI pending; browser UAT not run.

## Temuan

- Migration `server/migrations/024_dynamic_rbac_core_operational_permissions.sql` memberikan `loans.return` kepada profil fungsi `karyawan` sebagai bagian dari employee self-service.
- Hak tersebut memungkinkan peminjam mengembalikan pinjamannya sendiri; ia bukan bukti bahwa pegawai menjadi operator/custodian peminjaman.
- `src/navigation/roleNavigation.ts` memasukkan `loans.return` ke `OPERATIONAL_NAVIGATION_PERMISSIONS`. Akibatnya `isStaffNavigationPersona('Karyawan', permissionKeys)` mengembalikan `false` untuk pegawai biasa yang memiliki grant pengembalian pinjaman.
- `DashboardView` tidak memasukkan `loans.return` ke daftar operational-management permissions, sehingga akun yang sama diklasifikasikan sebagai dashboard staf tetapi Sidebar sebagai “Operasional Utama”. Ini inkonsistensi label/persona UI; bukan bypass otorisasi backend.

## Perubahan

- Menghapus `loans.return` dari daftar permission yang mengubah persona staf menjadi persona operasional.
- Mempertahankan `loans.approve`, `loans.reject`, dan `loans.handover` sebagai permission operasional/custodian.
- Menambah regression checks:
  - Karyawan dengan `dashboard.read + loans.return` tetap persona staf.
  - Karyawan dengan `dashboard.read + loans.approve` tetap persona operasional.
- Tidak mengubah permission grant, route, service backend, database, migration, atau data pengguna.

## File yang diubah

- `src/navigation/roleNavigation.ts`
- `scripts/navigation-policy-verify.ts`
- Dokumen worklog ini.

## Validasi

| Pemeriksaan | Status |
|---|---|
| Source inspection migration 024 | DONE — grant `loans.return` termasuk employee baseline |
| Cross-check DashboardView vs Sidebar persona logic | DONE — dua daftar sebelumnya tidak konsisten |
| Regression assertions ditambahkan | DONE |
| Eksekusi lokal `npm run test:navigation-policy` | NOT RUN — tidak ada checkout/runtime repository pada sesi ini |
| TypeScript/build | NOT RUN |
| Exact-head GitHub Actions CI | PASS — run #3939 / 46113074821, exact head `fec5c4a9f546daed4dfe35de73a5824021443e2d`; all 116 verification steps succeeded, including lint, navigation policy, dashboard scope, production build, Docker runtime smoke, PostgreSQL integration, P0 HTTP security, loan and ticket checks |
| Browser UAT lintas persona | NOT RUN |



## Audit lanjutan — Dashboard dan Sidebar harus memakai satu sumber persona

### Temuan baru
- Setelah mengeluarkan `loans.return` dari capability operasional, ditemukan drift lain: Sidebar menganggap `room_reservations.checkin` dan `room_reservations.checkout` sebagai kemampuan operasional, tetapi Dashboard memiliki daftar hard-coded terpisah yang tidak memuat dua permission tersebut.
- Akibatnya, akun custom yang hanya diberi tugas check-in/check-out dapat diberi label “Operasional Utama” di Sidebar tetapi masih menerima klasifikasi dashboard staf.
- Ini bukan perubahan hak akses; masalahnya klasifikasi persona UI yang tidak konsisten.

### Perbaikan tambahan
- Ekspor `OPERATIONAL_NAVIGATION_PERMISSIONS` sebagai sumber capability bersama dari `roleNavigation.ts`.
- Dashboard sekarang memakai daftar yang sama dengan Sidebar; daftar permission duplikat di Dashboard dihapus.
- Tambah regression assertions untuk:
  - `assets.lifecycle` tetap operasional.
  - `room_reservations.checkin` dan `room_reservations.checkout` tetap operasional.
  - `loans.return` tetap self-service dan bukan capability operasional.
  - Dashboard menggunakan shared list dan tidak memelihara daftar kedua.
- Ini mencegah daftar permission Dashboard dan Sidebar drift lagi ketika permission baru ditambahkan.

### File tambahan yang berubah
- `src/components/views/DashboardView.tsx`
- `scripts/navigation-policy-verify.ts`
- `src/navigation/roleNavigation.ts` (export shared capability list)

### Validation update
- Source-level mismatch terkonfirmasi pada baseline main: Dashboard list tidak memiliki dua room check-in/out grants yang ada pada Sidebar list.
- Regression assertions ditambahkan; exact-head CI untuk perubahan tambahan ini harus berjalan.
- Browser UAT untuk Karyawan, room operator, IT, GA, dan Humas tetap belum dilakukan.

## Batasan dan risiko

- Perubahan hanya mengubah label/kelompok navigasi di Sidebar; tidak menambah atau mengurangi hak akses.
- Backend tetap menentukan apakah aktor boleh mengembalikan pinjaman milik sendiri atau pinjaman milik orang lain melalui permission dan owner scope.
- Verifikasi browser masih diperlukan untuk memastikan Sidebar dan Dashboard menampilkan persona staf secara konsisten pada akun Karyawan yang memiliki grant `loans.return`.
- Tidak ada database, volume, akun, role assignment, permission assignment, atau data operasional yang diubah.

## Next

1. Exact-head CI #3939 telah lulus (116/116 steps); pertahankan hasil ini sebagai bukti otomatis, bukan pengganti browser UAT.
2. Jika CI lulus, pertahankan PR Draft sampai browser UAT Karyawan dan operator IT/GA dilakukan.
3. Lanjutkan audit form/action callback pada seluruh view tanpa menunggu CI jalur ini.
4. Jangan merge ke `main` tanpa persetujuan eksplisit pemilik proyek.


## CI feedback — dashboard summary regression expectation updated

- CI #3991 (run ID `46127969300`) failed at `test:dashboard-owner-summary`.
- Failure was a stale source assertion expecting Dashboard's old duplicated `operationalManagementPermissions` array. The implementation intentionally removes that duplicate and imports `OPERATIONAL_NAVIGATION_PERMISSIONS` from the shared navigation policy.
- Updated `scripts/dashboard-owner-summary-verify.mjs` to assert the shared capability list is imported and used.
- This was a regression-test expectation mismatch, not a TypeScript or runtime failure.
- New exact-head CI is required after this test correction.
