# GABAH-GAS — Deployment Validation Follow-up

Tanggal: 2026-10-22  
Branch: `work/antigravity-sync`  
PR: #11 (belum merged)

## Perubahan
- `.env.example` dibersihkan dari placeholder `GEMINI_API_KEY` dan `APP_URL` yang tidak digunakan aplikasi server ini.
- Template kini menjelaskan bahwa operator harus menyalin ke `.env`, mengisi password PostgreSQL yang kuat, dan tidak meng-commit kredensial.
- CI menambahkan langkah `docker compose config --quiet` dengan nilai dummy untuk validasi konfigurasi; bukan kredensial produksi.

## Verifikasi
- Perubahan sudah dikirim ke branch PR.
- CI HEAD `af956f8` **PASS**: run [39751923497](https://github.com/inieki-lab/gabah-gas/actions/runs/39751923497) — termasuk langkah `docker compose config --quiet`.
- Validasi konfigurasi Compose tidak membuktikan aplikasi berhasil tersambung ke PostgreSQL.

## Hasil pengujian sandbox (2026-10-22, HEAD `af956f8`, exit code riil)
| Check | Hasil | Bukti |
|---|---|---|
| `npm run lint` | PASS | exit 0 |
| `npm run build` | PASS | exit 0; `dist/server.cjs` dibangun |
| `dynamic-rbac-foundation-verify.mjs` | PASS | 97/97 |
| `p0-security-verify.mjs` | PASS | 37/37 (HTTP live, file-store) |
| `maintenance-authz-verify.mjs` | PASS | 33/33 (HTTP live) |
| `loan-authz-verify.mjs` | PASS | 37/37 |
| `meeting-room-stage3-verify.mjs` | PASS | 18/18 |
| `org-model-verify.mjs` | PASS | 14/14 |
| `t2b1/t2b2/t2b3-verify.mjs` | PASS | 18/18, 22/22, 26/26 |
| `menu-connectivity-verify.mjs` | PASS | 23/23 — login admin nyata via `/api/auth/login`, Bearer token, cek HTTP per titik menu |
| `docker compose config` (sandbox) | BLOCKED | CLI Docker tidak tersedia di sandbox; divalidasi sebagai PASS di CI (run di atas) |
| PostgreSQL live integration | BLOCKED | Tidak ada PostgreSQL di sandbox |

## Belum dibuktikan
1. PostgreSQL live integration dan migrasi pada database uji.
2. UAT end-to-end oleh perwakilan pengguna.
3. Deployment/rollback di staging.
4. Backup dan restore yang berhasil.

Tidak ada perubahan pada `main`, merge PR, deployment produksi, atau operasi pada volume/database produksi.
