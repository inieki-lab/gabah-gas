# Canonical Docker Runtime — 2026-11-16

## Keputusan arsitektur
Docker Compose adalah satu-satunya runtime yang didukung untuk development, UAT, dan deployment. App dan PostgreSQL selalu berjalan pada satu Compose network.

- Browser: `http://localhost` → host TCP 80 → app container TCP 3000.
- App → PostgreSQL: service DNS `database:5432`, bukan localhost dan bukan host-mapped port.
- PostgreSQL host port: bind loopback `127.0.0.1:5432` untuk administrasi lokal.
- Default host ports dapat diubah dengan `GABAH_WEB_PORT` / `GABAH_DB_PORT`; variabel internal `PGHOST=database` dan `PGPORT=5432` tidak boleh diubah.
- PostgreSQL harus healthy sebelum app dimulai. App memakai `NODE_ENV=production`, sehingga startup gagal jika DB/migrasi gagal; tidak boleh fallback ke file-store.
- Named volumes `postgres_data` dan `uploads_data` harus dipertahankan. Jangan menjalankan `docker compose down -v` dalam operasional normal.

## Perubahan implementasi
- Default port Compose dan contoh environment diselaraskan ke web 80 / database 5432.
- `npm run dev` dan `npm start` diarahkan ke Compose agar tidak ada jalur start lokal yang berbeda konfigurasi.
- Ditambahkan shortcut `npm run docker:up`, `docker:down`, `docker:logs`, dan `docker:ps`.
- Healthcheck deployment diselaraskan dengan host web port yang dapat dikonfigurasi.
- README, runbook laptop, UAT, dan dokumen arsitektur diperbarui.

## Cara menjalankan di laptop
```bash
cp .env.example .env
# Isi PGPASSWORD dan password bootstrap pada .env
docker compose config
docker compose up -d --build
docker compose ps
docker compose logs -f --tail=200 app
```

Akses `http://localhost`. Pastikan `gabah_database` = healthy dan `gabah_app` = healthy. Log boot app harus memuat `PostgreSQL persistence ready`.

## Verifikasi wajib sebelum merge
- CI pada PR branch ini harus lulus (typecheck, regression suite, production build, Docker runtime smoke, PostgreSQL integration).
- UAT laptop harus membuktikan persistence PostgreSQL aktif dan Control Panel → Penetapan Role Pegawai memuat role aktif.
- Jangan menghapus volume atau reset database untuk mengatasi kegagalan koneksi.
- Jangan merge ke main sebelum CI dan verifikasi runtime selesai.
