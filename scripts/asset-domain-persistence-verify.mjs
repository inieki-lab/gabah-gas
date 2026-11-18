import fs from 'node:fs';

const services = fs.readFileSync('server/services.ts', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');
const failures = [];
let passed = 0;
const assert = (name, condition) => {
  console.log(`[${condition ? 'PASS' : 'FAIL'}] ${name}`);
  if (condition) passed++; else failures.push(name);
};
function section(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + 1);
  return start >= 0 ? source.slice(start, end < 0 ? undefined : end) : '';
}

const persist = section(services, 'async function persistDomainMutation', 'export class GabahDomainService');
const audit = section(services, 'static recordAudit(', '  /**\n   * Dispatch targeted notification');
const assign = section(services, 'static async assignAsset(', '  /**\n   * Asset Location Movement Mutation');
const move = section(services, 'static async moveAsset(', '  /**\n   * Asset Lifecycle Mutation');
const lifecycle = section(services, 'static async mutateLifecycle(', '  /**\n   * Loan Request & Collision Detection');
const restore = section(services, 'function restoreAssetSnapshot(', 'async function persistDomainMutation');
const assignRoute = section(server, "app.post('/api/assets/:id/assign'", "app.post('/api/assets/:id/move'");
const moveRoute = section(server, "app.post('/api/assets/:id/move'", "app.post('/api/assets/:id/lifecycle'");
const lifecycleRoute = section(server, "app.post('/api/assets/:id/lifecycle'", '  // Movements');

assert('asset persistence helper awaits the authoritative write', /await persistDataStore\(\)/.test(persist));
assert('asset persistence helper invokes rollback on write failure', /catch[\s\S]*?rollback\?\.\(\)/.test(persist));
assert('asset persistence failure is returned as HTTP 503 contract', /statusCode: 503/.test(persist));
assert('audit helper supports deferred persistence for transactional domain operations', /persist = true/.test(audit) && /if \(persist\) persistDataStore\(\)/.test(audit));
assert('asset snapshot restore removes optional fields absent from prior snapshot', /hasOwnProperty\.call\(snapshot, key\)[\s\S]*?delete \(asset as any\)\[key\]/.test(restore));

assert('assignment operation is async and persists before success', /static async assignAsset/.test(assign) && /await persistDomainMutation\(/.test(assign));
assert('assignment and unassignment audit writes defer fire-and-forget persistence', (assign.match(/actor, asset\.id, false\)/g) || []).length === 2);
assert('assignment rollback restores asset and removes movement plus audit event', /restoreAssetSnapshot\(asset, previousAsset\)/.test(assign) && /db\.movements = db\.movements\.filter/.test(assign) && /db\.auditLogs = db\.auditLogs\.filter/.test(assign));
assert('location movement is async and persists before success', /static async moveAsset/.test(move) && /await persistDomainMutation\(/.test(move));
assert('location movement rollback restores asset, movement history, and audit', /restoreAssetSnapshot\(asset, previousAsset\)/.test(move) && /db\.movements = db\.movements\.filter/.test(move) && /db\.auditLogs = db\.auditLogs\.filter/.test(move));
assert('lifecycle operation is async and persists before success', /static async mutateLifecycle/.test(lifecycle) && /await persistDomainMutation\(/.test(lifecycle));
assert('lifecycle rollback restores asset and removes audit event', /restoreAssetSnapshot\(asset, previousAsset\)/.test(lifecycle) && /db\.auditLogs = db\.auditLogs\.filter/.test(lifecycle));

assert('assignment HTTP route awaits durable domain mutation', /async \(req, res\)/.test(assignRoute) && /await GabahDomainService\.assignAsset/.test(assignRoute));
assert('movement HTTP route awaits durable domain mutation and preserves 503', /async \(req, res\)/.test(moveRoute) && /await GabahDomainService\.moveAsset/.test(moveRoute) && /statusCode/.test(moveRoute));
assert('lifecycle HTTP route awaits durable domain mutation and preserves 503', /async \(req, res\)/.test(lifecycleRoute) && /await GabahDomainService\.mutateLifecycle/.test(lifecycleRoute) && /statusCode/.test(lifecycleRoute));

console.log(`Asset domain persistence regression: ${passed}/${passed + failures.length} checks passed.`);
if (failures.length) process.exit(1);
