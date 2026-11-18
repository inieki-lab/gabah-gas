import fs from 'node:fs';
import assert from 'node:assert/strict';

const server = fs.readFileSync('server.ts', 'utf8');
const services = fs.readFileSync('server/services.ts', 'utf8');
const assets = fs.readFileSync('src/components/views/AssetsView.tsx', 'utf8');
const contracts = fs.readFileSync('src/components/views/ContractsView.tsx', 'utf8');
const dashboard = fs.readFileSync('src/components/views/DashboardView.tsx', 'utf8');

assert.match(server, /\['SC', 'PIBC', 'SUPPLY CHAIN'\]\.includes\(owner\.toUpperCase\(\)\)/,
  'asset creation options must hide legacy SC/PIBC owner categories');
assert.match(services, /\['SC', 'PIBC', 'SUPPLY CHAIN'\]\.includes\(normalizedOwner\)[\s\S]*?statusCode: 409/,
  'domain service must reject new assets assigned to legacy location codes');
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

console.log('Legacy owner / location separation checks: 14/14 passed');
