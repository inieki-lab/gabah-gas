import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('src/components/modals/AdministrationModal.tsx', 'utf8');
assert.match(source, /currentUser\?\.is_superadmin\s*===\s*true/, 'Administration must honor the server-provided Superadmin flag');
assert.match(source, /currentUser\?\.role_keys\?\.includes\('superadmin'\)\s*===\s*true/, 'Administration must honor the stable Superadmin role key');
assert.match(source, /!hasPermissionMetadata[\s\S]*activeRole === 'Admin GABAH'/, 'Legacy role fallback must only apply when permission metadata is absent');
console.log('PASS: Administration access recognizes Superadmin identity without relying on the active dashboard persona.');
