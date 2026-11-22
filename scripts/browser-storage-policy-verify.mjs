import fs from 'node:fs';
import assert from 'node:assert/strict';

const admin = fs.readFileSync('src/components/modals/AdministrationModal.tsx', 'utf8');
const api = fs.readFileSync('src/services/gabahApi.ts', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');

const forbiddenAdminStorageKeys = [
  'gabah_system_settings',
  'gabah_org_divisions',
  'gabah_master_locations',
  'gabah_numbering_config',
  'gabah_role_permissions',
  'gabah_notification_rules',
];

for (const key of forbiddenAdminStorageKeys) {
  assert.equal(admin.includes(key), false, `Administration must not persist or hydrate ${key} from browser storage`);
}
assert.equal(/(?:window\.)?localStorage\.(?:getItem|setItem|removeItem)/.test(admin), false,
  'Administration must not use localStorage; server-backed masters and Dynamic RBAC are authoritative');

const storageAccesses = [...api.matchAll(/localStorage\.(?:getItem|setItem|removeItem)\(([^)]+)\)/g)].map(match => match[1].trim());
assert.ok(storageAccesses.length > 0, 'Auth token storage should remain wired');
assert.ok(storageAccesses.every(key => key === 'TOKEN_STORAGE_KEY' || key.startsWith('TOKEN_STORAGE_KEY,')),
  'The API client may access browser storage only through its canonical token key constant');
assert.match(api, /const TOKEN_STORAGE_KEY = 'gabah_auth_token';/,
  'The API client storage key must remain the canonical auth token');
assert.equal((app.match(/localStorage\\./g) || []).length, 1,
  'The application shell may only read the canonical auth token once');
assert.match(app, /localStorage\.getItem\('gabah_auth_token'\)/,
  'The application shell may only inspect gabah_auth_token');

console.log('Browser storage policy verified: only gabah_auth_token is persisted by the API client.');
