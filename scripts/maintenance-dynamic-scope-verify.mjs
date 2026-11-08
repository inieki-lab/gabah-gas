import fs from 'node:fs';

const server = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const services = fs.readFileSync(new URL('../server/services.ts', import.meta.url), 'utf8');
const start = server.indexOf("app.get('/api/maintenances'");
const end = server.indexOf("app.post('/api/maintenances'", start);
if (start < 0 || end < 0) throw new Error('GET /api/maintenances route not found');
const route = server.slice(start, end);

const checks = [
  ['PostgreSQL maintenance reads use the dedicated dynamic-scope resolver', /filterMaintenanceSchedulesByDynamicScopes\(db\.maintenances, actor\)/.test(route)],
  ['PostgreSQL visibility derives schedule IDs from resolved scoped assets', /dynamicallyScopedScheduleIds\.has\(schedule\.id\)/.test(route)],
  ['Employee baseline remains personal-asset-only', /asset\.assigned_to\?\.id === actor\.id/.test(route)],
  ['Primary-role filtering is confined to file-store compatibility', /if \(isPostgresPersistenceActive\(\)\)[\s\S]*?return res\.json\(\{ success: true, data: filtered \}\);[\s\S]*?const employeeBaseline/.test(route)],
  ['GA IT-workstation read-only exception is explicitly excluded from maintenance scope', /read-only IT-workstation exception is intentionally excluded/.test(route)],
  ['File-store legacy GA owner filter remains intact', /actor\.role !== 'GA' \|\| String\(asset\.owner_division\)\.toUpperCase\(\) === 'GA'/.test(route)],
  ['Dynamic maintenance resolver evaluates explicit asset scopes, not workstation read permission', /assetVisibleUnderDynamicScopes\(user, asset\)/.test(services) && !/assets\.read\.it_workstations/.test(services.slice(services.indexOf('export function filterMaintenanceSchedulesByDynamicScopes'), services.indexOf('export class GabahDomainService')))],
  ['Unknown or missing asset references fail closed', /asset != null && assetVisibleUnderDynamicScopes\(user, asset\)/.test(services)],
];
let failed = 0;
for (const [name, pass] of checks) {
  console.log((pass ? 'PASS' : 'FAIL') + ' | ' + name);
  if (!pass) failed += 1;
}
console.log('TOTAL: ' + checks.length + ' | PASS: ' + (checks.length - failed) + ' | FAIL: ' + failed);
process.exit(failed === 0 ? 0 : 1);
