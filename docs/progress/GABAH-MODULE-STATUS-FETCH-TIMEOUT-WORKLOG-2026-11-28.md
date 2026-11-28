# GABAH Module Status Fetch Timeout Worklog

**Tanggal:** 28 November 2026  
**Repository:** `inieki-lab/gabah-gas`  
**Base:** `main`  
**Branch:** `fix/module-status-fetch-timeout-2026-11-28`  
**Status:** IMPLEMENTED — exact-head CI pending; browser UAT pending.

## Temuan terkonfirmasi

- `App.tsx` menunggu `gabahApi.getModules()` sebelum mengisi `activeModuleKeys`.
- Sidebar hanya menampilkan menu jika `activeModuleKeys` tersedia dan memuat key modul terkait.
- `refreshModuleStatuses()` baru menandai gagal ketika Promise API reject.
- `GabahApiClient.request()` menggunakan `fetch()` tanpa timeout atau AbortSignal default.
- Jika request `GET /api/modules` menggantung tanpa resolve/reject, UI dapat terus berada pada `activeModuleKeys === null` dan menampilkan “Memuat status modul…” tanpa pernah menampilkan tombol retry.
- PR #345 menangani race antara restore session dan login; PR tersebut tidak memberi batas waktu pada request module registry. Ini jalur kegagalan berbeda.

## Perbaikan

- `getModules()` membuat `AbortController` dan timeout 12 detik.
- Abort signal diteruskan ke request `/api/modules`.
- Timeout diterjemahkan menjadi pesan Indonesia yang dapat ditindaklanjuti.
- Timer selalu dibersihkan pada blok `finally`.
- App yang sudah ada akan menangkap timeout, tetap fail-closed (tidak menampilkan menu tanpa status modul terverifikasi), menampilkan “Status modul tidak dapat diverifikasi”, dan menyediakan tombol “Coba lagi”.
- Tambah `scripts/module-status-timeout-verify.mjs`, npm script, dan CI step.

## File berubah

- `src/services/gabahApi.ts`
- `scripts/module-status-timeout-verify.mjs`
- `package.json`
- `.github/workflows/ci.yml`
- Dokumen worklog ini.

## Validasi

- Source inspection App → API client → Sidebar gating: DONE.
- Regression contract untuk AbortController, 12-second timeout, abort signal, error message, timer cleanup, fail-closed state, dan retry: ADDED.
- Local npm execution, TypeScript/build, Docker runtime, and browser UAT: NOT RUN.
- Exact-head GitHub Actions CI: PENDING.
- UAT wajib: normal fast response, API 503, network disconnect, request hang >12 seconds, then retry after server recovery. Confirm app no longer stays indefinitely on “Memuat status modul…”.

## Safety

- No permission grants, module activation flags, user roles, database, migration, or operational data changed.
- The UI continues to fail closed when module registry cannot be verified.
- No merge to `main` without explicit owner approval.
