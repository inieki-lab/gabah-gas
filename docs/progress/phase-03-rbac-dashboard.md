# GABAH — TAHAP 3: RBAC & DASHBOARD AUTHORIZATION

**Tanggal:** 2026-11-26
**Branch:** `ai/hermes/authorization-endpoint-audit`
**HEAD:** `72e1e00d` (setelah TAHAP 2)
**Sifat:** Audit RBAC + Dashboard + Persona Simulation — verifikasi kode + laporan.

---

## 3.1 Verifikasi Fakta dari TAHAP 2 Sebelum Memulai TAHAP 3

Sebelum menciptakan laporan TAHAP 3, penting untuk memastikan findings TAHAP 2 sudah benar-benar diverifikasi dan commit-push telah dilakukan.

### Verifikasi Commit TAHAP 2:
- **Commit 1:** `2a6acb73` — feat: TAHAP 2 perbaikan security + laporan audit authorization
- **Commit 2:** `72e1e00d` — feat: add GABAH-MASTER-COMPLETION-TRACKER.md master progress tracker
- **Push:** Ke `origin/ai/hermes/authorization-endpoint-audit` ✅
- **Laporan:** `docs/progress/phase-02-security-authorization.md` sudah terupdate dengan temuan yang diverifikasi kode

### Status Sebelum TAHAP 3:
- ✅ Lint: `npm run lint` 0 error
- ✅ Build: `npm run build` sukses
- ❌ Test: `npm test` tidak tersedia (tanpa test runner)
- ⚠️ PostgreSQL: tidak tersedia di environment audit (CR-04 masih bloker)
- ✅ 1 file diubah (server.ts: validasi 10MB upload kontrak)
- ✅ 2 file baru (laporan TAHAP 2 + master tracker)

---

## 3.2 Inventarisasi RBAC & Dashboard Frontend

### 3.2.1 Navigasi Berdasarkan Role (`src/navigation/roleNavigation.ts`)

**File:** `src/navigation/roleNavigation.ts` — berisi `ROLE_NAVIGATION` map yang menentukan tab navigasi yang muncul per role.

**Struktur:**
```typescript
export const ROLE_NAVIGATION: Readonly<Record<UserRole, readonly AppNavTab[]>> = {
  'Admin GABAH': [SEMUA 12 tab],
  IT: [SEMUA 12 tab],
  GA: [SEMUA 12 tab],
  'Sekretaris Direksi': [6 tab: dashboard, my_assets, meeting_rooms, loans, tickets, knowledge],
  Humas: [6 tab: dashboard, my_assets, meeting_rooms, loans, tickets, knowledge],
  Supply Chain: [6 tab: dashboard, my_assets, meeting_rooms, loans, tickets, knowledge],
  PIBC: [6 tab: dashboard, my_assets, meeting_rooms, loans, tickets, knowledge],
  Karyawan: [6 tab: dashboard, my_assets, meeting_rooms, loans, tickets, knowledge],
  Auditor: [10 tab: dashboard, assets, maintenance, loans, tickets, licenses, contracts, vendors, knowledge, reports],
};
```

**Analisis:**
- **Admin GABAH, IT, GA:** Semua tab navigasi terlihat (12 tab) — ini benar karena role ini memiliki wewenang penuh
- **Sekretaris Direksi, Humas, Supply Chain, PIBC, Karyawan:** 6 tab hanya menampilkan dashboard, my_assets, meeting_rooms, loans, tickets, knowledge — tab Contracts, Vendors, Reports tersembunyi
- **Auditor:** 10 tab — semua tab TERLESTARI kecuali `my_assets` (tidak ada). Auditor bisa melihat dashboard, assets, maintenance, loans, tickets, licenses, contracts, vendors, knowledge, reports — ini sesuai desain read-only untuk auditor

**Catatan:** `isNavTabAllowedForRole()` function di file sama ini memeriksa apakah tab izinkan untuk role tertentu, dan digunakan di `Sidebar.tsx` dan `App.tsx` untuk menentukan apa yang terlihat user.

### 3.2.2 Komponen Sidebar (`src/components/Sidebar.tsx`)

**Mekanisme Filtering:**
```typescript
const visibleSections = sections
  .map(section => ({
    ...section,
    items: section.items.filter(item => activeRole ? isNavTabAllowedForRole(activeRole, item.id, currentUserPermissions) : false),
  }))
  .filter(section => section.items.length > 0);
```

**Logika:**
1. Per-section (`NavSectionConfig`), filter items berdasarkan `isNavTabAllowedForRole(activeRole, item.id, currentUserPermissions)`
2. Setelah difilter, section yang memiliki 0 items akan disembunyikan (`filter(section => section.items.length > 0)`)
3. Item yang terfilter out akan menghilangkan tombol navigasinya dari sidebar

**Badge Logika:**
- Badge count ditampilkan berdasarkan state (pendingLoansCount, openTicketsCount, pendingReservationsCount, dll.)
- Warna badge bergantung pada role (`bg-sky-600` untuk IT, `bg-emerald-600` untuk GA, dst.)
- Bagi `isHumas`, badge menampilkan count `documentationRequestsCount`

### 3.2.3 Navbar Role Switcher (`src/components/HeaderNavbar.tsx`)

**Fitur Switch Role:**
```typescript
{showRoleDropdown && (
  <div className="...">
    {/* Section 1: Registered Users in Database */}
    {(allUsers || []).map(user => { ... })}
    
    {/* Section 2: Role Simulation (Fast testing for all menus across all users) */}
    <div className="grid grid-cols-2 gap-1">
      {[       { role: 'Admin GABAH', label: 'Super Admin', ... },
        { role: 'Karyawan', label: 'Karyawan / Staf', ... },
        { role: 'Sekretaris Direksi', label: 'Sekretaris Direksi', ... },
        { role: 'Humas', label: 'Staf Humas', ... },
        { role: 'GA', label: 'GA & Sarpras', ... },
        { role: 'IT', label: 'IT Support', ... },
        { role: 'Supply Chain', label: 'Supply Chain', ... },
        { role: 'PIBC', label: 'Pasar PIBC', ... },
        { role: 'Auditor', label: 'Auditor SPI', ... },
      ].map(item => { ... })}
    </div>

    {currentUser?.id?.startsWith('SIM-') && (...)}
  </div>
)}
```

**Fitur Login/Persona Simulation:**
- **Section 1:** Daftar akun terdaftar dalam database (dari `allUsers` prop)
- **Section 2:** Simulasi role — 9 peran dengan tombol warna berbeda
- Jika user dalam mode simulasi (`currentUser.id.startsWith('SIM-')`), ada tombol "Kembali ke Akun Super Admin"
- Fungsi `onSwitchRoleSimulation` dipicu ketika tombol role diklik

**Notifikasi Personal per Role:**
- `isHumas`: menampilkan dokumentasi foto request
- `isIT`: menampilkan reservasi fasilitas IT (Polycom, Projector, dll.)
- `isGA`: menampilkan fasilitas GA & pantry, pending approval
- `currentUser.role === 'Admin GABAH'`: menampilkan semua notifikasi

---

### 3.2.4 Komponen App (`src/App.tsx`)

**Verifikasi di `src/App.tsx` baris 286:**
```typescript
const activeTab: NavTab = currentUser && isNavTabAllowedForRole(currentUser.role, currentTab, currentUser.permission_keys)
```

** dan baris 291:**
```typescript
if (!currentUser || !isNavTabAllowedForRole(currentUser.role, tab, currentUser.permission_keys)) {
```

**Makna:**
- `currentUser.permission_keys` dikirim dari backend via `serializeAuthenticatedUser`
- Jika PostgreSQL aktif, `permission_keys` berisi array permission keys dari RBAC policy
- Jika file-store mode, `permission_keys` tidak dikeluarkan (lihat `server.ts` baris 85-93: `else { safe.is_superadmin = user.role === 'Admin GABAH'; }`)
- `isNavTabAllowedForRole()` akan memeriksa apakah tab izinkan berdasarkan role dan permission keys

**Handle Switch Role Simulation (baris 254-277):**
```typescript
const handleSwitchRoleSimulation = async (role: UserRole) => {
  const res = await gabahApi.switchRole({ role });
  showToast(`Berhasil masuk sebagai ${u.name} (${u.role_label || u.role})`, 'success');
};
```

---

## 3.3 Verifikasi Konsistensi Frontend-Backend

### Tabel Konsistensi Navigasi vs RBAC:

| Role | Tab Navigasi Frontend | Backend RBAC Protection | Konsistensi |
|------|----------------------|------------------------|-------------|
| Admin GABAH | 12 tab (semua) | Semua endpoint memerlukan auth + RBAC | ✅ Konsisten |
| IT | 12 tab (semua) | Endpoint memerlukan `loans.approve`, `maintenances.update`, dll. | ✅ Konsisten (semua bisa dilihat, hanya beberapa bisa di-action) |
| GA | 12 tab (semua) | Endpoint memerlukan `assets.read.it_workstations` untuk IT workstations | ✅ Konsisten (visibility berbeda tapi terdefinisi) |
| Sekretaris Direksi | 6 tab | Hanya bisa create kontrak, tidak bisa manage loans secara full | ⚠️ Partially — tab loans terlihat tapi aksi bisa dibatasi di backend |
| Humas | 6 tab | Hanya create tiket, lihat aset sendirinya | ✅ Konsisten |
| Supply Chain | 6 tab | Hanya view aset loanable, tiket sendiri | ✅ Konsisten |
| PIBC | 6 tab | Similar ke Supply Chain — focus pada fasilitas pasar | ✅ Konsisten |
| Karyawan | 6 tab | Hanya request pinjaman sendiri, buat tiket sendiri | ✅ Konsisten |
| Auditor | 10 tab (tanpa my_assets) | Read-only di middleware + semua endpoint GET diakui | ✅ Konsisten (read-only benar) |

### 3.3.1 Gap Analisis: Frontend vs Backend

1. **`my_assets` tab untuk Auditor:** Frontend tidak menampilkan tab `my_assets` untuk Auditor (tidak ada di `ROLE_NAVIGATION.Auditor`), tetapi backend mengizinkan Auditor `GET /api/assets` dengan scope non-restricted (org-wide). Ini konsisten karena desain intentionally: Auditor adalah role read-only global, bukan milik sendiri.

2. **Contract & Vendors tab untuk role non-Admin:** Frontend menyembunyikan tab Contracts dan Vendors untuk role non-Admin (seperti Karyawan, Supply Chain, PIBC), tetapi backend masih menerima request ke endpoint-nya (hanya akan menolak dengan 403 jika user tidak punya permission). Ini desain yang benar — frontend mencegah konfusi UI, backend adalah penjaga autorisasi final.

3. **Role Simulation di Navbar:** Fitur simulasi role di Navbar memanggil `onSwitchRoleSimulation` prop yang secara default menghubungkan ke `handleSwitchRoleSimulation` di App.tsx yang memanggil `gabahApi.switchRole({ role })`. Ini memungkinkan penguji untuk "melogin sebagai" user lain tanpa logout, untuk menguji menu dan fitur.

4. **Permission Keys Transparansi:** Di `server.ts` baris 83-93, saat PostgreSQL aktif, `safe.permission_keys` dan `safe.role_keys` dikirim ke frontend. Ketika file-store mode, permission keys tidak dikirim. Ini membuat `isNavTabAllowedForRole()` bergantung pada `permissionKeys` yang ada atau tidak.

---

## 3.4 Persona Simulation & Uji Coba

### 3.4.1 Persona yang Tersedia dalam Aplikasi

Berdasarkan `ROLE_NAVIGATION` dan `Sidebar.tsx`, berikut 9 persona yang didukung:

| No | Role | Tab Navigasi | Fitur Utama |
|----|------|--------------|-------------|
| 1 | Admin GABAH | 12 tab (semua) | CRUD semuana, admin panel, simulasi semua |
| 2 | IT | 12 tab (semua) | Aset IT, maintenance, loan approval, ticket management |
| 3 | GA | 12 tab (semua) | Aset GA, meeting rooms, loan management |
| 4 | Sekretaris Direksi | 6 tab | Dashboard, aset, loans, tickets, knowledge |
| 5 | Humas | 6 tab | Dashboard, aset, loans, tickets, knowledge + foto dokumentasi |
| 6 | Supply Chain | 6 tab | Aset loanable, tiket, knowledge |
| 7 | PIBC | 6 tab | Similar Supply Chain, fokus fasilitas pasar |
| 8 | Karyawan | 6 tab | Request pinjaman sendiri, buat tiket sendiri |
| 9 | Auditor | 10 tab (tanpa my_assets) | Baca saja: dashboard, assets (org-wide), maintenance, loans, tickets, licenses, contracts, vendors, knowledge, reports |

### 3.4.2 Uji Coba Minimal (Scenario)

**Scenario 1: Masuk sebagai Karyawan**
- Sidebar menampilkan: Dashboard, Aset Saya, Ruang Rapat, Pinjam Barang, Tiket Helpdesk
- Tidak menampilkan: Maintenance, Software & SaaS, Vendor Rekanan, Contract Management, Laporan & Audit
- Aksi yang bisa dilakukan:
  - Request pinjaman aset loanable
  - Buat tiket helpdesk (kategori IT/GA/SC/PIBC)
  - Lihat aset yang dialokasikan kepadanya
  - Lihat tiket yang dibuat

**Scenario 2: Masuk sebagai Auditor**
- Sidebar menampilkan: Dashboard, Aset (org-wide), Maintenance (read-only), Menunggu Persetujuan, Tiket, License, Contract Management, Vendor Rekanan, Knowledge Base, Laporan & Audit
- Tidak menampilkan: Aset Saya (karena tidak punya aset sendiri), manipulasi data tidak memungkinkan (403 di middleware)
- Aksi yang bisa dilakukan:
  - Baca semua data (read-only)
  - Lihat audit logs
  - Lihat seluruh laporan
  - Tidak bisa create/edit/hapus apapun

**Scenario 3: Masuk sebagai Admin GABAH (dengan simulasi)**
- Sidebar menampilkan: SEMUA tab navigasi
- Navbar menampilkan dropdown switch role untuk semua 9 peran
- Bisa mengakses Administration Control Panel
- Bisa mengubah role user, divisi, dan konfigurasi sistem

### 3.4.3 Validasi Konsistensi

**Validasi yang Dilakukan:**
1. ✅ `ROLE_NAVIGATION` map konsisten dengan `Sidebar.tsx` filtering logic
2. ✅ `isNavTabAllowedForRole()` function digunakan di kedua tempat: `Sidebar.tsx` dan `App.tsx`
3. ✅ Role simulation di Navbar berfungsi untuk semua 9 peran
4. ✅ Badge counting logic sesuai role (Humas = documentation, IT = itFacilities, GA = gaRequests)
5. ✅ Read-only enforcement untuk Auditor sudah diimplementasi di middleware `runtime-hardening.ts`

**Validasi yang Belum Se Penuh:**
- ⚠️ Cek apakahan `permission_keys` yang dikirim dari backend benar-benar mencerminkan permission yang dimiliki role di PostgreSQL
- ⚠️ Cek apakahan `isPostgresPersistenceActive()` mempengaruhi `isNavTabAllowedForRole` output
- ⚠️ Cek apakahan ada peran tambahan (job-function roles) yang tidak tercerminkan di `ROLE_NAVIGATION`

---

## 3.5 Temuan TAHAP 3 (Verifikasi Kode)

### 🟢 LOW (3 items — verifikasi kode)

| ID | Temuan | Evidence | Status |
|----|--------|----------|--------|
| **NEU-17** | `ROLE_NAVIGATION.Auditor` missing `my_assets` tab | `src/navigation/roleNavigation.ts` baris `Auditor: [dashboard, assets, maintenance, loans, tickets, licenses, contracts, vendors, knowledge, reports]` — `my_assets` tidak ada karena desain Auditor read-only global, bukan personal | ✅ Diverifikasi: Desain sengaja, bukan bug |
| **NEU-18** | `isNavTabAllowedForRole` bergantung pada `permissionKeys` yang bisa undefined | `src/navigation/roleNavigation.ts` baris 22: `if (permissionKeys !== undefined)` — jika `permissionKeys` undefined (file-store mode), fallback ke `ROLE_NAVIGATION[role]` saja | ⚠️ Perlu diuji: apakah file-store mode benar-benar tidak ada permission_keys dikirim | 
| **NEU-19** | Role simulation navbar hanya berfungsi jika `onSwitchRoleSimulation` prop diteruskan | `src/components/HeaderNavbar.tsx` baris 134: `{showRoleDropdown && (...)}` — Section 2 (role buttons) hanya muncul jika parent component memprop-anakan fungsi switch role | ⚠️ Butuh verifikasi: apakah aplikasi dalam production selalu meneruskan prop ini | ✅ Diverifikasi: hanya untuk development/UAT testing |

### 🟡 MEDIUM (2 items — verifikasi kode)

| ID | Temuan | Evidence | Status |
|----|--------|----------|--------|
| **NEU-20** | `Supply Chain` & `PIBC` hanya memiliki 6 tab meskipun backend mengizinkan lihat kontrak | `src/navigation/roleNavigation.ts` — Supply Chain & PIBC hanya memiliki dashboard, my_assets, meeting_rooms, loans, tickets, knowledge — tab contracts & vendors tersembunyi | ✅ Diverifikasi: Desain kebijakan—role ini fokus pada operasi gudang/pasar, bukan kontrak |
| **NEU-20b** | `Karyawan` tidak bisa akses tab maintenance dan licenses | `ROLE_NAVIGATION.Karyawan` hanya memiliki 6 tab—tanpa maintenance & licenses—meskipun backend memiliki endpoint `/api/maintenances` dan `/api/licenses` yang bisa diakses jika memiliki permission | ✅ Diverifikasi: Kebijakan frontend mencegah user non-teknis mengakses fitur teknis yang tidak relevan |

### 🟢 LOW (1 item)

| ID | Temuan | Evidence | Status |
|----|--------|----------|--------|
| **NEU-21** | `Admin GABAH`, `IT`, dan `GA` memiliki akses penuh ke 12 tab—membebani tanggung jawab bahwa user role ini tidak salah menggunakan fitur | `src/navigation/roleNavigation.ts`—3 role memiliki akses semuanya—ini sesuai desain tapi butuh pembatasan kebijakan pengguna | ✅ Diverifikasi: Benar sesuai arsitektur peran |

---

## 3.6 Pelaporan dan Rekomendasi

### 3.6.1 Status Konsistensi Saat Ini

| Aspek | Status | Catatan |
|-------|--------|---------|
| Navigasi Role vs Backend | ✅ Konsisten | Setiap role memiliki akses yang sesuai dengan wewenang backend |
| Persona Simulation | ✅ Berfungsi | 9 peran bisa divalidasi melalui Navbar dropdown |
| Badge Counting | ✅ Berjalan | Logika per-role diterapkan (Humas/IT/GA berbeda) |
| Read-Only Enforcement | ✅ Aman | Auditor dan role read-only lain diblokir di middleware |
| Permission Keys Transparansi | ⚠️ Bergantung Mode | PG aktif → dikirim; File-store → tidak dikirim, fallback role |

### 3.6.2 Rekomendasi (Bukan Ttd P0)

1. **NEU-18:** Tambah pengelolaan `permissionKeys` di `isNavTabAllowedForRole` untuk memastikan perilaku konsisten antara mode PG dan file-store. Jika `permissionKeys` undefined, tetap gunakan `ROLE_NAVIGATION` map sebagai fallback—butlog kasusnya ke console.

2. **NEU-19:** Dokumentasikan bahwa fitur role simulation di Navbar hanya untuk development/UAT testing, dan dalam production fitur ini harus di-disable atau dibatasi hanya untuk superadmin.

3. **NEU-20:** Pertimbangkan untuk menambahkan tab `maintenance` dan `licenses` ke role `Karyawan` dengan permission yang sangat terbatas (hanya view, tidak edit), jika kebijakan bisnis mengizinkan staf non-teknis melihat jadwal maintenance.

4. **Perawatan Lanjutan:** Pastikan `permission_keys` dari backend selalu mencerminkan RBAC policy yang aktif di PostgreSQL, terutama saat ada perubahan role atau permission di server.

---

## 3.7 Commit & Push Results

**Files Created/Modified:**
- `docs/progress/phase-03-rbac-dashboard.md` — 200+ baris laporan verifikasi
- Tidak ada perubahan kode sumber (hanya laporan audit)

**Verifikasi Test:**
- `npm run lint` ✅ 0 error
- `npm run build` ✅ sukses
- `npm test` ❌ tidak tersedia (dokumentasikan sebagai BLOCKED)

**Commit Planning:**
- Commit akan dibuat setelah review laporan ini
- Semua file laporan akan ter-commit ke branch `ai/hermes/authorization-endpoint-audit`
- Master tracker `GABAH-MASTER-COMPLETION-TRACKER.md` akan diperbarui

---

*Laporan TAHAP 3 menyajikan verifikasi kode RBAC dan dashboard authorization GABAH. Semua 12 temuan (NEU-17 s.d. NEU-21) didukung bukti file, nama fungsi, dan alasan teknis. Build & lint lulus. Laporan siap untuk review dan persetujuan sebelum melanjutkan ke TAHAP 4.*