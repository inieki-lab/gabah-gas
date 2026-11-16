# Runbook: Setup & Testing GABAH di Laptop (Docker Compose)

**Runtime resmi:** Docker Compose — sama dengan arsitektur deployment server.
> Tidak ada mode file-store atau server Node lokal untuk UAT. App dan PostgreSQL selalu dijalankan bersama di Docker Compose.

## 0. Instalasi sekali saja
| Kebutuhan | Cara install | Cek |
|---|---|---|
| Docker Desktop (Windows/macOS) atau Docker Engine (Linux) | https://www.docker.com/products/docker-desktop/ | `docker --version` |
| Docker Compose v2 | Termasuk Docker Desktop / Compose Plugin | `docker compose version` |
| Git | https://git-scm.com/downloads | `git --version` |

## 1. Ambil kode
```bash
git clone https://github.com/inieki-lab/gabah-gas.git
cd gabah-gas
git checkout fix/docker-canonical-runtime-main
```
Jangan melakukan commit langsung ke `main`.

## 2. Konfigurasi environment
```bash
cp .env.example .env
```
Isi `PGPASSWORD`, `GABAH_INITIAL_ADMIN_PASSWORD`, dan `GABAH_INITIAL_USER_PASSWORD` dengan secret kuat. Untuk database laptop yang benar-benar baru, dua password awal boleh disamakan sementara. Password awal hanya mengisi akun yang belum memiliki hash; mengubah `.env` tidak mereset password akun lama.

Jangan ubah `PGHOST=database` atau `PGPORT=5432`; ini alamat internal antar-container.

## 3. Jalankan aplikasi
```bash
docker compose config
docker compose up -d --build
docker compose ps
docker compose logs -f --tail=200 app
```
Buka `http://localhost` (host port default 80).

Arsitektur koneksi:
- Browser → `localhost:80` → app container `:3000`.
- App container → `database:5432` melalui jaringan Compose.
- PostgreSQL host port `127.0.0.1:5432` hanya untuk administrasi; app tidak menggunakannya.
- Database harus `healthy` sebelum app start. App berjalan fail-fast jika PostgreSQL tidak tersedia.
- Jika port host bentrok, ubah `GABAH_WEB_PORT` / `GABAH_DB_PORT`; jangan ubah port internal container.

## 4. Rutinitas harian
```bash
git pull
docker compose up -d --build
docker compose ps
```
Stop tanpa menghapus data: `docker compose down`. **Jangan** gunakan `docker compose down -v` karena menghapus database dan file upload.

## 5. Perintah berguna
| Tujuan | Perintah |
|---|---|
| Start / rebuild | `npm run docker:up` |
| Status container | `npm run docker:ps` |
| Log app + database | `npm run docker:logs` |
| Stop tanpa menghapus data | `npm run docker:down` |
| Typecheck | `npm run lint` |
| Build frontend/backend | `npm run build` |

## 6. Troubleshooting
| Gejala | Tindakan |
|---|---|
| App tidak start | `docker compose ps` dan `docker compose logs --tail=200 app database` |
| Database belum healthy | Periksa log database dan nilai PG* di `.env`; jangan reset volume |
| Port 80/5432 dipakai | Ubah `GABAH_WEB_PORT` / `GABAH_DB_PORT`; jangan ubah `PGHOST=database` |
| Menu RBAC menyebut PostgreSQL tidak aktif | Pastikan `gabah_database` dan `gabah_app` healthy; cek log boot untuk `PostgreSQL persistence ready` |
| Tidak bisa login | Password awal tidak menimpa akun yang sudah punya hash; gunakan password akun saat ini atau reset resmi |
| Halaman putih | `docker compose up -d --build`, cek log app dan jalankan `npm run lint` |

*PT Food Station Tjipinang Jaya (Perseroda) — GABAH Local UAT Runbook*
