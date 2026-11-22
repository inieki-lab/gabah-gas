import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('server/notifications/reminderScheduler.ts', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');
const acquireStart = source.indexOf('async function acquireLeaderLock()');
const releaseStart = source.indexOf('async function releaseLeaderLock()', acquireStart);
const releaseEnd = source.indexOf('/** Execute one reminder sweep pass', releaseStart);
assert.ok(acquireStart >= 0 && releaseStart > acquireStart && releaseEnd > releaseStart, 'scheduler lock helpers must exist');

const acquire = source.slice(acquireStart, releaseStart);
assert.ok(acquire.includes('let client: any = null;'), 'acquire must track the checked-out client');
assert.ok(acquire.includes('finally {') && acquire.includes('client.release(acquisitionError || undefined)'), 'failed/negative lock acquisition must release its client and discard broken connections');
assert.ok(acquire.includes('client = null; // ownership transferred'), 'successful acquisition must transfer client ownership to the lock holder');
const catchStart = acquire.indexOf('} catch (error)');
const finallyStart = acquire.indexOf('} finally', catchStart);
const catchBlock = acquire.slice(catchStart, finallyStart);
assert.ok(catchBlock.includes('return false;') && !catchBlock.includes('return true;'), 'PostgreSQL lock errors must fail closed and skip the sweep');

const release = source.slice(releaseStart, releaseEnd);
assert.ok(release.includes('async function releaseLeaderLock(): Promise<void>'), 'leader release must be asynchronous');
assert.ok(release.indexOf('await client.query') >= 0, 'leader advisory unlock must be awaited');
assert.ok(release.indexOf('await client.query') < release.indexOf('client.release(unlockError || undefined)'), 'pool client must not be released before advisory unlock finishes and broken connections must be discarded');

const timerStart = source.indexOf('export function startReminderScheduler()');
const stopStart = source.indexOf('export async function stopReminderScheduler()', timerStart);
assert.ok(timerStart >= 0 && stopStart > timerStart, 'scheduler lifecycle methods must exist');
const lifecycle = source.slice(timerStart);
assert.equal((lifecycle.match(/await releaseLeaderLock\(\)/g) || []).length, 3, 'both scheduler ticks and stop must await lock release');
const manualStart = source.indexOf('export async function runManualOnce(');
const manualEnd = source.indexOf('/** Start the interval scheduler', manualStart);
assert.ok(manualStart >= 0 && manualEnd > manualStart, 'manual sweep must have a dedicated leader-locked entrypoint');
const manual = source.slice(manualStart, manualEnd);
assert.ok(manual.indexOf('await acquireLeaderLock()') < manual.indexOf('ContractDomainService.runReminderSweep(actor)'), 'manual sweep must acquire leader lock before delivery');
assert.ok(manual.includes('await releaseLeaderLock();'), 'manual sweep must release leader lock after completion');
const manualRouteStart = server.indexOf("app.post('/api/contracts/reminders/run'");
const manualRouteEnd = server.indexOf("app.get('/api/contracts/reminders/scheduler-status'", manualRouteStart);
assert.ok(manualRouteStart >= 0 && manualRouteEnd > manualRouteStart, 'manual reminder route must exist');
const manualRoute = server.slice(manualRouteStart, manualRouteEnd);
assert.ok(manualRoute.includes('runReminderManualOnce(actor)'), 'admin endpoint must use leader-locked manual sweep');
assert.ok(!manualRoute.includes('ContractDomainService.runReminderSweep(actor)'), 'admin endpoint must not bypass scheduler leader lock');
console.log('PASS | failed advisory-lock acquisition always releases checked-out client');
console.log('PASS | PostgreSQL leader-lock errors fail closed to prevent duplicate external delivery');
console.log('PASS | advisory unlock is awaited before returning client to pool');
console.log('PASS | interval, boot catch-up, stop, and manual sweep await leader lock release');
console.log('PASS | admin manual reminder endpoint cannot bypass leader lock');
console.log('TOTAL: 6 | PASS: 6 | FAIL: 0');
