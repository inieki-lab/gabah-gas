# GABAH — Rencana Finalisasi yang Bisa Dieksekusi

**Tujuan:** menghentikan penambahan fitur dan menyelesaikan GABAH sampai bisa diuji pengguna secara nyata. Dokumen ini adalah daftar kerja operasional, bukan klaim bahwa aplikasi sudah siap produksi.

## Aturan mulai sekarang

1. **Bekukan fitur baru.** Tidak menambah modul, merombak arsitektur, atau memulai ulang proyek sebelum semua gerbang rilis di bawah selesai.
2. **Satu perubahan per pekerjaan.** Setiap perubahan harus punya masalah yang dapat direproduksi, perubahan sekecil mungkin, pemeriksaan yang dijalankan, dan hasil PASS/FAIL.
3. **Jangan menyebut PASS tanpa menjalankan pemeriksaan.** Pemeriksaan statis bukan pengganti uji PostgreSQL atau UAT di browser.
4. **Jangan hapus atau reset data/branch untuk merapikan.** Pertahankan riwayat Git dan perubahan pengguna.
5. **Jangan membuka pekerjaan baru jika pemeriksaan sebelumnya gagal.** Perbaiki kegagalan pertama, ulangi pemeriksaan terkait, baru lanjut.
6. **Sumber status:** source code dan hasil test terbaru lebih otoritatif daripada laporan lama. Perbarui dokumen status setelah hasil baru benar-benar tersedia.

## Status yang diketahui dari repositori

- Stack yang dituju: React + TypeScript/Vite, Express/Node.js, PostgreSQL 17, Docker Compose.
- Commit di `main` tanggal 21 Oktober 2026 mencatat implementasi otorisasi dinamis untuk maintenance (Stage 13F) dan CI berhasil untuk perubahan tersebut.
- Laporan commit itu menyatakan pengujian integrasi PostgreSQL langsung belum tersedia di CI. Karena itu, status lolos pemeriksaan statis tidak membuktikan persistensi produksi telah tervalidasi.
- Dokumen audit lama mencatat modul tertentu masih mock/statik dan UAT 9 peran belum ditutup dengan bukti. Status ini harus diverifikasi ulang saat menjalankan gerbang di bawah; jangan menganggap laporan lama sebagai hasil uji hari ini.

## Gerbang rilis — kerjakan berurutan

### G0 — Baseline dan kesehatan kode
- [ ] Ambil status branch/commit dan pastikan working tree pengguna tidak tertimpa.
- [ ] `npm ci`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Jalankan seluruh skrip verifikasi yang tersedia di `package.json`, termasuk otorisasi peminjaman, ruang rapat, model organisasi, managing unit, asset location, category master, dynamic RBAC foundation, dan maintenance authorization.
- [ ] Simpan output aktual, commit SHA, tanggal, serta PASS/FAIL. Jangan mengubah kode jika baseline belum diketahui.

### G1 — Jalankan aplikasi dengan database nyata
- [ ] Siapkan PostgreSQL 17 terisolasi untuk pengujian; jangan arahkan test ke database produksi.
- [ ] Validasi konfigurasi environment tanpa menaruh secret di log atau commit.
- [ ] Jalankan migrasi dari database kosong.
- [ ] Verifikasi login, buat/perbarui data, restart aplikasi/container, lalu pastikan data tetap ada.
- [ ] Verifikasi aplikasi gagal secara aman ketika konfigurasi database produksi tidak valid.
- [ ] Uji backup dan restore database uji.
- [ ] Catat hasil CR-04/CR-05 dan bukti log yang sudah disanitasi.

### G2 — Smoke test UI dan alur bisnis
Uji di browser menggunakan data uji yang bisa dibuang:
- [ ] Login/logout dan sesi berakhir.
- [ ] Dashboard dan navigasi; Administration Control Panel bisa dibuka tanpa error React/hooks.
- [ ] CRUD aset dan penomoran aset.
- [ ] Pencarian cepat.
- [ ] Buat tiket, ubah status, dan validasi SLA.
- [ ] Peminjaman: ajukan, setujui/tolak, serah-terima, pengembalian, dan konflik jadwal.
- [ ] Maintenance: baca/tambah/ubah data sesuai peran dan endpoint yang benar-benar tersedia.
- [ ] Reservasi ruang rapat dan validasi bentrok.
- [ ] Audit log serta penolakan akses yang tidak berwenang.
- [ ] Bedakan fitur yang terhubung ke API/database dari tampilan mock; tandai fitur mock dengan jelas dan jangan mengklaimnya siap.

### G3 — UAT akses untuk 9 peran
- [ ] Admin GABAH
- [ ] IT
- [ ] GA
- [ ] Sekretaris Direksi
- [ ] Humas
- [ ] Supply Chain
- [ ] PIBC
- [ ] Karyawan
- [ ] Auditor (read-only)

Untuk tiap peran, catat akun uji (tanpa password), skenario, hasil yang diharapkan, hasil aktual, bukti, dan status. Pastikan Auditor tidak dapat menulis data dan pengguna tidak dapat mengakses divisi/operasi di luar izinnya. Jangan memakai satu hasil uji untuk mewakili semua peran.

### G4 — Kandidat rilis
- [ ] Seluruh gerbang G0–G3 lulus atau ada pengecualian yang disetujui dan tercatat.
- [ ] Konfigurasi produksi tidak menggunakan password uji, auto-login development, atau secret default.
- [ ] Periksa `.env.example`, Docker Compose, port, health check, restart policy, volume database, dan prosedur rollback.
- [ ] Pastikan backup terjadwal dan prosedur restore pernah diuji.
- [ ] Catat commit kandidat rilis, versi, hasil tes, isu terbuka, dan keputusan **GO / NO-GO**.

## Format laporan setiap pekerjaan

Gunakan format singkat ini agar agen tidak berputar-putar:

- **Target:** satu masalah yang ditutup.
- **Bukti awal:** file/endpoint/skenario dan cara mereproduksi.
- **Perubahan:** file yang berubah dan alasan.
- **Verifikasi:** perintah/skenario yang benar-benar dijalankan.
- **Hasil:** PASS/FAIL beserta ringkasan output.
- **Commit:** SHA, atau jelaskan kenapa belum dibuat.
- **Berikutnya:** satu langkah terdekat saja.

## Definisi selesai

GABAH belum disebut selesai hanya karena build sukses. Minimal, aplikasi harus berjalan pada stack target, data tetap tersimpan setelah restart PostgreSQL-backed, alur utama lulus smoke test, seluruh 9 peran lulus UAT berbukti, dan backup/restore serta konfigurasi produksi sudah diperiksa. Jika ada fitur yang masih mock, nyatakan eksplisit dan putuskan apakah wajib untuk rilis pertama atau ditunda.
