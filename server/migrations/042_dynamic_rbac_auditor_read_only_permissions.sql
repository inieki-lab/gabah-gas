-- Stage 42: align the Auditor permission template with the global read-only policy.
-- The runtime middleware already denies Auditor write requests, including when
-- Auditor is assigned as an additional role. Remove misleading write grants
-- from the base Auditor template so effective permissions and UI affordances
-- match that policy. This is additive to the migration history and idempotent.

DELETE FROM gabah_role_permissions rp
USING gabah_roles r
WHERE rp.role_id = r.id
  AND r.role_key = 'auditor'
  AND rp.permission_key IN (
    'loans.create',
    'loans.return',
    'tickets.create',
    'knowledge.vote',
    'room_reservations.create',
    'room_reservations.cancel'
  );
