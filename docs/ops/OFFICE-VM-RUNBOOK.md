# Runbook: GABAH Staging/Production VM

**Target:** Ubuntu Server VM kantor.  
**Repository:** inieki-lab/gabah-gas.  
**Application path:** /opt/gabah-gas.  
**Runtime:** Node.js 22 Alpine multi-stage Docker image (build-time npm ci from lockfile).  
**Database:** PostgreSQL 17 via Docker Compose.  
**Persistent files:** Docker named volume uploads_data mounted at /app/uploads.

> **Release gate:** Jangan deploy PR draft atau branch kerja. PR #18 masih dalam stabilisasi. Deployment hanya dilakukan setelah PR di-merge ke main, CI pada commit main lulus, UAT disetujui, dan backup/rollback siap.

## 0. Aturan keselamatan

- Jangan menjalankan git reset --hard atau git clean -fd pada server.
- Jangan menjalankan docker compose down -v.
- Jangan menghapus volume postgres_data.
- Jangan membuka port PostgreSQL ke jaringan kantor/VPN; compose mengikatnya ke loopback 127.0.0.1.
- Jangan membuka akses internet sebelum TLS/reverse proxy, firewall, dan monitoring siap.
- Jangan menyalin password/token ke chat, tiket, atau log.

## 1. Pemeriksaan repository sebelum update

Semua perintah berikut dijalankan di VM melalui SSH.

```sh
cd /opt/gabah-gas
git branch --show-current
git status --short
```

Syarat lanjut:
- Branch harus main.
- Working tree harus bersih.
- Jika ada perubahan lokal atau branch bukan main, berhenti dan minta review; jangan ditimpa.

Ambil hanya commit yang sudah masuk main:

```sh
git fetch origin
git pull --ff-only origin main
git log -1 --oneline
```

Catat commit SHA sebelum deployment agar rollback code dapat dilakukan.

## 2. Konfigurasi environment (sekali saja)

Jika .env belum ada:

```sh
cd /opt/gabah-gas
cp .env.example .env
chmod 600 .env
```

Edit .env secara lokal di VM. Isi PGPASSWORD dengan password PostgreSQL yang kuat dan unik. Untuk instalasi database baru, isi juga GABAH_INITIAL_ADMIN_PASSWORD dan GABAH_INITIAL_USER_PASSWORD dengan password unik yang kuat. Jangan menimpa .env lama saat update. Set GABAH_IMAGE_TAG ke tag release yang mencerminkan commit SHA yang telah di-merge (jangan memakai tag bergerak untuk rilis produksi). Docker Compose menggunakan tag tersebut untuk image hasil build lokal. Untuk deployment VM kantor, set `GABAH_WEB_PORT=80` dan `GABAH_DB_PORT=5432` agar sesuai dengan akses operasional yang didokumentasikan; PostgreSQL tetap hanya bind ke loopback. `deploy.sh` otomatis memakai `GABAH_WEB_PORT` untuk health check, atau gunakan `GABAH_HEALTH_URL` bila health check berada di reverse proxy.

Validasi konfigurasi tanpa menampilkan secret:

```sh
docker compose config --quiet
```

## 3. Backup PostgreSQL sebelum update

Pastikan database container sedang berjalan. Simpan backup di disk/volume backup yang terpisah dari volume database:

```sh
sudo install -d -m 700 /var/backups/gabah
umask 077
BACKUP_FILE="/var/backups/gabah/gabah-$(date +%F-%H%M%S).sql"
docker compose exec -T database sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$BACKUP_FILE"
test -s "$BACKUP_FILE"
sha256sum "$BACKUP_FILE"

# Contract documents live in the dedicated uploads_data volume mounted at /app/uploads.
# Coordinate a short write pause so the DB dump and file archive represent the same point in time.
UPLOAD_BACKUP_FILE="/var/backups/gabah/gabah-uploads-$(date +%F-%H%M%S).tar.gz"
docker compose exec -T app tar -czf - -C /app/uploads . > "$UPLOAD_BACKUP_FILE"
test -s "$UPLOAD_BACKUP_FILE"
sha256sum "$UPLOAD_BACKUP_FILE"
```

Catat nama file, ukuran, checksum, waktu, dan commit aplikasi. Untuk instalasi baru tanpa data, dokumentasikan bahwa backup belum diperlukan. Backup belum dianggap teruji restore sampai pernah dipulihkan pada database uji terpisah.

## 4. Deploy aplikasi

```sh
cd /opt/gabah-gas
./deploy.sh
```

Script deploy melakukan preflight, validasi Compose, membangun image production dari Dockerfile/lockfile, lalu mengganti service app saja tanpa menghentikan database atau menghapus volume. Image runtime memakai Node 22, user non-root, dependency production, dan artefak build; npm install/build tidak berjalan saat container start. Dokumen kontrak disimpan di volume uploads_data. Script tidak memasang Docker otomatis dan tidak menjalankan docker compose down.

Verifikasi:

```sh
docker compose ps
curl -fsS http://127.0.0.1/api/health
docker compose logs --tail=100 app
```

Pastikan health menunjukkan persistence PostgreSQL. Jika health gagal, deployment dianggap gagal; jangan menyatakan rilis berhasil.

## 5. Akses dan firewall

- Akses internal melalui VPN hanya setelah kebijakan firewall disetujui.
- Port 5432 hanya bind ke 127.0.0.1; jangan membuka port itu di firewall.
- Port 80 adalah HTTP. Untuk akses lintas jaringan yang berisi data perusahaan, pasang reverse proxy TLS dan sertifikat yang sah sebelum go-live.
- Health check dari reverse proxy dapat menggunakan URL HTTPS melalui GABAH_HEALTH_URL.

## 6. Rollback aplikasi

Jika health check atau smoke test gagal:
1. Hentikan perubahan lanjutan; simpan log aplikasi dan database yang sudah disanitasi.
2. Catat commit yang sedang berjalan dan commit terakhir yang diketahui baik.
3. Checkout sementara ke commit terakhir yang diketahui baik, lalu jalankan deploy script.
4. Jangan reset branch main atau menghapus commit; buat catatan insiden dan PR perbaikan.
5. Rollback skema/data dilakukan hanya berdasarkan rencana migrasi yang telah diuji. Jangan menganggap rollback kode otomatis membalikkan migrasi database.

Contoh rollback kode sementara (ganti placeholder dengan SHA yang sudah dicatat):

```sh
cd /opt/gabah-gas
git switch --detach LAST_GOOD_COMMIT_SHA
./deploy.sh
```

Setelah layanan stabil, koordinasikan pengembalian server ke main melalui prosedur release.

## 7. Restore database (hanya saat diperlukan dan disetujui)

Restore dapat menimpa data saat ini. Lakukan hanya setelah incident lead menyetujui file backup dan target database, dan setelah snapshot kondisi saat ini disimpan.

```sh
docker compose exec -T database sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" "$POSTGRES_DB"' < /var/backups/gabah/BACKUP_FILE.sql

# Restore contract files from the matching uploads archive after verifying the archive.
docker compose exec -T app tar -xzf - -C /app/uploads < /var/backups/gabah/UPLOADS_BACKUP_FILE.tar.gz
```

Uji restore terlebih dahulu pada database terpisah. Jangan menjalankan restore ke database produksi hanya untuk mencoba.

## 8. Perintah operasional

| Tujuan | Perintah |
|---|---|
| Status container | docker compose ps |
| Log aplikasi | docker compose logs -f app |
| Log PostgreSQL | docker compose logs -f database |
| Restart app | docker compose restart app |
| Stop layanan tanpa hapus data | docker compose down |
| **Dilarang tanpa change approval** | docker compose down -v |

## 9. Status go-live

Status saat dokumen ini diperbarui: **NO-GO**. PR #18 belum merge. CI PostgreSQL dan regression tests sedang ditutup; browser UAT, backup/restore rehearsal, staging deploy, TLS/reverse proxy, monitoring, dan sign-off pemilik proses masih wajib.
