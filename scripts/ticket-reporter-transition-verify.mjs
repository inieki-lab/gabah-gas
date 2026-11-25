import fs from 'node:fs';
import assert from 'node:assert/strict';
const source = fs.readFileSync('server.ts', 'utf8');
const start = source.indexOf("app.patch('/api/tickets/:id/status'");
const end = source.indexOf('const validateMaintenanceInput', start);
assert.ok(start >= 0 && end > start, 'ticket status route must exist');
const route = source.slice(start, end);
assert.ok(route.includes('const isOperationalTicketHandler = hasTicketUpdatePermission && ('));
assert.ok(route.includes("requireRbacPermission(req, res, 'tickets.read')"));
assert.ok(route.includes("hasRbacPermission(String(actor.id), 'tickets.update')"));
assert.ok(route.includes('const canUpdateTicket = isOperationalTicketHandler || isReporter'));
assert.ok(route.includes("resolved: ['closed']"));
assert.ok(route.includes("closed: ['open']"));
assert.ok(route.includes('if (!reporterAllowed.includes(nextStatus))'));
assert.ok(route.includes("res.status(403).json({"));
assert.ok(route.includes('const allowed = TICKET_TRANSITIONS[currentStatus]'));
assert.ok(route.includes("res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400)"), 'ticket status route must preserve explicit authorization/conflict HTTP status codes');
console.log('PASS: Ticket reporters can confirm resolved tickets or reopen closed tickets, not operate staff workflow.');


const hardening = fs.readFileSync('server/runtime-hardening.ts', 'utf8');
assert.ok(hardening.includes('actor.role_keys || []'), 'file-store ticket/loan scopes must honor secondary functional roles');
assert.ok(hardening.includes("capabilities.has('it')") && hardening.includes("capabilities.has('ga')"), 'IT/GA secondary capabilities must govern ticket queue scope');

const ticketRoutes = source.slice(source.indexOf('const canAccessTicketRecord'), source.indexOf("app.get('/api/tickets/:id/comments'"));
assert.ok(ticketRoutes.includes('hasApplicationRole(actor, String(ticket.category'), 'file-store ticket record access must honor secondary operational roles');
assert.ok(source.includes("hasApplicationRole(actor, String(ticket.category || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'))"), 'file-store ticket comments and status transitions must honor secondary operational roles');
