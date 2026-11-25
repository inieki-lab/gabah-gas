import fs from 'node:fs';
import assert from 'node:assert/strict';

const server = fs.readFileSync('server.ts', 'utf8');
const types = fs.readFileSync('src/types.ts', 'utf8');
const view = fs.readFileSync('src/components/views/TicketsView.tsx', 'utf8');
const start = server.indexOf("app.get('/api/tickets'");
const end = server.indexOf("app.post('/api/tickets'", start);
assert.ok(start >= 0 && end > start, 'ticket list endpoint must exist');
const route = server.slice(start, end);
for (const key of ['start', 'wait_vendor', 'resolve', 'close', 'reopen']) {
  assert.ok(route.includes(`${key}:`), `API must provide ${key} action`);
}
assert.ok(route.includes('isOperationalHandler'), 'actions must use object-level operational authorization');
assert.ok(route.includes("hasRbacPermission(String(actor.id), 'tickets.update')"), 'operator actions must require tickets.update');
assert.ok(route.includes('close: canMutate && (isOperationalHandler || isReporterOfTicket)'), 'reporter confirmation must not require operator permission');
assert.ok(route.includes('isReporterOfTicket'), 'reporter-only close/reopen actions must be represented');
assert.ok(route.includes('canMutate = !isReadOnlyActor(actor)'), 'Auditor must receive no mutation actions');
assert.ok(route.includes('data: db.tickets.map(withAllowedActions)'), 'Superadmin/Auditor response must include action metadata');
assert.ok(route.includes('.map(withAllowedActions)'), 'scoped ticket response must include action metadata');
assert.ok(types.includes('allowed_actions?:'), 'Ticket type must model API action metadata');
assert.ok(view.includes('ticket.allowed_actions[action] === true'), 'UI must prefer server-authoritative action metadata');
assert.ok(view.includes("canPerformTicketAction(ticket, 'close')"), 'UI must expose permitted reporter confirmation');
assert.ok(view.includes("canPerformTicketAction(ticket, 'reopen')"), 'UI must expose permitted reopen action');
console.log('PASS: ticket action controls follow server-computed object-level authorization.');
