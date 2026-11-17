import fs from 'node:fs';

const source = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const start = source.indexOf("const isReporter = (ticket: any) =>");
const end = source.indexOf("\n\n    if (isSuperadminActor(actor)", start);
const block = source.slice(start, end);

const checks = [
  ['Reporter ID remains the primary ownership key', block.includes('ticket.reporter_id === actor.id')],
  ['Name fallback is restricted to legacy records without reporter ID', block.includes('!ticket.reporter_id && Boolean(ticket.reporter_name)')],
  ['Name equality cannot override a different reporter ID', block.includes('|| (!ticket.reporter_id')],
  ['Ticket list still filters through the reporter predicate', source.slice(end, end + 1200).includes('isReporter(ticket)')],
];

const patchStart = source.indexOf("app.patch('/api/tickets/:id/status'");
const patchEnd = source.indexOf('const validateMaintenanceInput', patchStart);
const patchRoute = source.slice(patchStart, patchEnd);
checks.push(
  ['Status PATCH has an explicit object-level authorization predicate', patchRoute.includes('const canUpdateTicket =')],
  ['Status PATCH permits only Superadmin, reporter, assignee, or scoped owner division', patchRoute.includes('isSuperadminActor(actor)') && patchRoute.includes('|| isReporter') && patchRoute.includes('ticket.assigned_agent_id === actor.id') && patchRoute.includes('|| canReadTicketOwner')],
  ['Status PATCH rejects unrelated tickets with HTTP 403', patchRoute.includes('if (!canUpdateTicket)') && patchRoute.includes('res.status(403)')],
);

let failed = 0;
for (const [name, pass] of checks) {
  console.log((pass ? 'PASS' : 'FAIL') + ' | ' + name);
  if (!pass) failed += 1;
}
console.log('TOTAL: ' + checks.length + ' | PASS: ' + (checks.length - failed) + ' | FAIL: ' + failed);
process.exit(failed === 0 ? 0 : 1);
