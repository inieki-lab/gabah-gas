import fs from 'node:fs';

const source = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const hardening = fs.readFileSync(new URL('../server/runtime-hardening.ts', import.meta.url), 'utf8');
const guardStart = hardening.indexOf('function canManageTicket(');
const guardEnd = hardening.indexOf('\n}\n', guardStart);
const guard = hardening.slice(guardStart, guardEnd);
const start = source.indexOf("const isReporter = (ticket: any) =>");
const end = source.indexOf("\n\n    if (isSuperadminActor(actor)", start);
const block = source.slice(start, end);

const checks = [
  ['Reporter ID remains the primary ownership key', block.includes('ticket.reporter_id === actor.id')],
  ['Name fallback is restricted to legacy records without reporter ID', block.includes('!ticket.reporter_id && Boolean(ticket.reporter_name)')],
  ['Name equality cannot override a different reporter ID', block.includes('|| (!ticket.reporter_id')],
  ['Ticket list still filters through the reporter predicate', source.slice(end, end + 1200).includes('isReporter(ticket)')],
  ['Reporter-only identity does not grant status-mutation authority', !guard.includes('ticket.reporter_id === actor.id')],
  ['Assigned agent retains object-level status authority', guard.includes('ticket.assigned_agent_id === actor.id')],
  ['Unassigned operator still needs explicit ticket owner scope', guard.includes("hasRbacScope(String(actor.id), 'division', owner, 'tickets')')],
  ['Reporter remains eligible for ticket-linked attention visibility', hardening.includes("if (item.link_type === 'ticket') return canSeeTicket(actor, item.link_id);")],
  ['Ticket visibility helper includes reporter ownership', hardening.includes('function canSeeTicket(') && hardening.slice(hardening.indexOf('function canSeeTicket('), hardening.indexOf('function canManageTicket(')).includes('ticket.reporter_id === actor.id')],
  ['Mutation helper excludes reporter-only ownership', !guard.includes('ticket.reporter_id === actor.id')],
];


const statusRouteStart = source.indexOf("app.patch('/api/tickets/:id/status'");
const statusRouteEnd = source.indexOf("\n  const validateMaintenanceInput", statusRouteStart);
const statusRoute = source.slice(statusRouteStart, statusRouteEnd);
checks.push(
  ['Ticket status route requires explicit tickets.update permission', statusRoute.includes("requireRbacPermission(req, res, 'tickets.update')")],
  ['Ticket status route is protected by the shared object-level mutation guard', hardening.includes("const ticketMatch = req.path.match(/^\\/api\\/tickets\\/([^/]+)\\/status\\/?$/i);") && hardening.includes('ticketMatch && !canManageTicket(actor, ticketMatch[1])')],
  ['Ticket status route awaits authoritative persistence', statusRoute.includes("app.patch('/api/tickets/:id/status', async") && statusRoute.includes('await persistDataStore();')],
  ['Ticket status persistence failure returns HTTP 500', statusRoute.includes('return res.status(500).json(')],
  ['Ticket status is restored when persistence fails', ['ticket.status = previousState.status','ticket.resolution_notes = previousState.resolution_notes','ticket.resolved_at = previousState.resolved_at','ticket.updated_at = previousState.updated_at'].every(fragment => statusRoute.includes(fragment))],
  ['Failed ticket status audit entry is removed from memory', statusRoute.includes('db.auditLogs.splice(auditIndex, 1)')],
  ['Ticket status route does not silently swallow persistence errors', !statusRoute.includes('persistDataStore().catch(() => {})')],
  ['Ticket status rollback refreshes the local fallback snapshot', statusRoute.includes('await persistDataStore();') && statusRoute.includes('Failed to persist rollback snapshot')],
);

let failed = 0;
for (const [name, pass] of checks) {
  console.log((pass ? 'PASS' : 'FAIL') + ' | ' + name);
  if (!pass) failed += 1;
}
console.log('TOTAL: ' + checks.length + ' | PASS: ' + (checks.length - failed) + ' | FAIL: ' + failed);
process.exit(failed === 0 ? 0 : 1);
