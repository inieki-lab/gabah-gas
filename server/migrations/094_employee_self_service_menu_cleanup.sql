-- GABAH Migration 094: employee baseline menu cleanup.
-- Karyawan is a self-service employee role, not an inventory-management,
-- maintenance-planning, or room-reservation operations role.
-- These capabilities remain configurable through Role & Permissions. A
-- Superadmin may explicitly grant them to Karyawan or any custom role.
-- Authority is role-based; no per-user override is introduced.
DELETE FROM gabah_role_permissions rp
USING gabah_roles r
WHERE rp.role_id = r.id
  AND r.role_key = 'karyawan'
  AND rp.permission_key IN (
    'maintenances.read',
    'meeting_rooms.read',
    'room_reservations.read'
  );
