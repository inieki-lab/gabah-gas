-- Dynamic RBAC Stage 2: catalogue seed and legacy assignment backfill.
-- Additive only: preserve users.role and all existing application authorization paths.
-- The migration runner owns the transaction; do not add BEGIN/COMMIT here.

-- Seed a permission vocabulary for the current product modules. Enforcement is
-- deliberately not switched on in this migration; endpoint-by-endpoint mapping
-- and regression tests must precede runtime authorization changes.
INSERT INTO gabah_permissions (permission_key, module, action, description) VALUES
  ('dashboard.read', 'dashboard', 'read', 'Melihat dashboard'),
  ('users.read', 'users', 'read', 'Melihat daftar dan detail user'),
  ('users.create', 'users', 'create', 'Membuat user'),
  ('users.update', 'users', 'update', 'Mengubah data user'),
  ('users.deactivate', 'users', 'deactivate', 'Menonaktifkan user'),
  ('roles.read', 'roles', 'read', 'Melihat daftar role dan permission'),
  ('roles.create', 'roles', 'create', 'Membuat role'),
  ('roles.update', 'roles', 'update', 'Mengubah nama dan konfigurasi role'),
  ('roles.deactivate', 'roles', 'deactivate', 'Menonaktifkan role'),
  ('roles.delete', 'roles', 'delete', 'Menghapus role yang tidak digunakan'),
  ('roles.permissions.manage', 'roles', 'manage_permissions', 'Mengatur permission role'),
  ('roles.scopes.manage', 'roles', 'manage_scopes', 'Mengatur cakupan divisi, unit, dan lokasi'),
  ('roles.assign', 'roles', 'assign', 'Menetapkan role ke user'),
  ('assets.read', 'assets', 'read', 'Melihat data aset sesuai scope'),
  ('assets.create', 'assets', 'create', 'Membuat data aset'),
  ('assets.update', 'assets', 'update', 'Mengubah data aset'),
  ('assets.delete', 'assets', 'delete', 'Menghapus data aset'),
  ('loans.read', 'loans', 'read', 'Melihat peminjaman aset'),
  ('loans.create', 'loans', 'create', 'Mengajukan peminjaman aset'),
  ('loans.approve', 'loans', 'approve', 'Menyetujui peminjaman aset'),
  ('loans.handover', 'loans', 'handover', 'Mencatat serah terima aset'),
  ('loans.return', 'loans', 'return', 'Memproses pengembalian aset'),
  ('tickets.read', 'tickets', 'read', 'Melihat tiket sesuai scope'),
  ('tickets.create', 'tickets', 'create', 'Membuat tiket'),
  ('tickets.update', 'tickets', 'update', 'Mengubah tiket'),
  ('tickets.assign', 'tickets', 'assign', 'Menetapkan penanggung jawab tiket'),
  ('tickets.close', 'tickets', 'close', 'Menutup tiket'),
  ('licenses.read', 'licenses', 'read', 'Melihat lisensi'),
  ('licenses.manage', 'licenses', 'manage', 'Mengelola lisensi'),
  ('contracts.read', 'contracts', 'read', 'Melihat kontrak sesuai scope'),
  ('contracts.manage', 'contracts', 'manage', 'Mengelola kontrak dan dokumen'),
  ('reports.read', 'reports', 'read', 'Melihat laporan'),
  ('reports.export', 'reports', 'export', 'Mengekspor laporan'),
  ('audit.read', 'audit', 'read', 'Melihat audit log'),
  ('organization.manage', 'organization', 'manage', 'Mengelola master organisasi'),
  ('master_data.manage', 'master_data', 'manage', 'Mengelola master data'),
  ('notifications.manage', 'notifications', 'manage', 'Mengelola konfigurasi notifikasi'),
  ('settings.manage', 'settings', 'manage', 'Mengelola pengaturan sistem')
ON CONFLICT (permission_key) DO NOTHING;

-- Backfill the user-role relation from the existing normalized users table.
-- Unknown/legacy role values are intentionally skipped, not silently remapped.
INSERT INTO gabah_user_roles (user_id, role_id)
SELECT u.id::text, r.id
FROM users u
JOIN gabah_roles r ON r.role_key = CASE u.role
  WHEN 'Admin GABAH' THEN 'superadmin'
  WHEN 'IT' THEN 'it'
  WHEN 'GA' THEN 'ga'
  WHEN 'Sekretaris Direksi' THEN 'sekretaris_direksi'
  WHEN 'Humas' THEN 'humas'
  WHEN 'Supply Chain' THEN 'supply_chain'
  WHEN 'PIBC' THEN 'pibc'
  WHEN 'Karyawan' THEN 'karyawan'
  WHEN 'Auditor' THEN 'auditor'
  ELSE NULL
END
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Explicitly maintain the Superadmin capability on its stable internal role key.
-- This is not a display-name check and does not grant Superadmin to other roles.
UPDATE gabah_roles
SET is_superadmin = (role_key = 'superadmin'),
    updated_at = NOW()
WHERE role_key IN ('superadmin', 'it', 'ga', 'sekretaris_direksi', 'humas',
                   'supply_chain', 'pibc', 'karyawan', 'auditor');
