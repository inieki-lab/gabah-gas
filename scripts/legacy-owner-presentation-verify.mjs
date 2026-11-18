import fs from 'node:fs';
import assert from 'node:assert/strict';

const server = fs.readFileSync('server.ts', 'utf8');
const services = fs.readFileSync('server/services.ts', 'utf8');
const assets = fs.readFileSync('src/components/views/AssetsView.tsx', 'utf8');
const contracts = fs.readFileSync('src/components/views/ContractsView.tsx', 'utf8');
const dashboard = fs.readFileSync('src/components/views/DashboardView.tsx', 'utf8');
const admin = fs.readFileSync('src/components/modals/AdministrationModal.tsx', 'utf8');
const roleNavigation = fs.readFileSync('src/navigation/roleNavigation.ts', 'utf8');
const dbSeed = fs.readFileSync('server/db.ts', 'utf8');
const persistence = fs.readFileSync('server/persistence.ts', 'utf8');
const retireLocations = fs.readFileSync('server/migrations/100_retire_location_labels_from_org_divisions.sql', 'utf8');
const retireRoles = fs.readFileSync('server/migrations/101_retire_branch_location_roles.sql', 'utf8');
const normalizeProfiles = fs.readFileSync('server/migrations/102_post_seed_normalize_branch_location_profiles.sql', 'utf8');
const taxonomyCreateStart = server.indexOf("app.post('/api/taxonomy/categories'");
const taxonomyPatchStart = server.indexOf("app.patch('/api/taxonomy/categories/:code'");
const taxonomyCreate = server.slice(taxonomyCreateStart, taxonomyPatchStart);
const taxonomyPatch = server.slice(taxonomyPatchStart, server.indexOf("app.delete('/api/taxonomy/categories/:code'", taxonomyPatchStart));

assert.match(server, /\['SC', 'PIBC', 'SUPPLY CHAIN'\]\.includes\(owner\.toUpperCase\(\)\)/,
  'asset creation options must hide legacy SC/PIBC owner categories');
assert.match(services, /\['SC', 'PIBC', 'SUPPLY CHAIN'\]\.includes\(normalizedOwner\)[\s\S]*?statusCode: 409/,
  'domain service must reject new assets assigned to legacy location codes');
assert.match(taxonomyCreate, /\['SC', 'PIBC', 'SUPPLY CHAIN'\]\.includes\(String\(owner_division\)\.trim\(\)\.toUpperCase\(\)\)/,
  'new category master rows must not introduce legacy location owners');
assert.match(taxonomyPatch, /owner_division !== undefined[\s\S]*?\['SC', 'PIBC', 'SUPPLY CHAIN'\]/,
  'category owner edits must not reintroduce legacy location codes');
assert.match(assets, /selectedDivision === 'LEGACY'[\s\S]*?\['SC', 'PIBC', 'SUPPLY CHAIN'\]/,
  'asset view may expose legacy owner records only through a review filter');
assert.doesNotMatch(assets, /\{ id: 'SC', label: 'SC' \}|\{ id: 'PIBC', label: 'PIBC' \}/,
  'asset view must not present SC/PIBC as active divisions');
assert.match(contracts, /hasPermission\('contracts\.create', \['IT', 'GA'\]\)/);
assert.match(contracts, /hasPermission\('contracts\.documents\.upload', \['IT', 'GA'\]\)/);
assert.match(contracts, /options: \['ALL', \.\.\.ownerDomains, 'LEGACY'\]/);
assert.match(contracts, /deptFilter === 'LEGACY'[\s\S]*?\['SC', 'PIBC', 'SUPPLY CHAIN'\]/);
assert.match(contracts, /'Legacy \(perlu review\)'/);
const legacyGrants = dashboard.slice(dashboard.indexOf('const legacyGrants:'), dashboard.indexOf('return (legacyGrants[key]', dashboard.indexOf('const legacyGrants:')));
assert.ok(legacyGrants.length > 0);
assert.doesNotMatch(legacyGrants, /Supply Chain|PIBC|\bSC\b/,
  'dashboard compatibility grants must not treat location labels as roles');
assert.match(dashboard, /owner lama \(perlu review\)/);
assert.doesNotMatch(dashboard, /owner legacy SC|owner legacy PIBC/);
assert.match(dashboard, /<span>Layanan Helpdesk<\/span>/);
assert.doesNotMatch(roleNavigation, /'Supply Chain':|PIBC:/,
  'legacy office labels must not receive fallback role navigation');
assert.doesNotMatch(services, /LEGACY_SCOPED_ROLES|isLegacyScopedRole/,
  'obsolete SC/PIBC legacy role-scope helper must not remain available for future authorization use');
assert.match(admin, /activeOwnerDivisions = React\.useMemo/);
assert.match(admin, /value=\{newCategoryData\.owner_division\}[\s\S]*?activeOwnerDivisions\.map/);
assert.match(admin, /value=\{numberingRuleForm\.owner_division\}[\s\S]*?activeOwnerDivisions\.map/);
assert.match(admin, /value=\{newUserData\.division \|\| ''\}[\s\S]*?activeOwnerDivisions\.map/);
assert.match(admin, /Legacy \{editUserData\.division\} — perlu normalisasi/);
assert.match(admin, /Legacy \{editCategoryData\.owner_division\} — perlu review/);
assert.match(admin, /Legacy \(perlu normalisasi\)/);

assert.match(dbSeed, /code: 'SC',[^\\n]*is_active: false/);
assert.match(dbSeed, /code: 'PIBC',[^\\n]*is_active: false/);
assert.match(dbSeed, /id: 'UNIT-SC',[^\\n]*is_active: false/);
assert.match(dbSeed, /id: 'UNIT-PIBC',[^\\n]*is_active: false/);
assert.match(dbSeed, /id: 'UNIT-PANGSUB',[^\\n]*is_active: false/);
assert.match(dbSeed, /id: 'UNIT-PIBC-ME',[^\\n]*office_location_id: 'OFF-PIBC',[^\\n]*is_active: true/);
assert.match(retireLocations, /UPDATE divisions[\\s\\S]*WHERE code IN \\('SC', 'PIBC'\\)/);
assert.match(retireLocations, /UPDATE org_units[\\s\\S]*WHERE id IN \\('UNIT-SC', 'UNIT-PIBC', 'UNIT-PANGSUB'\\)/);
assert.match(retireRoles, /role_key IN \\('supply_chain', 'pibc'\\)/);
assert.match(retireRoles, /SET is_active = FALSE/);
assert.match(normalizeProfiles, /role IN \\('Supply Chain', 'PIBC'\\)[\\s\\S]*'Karyawan'/);
assert.match(normalizeProfiles, /WHEN u\\.role = 'PIBC' THEN 'OFF-PIBC'/);
assert.match(normalizeProfiles, /WHEN u\\.role = 'Supply Chain' THEN 'OFF-RPC'/);
assert.match(normalizeProfiles, /unit_id = CASE[\\s\\S]*'UNIT-SC', 'UNIT-PIBC', 'UNIT-PANGSUB'/);
assert.match(normalizeProfiles, /USER_LOCATION_ROLE_NORMALIZED/);
assert.match(persistence, /normalizeLegacyLocationProfilesInMemory/);
assert.match(persistence, /SELECT id::text AS id, role, unit_id, office_location_id FROM users/);

console.log('Legacy owner / location separation checks: 37/37 passed');
