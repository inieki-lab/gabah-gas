import fs from 'node:fs';

const server = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const scope = fs.readFileSync(new URL('../server/dashboard-attention-scope.ts', import.meta.url), 'utf8');
const client = fs.readFileSync(new URL('../src/services/gabahService.ts', import.meta.url), 'utf8');
const test = fs.readFileSync(new URL('./dashboard-attention-scope-verify.ts', import.meta.url), 'utf8');

const checks = [
  ['Ticket list ownership uses reporter_id only', /const isReporter = \(ticket: any\) => ticket\.reporter_id === actor\.id;/.test(server)],
  ['Dashboard ticket cards use reporter_id or assignee ID, never display name', /ticket\.reporter_id === scope\.actorId[\s\S]*ticket\.assigned_agent_id === scope\.actorId/.test(scope) && !scope.includes('reporter_name') && !scope.includes('actorName')],
  ['Client-side ticket ownership uses immutable reporter ID only', /ticket\.reporter_id && ticket\.reporter_id === currentUserId/.test(client) && !client.includes('isExactIdentityNameMatch')],
  ['Dashboard regression test rejects legacy name-only and same-name other-user tickets', /t-own-legacy/.test(test) && /t-same-name-other-id/.test(test) && !/ticket-own-legacy', 'ticket-owner-scope'/.test(test)],
  ['Server dashboard filter no longer passes actor display name as an ownership key', !/actorName: String\(actor\.name/.test(server)],
];

let failed = 0;
for (const [name, pass] of checks) {
  console.log((pass ? 'PASS' : 'FAIL') + ' | ' + name);
  if (!pass) failed += 1;
}
console.log('TOTAL: ' + checks.length + ' | PASS: ' + (checks.length - failed) + ' | FAIL: ' + failed);
process.exit(failed === 0 ? 0 : 1);
