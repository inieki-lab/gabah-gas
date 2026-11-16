# Runbook: Setup & Testing GABAH di Laptop (Docker Compose)

**Target:** Laptop/PC Windows, macOS, atau Linux untuk pengujian harian.
**Runtime resmi:** Docker Compose — sama dengan arsitektur deployment server.

> Tidak ada mode file-store atau server Node lokal untuk UAT. App dan PostgreSQL selalu dijalankan bersama di Docker Compose. Jangan mencampur npm run dev lokal dengan PostgreSQL container.

## 0. Instalasi sekali saja

| Kebutuhan | Cara install | Cek |
|---|---|---|
| Docker Desktop (Windows/macOS) atau Docker Engine (Linux) | https://www.docker.com/products/docker-desktop/ | docker --version |
| Docker Compose v2 | Termasuk Docker Desktop / Compose Plugin | docker compose version |
| Git | https://git-scm.com/downloads | git --version |

Windows: jalankan perintah berikut dari PowerShell atau Git Bash.

## 1. Ambil kode

```bash
git clone https://github.com/inieki-lab/gabah-gas.git
cd gabah-gas
git checkout fix/docker-canonical-runtime
```

Jika repo sudah ada, pindah ke folder repo dan lakukan pull branch kerja yang telah disepakati. Jangan melakukan commit langsung ke main.

## 2. Konfigurasi environment (sekali saja)

```bash
cp .env.example .env
```

Edit .env dan isi PGPASSWORD, GABAH_INITIAL_ADMIN_PASSWORD, dan GABAH_INITIAL_USER_PASSWORD dengan secret kuat dan unik. Untuk database laptop yang benar-benar baru, dua password awal boleh disamakan sementara. Jangan gunakan password uji ini di production.

Password awal hanya mengisi akun yang belum mempunyai hash. Mengubah nilai .env tidak mereset password akun yang sudah ada.

Jangan ubah PGHOST=database atau PGPORT=5432. Keduanya adalah alamat internal antar-container.

## 3. Jalankan aplikasi

```bash
docker compose config
docker compose up -d --build
docker compose ps
docker compose logs -f --tail=200 app
```

Buka browser: http://localhost (host port 80).

Arsitektur koneksi:
- Browser → localhost:80 → app container :3000.
- App container → database:5432 melalui jaringan Compose.
- PostgreSQL host port 127.0.0.1:5432 hanya untuk administrasi; app tidak menggunakannya.
- Database harus healthy sebelum app start. App berjalan fail-fast jika PostgreSQL tidak tersedia.

Jika port 80 atau 5432 sudah dipakai, ubah GABAH_WEB_PORT atau GABAH_DB_PORT di .env. Jangan mengubah port internal container.

## 4. Akun pengujian

Gunakan akun/persona yang tercantum di docs/testing/UAT.md. Password berasal dari proses provisioning awal atau reset resmi oleh Superadmin. Untuk akun yang sudah pernah login, gunakan password tersimpan saat ini; initial password tidak menimpa hash lama.

## 5. Rutinitas harian

```bash
git pull
docker compose up -d --build
docker compose ps
```

Setelah selesai:
```bash
docker compose logs --tail=200 app database
docker compose down
```

docker compose down mempertahankan named volumes. Jangan gunakan docker compose down -v karena menghapus database dan file upload.

## 6. Perintah berguna

| Tujuan | Perintah |
|---|---|
| Start / rebuild | npm run docker:up |
| Status container | npm run docker:ps |
| Log app + database | npm run docker:logs |
| Stop tanpa menghapus data | npm run docker:down |
| Typecheck | npm run lint |
| Build frontend/backend | npm run build |

## 7. Troubleshooting

| Gejala | Tindakan |
|---|---|
| App tidak start | docker compose ps, lalu docker compose logs --tail=200 app database |
| Database belum healthy | Periksa log database dan nilai PG* di .env; jangan reset volume |
| Port 80/5432 sudah dipakai | Ubah GABAH_WEB_PORT / GABAH_DB_PORT; jangan ubah PGHOST=database |
| Menu RBAC menyebut PostgreSQL tidak aktif | Pastikan gabah_database dan gabah_app healthy; cek log boot app untuk PostgreSQL persistence ready |
| Tidak bisa login | Password awal tidak menimpa akun yang sudah punya hash. Gunakan password akun saat ini atau reset resmi; jangan hapus database |
| Halaman putih / error JS | docker compose up -d --build, lalu cek log app dan npm run lint |

---

*PT Food Station Tjipinang Jaya (Perseroda) — GABAH Local UAT Runbook*
