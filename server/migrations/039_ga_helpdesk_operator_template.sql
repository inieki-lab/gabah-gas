-- GABAH migration 039: make GA helpdesk handling an explicit assignment.
-- GA tickets belong to the designated Admin/Staf GA operator, not automatically
-- to every employee carrying the generic GA role or to the Kasi by job title.
-- Super Admin assigns this template to the employee who actually handles GA tickets.

-- Ticket execution/dispatch belongs to the explicitly assigned helpdesk operator.
-- Keep all other generic GA capabilities intact (asset operations, reports,
-- contracts, vendors, facilities, etc.) for both Kasi and Admin/Staf GA.
DELETE FROM gabah_role_permissions rp
USING gabah_roles r
WHERE rp.role_id = r.id
  AND r.role_key = 'ga'
  AND rp.permission_key IN ('tickets.update', 'tickets.assign');

INSERT INTO gabah_roles (role_key, name, description, is_superadmin, is_active)
VALUES (
  'ga_helpdesk_operator',
  'Petugas Helpdesk GA',
  'Menangani tiket fasilitas dan layanan GA serta mendelegasikan pekerjaan kepada petugas GA aktif yang berwenang. Diberikan secara eksplisit kepada Admin/Staf GA atau pegawai yang ditunjuk; bukan berdasarkan jabatan.',
  FALSE,
  TRUE
)
ON CONFLICT (role_key) DO NOTHING;

INSERT INTO gabah_role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM gabah_roles r
JOIN (VALUES
  ('tickets.read'),
  ('tickets.update'),
  ('tickets.assign')
) AS p(permission_key) ON TRUE
WHERE r.role_key = 'ga_helpdesk_operator'
  AND r.is_active = TRUE
ON CONFLICT (role_id, permission_key) DO NOTHING;

INSERT INTO gabah_role_division_scopes (role_id, module, scope_type, scope_value)
SELECT r.id, 'tickets', 'division', 'GA'
FROM gabah_roles r
WHERE r.role_key = 'ga_helpdesk_operator'
  AND r.is_active = TRUE
ON CONFLICT DO NOTHING;
