-- Remove the default Software & SaaS workspace from GA.
-- GA may view only the explicitly scoped IT workstation hardware subset;
-- this does not grant access to IT software/license records.
-- Custom roles may still grant licenses.read deliberately when approved.
DELETE FROM gabah_role_permissions rp
USING gabah_roles r
WHERE rp.role_id = r.id
  AND r.role_key = 'ga'
  AND rp.permission_key = 'licenses.read';
