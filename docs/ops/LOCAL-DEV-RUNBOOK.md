# Runbook: Setup & Testing GABAH di Server Dev Lokal (Laptop/PC)

**Target:** Laptop/PC pribadi (Windows/macOS/Linux) untuk testing harian.
**Repo:** `https://github.com/inieki-lab/gabah-gas.git` (branch `main`).
**Pendamping:** untuk VM kantor/produksi, lihat [OFFICE-VM-RUNBOOK.md](./OFFICE-VM-RUNBOOK.md).

> **Jawaban singkat:** TIDAK perlu aplikasi khusus. Wajib hanya **Node.js 20+** dan **Git**.
> **Docker Desktop = opsional**, hanya dipakai jika ingin database PostgreSQL lokal (Opsi B).
> Data sync antar tempat = lewat **git push/pull** (kode) + database permanen (data).

---

## 0. Instalasi sekali saja

| Kebutuhan | Cara install | Cek |
|---|---|---|
| **Node.js 20+** (WAJIB) | Unduh LTS dari https://nodejs.org (Windows/macOS) atau `sudo apt install nodejs npm` (Ubuntu) | `node -v` → v20 atau lebih |
| **Git** (WAJIB) | https://git-scm.com/downloads | `git --version` |
| **Docker Desktop** (OPSIONAL, hanya Opsi B) | https://www.docker.com/products/docker-desktop/ | `docker compose version` |

> Windows: pakai **Git Bash** (ikut installer Git) untuk menjalankan semua perintah di bawah.

---

## 1. Ambil kode dari GitHub (pertama kali)

```bash
# Pilih folder kerja, lalu clone
git clone https://github.com/inieki-lab/gabah-gas.git
cd gabah-gas

# Install dependensi (sekali, ulangi hanya jika package.json berubah)
npm install
```

> Repo privat? Login sekali via browser: `gh auth login` → GitHub.com → HTTPS → Login with a web browser → `gh auth setup-git`.
> Tanpa `gh`, install dari https://cli.github.com atau biarkan Git meminta kredensial saat clone.

---

## 2. Konfigurasi `.env` (sekali saja)

```bash
cp .env.example .env
```

Lalu edit `.env`, isi minimal:

```env
NODE_ENV=development

# UAT: semua 9 akun kanonik pakai 1 password sama (HANYA untuk dev/test)
GABAH_TEST_PASSWORD=GABAH2026
```

**Pilihan penyimpanan data:**

- **Tanpa database** (tercepat): tidak perlu apa-apa lagi. Data tersimpan di file
  `server/data/gabah_state.json` — cukup untuk testing fungsional harian.
- **Dengan PostgreSQL lokal** (Opsi B di bawah): tambahkan `DATABASE_URL=...`
  sesuai kredensial database lokal Anda.

> Untuk pemakaian nyata (bukan testing), ganti `GABAH_TEST_PASSWORD` dengan
> `GABAH_INITIAL_ADMIN_PASSWORD` + `GABAH_INITIAL_USER_PASSWORD` yang kuat.

---

## 3. Jalankan aplikasi

```bash
npm run dev
```

Buka browser: **http://localhost:3000**

Login (password = isi `GABAH_TEST_PASSWORD`, default di atas: `GABAH2026`):

| Email (@foodstation.co.id) | Peran |
|---|---|
| admin@ | Admin GABAH (semua menu + Administrasi) |
| it.support@ | IT |
| ga@ | GA |
| sc.warehouse@ | Supply Chain |
| pibc.admin@ | PIBC |
| sekretariat.direksi@ | Sekretaris Direksi |
| humas@ | Humas |
| auditor@ | Auditor (read-only) |
| karyawan@ | Karyawan |

---

## 4. Opsi B — dengan PostgreSQL lokal via Docker (persisten & mirip produksi)

```bash
# 1. Nyalakan HANYA database-nya (tidak perlu build app)
PGPASSWORD=passku123 docker compose up -d database

# 2. Tambahkan ke .env:
#    DATABASE_URL=postgresql://gabah_user:passku123@localhost:5432/gabah_db
#    PGUSER=gabah_user
#    PGPASSWORD=passku123
#    PGDATABASE=gabah_db

# 3. Jalankan app seperti biasa
npm run dev
```

Migrasi skema (16 tabel) jalan **otomatis** saat boot. Data aman di Docker volume
`postgres_data` walau container di-restart. Cek: `docker compose ps`, log: `docker compose logs -f database`.

---

## 5. Rutinitas harian — selalu sync dengan GitHub

**Sebelum mulai kerja di lokal:**

```bash
git pull origin main
npm install          # hanya jika ada perubahan package.json
npm run dev
```

**Setelah selesai testing / ada perubahan kode (dua arah):**

```bash
git add <file-yang-diubah>
git commit -m "deskripsi perubahan"
git pull --rebase origin main   # ambil perubahan lain dulu, hindari konflik
git push origin main
```

**Aturan main biar tidak kacau:**

1. **Kode selalu lewat git** — jangan salin file manual antar mesin.
2. **Data bukan lewat git** — `server/data/gabah_state.json` sengaja di-gitignore;
   tiap mesin punya data testingnya sendiri. Data "resmi" taruh di database
   (Opsi B) atau di server kantor (lihat OFFICE-VM-RUNBOOK.md).
3. Satu orang satu topik satu branch bila kerja tim; langsung di `main` boleh
   kalau memang satu penjaga.

---

## 6. Perintah berguna

| Tujuan | Perintah |
|---|---|
| Cek kualitas kode | `npm run lint` (harus 0 error) |
| Build produksi lokal | `npm run build` lalu `npm start` |
| Verifikasi semua menu terkoneksi data | `npm run build` dulu, lalu `node scripts/menu-connectivity-verify.mjs` |
| Verifikasi import massal pegawai | `node scripts/bulk-import-verify.mjs` |
| Uji keamanan P0 | `node scripts/p0-security-verify.mjs` |
| Reset data file-store ke seed awal | hapus `server/data/gabah_state.json` saat server mati |

---

## 7. Troubleshooting cepat

| Gejala | Solusi |
|---|---|
| `npm run dev` gagal port terpakai | matikan proses lain di port 3000, atau `PORT=3001 npm run dev` |
| Tidak bisa login | pastikan `GABAH_TEST_PASSWORD` ada di `.env` dan **restart** `npm run dev`; password UAT hanya diprovision saat boot |
| Halaman putih / error JS | `npm run lint` — biasanya ada file belum ter-pull; `git status` |
| Data hilang setelah restart (mode file) | normal bila file state dihapus; pakai Opsi B untuk data permanen |
| `git pull` konflik | `git stash` → `git pull` → `git stash pop`, selesaikan konflik lalu commit |

---

*PT Food Station Tjipinang Jaya (Perseroda) — GABAH Local Dev Runbook*
