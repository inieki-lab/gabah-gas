# GABAH-GAS — Branch Consolidation Audit

**Tanggal snapshot:** 2026-11-06  
**Repository:** `inieki-lab/gabah-gas`  
**Base:** `main` @ `07adb964a55cb60a0d49329d9febad7456c97eca`  
**Audit branch:** `fix/phase-1-user-role-audit`  
**Status audit branch sebelum laporan ini:** 12 commits ahead, 0 behind  
**Sifat:** repository review dan rekomendasi konsolidasi; tidak ada merge, deployment, atau perubahan data produksi.

## 1. Ringkasan

Repository memiliki 16 branch (termasuk `main`). Branch tidak boleh digabung secara massal: beberapa branch diverged, beberapa mengubah file yang sama, dan sebagian pekerjaan Stage 13F sudah tercermin di `main`.

Prinsip konsolidasi: pertahankan `main` sebagai baseline; ambil hanya perubahan yang belum ada, setelah diff, migration, dan bukti pengujian diperiksa. Branch audit fase 1 tetap jalur kerja untuk identitas dan assignment user-role.

## 2. Status branch terhadap main

| Branch | Ahead | Behind | Perubahan utama | Rekomendasi |
|---|---:|---:|---|---|
| `fix/phase-1-user-role-audit` | 12 | 0 | Audit assignment, inventory API, Agent Skill, guardrails | Pertahankan sebagai jalur Phase 1 |
| `work/stage-13f-reconciled-main` | 9 | 3 | Maintenance RBAC, CI, migration 020, docs/UAT | Jangan merge langsung; bandingkan per file dengan main |
| `work/stage-13f-maintenance-rbac` | 4 | 5 | Maintenance RBAC, verify script, migration 020 | Banyak tertinggal; ambil hanya delta yang belum ada |
| `work/stage-13e-asset-division-authority` | 2 | 5 | Scope/otorisasi aset per divisi, server services | Review khusus terhadap main; hindari merge branch penuh |
| `work/stage-13c-vendor-rbac` | 5 | 7 | Vendor permission seed dan endpoint | Tertinggal/diverged; cek apakah sudah tercermin di main |
| `work/stage-13b-knowledge-rbac` | 6 | 8 | Knowledge permission seed dan endpoint | Tertinggal/diverged; cek apakah sudah tercermin di main |
| `stage-11-ticket-read-create-rbac` | 10 | 14 | Ticket read/create/update gates, migrations 017/018 | Sangat diverged; jangan merge branch penuh |
| `fix/rbac-sidebar-fail-closed` | 1 | 1 | Sidebar default-deny saat role kosong | Perubahan kecil dan layak review; perlu integrasi terhadap main terkini |
| `fix/contract-migration-fresh-db` | 3 | 1 | Migration 004 + perluasan CI PostgreSQL 17 | Kandidat penting; validasi CI terkini dan migration pada DB fresh/legacy |
| `ci/expand-regression-gates` | 2 | 1 | Perluasan workflow CI | Jangan digabung terpisah sebelum dibandingkan dengan PR #14 |
| `work/antigravity-sync` | 11 | 1 | Docker Compose, env example, audit RBAC, runbook | Review ops terpisah; jangan merge seluruh branch otomatis |
| `docs/uat-readiness-after-stage-13e` | 3 | 4 | Checklist UAT dan status progress | Ambil dokumentasi yang masih relevan saja |
| `docs/record-stage-13f-merged` | 2 | 2 | Changelog/progress Stage 13F | Dokumentasi saja; cek duplikasi dengan main |
| `chore/gabah-finalization-checklist` | 1 | 1 | Finalization plan | Review isi dan gabungkan dokumentasi bila belum ada |
| `dependabot/npm_and_yarn/npm_and_yarn-4b7f2c3562` | 1 | 80 | Update dependency lock/package | Sangat tertinggal; evaluasi ulang versi dependency terhadap main, jangan merge |

## 3. Temuan penting dari pull request

### PR #14 — contract migration fresh PostgreSQL
- Mengubah migration `004_contract_management.sql` agar menangani dua skema awal: fresh schema dengan `owner_division`, dan schema lama dengan `owner_division_id`.
- Backfill legacy dijalankan hanya bila kolom lama tersedia; nilai owner yang tetap NULL diisi `GA`.
- Workflow CI pada PR ini juga menambahkan PostgreSQL 17 service dan serangkaian regresi.
- Patch workflow-nya tumpang tindih dengan PR #13. Perlakukan PR #14 sebagai kandidat konsolidasi yang perlu diuji, bukan menggabungkan #13 dan #14 secara buta.
- Acceptance: migration harus lulus pada database kosong dan database legacy representatif; CI harus benar-benar selesai PASS.

### PR #13 — regression CI
- Memperluas CI dengan PostgreSQL 17 service, tes persistence/reminder, loan, meeting room, organisasi, master aset, menu connectivity, dan maintenance authorization.
- Perubahan workflow tumpang tindih dengan PR #14.
- Jangan mengklaim lulus hanya karena workflow sudah didefinisikan; periksa run untuk HEAD terbaru dan setiap langkah.

### PR #15 — sidebar fail-closed
- Menghapus fallback role kosong menjadi `Admin GABAH`; menu tidak ditampilkan bila identitas role tidak tersedia.
- Perubahan frontend ini baik sebagai default-deny untuk navigasi, tetapi bukan pengganti otorisasi backend.
- Branch diverged 1/1 terhadap main; perlu rebase/cherry-pick terkontrol dan regresi role sebelum merge.

### PR #11 — Docker Compose / Antigravity sync
- Memperbaiki instalasi dependency build, validasi password PostgreSQL fail-fast, healthcheck database, dan startup dependency.
- Tidak ada Dockerfile dalam perubahan yang diaudit; jangan menyatakan image Docker telah dibangun hanya berdasarkan perubahan Compose.
- Validasi `docker compose config` dan startup nyata tetap perlu dijalankan di lingkungan Docker target. PostgreSQL live integration dan UAT pengguna tetap gerbang terpisah.

## 4. Stage 13F: jangan menduplikasi pekerjaan yang sudah ada

Pemeriksaan langsung pada `main` menunjukkan:
- `server/migrations/020_dynamic_rbac_maintenance_permissions_seed.sql` sudah ada dan identik dengan file pada `work/stage-13f-maintenance-rbac`.
- Route `GET/POST/PATCH /api/maintenances` di `main` sudah memiliki Dynamic RBAC permission gates dan pemeriksaan division authority yang sesuai dengan implementasi Stage 13F.
- Dengan demikian, branch Stage 13F tidak boleh diperlakukan sebagai fitur yang belum ada. Delta branch yang masih tersisa harus diperiksa satu per satu (terutama workflow CI, package scripts, verify script, progress docs, dan services).

Perbandingan `work/stage-13f-reconciled-main` dengan `work/stage-13f-maintenance-rbac` menunjukkan keduanya diverged (11 ahead / 4 behind dari perspektif reconciled terhadap maintenance). Jangan memilih branch hanya dari namanya; bandingkan patch terhadap `main`.

## 5. Risiko integrasi yang harus dijaga

1. `server.ts`, `server/services.ts`, `scripts/dynamic-rbac-foundation-verify.mjs`, `package.json`, dan `.github/workflows/ci.yml` disentuh oleh beberapa branch. Integrasi harus dilakukan per file/per commit dengan regression checks.
2. Migration bernomor 017–020 harus diperiksa terhadap daftar migration yang sudah diterapkan di main dan urutan migration runner. Jangan mengubah nomor atau mengulang seed tanpa memeriksa idempotensi.
3. Permission seed harus mencerminkan kebijakan bisnis yang disetujui, bukan sekadar menyalin asumsi dari nama role.
4. Tes file-store tidak membuktikan enforcement PostgreSQL. Tes static contract juga tidak membuktikan persistence/runtime.
5. Sidebar/menu visibility bukan otorisasi. Setiap endpoint harus tetap menerapkan pemeriksaan backend dan object/division scope.
6. Tidak ada perubahan role user produksi dalam audit ini.

## 6. Urutan konsolidasi yang direkomendasikan

1. **Phase 1 identity & user-role** — lanjutkan branch `fix/phase-1-user-role-audit`; selesaikan inventory assignment, kontrak `/api/auth/me`, kontrol endpoint user, dan UI assignment Superadmin.
2. **CI + migration** — review PR #14 sebagai satu kandidat yang mencakup migration fresh/legacy dan workflow CI; pastikan run CI HEAD terbaru PASS.
3. **Sidebar fail-closed** — integrasikan perubahan PR #15 setelah pemeriksaan frontend dan role tanpa identitas.
4. **Stage 13 RBAC** — audit delta knowledge/vendor/asset scope/maintenance terhadap `main`; jangan merge branch Stage secara utuh bila fungsinya sudah ada.
5. **Docker/deployment** — review PR #11 terpisah; validasi compose, startup, backup/restore, staging dan rollback.
6. **UI per role dan UAT** — setelah kontrak role stabil, audit sidebar, route/landing page, forms, CRUD, approval, dan uji menggunakan akun per role.

## 7. Batas verifikasi snapshot ini

- Branch counts dan file stats berasal dari GitHub compare terhadap `main` pada 2026-11-06.
- Isi migration 020 dan route maintenance dibaca langsung dari `main` dan branch Stage 13F.
- Patch PR #11, #13, #14, #15, dan #3 diperiksa.
- Audit ini tidak menjalankan build, lint, CI, browser, PostgreSQL, atau UAT. Tidak ada klaim bahwa tes lulus.
- Status merge/CI terkini untuk semua PR harus diperiksa kembali sebelum tindakan integrasi.
