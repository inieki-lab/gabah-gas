# GABAH — ARCHITECTURE BASELINE & CONVERGENCE MAPPING
**Repository:** inieki-lab/GABAH  
**Organization:** PT Food Station Tjipinang Jaya (Perseroda)  
**Date:** 2026-09-17  
**Status:** AUTHORITATIVE BASELINE  
**Author:** ARCHITECT + SENIOR FULL-STACK ENGINEER  

---

## 1. Executive Summary

Dokumen ini memetakan baseline arsitektur lengkap sistem **GABAH** (General Asset & Business Administration Hub) dari lapisan antarmuka pengguna hingga persistensi relasional PostgreSQL. Tujuannya adalah memastikan konvergensi arsitektur satu arah (*Frontend -> REST API -> Domain Services -> PostgreSQL Single Source of Truth*) tanpa dependensi tersembunyi pada `localStorage` browser atau data tiruan (mock data).

---

## 2. Inventaris Struktur Proyek (Source Folders)

```
/
├── .env.example                     # Definisi variabel lingkungan & database credentials
├── docker-compose.yml               # Container definition: Node.js app & PostgreSQL 17
├── server.ts                        # Server entry point (Express + Vite Middleware)
├── package.json                     # Node.js dependencies & scripts
├── index.html                       # SPA HTML entry point
├── server/                          # Backend Domain & Persistence Engine
│   ├── auth.ts                      # Session token engine, rate limiting, PBKDF2
│   ├── crypto.ts                    # SHA-256 + salt password hashing & token generation
│   ├── db.ts                        # Server types, initial seeders, in-memory state mirrors
│   ├── migrations/                  # PostgreSQL DDL Migrations
│   │   ├── 001_gabah_normalized_schema.sql  # Normalized relational schema (11 tables)
│   │   └── 002_gabah_auth_hardening.sql     # Password hashing & user_sessions table
│   ├── numbering.ts                 # Server-authoritative sequence & numbering generator
│   ├── persistence.ts               # PostgreSQL Pool, state hydration & background backup
│   ├── runtime-hardening.ts         # Server-side RBAC middleware & anti-spoofing
│   ├── services.ts                  # Domain service (Asset, Loan, Ticket, Lifecycle, Audit)
│   └── taxonomy.ts                  # Canonical BUMD asset taxonomy & resolver
├── src/                             # Frontend React 19 Application
│   ├── App.tsx                      # Root component, state binding, modal management
│   ├── main.tsx                     # React DOM bootstrap
│   ├── types.ts                     # Shared TypeScript interfaces & types
│   ├── components/                  # UI Modular Components
│   │   ├── HeaderNavbar.tsx         # Top bar, notifications dropdown, user menu
│   │   ├── Sidebar.tsx              # Navigation tabs, active badge, quick links
│   │   ├── auth/LoginPage.tsx       # Auth login form & quick demo persona selector
│   │   ├── landing/LandingPage.tsx  # Public landing view
│   │   ├── modals/                  # Modals (CreateAsset, Loan, Ticket, QR, BAST, Detail)
│   │   └── views/                   # Main views (Dashboard, Assets, Loans, Tickets, etc.)
│   ├── data/                        # Static reference & fallback seeder
│   │   └── mockData.ts              # Fallback initial data (synchronized with DB)
│   └── services/                    # Client Services
│       ├── gabahApi.ts              # Authoritative API Client (`fetch` with Bearer tokens)
│       └── gabahService.ts          # Client-side utility functions (SLA formatting, etc.)
└── scripts/                         # Build & maintenance scripts
    ├── build-server.cjs             # Server compilation to dist/server.cjs
    └── reset-temporary-users.mjs    # Database seeder script for PostgreSQL
```

---

## 3. End-to-End Mapping: Frontend -> API -> Service -> PostgreSQL

| Fitur / Modul | Frontend Entry Point (`src/`) | API Endpoint (`server.ts`) | Service Method (`server/`) | PostgreSQL Target Table(s) |
| :--- | :--- | :--- | :--- | :--- |
| **Kredensial & Sesi** | `LoginPage.tsx`<br>`gabahApi.login()` | `POST /api/auth/login`<br>`POST /api/auth/logout`<br>`GET /api/auth/me` | `createSession()`<br>`destroySession()`<br>`verifyPassword()` | `users`<br>`user_sessions` |
| **Simulasi Peran** | `Sidebar.tsx`<br>`gabahApi.switchRole()` | `POST /api/auth/switch-role` | `createSession()`<br>`GabahDomainService.recordAudit()` | `user_sessions`<br>`audit_logs` |
| **Manajemen Pengguna** | `AdministrationModal.tsx`<br>`gabahApi.getUsers()` | `GET /api/users`<br>`POST /api/users`<br>`PATCH /api/users/:id`<br>`DELETE /api/users/:id` | `GabahDomainService.recordAudit()`<br>`hashPassword()` | `users`<br>`user_sessions` |
| **Katalog Aset Tetap** | `AssetsView.tsx`<br>`gabahApi.getAssets()` | `GET /api/assets`<br>`GET /api/assets/:id` | `GabahDomainService.getScopedAssets()` | `assets`<br>`asset_categories`<br>`divisions` |
| **Registrasi Aset Baru** | `CreateAssetModal.tsx`<br>`gabahApi.createAsset()` | `POST /api/assets` | `GabahDomainService.createAsset()`<br>`AssetNumberingEngine.generateAssetNumber()` | `assets`<br>`asset_number_sequences` |
| **Update Aset & ERP** | `AssetDetailModal.tsx`<br>`gabahApi.updateAsset()` | `PATCH /api/assets/:id` | `GabahDomainService.recordAudit()` | `assets` (termasuk `corporate_asset_number`) |
| **Penugasan (Assignment)** | `AssetDetailModal.tsx`<br>`gabahApi.assignAsset()` | `POST /api/assets/:id/assign` | `GabahDomainService.assignAsset()` | `assets`<br>`asset_assignments`<br>`asset_movements` |
| **Mutasi Lokasi Fisik** | `AssetDetailModal.tsx`<br>`gabahApi.moveAsset()` | `POST /api/assets/:id/move` | `GabahDomainService.moveAsset()` | `assets`<br>`asset_movements` |
| **Siklus Hidup (Lifecycle)** | `AssetDetailModal.tsx`<br>`gabahApi.mutateLifecycle()` | `POST /api/assets/:id/lifecycle` | `GabahDomainService.mutateLifecycle()` | `assets`<br>`audit_logs` |
| **Peminjaman Aset** | `CreateLoanModal.tsx`<br>`gabahApi.requestLoan()` | `POST /api/loans`<br>`GET /api/loans` | `GabahDomainService.requestLoan()`<br>`AssetNumberingEngine.generateLoanNumber()` | `loans`<br>`assets`<br>`notifications` |
| **Approval Peminjaman** | `LoansView.tsx`<br>`gabahApi.approveLoan()` | `POST /api/loans/:id/approve` | `GabahDomainService.approveLoan()` | `loans`<br>`notifications` |
| **Serah Terima / Handover** | `LoansView.tsx`<br>`gabahApi.handoverLoan()` | `POST /api/loans/:id/handover` | `GabahDomainService.handoverLoan()` | `loans`<br>`assets` (status: `in_use`) |
| **Pengembalian / Return** | `LoansView.tsx`<br>`gabahApi.returnLoan()` | `POST /api/loans/:id/return` | `GabahDomainService.returnLoan()` | `loans`<br>`assets` (status: `available`) |
| **Tiket Helpdesk** | `CreateTicketModal.tsx`<br>`gabahApi.createTicket()` | `POST /api/tickets`<br>`GET /api/tickets` | `GabahDomainService.createTicket()`<br>`AssetNumberingEngine.generateTicketNumber()` | `tickets`<br>`notifications` |
| **Penyelesaian Tiket** | `TicketsView.tsx`<br>`gabahApi.updateTicketStatus()`| `PATCH /api/tickets/:id/status`| `GabahDomainService.recordAudit()` | `tickets` |
| **Pemeliharaan / Servis**| `MaintenanceView.tsx`<br>`gabahApi.getMaintenances()` | `GET /api/maintenances`<br>`POST /api/maintenances`<br>`PATCH /api/maintenances/:id`| `GabahDomainService.recordAudit()` | `maintenances` (relasi `assets` & `vendors`) |
| **Rekonsiliasi Accurate** | `ReportsView.tsx`<br>`gabahApi.linkReconciliation()` | `GET /api/reconciliation`<br>`POST /api/reconciliation/link` | `GabahDomainService.getReconciliationData()` | `assets` (`corporate_asset_number`) |
| **Audit Log Trail** | `ReportsView.tsx`<br>`gabahApi.getAuditLogs()` | `GET /api/audit-logs` | `GabahDomainService.recordAudit()` | `audit_logs` |
| **Attention Center** | `DashboardView.tsx`<br>`gabahApi.getAttentionCenter()`| `GET /api/dashboard/attention`| `GabahDomainService.getAttentionCenter()` | Query gabungan: `tickets`, `loans`, `assets` |

---

## 4. Matriks Akses Peran Final (7 Application Login Roles)

| Peran (Role) | Lingkup Akses (Scope) | Hak Akses Aset | Hak Akses Pinjam | Hak Akses Tiket | Akses Audit Log |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Admin GABAH** | Seluruh Sistem (Enterprise) | CRUD Semua Divisi | Approve/Handover Semua | Kelola Semua Tiket | Full View & Export |
| **2. IT** | Divisi IT | CRUD Aset Hardware & Software | Approve/Handover Aset IT | Kelola Tiket IT & Software | View Divisi IT |
| **3. GA** | Divisi GA (Umum) | CRUD Furniture, Bangunan, Kendaraan | Approve/Handover Aset GA | Kelola Tiket GA/Fasilitas | View Divisi GA |
| **4. Supply Chain** | Divisi Supply Chain | CRUD Mesin Pabrik, Truk Logistik | Approve/Handover Aset SC | Kelola Tiket Pabrik/Logistik | View Divisi SC |
| **5. PIBC** | Divisi Pasar Induk Cipinang | CRUD Sarana Pasar & Timbangan | Approve/Handover Aset PIBC | Kelola Tiket Pasar Cipinang | View Divisi PIBC |
| **6. Karyawan** | Personal / Individu | Read Aset Sendiri & Pool Peminjaman | Request Peminjaman Sendiri | Buat Tiket & Lihat Tiket Sendiri | Ditolak (403) |
| **7. Auditor** | Seluruh Sistem (Audit Trail) | Read-Only Semua Divisi | Read-Only Semua Pinjaman | Read-Only Semua Tiket | Full View Read-Only |

> **Ketentuan Mutlak:**
> 1. Role `Management` telah dihapus dari autentikasi login (pengawasan eksekutif menggunakan akun Auditor read-only atau Admin GABAH).
> 2. Role `Vendor` dihapus dari RBAC pengguna login (Vendor dikelola murni sebagai entitas master rekanan servis/kontrak).

---

## 5. Taksonomi & Penomoran Aset (Server-Authoritative)

### 5.1 Format Penomoran Kanonikal
`{OWNER_DIVISION}-{ASSET_CODE}-{YEAR}-{SEQUENCE}`

Contoh Riil:
- Laptop IT: `IT-HLT-2026-0001`
- Komputer Desktop: `IT-HPC-2026-0001`
- Server Datacenter: `IT-HSV-2026-0001`
- Lisensi Microsoft 365: `IT-SLIC-2026-0001`
- Furniture Kantor: `GA-INV-F-2026-0001`
- Truk Angkutan Beras: `SC-KDR-SC-2026-0001`
- Jembatan Timbang Beras PIBC: `PIBC-MSN-2026-0001`

### 5.2 Nomor ERP / Accurate
Nomor aset Accurate disimpan di field terpisah `corporate_asset_number` (misal `FA-2024-00892`) dan tidak pernah menimpa `asset_number` kanonikal sistem.

---

## 6. Persistensi & Arsitektur Data

1. **Authoritative Persistence:** PostgreSQL (melalui tabel `assets`, `users`, `user_sessions`, `asset_assignments`, `asset_movements`, `loans`, `tickets`, `notifications`, `audit_logs`).
2. **Ketiadaan LocalStorage:** `localStorage` pada browser **hanya** digunakan untuk menyimpan token autentikasi sesi (`gabah_auth_token`). Seluruh data operasional dimuat langsung dari server melalui `gabahApi`.
3. **Penyimpanan Cadangan (Resilience):** File `server/data/gabah_state.json` digunakan murni sebagai fallback offline container jika koneksi PostgreSQL host terputus saat cold-boot.
