import fs from 'node:fs';

const server = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const scope = fs.readFileSync(new URL('../server/dashboard-attention-scope.ts', import.meta.url), 'utf8');
const client = fs.readFileSync(new URL('../src/services/gabahService.ts', import.meta.url), 'utf8');
const test = fs.readFileSync(new URL('./dashboard-attention-scope-verify.ts', import.meta.url), 'utf8');
const roleDashboard = fs.readFileSync(new URL('../src/dashboard/roleDashboardScope.ts', import.meta.url), 'utf8');
const loansView = fs.readFileSync(new URL('../src/components/views/LoansView.tsx', import.meta.url), 'utf8');
const myAssetsView = fs.readFileSync(new URL('../src/components/views/MyAssetsView.tsx', import.meta.url), 'utf8');
const dashboardView = fs.readFileSync(new URL('../src/components/views/DashboardView.tsx', import.meta.url), 'utf8');
const createTicketModal = fs.readFileSync(new URL('../src/components/modals/CreateTicketModal.tsx', import.meta.url), 'utf8');

const checks = [
  ['Ticket list ownership uses reporter_id only', /const isReporter = \(ticket: any\) => ticket\.reporter_id === actor\.id;/.test(server)],
  ['Dashboard ticket cards use reporter_id or assignee ID, never display name', /ticket\.reporter_id === scope\.actorId[\s\S]*ticket\.assigned_agent_id === scope\.actorId/.test(scope) && !scope.includes('reporter_name') && !scope.includes('actorName')],
  ['Client-side ticket ownership uses immutable reporter ID only', /ticket\.reporter_id && ticket\.reporter_id === currentUserId/.test(client) && !client.includes('isExactIdentityNameMatch')],
  ['Dashboard regression test rejects legacy name-only and same-name other-user tickets', /t-own-legacy/.test(test) && /t-same-name-other-id/.test(test) && !/ticket-own-legacy', 'ticket-owner-scope'/.test(test)],
  ['Server dashboard filter no longer passes actor display name as an ownership key', !/actorName: String\(actor\.name/.test(server)],
  ['Personal loan scope uses borrower ID only', roleDashboard.includes('item.borrower_id === user.id') && !roleDashboard.includes('isExactIdentityNameMatch') && loansView.includes('l.borrower_id === currentUserId') && !loansView.includes('isExactIdentityNameMatch')],
  ['Personal asset scope uses assigned user ID only', roleDashboard.includes('asset.assigned_to?.id === user.id') && myAssetsView.includes('assignedId === currentUser.id') && !myAssetsView.includes('assignedEmail') && !myAssetsView.includes('isExactIdentityNameMatch')],
  ['Dashboard and ticket modal use reporter/borrower/assignee IDs only', dashboardView.includes('t.reporter_id === currentUserId') && dashboardView.includes('l.borrower_id === currentUserId') && createTicketModal.includes('loan.borrower_id === currentUser?.id') && !dashboardView.includes('isExactIdentityNameMatch') && !createTicketModal.includes('isExactIdentityNameMatch')],
];

let failed = 0;
for (const [name, pass] of checks) {
  console.log((pass ? 'PASS' : 'FAIL') + ' | ' + name);
  if (!pass) failed += 1;
}
console.log('TOTAL: ' + checks.length + ' | PASS: ' + (checks.length - failed) + ' | FAIL: ' + failed);
process.exit(failed === 0 ? 0 : 1);
