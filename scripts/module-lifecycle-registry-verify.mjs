import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migration = fs.readFileSync(path.join(root, 'server/migrations/037_module_lifecycle_registry.sql'), 'utf8');
const navigation = fs.readFileSync(path.join(root, 'src/navigation/roleNavigation.ts'), 'utf8');

const expectedTabs = [
  'dashboard', 'my_assets', 'meeting_rooms', 'assets', 'maintenance', 'loans',
  'tickets', 'licenses', 'contracts', 'vendors', 'knowledge', 'reports',
];

const seedBlock = migration.split('INSERT INTO gabah_modules')[1] || '';
for (const tab of expectedTabs) {
  assert.ok(navigation.includes(`'${tab}'`), `Navigation tab missing: ${tab}`);
  const seedLine = seedBlock.split('\n').find(line => line.includes(`('${tab}',`));
  assert.ok(seedLine, `Module registry seed missing: ${tab}`);
  assert.match(seedLine, /TRUE/, `Module must be seeded Active: ${tab}`);
}

assert.match(migration, /CREATE TABLE IF NOT EXISTS gabah_modules/i);
assert.match(migration, /CREATE TABLE IF NOT EXISTS gabah_module_status_audit/i);
assert.match(migration, /reason TEXT NOT NULL CHECK/i);
assert.match(migration, /changed_by_user_id TEXT NOT NULL/i);
assert.match(migration, /previous_is_active BOOLEAN NOT NULL/i);
assert.match(migration, /new_is_active BOOLEAN NOT NULL/i);
assert.match(migration, /CREATE OR REPLACE FUNCTION gabah_reject_module_audit_mutation/i);
assert.match(migration, /BEFORE UPDATE OR DELETE ON gabah_module_status_audit/i);
assert.match(migration, /BEFORE TRUNCATE ON gabah_module_status_audit/i);
assert.match(migration, /USING ERRCODE = '55000'/i);
assert.match(migration, /ON CONFLICT \(module_key\) DO NOTHING/i);
assert.match(migration, /is_active BOOLEAN NOT NULL DEFAULT TRUE/i);
assert.doesNotMatch(migration, /INSERT INTO gabah_user_roles/i);
assert.doesNotMatch(migration, /UPDATE gabah_roles/i);
assert.doesNotMatch(migration, /DELETE FROM/i);

console.log(`Module lifecycle registry verification passed (${expectedTabs.length} navigation modules seeded Active; no role assignment or data deletion).`);
