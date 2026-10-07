# Runbook: Deploy & Tes GABAH di VM Kantor (`/opt/gabah-gas`)

**Target:** Ubuntu Server (VM kantor), diakses dari laptop Ubuntu di rumah via VPN.
**Repo:** `https://github.com/inieki-lab/gabah-gas.git` (branch `main`).

> Semua perintah dijalankan **di VM** (SSH dari rumah: `ssh user@IP-VPN-VM`).
> Ganti `user@IP-VPN-VM` sesuai akun & IP VPN VM Anda.

---

## 0. Persiapan sekali saja (di VM)

```bash
# a. Masuk folder kerja
cd /opt/gabah-gas

# b. (Jika repo privat) Login GitHub sekali via browser — TANPA menyalin password:
#    jalankan perintah ini, lalu buka URL + kode yang muncul di browser laptop Anda
gh auth login
#    pilih: GitHub.com → HTTPS → Login with a web browser
#    kemudian: gh auth setup-git

# c. Pastikan remote sudah benar (abaikan bila sudah sesuai)
git remote set-url origin https://github.com/inieki-lab/gabah-gas.git
```

---

## 1. Update kode (menimpa isi lama sesuai permintaan)

> ⚠️ `reset --hard` + `clean` **menghapus perubahan lokal di VM** — ini memang diminta.
> Data database TIDAK ikut terhapus (tersimpan di volume Docker terpisah).

```bash
cd /opt/gabah-gas
git fetch origin
git reset --hard origin/main
git clean -fd
git log --oneline -3   # commit teratas harus sama dengan origin/main terbaru
```

---

## 2. Tes mode produksi (disarankan — pakai PostgreSQL sesungguhnya)

### a. Buat file `.env` di VM (sekali saja — password ini milik Anda, jangan dipakai ulang di tempat lain)

```bash
cd /opt/gabah-gas
cat > .env <<'EOF'
PGDATABASE=gabah_db
PGUSER=gabah_user
PGPASSWORD=GANTI-DENGAN-PASSWORD-KUAT-ANDA
GABAH_INITIAL_ADMIN_PASSWORD=GANTI-PASSWORD-ADMIN-GABAH
GABAH_INITIAL_USER_PASSWORD=GANTI-PASSWORD-USER-LAIN
EOF
chmod 600 .env
```

### b. Build & jalankan (Docker + PostgreSQL 17)

```bash
# Jika Docker belum ada, skrip ini meng-install otomatis:
sh ./deploy.sh

# Cek status
docker compose ps
curl -s http://localhost/api/health
```

### c. Akses dari laptop di rumah (via VPN)

Buka browser: `http://IP-VPN-VM` (port 80).
Login: `admin@foodstation.co.id` + `GABAH_INITIAL_ADMIN_PASSWORD` yang Anda isi di `.env`.

### d. Firewall (hanya jika halaman tidak terbuka dari laptop)

```bash
sudo ufw status                      # jika aktif (active):
sudo ufw allow 80/tcp                # produksi (Docker)
# sudo ufw allow 3000/tcp            # hanya jika memakai mode dev di bawah
```

---

## 3. Alternatif: tes cepat mode dev (tanpa Docker, tanpa PostgreSQL)

```bash
cd /opt/gabah-gas
npm ci
npm run lint        # harus 0 error
npm run dev         # server jalan di port 3000
```
Buka: `http://IP-VPN-VM:3000` — mode ini memakai penyimpanan file sementara (`server/data/gabah_state.json`), **bukan** untuk menilai persistensi database.

---

## 4. Update di kemudian hari (rutin)

```bash
cd /opt/gabah-gas
git fetch origin && git reset --hard origin/main && git clean -fd
docker compose up -d --build      # rebuild + restart, data database tetap aman
```

---

## 5. Perintah berguna

| Tujuan | Perintah |
|---|---|
| Lihat log aplikasi | `docker compose logs -f app` |
| Lihat log database | `docker compose logs -f database` |
| Matikan aplikasi (data tetap) | `docker compose down` |
| **HAPUS SEMUA DATA** + mulai dari nol | `docker compose down -v` (hati-hati) |
| Uji keamanan P0 (37 asersi) | `node scripts/p0-security-verify.mjs` |

---

## 6. Troubleshooting cepat

| Gejala | Cek |
|---|---|
| Halaman tidak terbuka dari rumah | VPN tersambung? `ping IP-VPN-VM`; firewall §2d |
| `health` gagal / app restart terus | `docker compose logs -f app` — biasanya `PGPASSWORD` kosong di `.env` |
| Port 80 dipakai layanan lain | `sudo ss -ltnp | grep :80` → hentikan layanan itu, atau ubah mapping port di `docker-compose.yml` |
| Lupa password admin | isi ulang `GABAH_INITIAL_ADMIN_PASSWORD` di `.env`, lalu `docker compose down && docker compose up -d --build` |
