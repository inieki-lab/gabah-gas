-- Reconcile room-reservation operational capability grants after canonical
-- roles have been seeded. This is a NEW migration (not an edit to 034/090):
-- databases that already recorded those migrations must receive the fix too.
-- Additive and idempotent; never overwrites custom role assignments.

INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM gabah_roles r
JOIN (VALUES
  ('it', 'room_reservations.it_facilities.read'),
  ('humas', 'room_reservations.documentation.read'),
  ('sekretaris_direksi', 'room_reservations.override_priority')
) AS p(role_key, permission_key) ON p.role_key = r.role_key
JOIN gabah_permissions permission
  ON permission.permission_key = p.permission_key
 AND permission.is_active = TRUE
WHERE r.is_active = TRUE
ON CONFLICT (role_id, permission_key) DO NOTHING;
