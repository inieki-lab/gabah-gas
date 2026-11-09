-- GABAH migration 038: separate ticket dispatch authority from ticket updates.
-- IT tickets are auto-routed to the sole explicitly authorized IT support agent;
-- GA and ME dispatchers receive tickets.assign and delegate within their scope.

INSERT INTO gabah_permissions (permission_key, module, action, description)
VALUES ('tickets.assign', 'tickets', 'assign', 'Mendelegasikan tiket kepada petugas aktif yang memiliki permission dan scope sesuai')
ON CONFLICT (permission_key) DO NOTHING;

-- GA is the current facilities dispatcher. This is a permission preset only:
-- Super Admin may assign the role to any employee and may create other presets.
INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, 'tickets.assign'
FROM gabah_roles r
WHERE r.role_key = 'ga' AND r.is_active = TRUE
ON CONFLICT (role_id, permission_key) DO NOTHING;

-- ME dispatcher template; no account is assigned automatically.
INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, 'tickets.assign'
FROM gabah_roles r
WHERE r.role_key = 'admin_tiket_me' AND r.is_active = TRUE
ON CONFLICT (role_id, permission_key) DO NOTHING;
