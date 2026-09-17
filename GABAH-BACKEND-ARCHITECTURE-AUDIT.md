# GABAH — BACKEND & DOMAIN ARCHITECTURE AUDIT
**Target:** `/opt/gabah` (Laravel 11 Backend Specification)  
**Date:** 2026-09-10  
**Audit Mode:** READ-ONLY (No code modified, no migrations executed, no features created, no refactoring performed)  
**Objective:** Menilai kelayakan teknis dan arsitektural backend Laravel eksisting untuk dijadikan production backend utama GABAH.

---

## 1. Executive Verdict: Kelayakan Production Backend

> **STATUS: NOT PRODUCTION READY AS-IS (Spesifikasi Berbobot Tinggi, Namun Kerangka Runtuh / Incomplete Framework)**
>
> **Kesimpulan Singkat:** Kode di `/opt/gabah` saat ini **BUKAN** aplikasi Laravel utuh yang dapat langsung di-boot atau dijalankan (`php artisan` gagal karena direktori vital framework `artisan`, `bootstrap/`, `config/`, dan `public/` **TIDAK ADA** di repositori). Selain itu, sistem Docker `docker-compose.yml` hanya memuat container Node.js dan PostgreSQL tanpa container PHP-FPM / Nginx untuk backend.
>
> Namun demikian, domain logic di `app/Services/` dan skema database di `database/migrations/` memiliki kualitas desain arsitektural yang **sangat kuat (enterprise-grade foundation)**. Dengan perbaikan terstruktur (restorasi kerangka framework Laravel 11, perbaikan numbering multi-divisi, dan penyesuaian RBAC 9 peran), aset ini sangat berharga untuk diselamatkan dan dijadikan backend utama.

---

## 2. Hasil Pemeriksaan Detail Komponen Backend

### 2.1 Struktur Laravel & Entry Point Aplikasi
* **Kondisi Aktual:**
  * File `artisan` (CLI entry point): ❌ **MISSING** (Tidak ada di root `/opt/gabah`).
  * Direktori `bootstrap/` (`app.php`, `providers.php`): ❌ **MISSING**.
  * Direktori `config/` (`app.php`, `auth.php`, `database.php`, `sanctum.php`, `permission.php`): ❌ **MISSING**.
  * Direktori `public/` (`index.php`, `.htaccess`): ❌ **MISSING**.
  * Direktori `storage/` (`logs/`, `framework/views/`, `framework/sessions/`): ❌ **MISSING**.
* **Dampak:** Perintah standar `php artisan migrate`, `php artisan serve`, atau web server Nginx/Apache tidak akan bisa melakukan bootstrapping aplikasi sama sekali.
* **Klasifikasi:** **MISSING (Framework Skeleton)**.

### 2.2 `composer.json`
* **Kondisi Aktual:**
  * Dependensi runtime: `php: ^8.3`, `laravel/framework: ^11.0`, `laravel/sanctum: ^4.0`, `spatie/laravel-permission: ^6.4`, `simplesoftwareio/simple-qrcode: ^4.2`.
  * Dependensi dev: `phpunit/phpunit: ^11.0`, `mockery/mockery: ^1.6`, `nunomaduro/collision: ^8.1`.
  * PSR-4 autoloading dipetakan ke `App\\` -> `app/`, `Database\\Seeders\\` -> `database/seeders/`.
* **Analisis:** Pilihan library sangat tepat, modern, dan ramping untuk Laravel 11 API-only.
* **Klasifikasi:** **KEEP**.

### 2.3 `routes/api.php`
* **Kondisi Aktual:**
  * Route publik: `POST /api/login` (Auth Sanitized via `AuthController`).
  * Route terlindungi `auth:sanctum`:
    * `GET /api/me`, `POST /api/logout`.
    * `GET /api/dashboard/stats`.
    * `apiResource('assets')` + `GET /api/assets/barcode/{assetNumber}/qr`.
    * `apiResource('loans')` + `POST /loans/{loan}/approve`, `POST /loans/{loan}/handover`, `POST /loans/{loan}/return`.
    * `apiResource('tickets')` + `POST /tickets/{ticket}/status`, `POST /tickets/{ticket}/escalate`.
    * `GET /api/audit-logs`.
* **Analisis:** Mengikuti RESTful conventions. Namun controller untuk `AuthController`, `DashboardController`, dan method custom ticket belum lengkap terdefinisi.
* **Klasifikasi:** **REFACTOR**.

### 2.4 Authentication / Laravel Sanctum
* **Kondisi Aktual:**
  * Migration Sanctum: `2024_01_01_000000_create_personal_access_tokens_table.php` sudah ada.
  * Trait `HasApiTokens` terpasang di model `User`.
  * **Ketiadaan Konfigurasi:** File `config/sanctum.php` dan `config/auth.php` tidak ada. Guard API token belum terkonfigurasi.
* **Klasifikasi:** **REFACTOR**.

### 2.5 Models & Relationships
* **Kondisi Aktual:**
  * Terdapat 10 Model: `User`, `Asset`, `AssetCategory`, `AssetNumberSequence`, `Vendor`, `Loan`, `Ticket`, `KbArticle`, `Notice`, `AuditLog`.
  * Model menggunakan PHP 8.2+ Typed Properties dan Eloquent Attributes Casting (Enum casting: `CategoryType`, `AssetStatus`, `LoanStatus`, `TicketStatus`, `TicketPriority`).
  * Relasi: `Asset` memiliki relasi lengkap ke `category`, `assignedUser`, `vendor`, `pic`, `loans`, `tickets`.
  * **Cacat Relasi User:** Model `User.php` **LUPA** menyertakan trait Spatie `HasRoles` (`use Spatie\Permission\Traits\HasRoles`). Tanpa trait ini, pemanggilan `$user->hasRole()` atau `$user->can()` akan fatal error!
* **Klasifikasi:** **REFACTOR**.

### 2.6 Migrations & Database Constraints
* **Kondisi Aktual (11 Migration Files):**
  1. `users`: id, name, email, password, is_active, timestamps, softDeletes.
  2. `asset_categories`: code (unique), name, category_type, is_active.
  3. `vendors`: name, type, contact_person, phone, email, address.
  4. `assets`: asset_number (unique), serial_number, hostname, ip_address, category_type, location, JSONB custom_attributes, is_loanable, loan_blocked.
  5. `tickets`: ticket_number (unique), SLA deadlines, priority, foreign keys.
  6. `loans`: loan_number (unique), asset_id, borrower_id, loan_date, due_date, status.
  7. `kb_articles`: author_id, views, status.
  8. `notices`: in-app notifications.
  9. `audit_logs`: JSONB old_values, JSONB new_values, ip_address.
  10. `permission_tables`: Spatie RBAC tables (`roles`, `permissions`, `model_has_roles`, dll).
  11. `asset_number_sequences`: category_code, year, last_number, UNIQUE(category_code, year).
* **Foreign Key & Constraints:**
  * Hubungan relasional menggunakan `constrained()->cascadeOnUpdate()->restrictOnDelete()` atau `nullOnDelete()`. Sangat aman mencegah orphan records.
  * Indexing komposit: `idx_loans_anti_collision` pada `loans(asset_id, status, loan_date, due_date)` sangat optimal untuk anti-bentrok.
* **Klasifikasi:** **KEEP (Terkualifikasi Tinggi)**.

### 2.7 Controllers
* **Kondisi Aktual:**
  * `AssetController.php`, `LoanController.php`, `TicketController.php` telah mengadopsi prinsip *Thin Controller*: controller hanya bertugas menerima request, memanggil Policy `$this->authorize()`, mendelegasikan transaksi ke Service, dan mengembalikan JsonResponse.
  * Controller yang belum ada: `AuthController.php`, `DashboardController.php`, `VendorController.php`, `ReportController.php`.
* **Klasifikasi:** **REFACTOR**.

### 2.8 Services Layer
* `AssetService.php`: Membungkus pembuatan dan update aset ke dalam `DB::transaction()`, men-generate nomor otomatis, serta mencatat audit log. (**KEEP**)
* `LoanReservationService.php`: Logika peminjaman, approval, serah terima, dan pengembalian dengan database lock. (**KEEP**)
* `TicketSlaService.php`: Kalkulasi SLA otomatis dan deteksi pelanggaran. (**KEEP**)
* `AuditLogService.php`: Helper pencatatan audit trail berbasis request kontekstual. (**KEEP**)
* `AssetNumberingService.php`: Service penomoran dengan row locking. (**REFACTOR** - karena format division masih hardcoded).

### 2.9 Policies / Gates & Server-Side Authorization
* **Kondisi Aktual (`AssetPolicy.php`):**
  * `before(User $user, string $ability)`: Memeriksa role `Super Admin` via Spatie.
  * `viewAny`, `view`, `create`, `update`, `delete` dipetakan menggunakan PHP 8 match expression berdasarkan `CategoryType`.
  * **Kelemahan:** `AssetPolicy` saat ini hanya menginspeksi wewenang divisi IT (`assets_it.*`) dan GA (`assets_ga.*`). Divisi baru (Supply Chain, PIBC, Management, Auditor) belum memiliki policy.
* **Klasifikasi:** **REFACTOR**.

### 2.10 Spatie Permission & Seeder
* **Kondisi Aktual (`DatabaseSeeder.php`):**
  * 7 Role yang di-seed: `Super Admin`, `IT Manager`, `IT Support`, `GA`, `GA Staff`, `User`, `Auditor`.
  * Permission di-seed: `assets_it.create`, `assets_ga.approve_loan`, dll.
  * **Gap:** Tidak cocok dengan 9 peran target operasional GABAH (Management, Admin GABAH, IT, GA, Supply Chain, PIBC, Karyawan, Auditor, Vendor).
* **Klasifikasi:** **REFACTOR**.

### 2.11 Concurrency, Transactions & Pessimistic Locking
* **Kondisi Aktual:**
  * Penomoran aset: Menggunakan `DB::transaction()` dan `AssetNumberSequence::where(...)->lockForUpdate()->first()`.
  * Peminjaman aset: Menggunakan `Asset::where('id', $assetId)->lockForUpdate()` saat reservasi dan approval.
  * Serah terima & kembali: Menggunakan row locking pada aset dan pinjaman.
* **Evaluasi Concurrency-Safety:**
  * **Peminjaman:** Sudah **100% concurrency-safe** di layer database. Dua user yang mencoba meminjam aset yang sama di rentang waktu beririsan akan diantrekan oleh PostgreSQL, dan user kedua akan ditolak dengan error bentrok jadwal.
  * **Nomor Aset:** Lihat analisis mendalam pada Bagian 3.
* **Klasifikasi:** **KEEP (Sangat Baik)**.

### 2.12 Validation & Form Requests
* **Kondisi Aktual:**
  * `StoreAssetRequest`, `UpdateAssetRequest`, `StoreLoanRequest`, `StoreTicketRequest`.
  * Menggunakan array rules standar Laravel, sanitasi field `asset_number` (tidak mempercayai input client), dan pesan berbahasa Indonesia.
* **Klasifikasi:** **KEEP**.

### 2.13 API Response Structure (Resources)
* **Kondisi Aktual:**
  * `AssetResource.php`, `LoanResource.php`, `TicketResource.php` sudah dibuat rapi dan konsisten.
  * **Divergensi:** Di beberapa controller method (misal `AssetController::index`), controller memanggil `response()->json($assets)` secara langsung tanpa membungkusnya lewat `AssetResource::collection($assets)`.
* **Klasifikasi:** **REFACTOR**.

### 2.14 Scheduled Tasks / Console Commands
* **Kondisi Aktual:**
  * Terdapat 3 command di `app/Console/Commands/`: `CheckOverdueLoans`, `CheckTicketSla`, `CheckAssetExpirations`.
  * Terjadwal di `routes/console.php`.
  * **Bug Fatal di Command:** Ketiga command ini menggunakan model dan nama kolom yang **salah**!
    * `CheckOverdueLoans` mengimpor `App\Models\LoanReservation` (nama model aktual di backend adalah `Loan`).
    * `CheckOverdueLoans` mengakses kolom `$loan->end_date` (nama kolom aktual adalah `due_date`) dan `$loan->loan_code` (nama aktual `loan_number`).
    * `CheckTicketSla` mengakses `$ticket->sla_due_at` (nama kolom aktual `sla_resolution_deadline`).
    * `CheckAssetExpirations` mengakses `$asset->warranty_expiry` (nama kolom aktual `warranty_until`).
  * Command ini ditulis berdasarkan nama atribut TypeScript frontend, bukan skema database Laravel backend!
* **Klasifikasi:** **REFACTOR (Koreksi Nama Kolom)**.

### 2.15 Docker & Deployment Configuration
* **Kondisi Aktual (`docker-compose.yml` di root):**
  * Memiliki container `database` (PostgreSQL 17) dan `app` (Node.js 20 untuk frontend React SPA).
  * **Container PHP Backend TIDAK ADA.** Tidak ada PHP-FPM, tidak ada Nginx untuk Laravel, tidak ada entry Dockerfile untuk backend.
* **Klasifikasi:** **MISSING**.

---

## 3. Audit Khusus: Domain Aset & Atribut

### 3.1 Pemetaan Atribut Aset (Target vs Implementasi Backend)

| Atribut Domain | Target Bisnis GABAH | Implementasi Aktual di Backend (`assets` table) | Status & Evaluasi |
| :--- | :--- | :--- | :--- |
| **Asset Number** | `{OWNER_DIVISION}-{ASSET_CODE}-{YEAR}-{SEQUENCE}` | Kolom `asset_number` (varchar 50, unique) | ⚠️ Terformat kaku dengan prefix `IT-` |
| **Owner Division** | IT, GA, SC, PIBC | ❌ **TIDAK ADA kolom `owner_division`** di tabel `assets` | Diambil secara implisit dari `category_type` (hanya IT, General, License) |
| **Asset Code / Category**| Subkategori (misal: HLT, HPC, INV-F) | Relasi `asset_category_id` -> `asset_categories.code` | Sesuai target via tabel master |
| **Year** | 4 digit tahun (2026) | Dihasilkan dari parameter saat generate | Sesuai target |
| **Sequence** | 4 digit sequence (0001) | Disimpan di `asset_number_sequences.last_number` | Sesuai target |
| **Custodian (Pemegang)** | User pemegang saat ini | Kolom `assigned_to` (foreignId -> `users.id`) | Sesuai target |
| **PIC (Penanggung Jawab)**| PIC teknis aset divisi | Kolom `pic_id` (foreignId -> `users.id`) | Sesuai target |
| **Location** | Lokasi fisik penempatan aset | Kolom `location` (varchar 150) | Sesuai target |
| **Status** | Status operasional | Kolom `status` (Enum: `available`, `in_use`, `loaned`, `maintenance`, `disposed`) | Sesuai target |
| **Condition** | Kondisi fisik (good, fair, damaged) | ❌ **TIDAK ADA kolom `condition`** di migration | Disimpan secara tidak terstruktur di JSONB `custom_attributes` |
| **Purchase Price** | Nilai perolehan aset | Kolom `price` (decimal 15,2) | Sesuai target |
| **Warranty** | Batas akhir masa garansi | Kolom `warranty_until` (date) | Sesuai target |
| **Corporate / ERP Number** | Nomor barcode akuntansi Accurate FST | ❌ **TIDAK ADA di tabel `assets`** | Di UI ada (`corporate_asset_number`), di DB belum ada |

---

## 4. Audit Khusus: Asset Numbering Engine & Concurrency Safety

### 4.1 Target Format vs Implementasi Aktual
* **Target Format Bisnis:**
  `{OWNER_DIVISION}-{ASSET_CODE}-{YEAR}-{SEQUENCE}`
  * Contoh: `IT-HLT-2026-0001` (IT Laptop)
  * Contoh: `IT-HPC-2026-0001` (IT PC Workstation)
  * Contoh: `GA-INV-F-2026-0001` (General Affair Furniture)
  * Contoh: `SC-FL-2026-0001` (Supply Chain Forklift)
  * Contoh: `PIBC-WB-2026-0001` (PIBC Weigh Bridge)

* **Implementasi Aktual di `AssetNumberingService.php`:**
  ```php
  public const PREFIX = 'IT'; // <-- HARDCODED PREFIX!

  public function formatAssetNumber(string $categoryCode, int $year, int $sequenceNumber): string
  {
      $padding = max(self::MIN_PADDING, strlen((string) $sequenceNumber));
      $formattedSequence = str_pad((string) $sequenceNumber, $padding, '0', STR_PAD_LEFT);

      return sprintf('%s-%s-%d-%s', self::PREFIX, $categoryCode, $year, $formattedSequence);
  }
  ```
* **Evaluasi Format:**
  * Format aktual di-hardcode ke prefix `IT`.
  * Jika divisi General Affair membuat aset furniture, nomor yang terbentuk adalah `IT-GA-FUR-2026-0001`, **bukan** `GA-INV-F-2026-0001`!
  * Prefix `OWNER_DIVISION` belum dinamis dan tabel `asset_number_sequences` hanya mengindeks `(category_code, year)`.

### 4.2 Analisis Concurrency Safety
* Kode aktual di `AssetNumberingService::generateNumber()`:
  ```php
  return DB::transaction(function () use ($code, $year) {
      $sequence = AssetNumberSequence::where('category_code', $code)
          ->where('year', $year)
          ->lockForUpdate()
          ->first();

      if (! $sequence) {
          $sequence = AssetNumberSequence::create([
              'category_code' => $code,
              'year' => $year,
              'last_number' => 0,
          ]);
          // Re-fetch with lock
          $sequence = AssetNumberSequence::where('id', $sequence->id)->lockForUpdate()->first();
      }

      $sequence->last_number += 1;
      $sequence->save();

      return $this->formatAssetNumber($code, $year, $sequence->last_number);
  }, 5);
  ```
* **Apakah benar-benar Concurrency-Safe?**
  * **Kondisi Baris Sudah Ada (Sequence Exists):** **YA, 100% SAFE.** `lockForUpdate()` pada row yang sudah ada di PostgreSQL menerapkan exclusive row-level lock. Transaksi lain yang meminta sequence untuk category & year yang sama akan ditahan (blocked) hingga transaksi pertama commit.
  * **Kondisi Inisialisasi Pertama (First-Insert Race Condition):** ⚠️ **TERDAPAT CELAH KECIL (Edge Case).**
    Jika dua request masuk bersamaan saat tabel sequence belum memiliki record untuk `category_code` dan `year` tersebut, keduanya akan mendapati `$sequence === null`, lalu keduanya memanggil `create()`. Request kedua akan melempar exception `UniqueViolationException` dari database karena constraint `unique(['category_code', 'year'])`. Meskipun data integrity terlindungi (tidak akan menghasilkan nomor duplikat), request kedua akan crash 500 jika tidak ditangkap oleh retry logic.
  * **Rekomendasi:** Gunakan atomic upsert pattern PostgreSQL: `firstOrCreate` di luar transaction atau tangani dengan retry.

---

## 5. Audit Khusus: RBAC (Role-Based Access Control)

### 5.1 Pemetaan Hirarki RBAC Aktual

```
User
 │
 ├── Role (Spatie: roles table)
 │    │
 │    ├── Super Admin  --> Semua permission (Gate::before bypass)
 │    ├── IT Manager   --> assets_it.*, loans.approve, reports.view
 │    ├── IT Support   --> assets_it.view, assets_it.create, tickets.assign
 │    ├── GA           --> assets_ga.*, loans.approve
 │    ├── GA Staff     --> assets_ga.view, assets_ga.create, loans.handover
 │    ├── User         --> loans.create, tickets.create, assets.view_assigned
 │    └── Auditor      --> *.view (Read-only)
 │
 └── Permission (Spatie: permissions table)
      │
      └── CategoryType Scope (Hardcoded di AssetPolicy.php)
           ├── CategoryType::IT      --> Guarded by 'assets_it.*'
           ├── CategoryType::GENERAL --> Guarded by 'assets_ga.*'
           └── CategoryType::LICENSE --> Guarded by 'assets_it.*'
```

### 5.2 Identifikasi Bagian Hardcoded
1. **Hardcoded Division di `AssetPolicy.php`:**
   ```php
   match ($categoryType) {
       CategoryType::IT, CategoryType::LICENSE => $user->hasPermissionTo('assets_it.create'),
       CategoryType::GENERAL => $user->hasPermissionTo('assets_ga.create'),
       default => false,
   }
   ```
   * *Masalah:* Divisi di-hardcode ke `CategoryType` (`IT` dan `GENERAL`). Divisi operasional baru seperti `Supply Chain` dan `PIBC` tidak memiliki tempat dalam enum maupun policy ini.
2. **Hardcoded Super Admin bypass di `AssetPolicy.php:24`:**
   * Mengecek `$user->hasRole('Super Admin')`. Nomenklatur target adalah `Admin GABAH`.
3. **Hardcoded Role Check di `LoanReservationService.php:12`:**
   * Di dalam command cron dan seeder, penamaan role berganti-ganti antara `Super Admin`, `Admin`, dan `IT Support`.
4. **Pemisahan Scope Divisi Pengguna:**
   * Tidak ada kolom `department` atau `division` pada tabel `users`.
   * Backend saat ini tidak tahu seorang `User` berasal dari divisi mana, sehingga tidak bisa membatasi data tiket atau peminjaman per unit kerja.

---

## 6. Klasifikasi Komponen Backend

| Komponen | Path Berkas | Klasifikasi | Catatan Evaluasi |
| :--- | :--- | :--- | :--- |
| **Framework Skeleton** | `artisan`, `bootstrap/`, `config/`, `public/` | **MISSING** | Direktori inti Laravel 11 belum dibuat. Harus digenerate via `composer create-project` / scaffold. |
| **Docker Compose** | `/docker-compose.yml` | **REFACTOR** | Hanya ada service `database` dan `app` (Node.js). Service PHP-FPM / Laravel API server belum didefinisikan. |
| **Composer Config** | `/opt/gabah/composer.json` | **KEEP** | Dependensi modern & clean (PHP 8.3, Laravel 11, Sanctum 4, Spatie 6, QrCode). |
| **Migrations Core** | `database/migrations/2024_01_01_000001..09` | **KEEP** | 9 tabel relasional sangat matang, index komposit solid, foreign key restrict/cascade terjaga baik. |
| **Migration Sequence** | `database/migrations/2026_01_01_000001` | **REFACTOR** | Perlu kolom `owner_division` agar sequence terpisah per divisi (IT, GA, SC, PIBC). |
| **Migration Assets** | `database/migrations/..._create_assets_table` | **REFACTOR** | Tambahkan kolom `owner_division`, `corporate_asset_number`, `condition`. |
| **Model User** | `app/Models/User.php` | **REFACTOR** | Tambahkan trait Spatie `HasRoles` dan kolom `division` / `department`. |
| **Model Asset** | `app/Models/Asset.php` | **KEEP** | Casts & relationships sudah rapi. |
| **Model Loan** | `app/Models/Loan.php` | **KEEP** | Casts enum & relasi sudah lengkap. |
| **Model Ticket** | `app/Models/Ticket.php` | **KEEP** | Relasi SLA & approver terjaga baik. |
| **AssetNumberingService** | `app/Services/AssetNumberingService.php` | **REFACTOR** | Ubah hardcoded prefix `IT-` menjadi dinamis `{OWNER_DIVISION}` dan perbaiki edge-case first insert. |
| **LoanReservationService** | `app/Services/LoanReservationService.php` | **KEEP** | Anti-collision query & pessimistic row locking sudah enterprise-grade. |
| **TicketSlaService** | `app/Services/TicketSlaService.php` | **KEEP** | Kalkulasi respon pertama dan resolusi akhir sudah tepat. |
| **AuditLogService** | `app/Services/AuditLogService.php` | **KEEP** | Menyimpan audit trail JSONB kontekstual dengan baik. |
| **AssetPolicy** | `app/Policies/AssetPolicy.php` | **REFACTOR** | Perluas match expression untuk 9 peran (tambahkan SC, PIBC, Management, Auditor). |
| **DatabaseSeeder** | `database/seeders/DatabaseSeeder.php` | **REFACTOR** | Sesuaikan 9 role baru dan permission matrix Food Station. |
| **Console Commands** | `app/Console/Commands/*.php` | **REFACTOR** | Perbaiki nama model & nama kolom yang salah (mismatch dengan database). |
| **AssetRepository** | `app/Repositories/Eloquent/AssetRepository.php` | **KEEP** | Query filter, pagination, dan eager loading sudah baik. |
| **Controllers (Eksisting)**| `AssetController`, `LoanController`, `TicketController` | **REFACTOR** | Konsistensikan pemakaian `JsonResource` di seluruh method index. |
| **Controllers (Hilang)** | `AuthController`, `DashboardController`, `VendorController` | **MISSING** | Rute di `routes/api.php` memanggil controller ini, tetapi filenya belum ada. |
| **Form Requests** | `app/Http/Requests/*` | **KEEP** | Aturan validasi dan pesan berbahasa Indonesia sudah solid. |
| **API Resources** | `app/Http/Resources/*` | **KEEP** | Serialisasi JSON terstruktur dengan baik. |

---

## 7. Rangkuman Tindak Lanjut & Roadmap

### A. Backend Components yang Siap Dipakai (KEEP)
1. **`app/Services/LoanReservationService.php`**: Logika anti-bentrok berbasis interval query atomik dan pessimistic locking pada `loans` dan `assets`.
2. **`app/Services/TicketSlaService.php`**: Logika kalkulasi SLA respon dan resolusi otomatis berdasarkan jam kerja / prioritas.
3. **`app/Services/AuditLogService.php`**: Mekanisme pencatatan audit log JSONB.
4. **`database/migrations/` (Core Tables)**: Struktur database `users`, `vendors`, `tickets`, `loans`, `kb_articles`, `notices`, `audit_logs`, dan `permissions`.
5. **Form Requests & API Resources**: Seluruh class validasi request dan format response JSON.

### B. Backend Components yang Harus Diperbaiki (REFACTOR)
1. **`app/Services/AssetNumberingService.php`**:
   * Hapus `public const PREFIX = 'IT'`.
   * Ubah parameter method menjadi `generateNumber(string $ownerDivision, string $categoryCode, ?int $year = null)`.
   * Dukung format: `{OWNER_DIVISION}-{ASSET_CODE}-{YEAR}-{SEQUENCE}` (misal: `GA-INV-F-2026-0001`).
2. **`app/Models/User.php`**:
   * Tambahkan `use Spatie\Permission\Traits\HasRoles;` dan trait `HasRoles`.
3. **`app/Policies/AssetPolicy.php`**:
   * Perluas verifikasi hak akses untuk divisi `Supply Chain`, `PIBC`, `Management` (approval lintas divisi), dan `Auditor` (read-only global).
4. **`app/Console/Commands/*.php`**:
   * Koreksi pemanggilan model dari `LoanReservation` ke `Loan`.
   * Koreksi pemanggilan kolom (`end_date` -> `due_date`, `loan_code` -> `loan_number`, `sla_due_at` -> `sla_resolution_deadline`, `warranty_expiry` -> `warranty_until`).
5. **`database/seeders/DatabaseSeeder.php`**:
   * Perbarui role seeder agar tepat memuat 9 peran yang diminta pengguna.

### C. Backend Components yang Harus Dibuat (MISSING)
1. **Laravel Framework Skeleton Files**:
   * File `artisan`.
   * Folder `bootstrap/app.php` (Laravel 11 routing & middleware bootstrap).
   * Folder `config/` (`app.php`, `auth.php`, `database.php`, `sanctum.php`, `permission.php`).
   * Folder `public/index.php`.
2. **Controller Pelengkap**:
   * `app/Http/Controllers/Api/AuthController.php` (login via Sanctum, logout, profile).
   * `app/Http/Controllers/Api/DashboardController.php` (agregasi KPI, total nilai aset, tiket kritis).
   * `app/Http/Controllers/Api/VendorController.php` (CRUD rekanan).
3. **Kolom Database Tambahan**:
   * Kolom `owner_division` pada tabel `assets` dan `asset_number_sequences`.
   * Kolom `corporate_asset_number` (Accurate FST) pada tabel `assets`.
   * Kolom `condition` pada tabel `assets`.
   * Kolom `division` pada tabel `users`.
4. **Docker Container Configuration**:
   * Penambahan service `api` (PHP 8.3 FPM / Nginx) di `docker-compose.yml` agar backend Laravel dapat berjalan berdampingan dengan frontend React dan database PostgreSQL.

---

### D. Urutan Implementasi Paling Aman

```
Langkah 1: Restorasi Framework Skeleton (artisan, bootstrap/app.php, config/)
    │
    ▼
Langkah 2: Perbaikan Model User (Tambah trait HasRoles & kolom division)
    │
    ▼
Langkah 3: Perbaikan Skema Database (Tambah owner_division, corporate_asset_number, condition)
    │
    ▼
Langkah 4: Refactor AssetNumberingService (Format dinamis multi-divisi + sequence safe)
    │
    ▼
Langkah 5: Penyelarasan Seeder & Policy RBAC (9 Peran Operasional GABAH)
    │
    ▼
Langkah 6: Koreksi Console Commands (Sinkronisasi nama kolom database)
    │
    ▼
Langkah 7: Pembuatan Missing Controllers (AuthController, DashboardController)
    │
    ▼
Langkah 8: Setup Docker Service Backend (PHP 8.3 + PostgreSQL integration)
    │
    ▼
Langkah 9: Integrasi Frontend API Client (Menghubungkan React ke Laravel API)
```

---

### E. Dependency Antar Pekerjaan

1. **Skeleton Framework -> Artisan & Migration**:
   Migrasi database dan seeding Spatie Permission tidak dapat dijalankan sama sekali sebelum file `artisan` dan `bootstrap/app.php` dipulihkan.
2. **Trait HasRoles -> Policies & Auth**:
   Semua controller dan policy bergantung pada `$user->can()` dan `$user->hasRole()`. Trait `HasRoles` di `User.php` harus dipasang sebelum policy diuji.
3. **Skema `owner_division` -> `AssetNumberingService`**:
   Service penomoran tidak bisa mengalokasikan nomor per divisi sebelum kolom dan index komposit `(owner_division, category_code, year)` tersedia di tabel `asset_number_sequences`.
4. **Backend Running -> Frontend API Integration**:
   Frontend tidak boleh diubah untuk memanggil endpoint API sebelum backend berjalan stabil dan lulus pengujian response payload.

---

### F. Risiko Migration & Data Loss

1. **Risiko Saat Menjalankan `migrate:fresh`:**
   Saat ini database PostgreSQL pada Docker berjalan terpisah dari container frontend yang menggunakan `localStorage`. Menjalankan migrasi pada PostgreSQL **TIDAK AKAN** menghapus data frontend yang ada di browser saat ini.
2. **Risiko Perubahan Nama Kolom Aset:**
   Jika nanti dilakukan migrasi data dari mock frontend ke backend, terdapat perbedaan nama field:
   * Frontend `astick_internal_number` <-> Backend `asset_number`
   * Frontend `corporate_asset_number` <-> Backend (belum ada kolomnya)
   * Frontend `purchase_price` <-> Backend `price`
   * Frontend `warranty_expiry` <-> Backend `warranty_until`
   * *Mitigasi:* Menggunakan database migration penambahan kolom baru dan mapping eksplisit pada API Resource / DTO saat proses migrasi data dilakukan.
3. **Risiko Concurrency Race Condition pada Numbering:**
   Jika sekuens kategori baru diinisialisasi pertama kali, gunakan query `firstOrCreate` atau upsert locking agar tidak terjadi rollback transaksi saat dua pengguna dari divisi yang sama serentak menambahkan aset pertama di tahun tersebut.
