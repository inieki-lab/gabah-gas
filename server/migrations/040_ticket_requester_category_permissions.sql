-- GABAH migration 040: category-specific requester permissions.
-- IT remains the company-wide employee helpdesk channel. GA and ME are opt-in.
INSERT INTO gabah_permissions (permission_key, module, action, description)
VALUES
  ('tickets.create.ga', 'tickets', 'create_ga', 'Mengajukan tiket layanan General Affair (GA)'),
  ('tickets.create.me', 'tickets', 'create_me', 'Mengajukan tiket Mechanical & Electrical (ME)')
ON CONFLICT (permission_key) DO NOTHING;
