import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const migrationPath = path.join(root, 'server/migrations/037_module_lifecycle_registry.sql');
const navigationPath = path.join(root, 'src/navigation/roleNavigation.ts');
const migration = fs.readFileSync(migrationPath, 'utf8');
const navigation = fs.readFileSync(navigationPath, 'utf8');

const expectedTabs = [
  'dashboard', 'my_assets', 'meeting_rooms', 'assets', 'maintenance', 'loans',
  'tickets', 'licenses', 'contracts', 'vendors', 'knowledge', 'reports',
];

for (const tab of expectedTabs) {
  assert.match(navigation, new RegExp(`['"]${tab}['"]`), `Navigation tab missing: ${tab}`);
  assert.match(migration, new RegExp(`\\('\\${tab}\\'`), `Module registry seed missing: ${tab}`);
}

assert.match(migration, /CREATE TABLE IF NOT EXISTS gabah_modules/i);
assert.match(migration, /CREATE TABLE IF NOT EXISTS gabah_module_status_audit/i);
assert.match(migration, /reason TEXT NOT NULL CHECK/i);
assert.match(migration, /changed_by_user_id TEXT NOT NULL/i);
assert.match(migration, /previous_is_active BOOLEAN NOT NULL/i);
assert.match(migration, /new_is_active BOOLEAN NOT NULL/i);
assert.match(migration, /ON CONFLICT \\(module_key\\) DO NOTHING/i);
assert.match(migration, /is_active BOOLEAN NOT NULL DEFAULT TRUE/i);
assert.doesNotMatch(migration, /INSERT INTO gabah_user_roles/i);
assert.doesNotMatch(migration, /UPDATE gabah_roles/i);
assert.doesNotMatch(migration, /DELETE FROM/i);

const seedBlock = migration.split('INSERT INTO gabah_modules')[1] || '';
for (const tab of expectedTabs) {
  const line = seedBlock.split('\\n').find(value => value.includes(`'${tab}'`));
  assert.ok(line, `Seed row missing: ${tab}`);
  assert.match(line, /TRUE/, `Module must be seeded Active: ${tab}`);
}

console.log(`Module lifecycle registry verification passed (${expectedTabs.length} navigation modules seeded Active; no role assignment or data deletion).`);
