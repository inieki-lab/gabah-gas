import fs from 'node:fs';
import assert from 'node:assert/strict';

const server = fs.readFileSync('server.ts', 'utf8');
const modal = fs.readFileSync('src/components/modals/CreateAssetModal.tsx', 'utf8');
const api = fs.readFileSync('src/services/gabahApi.ts', 'utf8');

assert.match(server, /app\.get\('\/api\/assets\/creation-categories'/,
  'asset creation categories endpoint must exist');
assert.match(server, /requireRbacPermission\(req, res, 'assets\.create'\)/,
  'creation options must require assets.create');
assert.match(server, /hasRbacScope\(String\(actor\.id\), 'division', owner, 'assets'\)/,
  'creation options must be filtered by exact assets owner scope');
assert.match(server, /hasRbacPermission\(String\(actor\.id\), 'licenses\.manage'\)/,
  'license categories must require licenses.manage');
assert.match(api, /getAssetCreationCategories\(\)[\s\S]*?\/api\/assets\/creation-categories/,
  'frontend API client must call the server-authorized endpoint');
assert.match(modal, /gabahApi\.getAssetCreationCategories\(\)/,
  'asset creation form must use server-authorized category options');
assert.match(modal, /divisionOverride: String\(master\?\.owner_division \|\| ''\)/,
  'selected category must carry its configured owner domain');
assert.match(modal, /availableOwnerDomains\.map\(owner =>/,
  'owner selector must use configurable owner-domain values');
assert.doesNotMatch(modal, /userRole === '(IT|GA|Supply Chain|PIBC)'/,
  'asset creation UI must not infer write domains from primary role labels');
assert.match(modal, /resolvedUser\?\.is_superadmin === true/,
  'superadmin UI capability must come from the server-calculated flag');

console.log('Asset creation owner-scope checks: 10/10 passed');
