# GABAH — Persistence Failure Hardening Review
**Tanggal:** 17 November 2026  
**Basis kode:** `audit/dynamic-rbac-full-sync` pada `b3c2489d63ece6aef0670332a5f0149c454a01e1`  
**Status:** Perbaikan awal diterapkan pada branch audit; belum disetujui merge/produksi.

## Temuan yang diverifikasi
1. Sejumlah endpoint mutasi mengubah objek `db`, memanggil `persistDataStore().catch(() => {})`, lalu mengirim HTTP sukses. Ini dapat menghasilkan false-success ketika penulisan PostgreSQL gagal.
2. Tiga belas mutator domain ruang rapat/fasilitas memakai pola fire-and-forget yang sama. Route terkait sebelumnya memanggil service sinkron sehingga tidak dapat menunggu hasil persist.
3. Middleware global juga menjalankan persist setelah respons selesai tanpa menangani rejection. Ini berisiko menghasilkan unhandled rejection dan merupakan persist tambahan di luar penyimpanan eksplisit route.
4. Alur ganti password mencabut sesi sebelum hasil persist dipastikan.

## Perubahan pada branch ini
- Tambah helper route untuk menunggu `persistDataStore()` dan mengembalikan HTTP 503 dengan kode `PERSISTENCE_UNAVAILABLE` saat penyimpanan gagal.
- Mengubah endpoint password, update aset, status tiket, maintenance, vendor, dan knowledge base agar menunggu persist sebelum respons sukses.
- Mengubah 13 mutator ruang rapat/fasilitas menjadi asynchronous; route terkait menunggu service dan meneruskan status 503.
- Ganti password memulihkan field kredensial sebelumnya dan baru mencabut sesi setelah persist berhasil.
- Menangani rejection pada persist middleware global.
- Tambah pemeriksaan regresi di CI agar pola silent persistence tidak kembali.

## Batasan yang masih terbuka — jangan dianggap selesai
- **Rollback state belum atomik.** Banyak service mengubah objek in-memory sebelum memanggil persist. Jika PostgreSQL gagal, route kini mengembalikan 503, tetapi objek in-memory yang sudah berubah belum otomatis dipulihkan. Perbaikan transaksional/rollback yang aman perlu dirancang tanpa menimpa perubahan request lain yang berjalan bersamaan.
- `persistDataStore()` masih membuat snapshot dan menulis file lokal sebelum penulisan PostgreSQL selesai. Perilaku ini perlu ditinjau bersama strategi file-store fallback dan pemulihan state.
- Middleware persist setelah respons masih menjadi safety-net dan dapat menyebabkan write tambahan. Perlu audit seluruh route mutasi sebelum middleware itu dapat dihapus dengan aman.
- Pemeriksaan baru bersifat kontrak statis; hasil typecheck, build, PostgreSQL integration, dan runtime harus menunggu CI untuk commit branch ini.
- Belum dilakukan browser UAT, pengujian kegagalan PostgreSQL secara live, maupun uji request paralel.

## Keputusan rilis
Branch ini tetap untuk audit/perbaikan. Jangan merge ke `main` dan jangan menyatakan GABAH production-ready sampai rollback/transaction semantics, kegagalan PostgreSQL live, dan seluruh CI/UAT lulus.
