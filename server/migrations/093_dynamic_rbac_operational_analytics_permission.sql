-- Add a dedicated role permission for the operational analytics dashboard.
-- No role receives this permission automatically: Superadmin must explicitly
-- select it in Administration > Role & Hak Akses for each intended role.
-- Dashboard source collections remain protected by their own read permissions
-- and data scopes; this permission controls visibility of the aggregate charts.
-- The migration runner owns the transaction. Safe to apply repeatedly.

INSERT INTO gabah_permissions (permission_key, module, action, description)
VALUES (
  'analytics.operational.read',
  'analytics',
  'read_operational',
  'Melihat grafik Analitik Operasional sesuai permission baca dan cakupan data'
)
ON CONFLICT (permission_key) DO NOTHING;
