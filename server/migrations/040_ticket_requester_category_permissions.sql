-- GABAH migration 040: category-specific requester permissions for Helpdesk.
-- The existing tickets.create permission remains the company-wide IT request
-- capability. GA and ME requester access is opt-in through explicitly assigned
-- application roles; this migration deliberately grants neither permission.
INSERT INTO gabah_permissions (permission_key, module, action, description)
VALUES
  ('tickets.create.ga', 'tickets', 'create_ga', 'Mengajukan tiket layanan General Affair (GA)'),
  ('tickets.create.me', 'tickets', 'create_me', 'Mengajukan tiket layanan Mechanical & Electrical (ME)')
ON CONFLICT (permission_key) DO NOTHING;
