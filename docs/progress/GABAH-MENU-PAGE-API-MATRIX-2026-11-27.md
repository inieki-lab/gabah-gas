# GABAH Menu → Page → Data → Action Matrix

**Tanggal:** 27 November 2026  
**Baseline source:** `main` at `4f10d7a3aada9f41cd9e6cd2abe980b52054839e`  
**Jenis bukti:** pemetaan source; bukan hasil browser UAT.

| Menu / NavTab | Komponen halaman | Data utama yang dipasok App | Aksi utama yang dihubungkan App |
|---|---|---|---|
| Dashboard / `dashboard` | `DashboardView` | aset, pinjaman, tiket, audit log, reservasi ruang, current user | navigasi menu, buka modal pinjam/tiket/aset |
| Aset Saya / `my_assets` | `MyAssetsView` | aset, pinjaman, current user | detail aset, lapor tiket, pinjam, tiket helpdesk, ajukan pengembalian |
| Ruang Rapat / `meeting_rooms` | `MeetingRoomsView` | ruang, reservasi, current user, filter kategori | buat, setujui, tolak, check-in, check-out, batalkan reservasi, ubah status ruang, refresh |
| Aset / `assets` | `AssetsView` | aset terscope, current user | detail, edit, QR, scanner, tambah aset, pinjam, lapor tiket, impor |
| Maintenance / `maintenance` | `MaintenanceView` | jadwal maintenance, aset terscope, current user | ubah status jadwal, tambah jadwal |
| Peminjaman / `loans` | `LoansView` | pinjaman terscope, aset terscope, current user | permohonan baru, setujui, tolak, serah terima, pengembalian, BAST |
| Helpdesk & Tiket / `tickets` | `TicketsView` | tiket terscope, aset terscope, current user | buat tiket, ubah status, ubah penugasan |
| Software & SaaS / `licenses` | `LicensesView` | aset terscope, current user | detail aset, buka form aset baru |
| Vendor / `vendors` | `VendorsView` | vendor, current user | buat vendor, ubah vendor |
| Kontrak / `contracts` | `ContractsView` | kontrak terscope, current user | refresh, buat kontrak, buat tiket terkait kontrak |
| Knowledge Base / `knowledge` | `KnowledgeBaseView` | artikel, current user | buat/ubah artikel, catat view, vote helpful |
| Laporan & Audit / `reports` | `ReportsView` | aset, pinjaman, tiket, audit log, jadwal maintenance | baca laporan; tidak ada mutation callback dari App |

## Initial data endpoints invoked by `refreshData()`

| Collection | API client method |
|---|---|
| Assets | `getAssets()` |
| Loans | `getLoans()` |
| Tickets | `getTickets()` |
| Audit logs | `getAuditLogs()` |
| Users | `getUsers()` |
| Meeting rooms | `getMeetingRooms()` |
| Room reservations | `getRoomReservations()` |
| Contracts | `getContracts()` |
| Maintenance | `getMaintenances()` |
| Vendors | `getVendors()` |
| Knowledge articles | `getKnowledgeArticles()` |
| Asset movements | `getMovements()` |

## Cross-cutting UI

- Sidebar navigation: `Sidebar` → `navigateToTab` → effective permission + active module check → `currentTab` → matching App render branch.
- Administration Control Panel: separate modal, Superadmin only; not one of the 12 ordinary `NavTab` values.
- Header actions include account/role switch, notifications, scanner, global search, password change, and logout; they require separate UAT from the sidebar menu matrix.

## UAT execution rule

For each row, verify at least:
1. menu visibility for the persona;
2. click changes the active page;
3. page displays correct empty/loading/error state;
4. read action succeeds or shows a meaningful denial;
5. each listed mutation succeeds for an authorized persona;
6. the same mutation is rejected for an unauthorized persona;
7. refresh/reload shows the committed server state.

A page's existence and callback wiring in source do not prove its API permission, data scope, or transaction behavior. Browser UAT and backend negative tests remain mandatory.
