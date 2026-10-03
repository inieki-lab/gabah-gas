# GABAH — CURRENT STATE AUDIT

**Repository:** inieki-lab/GABAH
**Status:** Current authoritative application architecture + verified status
**Updated:** 3 Oktober 2026

## 1. Executive Summary

GABAH is implemented as a single Node.js application with a React frontend, Express backend/API, and PostgreSQL 17 persistence.

The production direction is:

**React 19 → Express REST API → Domain Services → PostgreSQL 17**

There is no separate PHP backend in the application architecture.

## 2. Runtime Stack

- Frontend: React 19 + TypeScript + Vite 6 + Tailwind CSS v4
- Backend/API: Node.js + Express + TSX
- Database: PostgreSQL 17
- Database driver: `pg`
- Build: Vite + esbuild
- Container runtime: Docker Compose
- Production application container: Node.js 20 Alpine

## 3. Repository Structure

```text
/
├── server.ts
├── server/
│   ├── auth.ts
│   ├── contracts.ts
│   ├── crypto.ts
│   ├── db.ts
│   ├── migrations/
│   ├── notifications/
│   ├── numbering.ts
│   ├── persistence.ts
│   ├── requestContext.ts
│   ├── runtime-hardening.ts
│   ├── services.ts
│   └── taxonomy.ts
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── components/
│   ├── data/
│   ├── services/
│   └── types.ts
├── scripts/
│   ├── build-server.cjs
│   ├── cr04-cr05-verify.mjs
│   ├── p0-security-verify.mjs
│   └── ...
├── docker-compose.yml
├── package.json
└── vite.config.ts
```

## 4. Persistence

PostgreSQL is the authoritative persistence layer for operational data.

The application uses PostgreSQL tables for users, assets, assignments, movements, loans, tickets, contracts, notifications, maintenance records, and audit logs.

Browser `localStorage` is not the authoritative application database. It is limited to the `gabah_auth_token` key required by the authentication flow.

## 5. Authentication & Authorization

Authentication is handled by the Node/Express backend (PBKDF2 password hashing, Bearer sessions, rate limiting, server-side authorization, audit logging).

Final application roles (9, per PRD.md — verified against `server/db.ts` CANONICAL_USERS):

1. Admin GABAH
2. IT
3. GA
4. Sekretaris Direksi
5. Humas
6. Supply Chain
7. PIBC
8. Karyawan
9. Auditor (read-only)

Management and Vendor are not application login roles.

## 6. Verified Status (3 Oktober 2026)

Hasil verifikasi yang benar-benar dijalankan (bukan klaim):

| Check | Command | Result |
|---|---|---|
| Typecheck | `npm run lint` (`tsc --noEmit`) | PASS — 0 error |
| Platform typecheck | `tsc -b --noEmit` | PASS — 0 error |
| Production build | `npm run build` (vite + esbuild) | PASS — dist/ + dist/server.cjs |
| Security P0 matrix | `node scripts/p0-security-verify.mjs` | PASS — 37/37 live HTTP |

Catatan verifikasi:

1. **TypeScript strict mode**: kode belum lolos `tsc --noEmit --strict` (~9.000+ error). Klaim "TypeScript Strictest Discipline" di PROJECT-RULES.md belum terpenuhi; anggap roadmap bertahap.
2. **CR-04 (PostgreSQL persistence/migrasi 001–005)**: kode lengkap, tetapi **belum terverifikasi end-to-end** di lingkungan ini karena tidak ada instance PostgreSQL. Verifikasi via `scripts/cr04-cr05-verify.mjs` + `GABAH_TEST_PG_ADMIN_URL` pada mesin dengan Postgres.
3. **CR-05 (contract reminder/email/Telegram)**: kode ada (`server/notifications/`); verifikasi live tergantung CR-04.
4. **Test otomatis**: hanya script P0 (self-booting). Tidak ada unit/integration test framework (vitest/jest) dan belum ada CI (GitHub Actions).
5. **Modul masih mock/statik**: Vendors, Knowledge Base, dan sebagian jadwal Maintenance (belum ada endpoint `/api/maintenances` yang dipanggil frontend).
6. **Bundle frontend 899 kB** (belum code-splitting) — non-blocking, tapi perlu dioptimasi.

## 7. Server-Authoritative Business Logic

Business-critical operations are enforced server-side: asset numbering, division ownership scope, loan conflict validation, loan approve/reject/handover/return, ticket lifecycle state machine, RBAC authorization, audit logging, Accurate/ERP reconciliation. Verified by the P0 matrix (37/37).

## 8. Production Readiness

Blockers sebelum production/UAT sign-off:

1. CR-04: jalankan `scripts/cr04-cr05-verify.mjs` terhadap PostgreSQL 17 sungguhan (migrasi fresh DB, persistence restart, production fail-fast).
2. CR-05: sweep reminder idempoten + status channel jujur (sent/failed/skipped).
3. UAT formal 9 peran sesuai `docs/testing/UAT.md` — hasilnya harus direkam (bukti, bukan narasi).
4. Matikan semua jalur dev-only di produksi (auto-login dev, `GABAH_TEST_PASSWORD` sudah diabaikan di production — pastikan verifikasi ulang).
5. CI pipeline (lint + build + P0 script) dan backup/restore PostgreSQL terjadwal.
6. Putuskan target deployment: Docker Compose di server organisasi (pola yang didukung repo) — bukan static hosting.

## 9. Conclusion

The authoritative GABAH architecture is **React + Node.js/Express + PostgreSQL 17**. Kode inti (auth, RBAC, asset/loan/ticket/contract domain) sehat dan teruji pada level API keamanan; risiko terbesar ada di **verifikasi persistensi PostgreSQL (CR-04/CR-05)**, **kedisiplinan tipe strict**, dan **formalisasi UAT/CI**. Development, UAT, and production work should continue on this stack.
