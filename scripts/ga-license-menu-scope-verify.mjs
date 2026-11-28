import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration = fs.readFileSync('server/migrations/050_remove_ga_licenses_read_permission.sql', 'utf8');
const seed = fs.readFileSync('server/migrations/023_dynamic_rbac_employee_and_navigation_permissions.sql', 'utf8');
const scopes = fs.readFileSync('server/migrations/021_dynamic_rbac_ga_it_workstation_read.sql', 'utf8');
const services = fs.readFileSync('server/services.ts', 'utf8');
const navigation = fs.readFileSync('src/navigation/roleNavigation.ts', 'utf8');

assert.match(migration, /DELETE FROM gabah_role_permissions rp[\s\S]*r\.role_key = 'ga'[\s\S]*rp\.permission_key = 'licenses\.read'/,
  'migration must remove licenses.read from the default GA role');
assert.doesNotMatch(migration, /r\.role_key\s+IN\s*\([^)]*'it'/,
  'migration must not remove the IT license permission');
assert.match(seed, /'licenses\.read'[\s\S]*WHERE r\.role_key IN \('superadmin', 'it', 'ga', 'auditor'\)/,
  'baseline seed historically granted the license menu to GA, IT, Superadmin, and Auditor');
assert.match(scopes, /'assets\.read\.it_workstations'/,
  'GA IT workstation visibility must remain an explicit capability');
assert.match(services, /const readOnlyItWorkstations = canReadItWorkstations[\s\S]*owner_division \|\| ''\)\.toUpperCase\(\) === 'IT' && isItWorkstation\(asset\)/,
  'GA read-only exception must remain limited to IT workstation hardware');
assert.match(services, /\['HLT', 'HPC'\]/,
  'read-only IT asset exception must remain limited to HLT/HPC workstation categories');
assert.match(navigation, /licenses: \['licenses\.read', 'assets\.read'\]/,
  'Software & SaaS menu must require both license and asset read permissions');

console.log('GA license menu scope regression: PASS (GA workstation read-only remains; default Software & SaaS access removed).');
