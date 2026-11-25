# GABAH — Standar Pengujian Terpadu (Single Test Method)

**Status:** Standar kerja pengujian untuk Development, CI, UAT, dan Release; bukan bukti bahwa seluruh skenario sudah dijalankan  
**Runtime wajib:** Docker Compose + PostgreSQL 17  
**URL default:** http://localhost  
**Prinsip:** satu build, satu runtime, satu database UAT, satu matriks role/menu, satu bukti hasil.

Dokumen ini menjadi acuan utama untuk menyatukan pengujian. Baca [Documentation Authority & AI Handoff Guide](../GABAH-DOCUMENTATION-CONTROL.md) untuk aturan status kebenaran, sinkronisasi spesifikasi, dan bukti yang wajib disertakan. Skenario rinci bisnis tetap berada di [UAT.md](./UAT.md), sedangkan workflow CI adalah pemeriksaan otomatis yang berjalan pada Pull Request.

## 1. Aturan lingkungan tunggal

Semua pengujian yang menyentuh aplikasi berjalan melalui Docker Compose. Dilarang mencampur server Node/TSX di host dengan PostgreSQL di container.

| Komponen | Kontrak tunggal |
|---|---|
| Browser | `http://localhost` (host port default 80) |
| Aplikasi | container `gabah_app`, port internal 3000 |
| Database | container `gabah_database`, PostgreSQL 17 |
| Koneksi aplikasi → DB | `database:5432` pada jaringan Compose |
| Persistensi | named volume PostgreSQL dan uploads |
| Health | `GET /api/health` harus sehat dan menyatakan PostgreSQL sebagai persistence aktif |

Perintah standar laptop/UAT:

```bash
# Jalankan dari root repository
docker compose config --quiet
docker compose up -d --build
docker compose ps
docker compose logs --tail=200 app
```

Buka `http://localhost`. Periksa status container dan healthcheck sebelum mulai tes. Untuk berhenti gunakan `docker compose down`; jangan gunakan `docker compose down -v` karena menghapus data database dan uploads.

Jangan mengubah `PGHOST=database` atau `PGPORT=5432` di konfigurasi internal aplikasi. Bila port host bentrok, ubah hanya `GABAH_WEB_PORT` atau `GABAH_DB_PORT`.

## 2. Lapisan pengujian — wajib berurutan

| Tahap | Apa yang diperiksa | Bukti lulus |
|---|---|---|
| A. Static & build | TypeScript, frontend build, server bundle | `npm run lint` dan `npm run build` lulus |
| B. CI automated | regresi RBAC, scope, migrasi, keamanan, modul, API, runtime Docker | seluruh job workflow CI hijau |
| C. Runtime smoke | image production, koneksi PostgreSQL, health, upload/persistensi | smoke test CI lulus; runtime lokal sehat |
| D. UI inventory | seluruh menu dan submenu yang benar-benar tampil | setiap menu dapat dibuka; tidak blank, crash, error console, atau loading tanpa akhir |
| E. Persona & permission | login setiap akun uji dan pemeriksaan hak akses | menu, halaman, API, data scope, dan aksi sesuai matriks |
| F. Workflow bisnis | create, edit, submit, approve/reject, close, export bila tersedia | data dan status benar; audit trail tercatat |
| G. Negative/security | akses tanpa token, lintas role/scope, ID spoofing, mutasi terlarang | server menolak dengan 401/403/404 sesuai kebijakan |
| H. Regression & release | ulangi skenario terdampak setelah perbaikan | tidak ada regresi; seluruh bukti tercatat sebelum merge |

**Penting:** CI hijau bukan bukti UAT UI selesai. Merge ke `main` hanya setelah tahap A–H yang relevan lulus dan tidak ada defect P0/P1 terbuka.

## 3. Persona dan cakupan akun uji

Dynamic RBAC tidak memiliki daftar role bisnis tertutup. Akun/email seed berikut hanyalah fixture historis untuk lingkungan uji; bukan daftar role kanonis, HR roster, atau dasar assignment produksi. Verifikasi akun dan grant aktual di database sebelum menyatakan lulus. Selain seed fixture, UAT wajib mencakup Karyawan di HO/RPC/PIBC, ME/Perawatan, GA read-only Laptop/PC IT dengan grant khusus, capability Humas/Sekretariat, Auditor, dan setidaknya satu custom role.

| Persona | Akun | Fokus pengujian |
|---|---|---|
| Superadmin | `admin@foodstation.co.id` | seluruh Administration, user/role, master, konfigurasi, audit |
| IT Support | `it.support@foodstation.co.id` | aset IT lintas lokasi, tiket IT, pemeliharaan IT, tugas IT |
| GA | `ga@foodstation.co.id` | aset GA, sarpras, peminjaman/approval sesuai kewenangan; hanya baca PC/laptop IT bila grant aktif |
| Sekretariat Direksi | `sekretariat.direksi@foodstation.co.id` | fungsi pegawai + capability sekretariat dan reservasi VIP sesuai grant |
| Humas | `humas@foodstation.co.id` | fungsi pegawai + capability dokumentasi/notifikasi Humas |
| Pegawai RPC (legacy fixture) | `sc.warehouse@foodstation.co.id` | fungsi pegawai; office location RPC (legacy code SC) bukan role atau owner scope |
| Pegawai PIBC (legacy fixture) | `pibc.admin@foodstation.co.id` | fungsi pegawai; office location PIBC bukan role atau owner scope |
| Pegawai umum | `hendra.w@foodstation.co.id` | layanan mandiri, aset milik sendiri, tiket, permohonan |
| Auditor | `auditor@foodstation.co.id` | baca sesuai scope audit; seluruh mutasi ditolak |

Password tidak boleh dicantumkan di dokumen, log, screenshot, atau commit. Pada Docker Compose, app berjalan dengan `NODE_ENV=production`; karena itu `GABAH_TEST_PASSWORD` memang diabaikan dan tidak boleh dijadikan cara login UAT. Untuk database UAT baru, isi `GABAH_INITIAL_ADMIN_PASSWORD` dan `GABAH_INITIAL_USER_PASSWORD` sebelum boot pertama. Password awal hanya mengisi akun yang belum punya hash dan tidak mereset akun lama. Untuk database UAT yang sudah berisi akun, login dengan kredensial yang berlaku lalu gunakan fitur reset password resmi dari Superadmin untuk menyiapkan password UAT bagi akun uji. Jangan hapus volume atau menimpa kredensial tanpa backup dan persetujuan. Jangan menyalin akun/password production ke UAT.

## 4. Model organisasi yang harus dipertahankan saat tes

- Role aplikasi, jabatan/level, unit/divisi, dan lokasi kerja adalah atribut berbeda.
- RPC dan PIBC adalah unit/lokasi, bukan role permanen; SC hanya kode legacy.
- Lokasi aktif yang perlu tersedia: HO, PIBC, RPC, Pangsub, dan Kantor Perawatan. Subang nonaktif.
- Owner aset tidak sama dengan lokasi fisik. Aset IT tetap owner IT meski berada di PIBC/RPC.
- IT mengelola aset IT lintas lokasi. GA mengelola aset GA; akses baca ke PC/laptop IT hanya jika permission/scope khusus diberikan, tanpa hak mutasi.
- Sekdir dan Humas adalah pegawai dengan capability tambahan, bukan pengganti role primer pegawai.
- Auditor harus tetap read-only walaupun role tambahan lain dimiliki.
- Superadmin memiliki akses administrasi penuh.

## 5. Pemeriksaan semua menu — metode inventory

Untuk **setiap akun**:

1. Login dari browser baru/private window atau logout penuh dari sesi sebelumnya.
2. Catat role primer, role tambahan, unit, jabatan, lokasi, dan status akun yang ditampilkan.
3. Ambil daftar seluruh menu dan submenu yang tampil pada sidebar, dashboard shortcut, header, dan menu konteks.
4. Buka setiap menu satu per satu. Catat URL/route, hasil render, tombol/aksi, dan apakah data sesuai scope.
5. Uji refresh langsung pada route, navigasi back/forward, dan buka ulang setelah logout/login.
6. Untuk setiap tombol yang mengubah data, lakukan tes pada data UAT yang memang disediakan; jangan mengubah data produksi.
7. Uji endpoint terkait secara langsung. Menyembunyikan tombol/menu di UI tidak cukup sebagai kontrol keamanan.
8. Ulangi dengan akun yang tidak berhak untuk memastikan akses ditolak oleh backend.
9. Catat bukti: akun/role, menu, langkah, hasil aktual, hasil yang diharapkan, waktu, screenshot/log bila ada, dan status PASS/FAIL/BLOCKED.

Jangan mengasumsikan nama menu dari dokumen lama. Daftar menu aktual yang ditemukan di build saat ini menjadi inventory; menu yang tidak muncul dicatat sebagai tidak tersedia, bukan dianggap lulus.

## 6. Matriks akses minimum per persona

| Area | Superadmin | IT | GA | Pegawai umum | Sekdir | Humas | Auditor |
|---|---|---|---|---|---|---|---|
| Dashboard | penuh | sesuai scope IT | sesuai scope GA | personal | personal + capability | personal + capability | read-only scope audit |
| User, role, organisasi, master admin | kelola | tolak | tolak | tolak | tolak | tolak | baca hanya bila diizinkan |
| Aset IT | penuh | kelola lintas lokasi | baca PC/laptop IT bila grant; tanpa mutasi | aset yang ditugaskan sendiri | sesuai grant | sesuai grant | baca scope audit |
| Aset GA | penuh | tolak kecuali grant | kelola | aset sendiri bila ditugaskan | sesuai grant | sesuai grant | baca scope audit |
| Tiket IT | penuh | tangani sesuai assignment | buat/lihat milik sendiri | buat/lihat milik sendiri | buat/lihat milik sendiri | buat/lihat milik sendiri | baca scope audit |
| GA/maintenance/peminjaman | penuh | hanya bila grant | kelola sesuai kewenangan | ajukan/lihat milik sendiri | ajukan sesuai capability | sesuai grant | baca scope audit |
| Ruang rapat/VIP | penuh | fasilitas tugas IT | fasilitas tugas GA | reservasi sesuai policy | capability reservasi VIP | notifikasi/dokumentasi sesuai tugas | baca scope audit |
| Kontrak/vendor | penuh | scope pemilik/PIC | scope pemilik/PIC | tolak kecuali grant | tolak kecuali grant | tolak kecuali grant | read-only scope audit |
| Audit trail | kelola | tolak | tolak | tolak | tolak | tolak | baca sesuai scope |

Matriks ini adalah **baseline kebijakan untuk diverifikasi**, bukan alasan untuk memberi permission secara otomatis. Permission/scope efektif yang disetujui dan tersimpan di PostgreSQL tetap menjadi sumber otoritatif. Jika implementasi aktual berbeda dari baseline, catat sebagai defect atau keputusan bisnis yang perlu disahkan.

## 7. Workflow bisnis yang harus dites end-to-end

Untuk setiap modul yang aktif pada role terkait, jalankan alur berikut bila fiturnya tersedia:

- **Aset:** buat → baca detail → edit → assign → tampil di Aset Saya → unassign/relokasi → riwayat movement dan audit.
- **Peminjaman:** ajukan → validasi ketersediaan → approval/reject → serah terima/BAST → pengembalian → uji tabrakan jadwal.
- **Helpdesk:** buat tiket → routing ke petugas yang benar → terima/proses → komentar/catatan solusi → resolve/close → SLA dan notifikasi.
- **Maintenance:** jadwalkan → tugaskan PIC/vendor → proses → isi hasil/biaya → selesai → riwayat.
- **Ruang rapat:** ajukan reservasi → approval sesuai policy → notifikasi tiap divisi penerima tugas → perubahan/pembatalan → audit.
- **Kontrak/vendor:** buat → lampirkan dokumen → akses sesuai owner/PIC → reminder → renewal/expired → linked ticket → audit.
- **Administration:** buat/nonaktifkan user → assignment role primer/tambahan → perubahan scope → reset password → audit log → verifikasi persistensi setelah restart.
- **Module lifecycle:** aktif/nonaktifkan modul untuk role/user → menu ikut policy → API ikut menolak akses → data tetap aman dan tidak terhapus.

Untuk setiap workflow, tes happy path, validasi input salah, aksi tanpa izin, data lintas scope, double-submit/concurrency bila relevan, dan persistensi setelah app restart.

## 8. Format pencatatan hasil

Gunakan status berikut, jangan mengubah BLOCKED menjadi PASS:

- **PASS:** hasil aktual sama dengan ekspektasi dan ada bukti.
- **FAIL:** hasil aktual salah atau ada error.
- **BLOCKED:** tidak bisa diuji karena prasyarat/data/provider belum tersedia.
- **N/A:** tidak berlaku untuk persona/modul tersebut, dengan alasan.

Template catatan:

| Tanggal/build | Akun & role | Menu/workflow | Langkah | Expected | Actual | Bukti | Status | Issue |
|---|---|---|---|---|---|---|---|---|

Setiap defect harus memuat severity, cara reproduksi, akun/role, route/API, expected vs actual, bukti, dugaan area kode, dan regression test yang ditambahkan.

Severity:
- **P0:** bypass autentikasi/otorisasi, kebocoran data sensitif lintas user, kehilangan/korupsi data kritis.
- **P1:** workflow inti tidak bisa dipakai, role salah akses, approval salah, aplikasi crash/blank pada fungsi utama.
- **P2:** fungsi sekunder rusak atau hasil tidak konsisten dengan workaround terbatas.
- **P3:** kosmetik/teks/layout tanpa dampak fungsi atau keamanan.

## 9. Gerbang release

PR hanya dapat dipromosikan jika:

- [ ] CI seluruh job hijau pada commit yang akan digabung.
- [ ] Build dan Docker runtime smoke lulus.
- [ ] PostgreSQL aktif; health endpoint tidak memakai fallback file.
- [ ] Tidak ada P0/P1 terbuka.
- [ ] Semua menu yang relevan telah di-inventory dan dibuka untuk persona terkait.
- [ ] Semua endpoint diuji untuk akses yang diizinkan dan ditolak.
- [ ] Workflow inti tiap modul aktif lulus.
- [ ] Data bertahan setelah restart container.
- [ ] Tidak ada fake-success, error console kritis, blank page, atau route macet.
- [ ] UAT dicatat dengan build/commit yang tepat dan disetujui pemilik proses.
- [ ] Rollback dan backup volume/database dipahami sebelum deployment.

CI hijau hanya membuktikan job otomatis yang tercantum di workflow. Integrasi provider eksternal (SMTP/Telegram), browser UI manual, dan proses bisnis yang membutuhkan keputusan pemilik proses harus tetap diberi status BLOCKED/menunggu bukti bila belum diuji.

## 10. Catatan implementasi saat ini

Workflow CI yang ada sudah menjalankan pemeriksaan TypeScript, build, Docker image/runtime smoke, PostgreSQL fresh database/persistence, P0 security, RBAC/navigation/dashboard, asset scope, user administration, module lifecycle, ticket, loan, meeting room, maintenance, contract, dan integrity regressions. Daftar aktual job berada di `.github/workflows/ci.yml`; dokumen ini tidak mengklaim semua menu UI telah otomatis diuji.

UAT lama masih memuat instruksi port `localhost:3000` dan beberapa skenario historis. Untuk runtime, dokumen ini yang menjadi acuan: gunakan Compose dan `http://localhost`. Skenario rinci UAT perlu terus diselaraskan saat modul dan permission berubah.
