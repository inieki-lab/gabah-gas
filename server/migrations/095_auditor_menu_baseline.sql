-- GABAH Migration 095: Auditor navigation baseline.
-- Auditor's default workspace is intentionally limited to Dashboard, Aset,
-- Vendor, Contract Management, and Laporan & Audit. Read-only access is
-- enforced separately by gabahSecurityMiddleware; this migration only
-- removes unrelated operational menu permissions from the Auditor role.
-- The five retained menu permissions remain configurable by Superadmin.
DELETE FROM gabah_role_permissions rp
USING gabah_roles r
WHERE rp.role_id = r.id
  AND r.role_key = 'auditor'
  AND rp.permission_key IN (
    'maintenances.read',
    'loans.read',
    'tickets.read',
    'meeting_rooms.read',
    'room_reservations.read',
    'licenses.read',
    'knowledge.read'
  );
