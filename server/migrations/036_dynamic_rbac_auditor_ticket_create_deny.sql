-- Stage 36: Auditor is read-only and must never receive ticket creation.
-- Stage 24 seeded tickets.create to the full employee set, including Auditor.
-- Remove only that accidental grant; keep tickets.read and audit visibility.
-- Additive/safe on every database state; no user or ticket data is changed.

DELETE FROM gabah_role_permissions rp
USING gabah_roles r
WHERE rp.role_id = r.id
  AND r.role_key = 'auditor'
  AND rp.permission_key = 'tickets.create';
