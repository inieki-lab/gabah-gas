-- GABAH migration 047: grant dedicated ticket assignment capability to the ME queue administrator.
-- Assignment authority is distinct from ticket operation authority. Existing ME admins
-- retain tickets.update for handling tickets and gain tickets.assign for routing work.
INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, 'tickets.assign'
FROM gabah_roles r
WHERE r.role_key = 'admin_tiket_me'
  AND r.is_active = TRUE
ON CONFLICT (role_id, permission_key) DO NOTHING;
