-- GABAH migration 041: opt-in requester role templates for GA and ME tickets.
-- These are additional application roles, not primary employee profiles.
-- They are intentionally not assigned to users automatically. Superadmin
-- grants/revokes them per employee through Administration > User Management.
-- IT ticket creation remains the company-wide authenticated employee channel;
-- Auditor is read-only and is denied by the API regardless of additional roles.

INSERT INTO gabah_roles (role_key, name, description, is_superadmin, is_active)
VALUES
  ('pemohon_tiket_ga', 'Pemohon Tiket GA', 'Kapabilitas tambahan untuk mengajukan tiket layanan General Affair (GA). Tidak memberikan hak menangani tiket.', FALSE, TRUE),
  ('pemohon_tiket_me', 'Pemohon Tiket ME', 'Kapabilitas tambahan untuk mengajukan tiket Mechanical & Electrical (ME). Tidak memberikan hak menangani tiket.', FALSE, TRUE)
ON CONFLICT (role_key) DO NOTHING;

INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM (VALUES
  ('pemohon_tiket_ga', 'tickets.create.ga'),
  ('pemohon_tiket_me', 'tickets.create.me')
) AS grant_map(role_key, permission_key)
JOIN gabah_roles r ON r.role_key = grant_map.role_key AND r.is_active = TRUE
JOIN gabah_permissions p ON p.permission_key = grant_map.permission_key AND p.is_active = TRUE
ON CONFLICT (role_id, permission_key) DO NOTHING;
