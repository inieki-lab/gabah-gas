# GABAH — Authoritative System Architecture Specification

**Dokumen:** `docs/architecture/ARCHITECTURE.md`  
**Sistem:** GABAH (*General Asset, Business & Automated Helpdesk*)  
**Organisasi:** PT Food Station Tjipinang Jaya (Perseroda)  
**Versi Arsitektur:** 2026.1.0-enterprise  
**Status:** Authoritative Baseline (Tervalidasi Sesuai Source Code Aktual)  
**Terakhir Diperbarui:** 28 September 2026  

---

## 1. Ringkasan Eksekutif Arsitektur

Arsitektur aplikasi GABAH beroperasi di bawah prinsip **Single Source of Truth** satu arah:

$$\text{React 19 (SPA)} \longrightarrow \text{Express REST API} \longrightarrow \text{Domain Services Layer} \longrightarrow \text{PostgreSQL 17 Relational Engine}$$

Sistem tidak lagi menggunakan arsitektur warisan (legacy) PHP/Laravel. Seluruh kode backend berjalan di atas platform **Node.js, Express, TSX, dan TypeScript** yang terintegrasi secara modular.

```
+-----------------------------------------------------------------------------------+
|                            CLIENT BROWSER (PORT 3000 / 80)                        |
|   +---------------------------------------------------------------------------+   |
|   |                          React 19 SPA (Vite 6)                            |   |
|   |   - Tailwind CSS v4             - Plus Jakarta Sans Typography            |   |
|   |   - Lucide React Icons          - Motion Animations                       |   |
|   |   - 11 Main Views               - 14 Interactive Modals                   |   |
|   |   - Bearer Token Session Client (localStorage: gabah_auth_token only)     |   |
|   +---------------------------------------------------------------------------+   |
+------------------------------------------+----------------------------------------+
                                           | HTTP REST API (Bearer Token)
                                           v
+-----------------------------------------------------------------------------------+
|                        APPLICATION SERVER (Node.js 20 Alpine)                     |
|                                                                                   |
|   [ Entry Point: server.ts ]                                                      |
|   - Express 4.21 Application Server                                               |
|   - Vite Middleware (Dev) / Static Asset Server (Prod: dist/)                     |
|                                                                                   |
|   [ Security & Hardening Middleware: server/runtime-hardening.ts ]                |
|   - API Rate Limiter (200 req/min per IP)                                         |
|   - Anti-Spoofing Guard (Rejects unverified x-user-id headers)                    |
|   - Token Authenticator (Validates Bearer token via server/auth.ts)               |
|   - Auditor Read-Only Interceptor (Enforces strict 403 on non-GET)                |
|   - Role-Based Attention Scoping                                                  |
|                                                                                   |
|   [ Domain & Business Services: server/services.ts ]                              |
|   - GabahDomainService (Asset CRUD, Assignment, Movement, Lifecycle)              |
|   - Loan Collision Engine (Anti-bentrok jadwal per-asset)                         |
|   - Ticket SLA Calculator (Urgent 4h, High 8h, Medium 24h, Low 48h)               |
|   - Room Reservation Manager (VIP Auto-approval & Multi-channel notifications)    |
|   - Immutable Audit Recorder (Logs all state mutations to audit_logs)             |
|                                                                                   |
|   [ Core Engines & Resolvers ]                                                    |
|   - AssetNumberingEngine (server/numbering.ts) -> Canonical format                |
|   - Taxonomy Resolver (server/taxonomy.ts) -> PSAK 16 BUMD mapping                |
|   - Auth Engine (server/auth.ts & crypto.ts) -> PBKDF2/SHA-256 with salt          |
|                                                                                   |
|   [ Dual-Persistence Manager: server/persistence.ts ]                             |
|   - Automated Schema Migration Runner (server/migrations/*.sql)                   |
|   - PostgreSQL Connection Pool (pg.Pool)                                          |
|   - Resilient Fail-Safe Snapshot Store (server/data/gabah_state.json)             |
+------------------------------------------+----------------------------------------+
                                           | TCP 5432 (pg connection pool)
                                           v
+-----------------------------------------------------------------------------------+
|                       DATABASE LAYER (PostgreSQL 17 Alpine)                       |
|                                                                                   |
|   - divisions               - departments            - users                      |
|   - user_sessions           - asset_categories       - assets                     |
|   - asset_assignments       - asset_movements        - asset_number_sequences     |
|   - loans (PL/pgSQL Anti-Collision Trigger)          - tickets                    |
|   - ticket_comments         - contracts              - notifications              |
|   - audit_logs              - gabah_state (Bridge cache)                          |
+-----------------------------------------------------------------------------------+
```

---

## 2. Lapisan Frontend (Presentation Layer)

1. **Framework & Toolkit**:
   - React 19 dengan TypeScript functional components dan hooks.
   - Vite 6 sebagai build tool & development server bundler.
   - Tailwind CSS v4 dengan impor global modern `@import "tailwindcss";`.
   - Motion untuk transisi halus antar modal dan tab.
2. **Struktur Komponen (`src/components/`)**:
   - `views/`: 11 tampilan modul utama:
     - `DashboardView.tsx` (KPI, attention center, overview SLA).
     - `AssetsView.tsx` (Katalog aset multi-divisi, filter kategori, batch QR).
     - `MyAssetsView.tsx` (Aset yang ditugaskan langsung ke persona login).
     - `MeetingRoomsView.tsx` (Jadwal reservasi ruangan, filter tanggal, status VIP).
     - `LoansView.tsx` (Sirkulasi peminjaman, approval, handover, return, BAST).
     - `TicketsView.tsx` (Helpdesk gangguan, SLA countdown, penugasan teknisi).
     - `MaintenanceView.tsx` (Servis berkala, checklist teknis, tera jembatan timbang).
     - `LicensesView.tsx` (Manajemen kursi software & SaaS, tanggal perpanjangan).
     - `VendorsView.tsx` (Daftar rekanan servis, kontrak, rating kepuasan).
     - `KnowledgeBaseView.tsx` (SOP teknis, artikel panduan operasional).
     - `ReportsView.tsx` (Rekonsiliasi Accurate ERP, depresiasi aset, audit trail).
   - `modals/`: 14 modal dialog interaktif untuk input, edit, detail, slip, scanner, dan administrasi kontrol panel.
   - `HeaderNavbar.tsx`: Top bar, status koneksi SSL, notifikasi lonceng, dan quick persona role switcher.
   - `Sidebar.tsx`: Navigasi samping dengan segmentasi menu dan akses restricted Administration Control Panel khusus Super Admin.
3. **Klien API (`src/services/gabahApi.ts`)**:
   - Membungkus seluruh panggilan `fetch` dengan penyematan header `Authorization: Bearer <token>`.
   - Menangani token session storage dan deserialisasi error respons terstruktur.

---

## 3. Lapisan Backend & API Server (Application Layer)

1. **Server Entry Point (`server.ts`)**:
   - Menjalankan Express app pada port 3000 (atau port 80 pada kontainer Docker produksi).
   - Mengikat Vite development middleware saat mode pengembangan aktif.
   - Mendaftarkan 46 endpoint REST API terotentikasi.
2. **Runtime Security Middleware (`server/runtime-hardening.ts`)**:
   - Mencegah peretasan identitas via header `x-user-id` tanpa token (`authenticateRequest`).
   - Menerapkan batasan akses per divisi (scoping aset dan tiket).
   - Memblokir seluruh operasi mutasi (non-GET) dari akun dengan peran `Auditor`.
   - Melindungi API dari serangan denial-of-service/scraping dengan rate limiter (200 req/menit).
3. **Domain Services (`server/services.ts`)**:
   - `GabahDomainService`: Enkapsulasi seluruh aturan bisnis aset, peminjaman, tiket, reservasi ruang rapat, notifikasi, dan pencatatan audit.

---

## 4. Lapisan Persistensi & Database (Data Layer)

1. **PostgreSQL 17 Authoritative Store**:
   - Koneksi dikelola oleh pool klien `pg` (`server/persistence.ts`).
   - Konfigurasi database dimuat dari variabel lingkungan (`DATABASE_URL`, `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`).
   - Migrasi DDL dijalankan otomatis pada saat booting server (`ensureNormalizedSchema`) dari folder `server/migrations/`.
2. **Dual-Persistence Resilience Manager**:
   - Setiap mutasi data langsung dicatat ke cache/memory snapshot dan disinkronkan ke file `server/data/gabah_state.json`.
   - Jika koneksi PostgreSQL host terhubung, data disinkronkan secara transaksional ke tabel ternormalisasi PostgreSQL (`backfillNormalizedTables`).
   - Mekanisme ini menjamin sistem tetap dapat beroperasi (resilient) tanpa kehilangan data operasional bahkan dalam kondisi infrastruktur basis data host sedang cold-booting.

---

## 5. Konfigurasi Kontainer & Produksi (Deployment)

1. **Docker Compose (`docker-compose.yml`)**:
   - Layanan `database`: Image `postgres:17-alpine`, volume data persisten `postgres_data` dimount ke `/var/lib/postgresql/data`.
   - Layanan `app`: Image `node:20-alpine`, port mapping `80:3000`, terhubung via bridge network `gabah_network`.
   - Perintah build aplikasi: `npm install && npm run build && npm start`.
2. **Kompilasi Server Produksi (`scripts/build-server.cjs`)**:
   - Menggunakan `esbuild` untuk mem-bundle `server.ts` dan seluruh dependensinya menjadi satu file mandiri `dist/server.cjs` yang siap dieksekusi oleh runtime Node.js.
