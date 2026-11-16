-- GABAH migration 039: separate GA helpdesk dispatchers from GA technicians.
DELETE FROM gabah_role_permissions rp
USING gabah_roles r
WHERE rp.role_id = r.id
  AND r.role_key = 'ga'
  AND rp.permission_key IN ('tickets.update', 'tickets.assign', 'tickets.close');

INSERT INTO gabah_roles (role_key, name, description, is_superadmin, is_active)
VALUES
  ('ga_helpdesk_operator', 'Petugas Helpdesk GA', 'Membaca antrean tiket GA, memperbarui tiket, dan mendelegasikan pekerjaan kepada petugas GA yang berwenang.', FALSE, TRUE),
  ('petugas_ga', 'Petugas GA', 'Menangani tiket GA yang ditugaskan; tidak memiliki hak delegasi.', FALSE, TRUE)
ON CONFLICT (role_key) DO NOTHING;

INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM gabah_roles r
JOIN (VALUES ('tickets.read'), ('tickets.update'), ('tickets.assign')) AS p(permission_key) ON TRUE
WHERE r.role_key = 'ga_helpdesk_operator' AND r.is_active = TRUE
ON CONFLICT (role_id, permission_key) DO NOTHING;

INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM gabah_roles r
JOIN (VALUES ('tickets.read'), ('tickets.update')) AS p(permission_key) ON TRUE
WHERE r.role_key = 'petugas_ga' AND r.is_active = TRUE
ON CONFLICT (role_id, permission_key) DO NOTHING;

INSERT INTO gabah_role_division_scopes (role_id, module, scope_type, scope_value)
SELECT r.id, 'tickets', 'division', 'GA'
FROM gabah_roles r
WHERE r.role_key IN ('ga_helpdesk_operator', 'petugas_ga') AND r.is_active = TRUE
ON CONFLICT DO NOTHING;
