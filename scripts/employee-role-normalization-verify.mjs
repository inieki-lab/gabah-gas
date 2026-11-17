import fs from 'node:fs';
import assert from 'node:assert/strict';

const persistence = fs.readFileSync('server/persistence.ts', 'utf8');
const dashboard = fs.readFileSync('src/components/views/DashboardView.tsx', 'utf8');
const header = fs.readFileSync('src/components/HeaderNavbar.tsx', 'utf8');
const migration = fs.readFileSync('server/migrations/031_employee_primary_role_with_job_capabilities.sql', 'utf8');
const dynamic = fs.readFileSync('scripts/dynamic-rbac-foundation-verify.mjs', 'utf8');

const persistFunction = persistence.slice(persistence.indexOf('async function persistPostgresState()'), persistence.indexOf('export async function initializePersistence()'));
assert.match(persistFunction, /await backfillNormalizedTables\(client\);/);
assert.doesNotMatch(persistFunction, /backfillDynamicRbacUserRoles|users\.role|gabah_user_roles/);
assert.doesNotMatch(persistence, /function normalizeLegacyEmployeeProfileRoles|function collectLegacyEmployeeCapabilityAssignments|function backfillDynamicRbacUserRoles/);
assert.match(migration, /INSERT INTO gabah_user_roles/);
assert.match(migration, /UPDATE users\s+SET role = 'Karyawan'/);
assert.match(dashboard, /hasRoleKey\('humas', 'Humas'\)/);
assert.match(dashboard, /hasRoleKey\('sekretaris_direksi', 'Sekretaris Direksi'\)/);
assert.match(header, /currentUser\.role_keys !== undefined[\s\S]*currentUser\.role_keys\.includes\(key\)[\s\S]*currentUser\.role === legacyLabel/);
assert.match(header, /hasRoleKey\('humas', 'Humas'\)/);
assert.match(dynamic, /one-time migration preserves Humas and Secretariat function assignments/);
console.log('Employee profile and RBAC persistence separation: PASS');
