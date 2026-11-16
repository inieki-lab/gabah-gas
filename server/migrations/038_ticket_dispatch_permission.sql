-- GABAH migration 038: separate ticket dispatch authority from ticket updates.
INSERT INTO gabah_permissions (permission_key, module, action, description)
VALUES ('tickets.assign', 'tickets', 'assign', 'Mendelegasikan tiket kepada petugas aktif yang memiliki permission dan scope sesuai')
ON CONFLICT (permission_key) DO NOTHING;

-- The generic GA role is not automatically a helpdesk operator; migration 039
-- moves this permission to the explicit ga_helpdesk_operator template.
INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, 'tickets.assign'
FROM gabah_roles r
WHERE r.role_key = 'ga' AND r.is_active = TRUE
ON CONFLICT (role_id, permission_key) DO NOTHING;

INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, 'tickets.assign'
FROM gabah_roles r
WHERE r.role_key = 'admin_tiket_me' AND r.is_active = TRUE
ON CONFLICT (role_id, permission_key) DO NOTHING;
