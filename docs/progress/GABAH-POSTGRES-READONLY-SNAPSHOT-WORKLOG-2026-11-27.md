# GABAH Worklog — PostgreSQL Read-only Snapshot Fix

**Date:** 27 November 2026  
**Branch:** `fix/postgres-skip-readonly-state-snapshot`  
**Base:** `main`  
**HEAD:** `3e4d560fc6c73564d97fe908fa201e6021090fdb`

## Ringkasan

Menangani warning `EROFS: read-only file system` ketika aplikasi berjalan dengan PostgreSQL dan Docker `read_only: true`.

## Temuan

- Compose mengaktifkan `read_only: true` pada service aplikasi dan hanya menyediakan tmpfs `/tmp` serta volume uploads.
- PostgreSQL adalah penyimpanan otoritatif ketika konfigurasi PG aktif.
- Jalur startup dan persistensi runtime masih mencoba menulis snapshot JSON lokal setelah/before transaksi PostgreSQL, sehingga menghasilkan warning EROFS yang tidak diperlukan.

## Perubahan

- Menghapus penulisan snapshot lokal pada jalur startup PostgreSQL.
- Menghapus penulisan snapshot lokal setelah transaksi PostgreSQL saat runtime.
- Mempertahankan penyimpanan file pada mode standalone dan fallback development ketika PostgreSQL tidak tersedia saat startup.
- Tidak menonaktifkan `read_only: true`; hardening container tetap dipertahankan.

## File diubah

- `server/persistence.ts`

## Pemeriksaan dan hasil

- Source path ditinjau pada `initializePersistence()` dan `persistDataStore()`.
- Perubahan dibuat dengan pencocokan blok yang harus unik sebelum commit GitHub.
- **Belum dijalankan:** unit test, build, Docker UAT, dan verifikasi bahwa warning EROFS hilang. Jangan tandai PASS sebelum pemeriksaan tersebut selesai.

## Status

- Commit tersedia pada branch kerja di GitHub.
- Belum digabung ke `main`.
- Login UAT masih perlu diverifikasi terpisah; hash password sudah terbukti cocok dengan password UAT di container, tetapi keberhasilan endpoint login belum terbukti.

## Langkah berikutnya

1. Jalankan CI/build dan test yang relevan pada branch ini.
2. Pengguna pull branch ini dan recreate service app saja (tanpa menghapus volume/database).
3. Verifikasi log startup tidak lagi memuat warning EROFS.
4. Lanjutkan diagnosis endpoint login berdasarkan hasil uji terkontrol.
