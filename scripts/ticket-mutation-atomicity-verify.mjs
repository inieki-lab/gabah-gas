import assert from 'node:assert/strict';
import fs from 'node:fs';

const services = fs.readFileSync('server/services.ts', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');
const createStart = services.indexOf('static createTicket(');
const createEnd = services.indexOf('\n  static ', createStart + 1);
const createService = services.slice(createStart, createEnd < 0 ? services.length : createEnd);
assert.match(createService, /persistAudit = true/);
assert.match(createService, /TICKET_LINKED_TO_CONTRACT'[\s\S]*newTicket\.id, persistAudit\)/);
assert.match(createService, /TICKET_CREATED'[\s\S]*newTicket\.id, persistAudit\)/);

const cases = [
  ["app.post('/api/tickets'", 'createTicket', ['createdNotificationIds', 'createdAuditIds']],
  ["app.patch('/api/tickets/:id/assignment'", 'assignment', ['ticketBefore', 'ticketAfter', 'createdNotificationIds', 'createdAuditIds']],
  ["app.patch('/api/tickets/:id/status'", 'status', ['ticketBefore', 'ticketAfter', 'createdAuditIds']],
];
for (const [path, label, required] of cases) {
  const start = server.indexOf(path);
  const end = server.indexOf('\n  app.', start + 10);
  const route = server.slice(start, end < 0 ? server.length : end);
  assert.match(route, /async \(req, res\)/, label + ' route must be async');
  assert.ok(route.includes('persistBeforeSuccess(req, res)'), label + ' route must await durable persistence');
  for (const token of required) assert.ok(route.includes(token), label + ' rollback must include ' + token);
  assert.ok(route.includes('Object.assign(ticket, ticketBefore)') || label === 'createTicket', label + ' must restore ticket state when applicable');
}
assert.ok(server.includes('createTicket(req.body, actor, false)'));
assert.match(server, /TICKET_ASSIGNMENT_UPDATED'[\s\S]*ticket\.id,[\s\S]*false/);
assert.match(server, /TICKET_STATUS_UPDATED'[\s\S]*ticket\.id, false\)/);
console.log('PASS: ticket creation, assignment, and status mutations rollback ticket, notification, and audit state on persistence failure');
