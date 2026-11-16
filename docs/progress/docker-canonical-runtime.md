# Canonical Docker Runtime — 2026-11-16

## Keputusan arsitektur
Docker Compose adalah satu-satunya runtime yang didukung untuk development, UAT, dan deployment. App dan PostgreSQL selalu berjalan pada satu Compose network yang sama.

- Browser: `http://localhost` → host TCP `80` → app container TCP `3000`.
- App → PostgreSQL: service DNS `database:5432` (bukan localhost dan bukan host-mapped port).
- PostgreSQL host port: bind loopback `127.0.0.1:5432` untuk administrasi lokal saja.
- Default host ports dapat diubah dengan `GABAH_WEB_PORT` / `GABAH_DB_PORT`; variabel internal `PGHOST=database` dan `PGPORT=5432` tidak boleh diubah.
- PostgreSQL harus healthy sebelum app dimulai. Container app memakai `NODE_ENV=production`, sehingga database tidak tersedia berarti startup gagal; tidak boleh jatuh diam-diam ke file-store.
- Named volumes `postgres_data` dan `uploads_data` harus dipertahankan. Jangan menjalankan `docker compose down -v` dalam operasional normal.

## Perubahan implementasi
- Default port Compose dan contoh environment diselaraskan ke web 80 / database 5432.
- `npm run dev` dan `npm start` diarahkan ke Compose agar tidak ada jalur start lokal yang berbeda konfigurasi.
- Ditambahkan shortcut `npm run docker:up`, `docker:down`, `docker:logs`, dan `docker:ps`.
- Healthcheck deployment diselaraskan dengan default port 80.
- README diperbarui agar prosedur laptop dan server menggunakan runtime yang sama.

## Cara menjalankan di laptop
```bash
cp .env.example .env
# Isi PGPASSWORD dan password bootstrap pada .env
docker compose config
docker compose up -d --build
docker compose ps
docker compose logs -f --tail=200 app
```

Akses `http://localhost`. Untuk pemeriksaan awal, pastikan container `gabah_database` = healthy dan `gabah_app` = healthy. Kemudian periksa `/api/health` dan log boot untuk pesan `PostgreSQL persistence ready`.

## Verifikasi yang masih wajib
- CI pada PR branch ini harus lulus (typecheck, regression suite, production build, Docker runtime smoke, PostgreSQL integration).
- UAT laptop harus membuktikan status persistence PostgreSQL aktif dan halaman Control Panel → Penetapan Role Pegawai memuat role aktif.
- Jangan menghapus volume atau melakukan reset database untuk mengatasi kegagalan koneksi.
- Jangan merge ke main sebelum CI dan verifikasi runtime selesai.
