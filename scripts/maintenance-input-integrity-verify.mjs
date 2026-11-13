import fs from 'node:fs';

const server = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const start = server.indexOf('const MAINTENANCE_FREQUENCIES');
const end = server.indexOf("app.post('/api/maintenances'", start);
if (start < 0 || end < 0) throw new Error('Maintenance validation block not found');
const validation = server.slice(start, end);
const postStart = end;
const patchStart = server.indexOf("app.patch('/api/maintenances/:id'", postStart);
const vendorStart = server.indexOf('// Vendor Directory', patchStart);
if (patchStart < 0 || vendorStart < 0) throw new Error('Maintenance routes not found');
const post = server.slice(postStart, patchStart);
const patch = server.slice(patchStart, vendorStart);

const checks = [
  ['frequency is restricted to the declared maintenance enum', validation.includes("'weekly', 'monthly', 'quarterly', 'biannual', 'annual', 'one_time'")],
  ['status is restricted to the declared maintenance enum', validation.includes("'scheduled', 'in_progress', 'completed', 'overdue', 'cancelled'")],
  ['date uses strict YYYY-MM-DD syntax and rejects impossible calendar dates', validation.includes('/^\\d{4}-\\d{2}-\\d{2}$/') && validation.includes("parsed.toISOString().slice(0, 10) !== body.scheduled_date")],
  ['cost values must be finite and non-negative', validation.includes('Number.isFinite(Number(body[field]))') && validation.includes('Number(body[field]) < 0')],
  ['notes and checklist have bounded type and length validation', validation.includes('body.notes.length > 5000') && validation.includes('body.checklist.length > 50') && validation.includes('item.length > 250')],
  ['vendor ID must resolve to an existing vendor', validation.includes('db.vendors.find(item => item.id === vendorId)')],
  ['create validates payload before creating schedule', post.indexOf('validateMaintenanceInput(req.body)') >= 0 && post.indexOf('validateMaintenanceInput(req.body)') < post.indexOf('db.maintenances.push(newSchedule)')],
  ['create stores canonical vendor name when vendor ID is supplied', post.includes('vendor_name: vendor.name || req.body.vendor_name ||') && post.includes('if (!vendor) return res.status(400)')],
  ['update validates payload and vendor reference before mutation', patch.indexOf('validateMaintenanceInput(req.body)') >= 0 && patch.indexOf('resolveMaintenanceVendor(req.body.vendor_id)') < patch.indexOf('for (const key of allowedMaintenanceFields)')],
  ['update keeps server-owned asset and owner fields outside allowlist', patch.includes("'vendor_id', 'vendor_name'") && !patch.includes("'asset_id'") && !patch.includes("'owner_division'")],
  ['update synchronizes vendor ID and canonical name', patch.includes('schedule.vendor_id = vendor.id') && patch.includes('schedule.vendor_name = vendor.name')],
];

let failed = 0;
for (const [name, pass] of checks) {
  console.log((pass ? 'PASS' : 'FAIL') + ' | ' + name);
  if (!pass) failed++;
}
console.log('TOTAL: ' + checks.length + ' | PASS: ' + (checks.length - failed) + ' | FAIL: ' + failed);
process.exit(failed ? 1 : 0);
