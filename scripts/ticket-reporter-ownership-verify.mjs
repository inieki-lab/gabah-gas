import fs from 'node:fs';

const source = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const start = source.indexOf("const isReporter = (ticket: any) =>");
const end = source.indexOf("\n\n    if (isSuperadminActor(actor)", start);
const block = source.slice(start, end);

const statusStart = source.indexOf("app.patch('/api/tickets/:id/status'");
const statusEnd = source.indexOf('// Maintenance & Calibration Schedules', statusStart);
const statusRoute = source.slice(statusStart, statusEnd);

const checks = [
  ['Reporter ID remains the primary ownership key', block.includes('ticket.reporter_id === actor.id')],
  ['Name fallback is restricted to legacy records without reporter ID', block.includes('!ticket.reporter_id && Boolean(ticket.reporter_name)')],
  ['Name equality cannot override a different reporter ID', block.includes('|| (!ticket.reporter_id')],
  ['Ticket list still filters through the reporter predicate', source.slice(end, end + 1200).includes('isReporter(ticket)')],
  ['Ticket status mutation checks reporter, assignee, owner scope, or Superadmin', statusRoute.includes('ticket.reporter_id === actor.id') && statusRoute.includes('ticket.assigned_agent_id === actor.id') && statusRoute.includes('canReadTicketOwner') && statusRoute.includes('isSuperadminActor(actor)')],
  ['Unrelated ticket status mutation is rejected with 403', statusRoute.includes('if (!canUpdateTicket)') && statusRoute.includes('res.status(403)')],
];

let failed = 0;
for (const [name, pass] of checks) {
  console.log((pass ? 'PASS' : 'FAIL') + ' | ' + name);
  if (!pass) failed += 1;
}
console.log('TOTAL: ' + checks.length + ' | PASS: ' + (checks.length - failed) + ' | FAIL: ' + failed);
process.exit(failed === 0 ? 0 : 1);
