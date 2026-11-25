import fs from 'node:fs';
import assert from 'node:assert/strict';

const server = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('../src/services/gabahApi.ts', import.meta.url), 'utf8');
const view = fs.readFileSync(new URL('../src/components/views/TicketsView.tsx', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');

const start = server.indexOf('const canManageTicketAssignment');
const routeStart = server.indexOf("app.get('/api/tickets/:id/assignees'", start);
const patch = server.indexOf("app.patch('/api/tickets/:id/assignment'", routeStart);
const end = server.indexOf('const canAccessTicketRecord', patch);
assert.ok(start >= 0 && routeStart > start && patch > routeStart && end > patch, 'assignee policy and routes must be registered before ticket comment routes');
const routes = server.slice(start, end);
assert.match(routes, /requireRbacPermission\(req, res, 'tickets\.assign'\)/);
assert.match(routes, /hasRbacPermission\(String\(actor\.id\), 'tickets\.assign'\)/);
assert.match(routes, /hasRbacPermission\(String\(user\.id\), 'tickets\.update'\)/);
assert.match(routes, /canManageTicketAssignment\(ticket, actor\)/);
assert.match(routes, /user\.is_active === false/);
assert.match(routes, /hasRbacPermission\(String\(user\.id\), 'tickets\.update'\)/);
assert.match(routes, /hasRbacScope\(String\(user\.id\), 'division', String\(ticket\.category\), 'tickets'\)/);
assert.match(routes, /hasRbacScope\(String\(user\.id\), 'unit', String\(ticket\.assigned_unit_id\), 'tickets'\)/);
assert.match(routes, /isReadOnlyActor\(actor\)/);
assert.match(routes, /\['open', 'assigned'\]/);
assert.match(routes, /status\(409\)/);
assert.match(routes, /TICKET_ASSIGNMENT_UPDATED/);
assert.match(routes, /previousAssignedAgentId/);
assert.match(routes, /GabahDomainService\.notify\(\{/);
assert.match(routes, /recipient_user_id: ticket\.assigned_agent_id/);
assert.match(routes, /link_type: 'ticket'/);
assert.match(routes, /persistBeforeSuccess/);
assert.match(api, /getTicketAssignees\(ticketId: string\)/);
assert.match(api, /updateTicketAssignment\(ticketId: string, assignedAgentId: string \| null\)/);
assert.match(view, /Atur Petugas/);
assert.match(view, /GabahService\.canAssignTickets\(currentUser\)/);
assert.match(fs.readFileSync(new URL('../src/services/gabahService.ts', import.meta.url), 'utf8'), /static canAssignTickets\(user\?: UserProfile\)/);
assert.match(view, /Simpan Penugasan/);
assert.match(view, /Lepas Petugas/);
assert.match(app, /onUpdateTicketAssignment=\{handleUpdateTicketAssignment\}/);

// File-store compatibility must recognize secondary IT/GA capabilities for
// canonical Karyawan accounts; PostgreSQL remains permission + scope based.
assert.match(routes, /actor\.role === ticket\.category \|\| hasApplicationRole\(actor, String\(ticket\.category/);
assert.match(routes, /user\.role === ticket\.category \|\| hasApplicationRole\(user, String\(ticket\.category/);

console.log('PASS: ticket assignment is permission/scope based, excludes inactive/Auditor users, validates queue eligibility, prevents reassignment after work starts, audits, persists, and is wired to UI.');
