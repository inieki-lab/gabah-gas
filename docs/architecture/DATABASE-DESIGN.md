# GABAH — Database Design & Data Modeling Specification

**Dokumen:** `docs/architecture/DATABASE-DESIGN.md`  
**Sistem:** GABAH (*General Asset, Business & Automated Helpdesk*)  
**Database Engine:** PostgreSQL 17  
**Driver:** `pg` (Node-Postgres)  
**Status:** Authoritative Database Specification (100% Sesuai Skema Aktual)  
**Terakhir Diperbarui:** 28 September 2026  

---

## 1. Ringkasan Desain Basis Data

Sistem GABAH menggunakan basis data relasional **PostgreSQL 17** sebagai lapisan penyimpanan otoritatif dengan skema ternormalisasi. Seluruh skema DDL didefinisikan dalam file migrasi SQL pada direktori `server/migrations/` dan dieksekusi secara otomatis saat server booting.

Sistem juga mengimplementasikan mekanisme **Dual-Persistence Bridge** (`server/persistence.ts`), di mana snapshot keadaan sistem disinkronkan ke file `server/data/gabah_state.json` sebagai fallback lokal jika koneksi database host mengalami gangguan atau saat cold-boot.

---

## 2. Struktur Tabel Relasional PostgreSQL

### 2.1 Tabel `divisions` (Divisi Korporat)
Menyimpan struktur divisi resmi BUMD PT Food Station Tjipinang Jaya.
- `id` (BIGSERIAL, PRIMARY KEY)
- `code` (VARCHAR(20), NOT NULL, UNIQUE) — Contoh: `'SC'`, `'PIBC'`, `'IT'`, `'GA'`
- `name` (VARCHAR(100), NOT NULL) — Contoh: `'Supply Chain'`, `'Pasar'`, `'IT'`, `'General Affairs'`
- `is_active` (BOOLEAN, NOT NULL, DEFAULT TRUE)
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW())

### 2.2 Tabel `departments` (Departemen / Sub-Unit Divisi)
Menyimpan unit operasional di bawah naungan divisi.
- `id` (BIGSERIAL, PRIMARY KEY)
- `division_id` (BIGINT, REFERENCES divisions(id))
- `code` (VARCHAR(50), UNIQUE)
- `name` (VARCHAR(150), NOT NULL)
- `is_active` (BOOLEAN, NOT NULL, DEFAULT TRUE)
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW())

### 2.3 Tabel `users` (Pengguna & Pegawai)
Menyimpan identitas pegawai, peran RBAC, kredensial hash, dan divisi.
- `id` (VARCHAR(64), PRIMARY KEY) — Contoh: `'USR-01'`, `'USR-SEKDIR'`
- `name` (VARCHAR(200), NOT NULL)
- `email` (VARCHAR(255), NOT NULL, UNIQUE)
- `role` (VARCHAR(50), NOT NULL) — `'Admin GABAH'`, `'IT'`, `'GA'`, `'Sekretaris Direksi'`, `'Humas'`, `'Supply Chain'`, `'PIBC'`, `'Karyawan'`, `'Auditor'`
- `division_id` (BIGINT, REFERENCES divisions(id))
- `department_id` (BIGINT, REFERENCES departments(id))
- `phone` (VARCHAR(50))
- `avatar` (TEXT)
- `password_hash` (VARCHAR(255)) — Hasil PBKDF2 / SHA-256
- `password_salt` (VARCHAR(64)) — Garam kriptografis unik per user
- `is_active` (BOOLEAN, NOT NULL, DEFAULT TRUE)
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW())

### 2.4 Tabel `user_sessions` (Sesi Token Otentikasi)
Menyimpan sesi aktif pengguna untuk autentikasi Bearer token.
- `id` (VARCHAR(64), PRIMARY KEY)
- `token` (VARCHAR(128), NOT NULL, UNIQUE)
- `user_id` (VARCHAR(64), NOT NULL, REFERENCES users(id) ON DELETE CASCADE)
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW())
- `expires_at` (TIMESTAMPTZ, NOT NULL) — Masa aktif 7 hari
- `last_active_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW())
- `ip_address` (INET)
- `user_agent` (TEXT)
- **Indeks Penting**: `idx_user_sessions_token`, `idx_user_sessions_user_id`, `idx_user_sessions_expires_at`

### 2.5 Tabel `asset_categories` (Kategori Aset & Taksonomi PSAK 16)
Menyimpan taksonomi master aset.
- `id` (BIGSERIAL, PRIMARY KEY)
- `code` (VARCHAR(30), NOT NULL, UNIQUE) — Contoh: `'HLT'`, `'HPC'`, `'INV-F'`, `'KDR'`, `'MSN'`
- `name` (VARCHAR(150), NOT NULL)
- `category_type` (VARCHAR(30), NOT NULL) — `'IT'`, `'General'`, `'License'`
- `owner_division_id` (BIGINT, REFERENCES divisions(id))
- `is_loanable_by_default` (BOOLEAN, NOT NULL, DEFAULT FALSE)
- `is_active` (BOOLEAN, NOT NULL, DEFAULT TRUE)
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW())

### 2.6 Tabel `assets` (Katalog Aset Tetap & Inventaris)
Tabel master pencatatan seluruh unit aset BUMD.
- `id` (VARCHAR(64), PRIMARY KEY) — Contoh: `'AST-1718000000-123'`
- `asset_number` (VARCHAR(100), NOT NULL, UNIQUE) — Format: `{OWNER_DIV}-{CODE}-{YEAR}-{SEQ}`
- `corporate_asset_number` (VARCHAR(100)) — Nomor Aset Accurate ERP
- `name` (VARCHAR(255), NOT NULL)
- `category_id` (BIGINT, REFERENCES asset_categories(id))
- `owner_division_id` (BIGINT, NOT NULL, REFERENCES divisions(id))
- `brand` (VARCHAR(150))
- `model` (VARCHAR(150))
- `serial_number` (VARCHAR(255))
- `specifications` (TEXT)
- `purchase_date` (DATE)
- `purchase_price` (NUMERIC(18,2), NOT NULL, DEFAULT 0)
- `warranty_until` (DATE)
- `status` (VARCHAR(40), NOT NULL) — `'active'`, `'assigned'`, `'available'`, `'reserved'`, `'in_repair'`, `'damaged'`, `'cannibalized'`, `'pending_disposal'`, `'pending_auction'`, `'auctioned'`, `'disposed'`, `'lost'`, `'inactive'`
- `condition` (VARCHAR(30), NOT NULL) — `'new'`, `'good'`, `'fair'`, `'poor'`, `'broken'`, `'damaged'`
- `location` (VARCHAR(255), NOT NULL)
- `is_loanable` (BOOLEAN, NOT NULL, DEFAULT FALSE)
- `license_detail` (JSONB) — Rincian lisensi digital (seats, key, renewal)
- `notes` (TEXT)
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW())
- **Indeks Penting**:
  - `uq_assets_corporate_number` (UNIQUE partial index WHERE corporate_asset_number IS NOT NULL)
  - `idx_assets_owner_division` ON assets(owner_division_id)
  - `idx_assets_status` ON assets(status)

### 2.7 Tabel `asset_assignments` (Riwayat Penugasan Unit)
Mencatat keterikatan aset dengan pegawai penanggung jawab.
- `id` (BIGSERIAL, PRIMARY KEY)
- `asset_id` (VARCHAR(64), NOT NULL, REFERENCES assets(id))
- `user_id` (VARCHAR(64), NOT NULL, REFERENCES users(id))
- `assigned_date` (DATE, NOT NULL)
- `returned_date` (DATE)
- `assigned_by` (VARCHAR(64), REFERENCES users(id))
- `notes` (TEXT)
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW())
- **Indeks Penting**:
  - `uq_asset_active_assignment` (UNIQUE partial index WHERE returned_date IS NULL: menjamin 1 aset hanya aktif ditugaskan ke 1 orang)

### 2.8 Tabel `asset_movements` (Riwayat Mutasi & Pergerakan)
Mencatat histori relokasi fisik dan alih tangan pemegang aset.
- `id` (VARCHAR(64), PRIMARY KEY)
- `asset_id` (VARCHAR(64), NOT NULL, REFERENCES assets(id))
- `from_user_id` (VARCHAR(64), REFERENCES users(id))
- `to_user_id` (VARCHAR(64), REFERENCES users(id))
- `from_location` (VARCHAR(255))
- `to_location` (VARCHAR(255))
- `reason` (TEXT, NOT NULL)
- `document_ref` (VARCHAR(150))
- `performed_by_id` (VARCHAR(64), REFERENCES users(id))
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW())
- **Indeks Penting**: `idx_movements_asset` ON asset_movements(asset_id, created_at DESC)

### 2.9 Tabel `asset_number_sequences` (Sequence Penomoran Aset)
Menjamin nomor sequence aset tidak bertabrakan secara atomik per divisi dan tahun.
- `id` (BIGSERIAL, PRIMARY KEY)
- `owner_division_id` (BIGINT, NOT NULL, REFERENCES divisions(id))
- `asset_code` (VARCHAR(30), NOT NULL)
- `sequence_year` (INTEGER, NOT NULL)
- `last_sequence` (INTEGER, NOT NULL, DEFAULT 0)
- **Constraint**: `UNIQUE (owner_division_id, asset_code, sequence_year)`

### 2.10 Tabel `loans` (Sirkulasi Peminjaman Barang Dinas)
Mencatat pengajuan, persetujuan, dan pengembalian barang pool.
- `id` (VARCHAR(64), PRIMARY KEY)
- `loan_number` (VARCHAR(100), NOT NULL, UNIQUE) — Contoh: `'LOAN-2026-0001'`
- `asset_id` (VARCHAR(64), NOT NULL, REFERENCES assets(id))
- `borrower_id` (VARCHAR(64), NOT NULL, REFERENCES users(id))
- `purpose` (TEXT, NOT NULL)
- `start_date` (TIMESTAMPTZ, NOT NULL)
- `due_date` (TIMESTAMPTZ, NOT NULL)
- `status` (VARCHAR(40), NOT NULL) — `'pending_approval'`, `'approved'`, `'rejected'`, `'borrowed'`, `'returned'`, `'overdue'`, `'closed'`
- `approver_id` (VARCHAR(64), REFERENCES users(id))
- `approved_at` (TIMESTAMPTZ)
- `rejection_reason` (TEXT)
- `handover_by_id` (VARCHAR(64), REFERENCES users(id))
- `handover_at` (TIMESTAMPTZ)
- `handover_notes` (TEXT)
- `actual_returned_at` (TIMESTAMPTZ)
- `return_condition` (VARCHAR(30)) — `'good'`, `'fair'`, `'poor'`, `'broken'`
- `return_inspected_by_id` (VARCHAR(64), REFERENCES users(id))
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW())
- **Constraint**: `CHECK (due_date > start_date)`
- **Indeks Penting**:
  - `idx_loans_asset_dates` ON loans(asset_id, start_date, due_date)
  - `idx_loans_borrower` ON loans(borrower_id, status)
- **Trigger**: `trg_check_loan_schedule_collision` (mengecek tabrakan jadwal pada status `approved` atau `borrowed`).

### 2.11 Tabel `tickets` (Tiket Gangguan & Helpdesk SLA)
Mencatat permohonan bantuan teknis dan pemenuhan SLA layanan.
- `id` (VARCHAR(64), PRIMARY KEY)
- `ticket_number` (VARCHAR(100), NOT NULL, UNIQUE) — Contoh: `'TKT-2026-0001'`
- `ticket_code` (VARCHAR(100), NOT NULL)
- `title` (VARCHAR(255), NOT NULL)
- `description` (TEXT, NOT NULL)
- `category` (VARCHAR(40), NOT NULL) — `'IT'`, `'GA'`, `'SC'`, `'PIBC'`, `'License'`, `'General'`
- `priority` (VARCHAR(20), NOT NULL) — `'urgent'`, `'high'`, `'medium'`, `'low'`
- `status` (VARCHAR(30), NOT NULL) — `'open'`, `'assigned'`, `'in_progress'`, `'pending_user'`, `'resolved'`, `'closed'`
- `reporter_id` (VARCHAR(64), NOT NULL, REFERENCES users(id))
- `assigned_agent_id` (VARCHAR(64), REFERENCES users(id))
- `related_asset_id` (VARCHAR(64), REFERENCES assets(id))
- `sla_hours` (INTEGER, NOT NULL) — 4, 8, 24, 48
- `sla_resolution_deadline` (TIMESTAMPTZ, NOT NULL)
- `resolved_at` (TIMESTAMPTZ)
- `resolution_notes` (TEXT)
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW())
- **Indeks Penting**: `idx_tickets_scope` ON tickets(category, status, created_at DESC)

### 2.12 Tabel `ticket_comments` (Catatan Diskusi Tiket)
- `id` (BIGSERIAL, PRIMARY KEY)
- `ticket_id` (VARCHAR(64), NOT NULL, REFERENCES tickets(id) ON DELETE CASCADE)
- `user_id` (VARCHAR(64), NOT NULL, REFERENCES users(id))
- `body` (TEXT, NOT NULL)
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW())

### 2.13 Tabel `contracts` (Kontrak Rekanan / Vendor)
- `id` (VARCHAR(64), PRIMARY KEY)
- `contract_number` (VARCHAR(100), NOT NULL, UNIQUE)
- `vendor_name` (VARCHAR(255), NOT NULL)
- `title` (VARCHAR(255), NOT NULL)
- `start_date` (DATE)
- `end_date` (DATE, NOT NULL)
- `status` (VARCHAR(30), NOT NULL, DEFAULT 'active')
- `owner_division_id` (BIGINT, REFERENCES divisions(id))
- `document_ref` (TEXT)
- `notes` (TEXT)
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW())
- `updated_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW())
- **Indeks Penting**: `idx_contracts_expiry` ON contracts(end_date, status)

### 2.14 Tabel `notifications` (Notifikasi Sistem & Perutean Divisi)
- `id` (VARCHAR(64), PRIMARY KEY)
- `recipient_user_id` (VARCHAR(64), REFERENCES users(id))
- `recipient_role` (VARCHAR(50))
- `recipient_division_id` (BIGINT, REFERENCES divisions(id))
- `title` (VARCHAR(255), NOT NULL)
- `message` (TEXT, NOT NULL)
- `severity` (VARCHAR(30), NOT NULL) — `'critical'`, `'action_required'`, `'warning'`, `'info'`, `'success'`
- `category` (VARCHAR(40), NOT NULL) — `'sla'`, `'warranty'`, `'loan'`, `'movement'`, `'disposal'`, `'contract'`, `'reconciliation'`, `'system'`
- `link_type` (VARCHAR(40)) — `'asset'`, `'loan'`, `'ticket'`, `'reconciliation'`
- `link_id` (VARCHAR(64))
- `is_read` (BOOLEAN, NOT NULL, DEFAULT FALSE)
- `created_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW())
- **Indeks Penting**:
  - `idx_notifications_user_read` ON notifications(recipient_user_id, is_read, created_at DESC)
  - `idx_notifications_division_read` ON notifications(recipient_division_id, is_read, created_at DESC)

### 2.15 Tabel `audit_logs` (Rekam Jejak Audit BUMD)
- `id` (VARCHAR(64), PRIMARY KEY)
- `action` (VARCHAR(100), NOT NULL) — Contoh: `'ASSET_CREATED'`, `'LOAN_APPROVED'`, `'TICKET_CREATED'`
- `entity` (VARCHAR(100), NOT NULL) — `'Assets'`, `'Loans'`, `'Tickets'`, `'Users'`, `'MeetingRooms'`
- `entity_id` (VARCHAR(64))
- `user_id` (VARCHAR(64), REFERENCES users(id))
- `user_name` (VARCHAR(200), NOT NULL)
- `user_role` (VARCHAR(50), NOT NULL)
- `details` (TEXT, NOT NULL)
- `ip_address` (INET)
- `timestamp` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW())
- **Indeks Penting**: `idx_audit_entity` ON audit_logs(entity, entity_id, timestamp DESC)

### 2.16 Tabel `gabah_state` (Bridge Cache & Standalone Snapshot)
Menyimpan snapshot JSON terpadu seluruh entitas sistem:
- `id` (SMALLINT, PRIMARY KEY, CHECK (id = 1))
- `payload` (JSONB, NOT NULL) — Menyimpan bundle data: `users`, `sessions`, `assets`, `movements`, `loans`, `tickets`, `notifications`, `auditLogs`, `rooms`, `roomReservations`, `categories`, `locations`, `divisions`, `meetingTypes`, `meetingFacilities`
- `updated_at` (TIMESTAMPTZ, NOT NULL, DEFAULT NOW())

---

## 3. Entitas Ruang Rapat & Operasional Khusus (State Models)

Model entitas berikut dikelola melalui `server/db.ts` dan disinkronkan ke PostgreSQL melalui JSONB `gabah_state`:
1. `rooms` (`ServerMeetingRoom`): Ruang Rapat VIP Direksi, Cipinang Utama, SPHP, IT Center (kapasitas, fasilitas, status ketersediaan, warna tag).
2. `roomReservations` (`ServerRoomReservation`): Nomor reservasi (`RSV-2026-xxxx`), pemohon, jumlah peserta, tanggal/jam, fasilitas IT/GA, pesanan konsumsi, permintaan dokumentasi foto/video Humas, approval GA/VIP auto-approval, dan status checkin/checkout.
3. `meetingTypes` & `meetingFacilities`: Master data jenis rapat dan katalog inventaris fasilitas rapat.
4. `maintenances` (`ServerMaintenance`): Jadwal servis berkala, estimasi biaya, biaya aktual, teknisi, vendor, dan checklist teknis.

---

## 4. Trigger Pencegahan Tabrakan Jadwal (PL/pgSQL Trigger)

Diterapkan pada `server/migrations/003_loan_anti_collision_trigger.sql`:

```sql
CREATE OR REPLACE FUNCTION check_loan_schedule_collision()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('approved', 'borrowed') THEN
    IF EXISTS (
      SELECT 1 FROM loans
      WHERE asset_id = NEW.asset_id
        AND id <> NEW.id
        AND status IN ('approved', 'borrowed')
        AND NEW.start_date < due_date
        AND NEW.due_date > start_date
    ) THEN
      RAISE EXCEPTION 'Tabrakan Jadwal: Aset sudah direservasi atau dipinjam pada rentang tanggal tersebut.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_loan_schedule_collision ON loans;
CREATE TRIGGER trg_check_loan_schedule_collision
  BEFORE INSERT OR UPDATE OF asset_id, start_date, due_date, status
  ON loans
  FOR EACH ROW
  EXECUTE FUNCTION check_loan_schedule_collision();
```
