import fs from 'node:fs';
import assert from 'node:assert/strict';
const source = fs.readFileSync('server.ts', 'utf8');
const helperStart = source.indexOf('const validateMaintenanceInput');
const helperEnd = source.indexOf('// Maintenance & Calibration Schedules', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart);
const helper = source.slice(helperStart, helperEnd);
assert.match(helper, /!body \|\| typeof body !== 'object' \|\| Array\.isArray\(body\)/, 'maintenance input must reject null, arrays, and non-object JSON payloads');
for (const value of ['weekly', 'monthly', 'quarterly', 'biannual', 'annual', 'one_time', 'scheduled', 'in_progress', 'completed', 'overdue', 'cancelled']) assert.ok(helper.includes(value), 'missing allowed value: ' + value);
assert.match(helper, /Number\.isFinite\(parsedDate\.getTime\(\)\)/);
assert.match(helper, /body\[field\] < 0/);
assert.match(helper, /Array\.isArray\(body\.checklist\)/);
assert.match(helper, /body\.checklist\.length > 100/);
assert.ok(helper.includes("body[field].includes('\\u0000')"));
assert.ok(helper.includes("item.includes('\\u0000')"));
assert.match(helper, /Array\.from\(body\[field\]\)\.length > max/);
const createStart = source.indexOf("app.post('/api/maintenances'");
const updateStart = source.indexOf("app.patch('/api/maintenances/:id'");
const vendorStart = source.indexOf("// Vendor Directory (server-authoritative)");
assert.ok(createStart >= 0 && updateStart > createStart && vendorStart > updateStart);
const create = source.slice(createStart, updateStart);
const update = source.slice(updateStart, vendorStart);
assert.match(create, /requireRbacPermission\(req, res, 'maintenances\.create'\)[\s\S]*validateMaintenanceInput\(req\.body \|\| \{\}\)/);
assert.match(create, /else if \(!isSuperadminActor\(actor\) && !hasApplicationRole\(actor, 'it'\) && !hasApplicationRole\(actor, 'ga'\)\)[\s\S]*validateMaintenanceInput/);
assert.match(update, /else if \(!isSuperadminActor\(actor\) && !hasApplicationRole\(actor, 'it'\) && !hasApplicationRole\(actor, 'ga'\)\)[\s\S]*validateMaintenanceInput/);
assert.match(update, /requireRbacPermission\(req, res, 'maintenances\.update'\)[\s\S]*validateMaintenanceInput/);
assert.match(update, /canMutateAssetOwner\(actor, schedule\.owner_division, 'maintenances\.update'\)[\s\S]*validateMaintenanceInput/);
assert.equal((source.match(/validateMaintenanceInput\(req\.body\)/g) || []).length, 2);
console.log('Maintenance input validation: 12 checks passed');


// Maintenance lifecycle must be enforced by the API, not only by UI buttons.
const lifecycleStart = source.indexOf('const MAINTENANCE_STATUS_TRANSITIONS: Record<string, string[]> = {');
const lifecycleEnd = source.indexOf('  };', lifecycleStart);
assert.ok(lifecycleStart >= 0 && lifecycleEnd > lifecycleStart, 'maintenance lifecycle transition map must exist');
const lifecycle = source.slice(lifecycleStart, lifecycleEnd);
for (const transition of [
  "scheduled: ['in_progress', 'overdue', 'cancelled']",
  "overdue: ['in_progress', 'cancelled']",
  "in_progress: ['completed', 'cancelled']",
  'completed: []',
  'cancelled: []',
]) assert.ok(lifecycle.includes(transition), 'missing maintenance transition policy: ' + transition);
const createLifecycle = source.slice(createStart, updateStart);
assert.match(createLifecycle, /req\.body\?\.status !== undefined && req\.body\.status !== 'scheduled'/);
assert.match(createLifecycle, /status: 'scheduled'/);
assert.match(update, /const currentStatus = String\(schedule\.status \|\| 'scheduled'\)/);
assert.match(update, /allowedTransitions\.includes\(nextStatus\)/);
assert.match(update, /nextStatus === 'completed' && nextStatus !== currentStatus/);
console.log('Maintenance lifecycle: 8 checks passed');
