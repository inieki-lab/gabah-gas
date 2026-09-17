# GABAH (General Asset, Business & Helpdesk)
### Enterprise Asset, Helpdesk, and Anti-Collision Loan Management System
**Backend Architecture: Laravel 11 | PHP 8.3+ | PostgreSQL 17**

---

## 🏛️ Arsitektur Sistem

1. **Service Layer Pattern**: Semua kalkulasi bisnis (Anti-Bentrok, SLA timer, generate nomor ASTICK unik, audit trail) didelegasikan ke `app/Services/`. Controller tetap tipis.
2. **Database Transactions**: Operasi peminjaman, approval, serah terima, dan pembuatan aset dibungkus dalam `DB::transaction()` dengan pessimistic locking (`lockForUpdate()`) guna menjamin integritas data saat konkurensi tinggi.
3. **Form Requests**: Validasi request sepenuhnya diisolasi di `app/Http/Requests/` dengan pesan error operasional berbahasa Indonesia.
4. **Granular RBAC**: Role-Based Access Control menggunakan Spatie Permission dengan isolasi wewenang per `CategoryType` (`IT`, `General`, `License`) pada `app/Policies/AssetPolicy.php`.
5. **Anti-Bentrok Loan Engine**: Formula interval overlap query atomik:
   `where('loan_date', '<', $newEnd)->where('due_date', '>', $newStart)`

---

## 📊 Database Schema (9 Tabel Utama)

1. `users` (id, name, email, password, is_active, deleted_at, timestamps)
2. `asset_categories` (id, code, name, description, category_type, is_active, timestamps)
3. `vendors` (id, name, type, contact_person, phone, email, address, notes, timestamps)
4. `assets` (id, asset_number, name, serial_number, hostname, ip_address, category_type, asset_category_id, status, location, assigned_to, vendor_id, pic_id, purchase_date, warranty_until, price, custom_attributes[JSONB], qr_code_url, is_loanable, loan_blocked, timestamps)
5. `tickets` (id, ticket_number, type, subject, description, status, priority, sla_response_deadline, sla_resolution_deadline, is_over_sla, asset_id, requester_id, assignee_id, category, approval_status, approved_by, approved_at, timestamps)
6. `loans` (id, loan_number, asset_id, borrower_id, purpose, loan_date, due_date, returned_at, status, approved_by, received_by, notes, timestamps)
7. `kb_articles` (id, title, category, content, author_id, views, status, timestamps)
8. `notices` (id, user_id, type, title, body, link, read_at, timestamps)
9. `audit_logs` (id, user_id, action, auditable_type, auditable_id, old_values[JSONB], new_values[JSONB], ip_address, user_agent, created_at)

---

## 🚀 Panduan Instalasi & Menjalankan

```bash
# 1. Salin konfigurasi environment
cp .env.example .env

# 2. Install dependency PHP via Composer
composer install --optimize-autoloader

# 3. Generate Application Key
php artisan key:generate

# 4. Jalankan Migrasi & Database Seeder
php artisan migrate:fresh --seed

# 5. Jalankan Background Queue Worker
php artisan queue:work --tries=3

# 6. Jalankan Web Server
php artisan serve --port=8000
```
