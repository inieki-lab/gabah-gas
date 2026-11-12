import fs from 'node:fs';

const source = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const start = source.indexOf('const hasNotificationRole =');
const end = source.indexOf("app.get('/api/notifications'", start);
const helper = start >= 0 && end > start ? source.slice(start, end) : '';
const listStart = source.indexOf("app.get('/api/notifications'");
const listEnd = source.indexOf("app.patch('/api/notifications/:id/read'", listStart);
const readStart = listEnd;
const readEnd = source.indexOf("app.post('/api/notifications/read-all'", readStart);
const allStart = readEnd;
const allEnd = source.indexOf('// Dashboard Stats & Attention Center', allStart);
const listRoute = source.slice(listStart, listEnd);
const readRoute = source.slice(readStart, readEnd);
const allRoute = source.slice(allStart, allEnd);

const checks = [
  ['Notification role labels map to effective application role keys', helper.includes("'humas': 'humas'") && helper.includes("'sekretaris direksi': 'sekretaris_direksi'") && helper.includes('hasApplicationRole(actor, roleKey)')],
  ['Notification list uses effective role assignment', listRoute.includes('hasNotificationRole(actor, notification.recipient_role)')],
  ['Humas documentation notifications honor secondary Humas capability', listRoute.includes("hasNotificationRole(actor, 'Humas')")],
  ['Mark-one-read uses effective role assignment', readRoute.includes('hasNotificationRole(actor, notif.recipient_role)')],
  ['Mark-all-read uses effective role assignment', allRoute.includes('hasNotificationRole(actor, n.recipient_role)')],
  ['Legacy non-application recipient labels retain exact primary-role fallback', helper.includes('roleLabel === actor.role')],
];

let failed = 0;
for (const [name, pass] of checks) {
  console.log((pass ? 'PASS' : 'FAIL') + ' | ' + name);
  if (!pass) failed += 1;
}
console.log('TOTAL: ' + checks.length + ' | PASS: ' + (checks.length - failed) + ' | FAIL: ' + failed);
process.exit(failed === 0 ? 0 : 1);
