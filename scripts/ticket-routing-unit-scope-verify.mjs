import fs from 'node:fs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const migration = read('server/migrations/098_ticket_routing_unit_scope.sql');
const services = read('server/services.ts');
const server = read('server.ts');
const hardening = read('server/runtime-hardening.ts');
const persistence = read('server/persistence.ts');
const types = read('server/db.ts');
const clientTypes = read('src/types.ts');
const form = read('src/components/modals/CreateTicketModal.tsx');
const ticketView = read('src/components/views/TicketsView.tsx');
const dashboardScope = read('server/dashboard-attention-scope.ts');

const ticketCreateStart = services.indexOf('static createTicket(');
const ticketCreateEnd = services.indexOf('\n  /**', ticketCreateStart);
const ticketCreate = services.slice(ticketCreateStart, ticketCreateEnd);
const listStart = server.indexOf("app.get('/api/tickets',");
const detailStart = server.indexOf("app.get('/api/tickets/:id',", listStart);
const createStart = server.indexOf("app.post('/api/tickets',", detailStart);
const assigneeStart = server.indexOf("app.get('/api/tickets/:id/assignees',", createStart);
const assignStart = server.indexOf("app.patch('/api/tickets/:id/assign',", assigneeStart);
const statusStart = server.indexOf("app.patch('/api/tickets/:id/status',", assignStart);
const listRoute = server.slice(listStart, detailStart);
const detailRoute = server.slice(detailStart, createStart);
const createRoute = server.slice(createStart, assigneeStart);
const assigneeRoute = server.slice(assigneeStart, assignStart);
const assignRoute = server.slice(assignStart, statusStart);
const queueScopeStart = services.indexOf('export function hasTicketQueueScope(');
const queueScopeEnd = services.indexOf('\n}', queueScopeStart);
const queueScope = services.slice(queueScopeStart, queueScopeEnd + 2);

const checks = [
  ['ME unit is represented independently from PIBC division', /VALUES \('UNIT-PIBC-ME', 'Tim Perawatan \(ME\)', 'Umum', 'OFF-PIBC', TRUE\)/.test(migration)],
  ['ME unit references the PIBC office location explicitly', migration.includes('office_location_id') && migration.includes("'OFF-PIBC'")],
  ['Ticket and notification schemas support unit routing', migration.includes('ADD COLUMN IF NOT EXISTS assigned_unit_id') && migration.includes('ADD COLUMN IF NOT EXISTS recipient_unit_id')],
  ['Migration preserves historical SC/PIBC ticket categories', migration.includes('Historical SC/PIBC ticket categories') && !/UPDATE tickets SET category/.test(migration)],
  ['GA generic role no longer receives ticket operator privileges', /DELETE FROM gabah_role_permissions rp[\s\S]*r\.role_key = 'ga'[\s\S]*tickets\.update'[\s\S]*tickets\.assign'/.test(migration)],
  ['GA operator role is explicit and not auto-assigned', migration.includes("'ga_helpdesk_operator'") && !/INSERT INTO gabah_user_roles[\s\S]*ga_helpdesk_operator/.test(migration)],
  ['ME admin role receives unit scope, not PIBC division scope', /'unit', 'UNIT-PIBC-ME'/.test(migration) && !/'division', 'PIBC'[\s\S]*UNIT-PIBC-ME/.test(migration)],
  ['GA and ME requester capabilities are opt-in', migration.includes('tickets.create.ga') && migration.includes('tickets.create.me') && migration.includes('pemohon_tiket_ga') && migration.includes('pemohon_tiket_me')],
  ['New ticket creation accepts only IT, GA, and ME', /VALID_TICKET_CATEGORIES = \['IT', 'GA', 'ME'\]/.test(ticketCreate)],
  ['New ME tickets are assigned to UNIT-PIBC-ME', /assigned_unit_id: payload\.category === 'ME' \? 'UNIT-PIBC-ME'/.test(ticketCreate)],
  ['IT auto-assignment requires exactly one explicitly scoped operator', /eligibleAgents\.length === 1/.test(ticketCreate) && ticketCreate.includes("hasRbacPermission(String(user.id), 'tickets.update')") && ticketCreate.includes("hasRbacScope(String(user.id), 'division', 'IT', 'tickets')")],
  ['Queue scope resolver uses unit scope for unit-targeted tickets', queueScope.includes("hasRbacScope(String(actor.id), 'unit'") && queueScope.includes("ticket.assigned_unit_id") && queueScope.includes('actor.unit_id')],
  ['ME without a unit target fails closed', /category === 'ME') return false/.test(queueScope)],
  ['List endpoint uses shared queue scope resolver', listRoute.includes('hasTicketQueueScope(actor, ticket)')],
  ['Direct detail endpoint uses the same queue scope resolver', detailRoute.includes('hasTicketQueueScope(actor, ticket)')],
  ['New ticket route selects permission by category and denies Auditor', createRoute.includes('tickets.create.ga') && createRoute.includes('tickets.create.me') && createRoute.includes('isAuditorActor(actor)')],
  ['Assignee discovery requires tickets.assign and target tickets.update plus scope', assigneeRoute.includes("tickets.assign") && assigneeRoute.includes("tickets.update") && assigneeRoute.includes("hasRbacScope")],
  ['Assignment mutation validates dispatcher and target scope', assignRoute.includes("tickets.assign") && assignRoute.includes("tickets.update") && assignRoute.includes('hasTicketQueueScope(actor, ticket)')],
  ['Runtime status mutation guard shares the same ticket queue resolver', hardening.includes('hasTicketQueueScope(actor, ticket)')],
  ['Ticket assignment and unit recipient fields are persisted', persistence.includes('assigned_unit_id') && persistence.includes('recipient_unit_id')],
  ['Server models retain legacy categories but support ME/unit routing', types.includes("'IT' | 'GA' | 'ME' | 'SC' | 'PIBC'") && types.includes('assigned_unit_id') && types.includes('recipient_unit_id')],
  ['Client form offers ME but does not offer SC/PIBC as new categories', form.includes("category: 'ME' as TicketCategory") && form.includes("canCreateCategory('ME')") && !form.includes("setCategory('SC')") && !form.includes("setCategory('PIBC')")],
  ['Client form prevents linking legacy SC/PIBC-owned assets to new tickets', form.includes('owner === \'SC\' || owner === \'PIBC\'') && form.includes('owner legacy SC/PIBC')],
  ['Ticket UI exposes assignment controls only with tickets.assign', ticketView.includes("hasEffectivePermission('tickets.assign') === true") && ticketView.includes('onAssignTicket')],
  ['Dashboard ticket stats use the same unit-aware queue scope as the ticket list', server.includes('|| hasTicketQueueScope(actor, ticket)')],
  ['Dashboard attention supports assigned-unit ticket scopes', dashboardScope.includes('assigned_unit_id?: string | null') && dashboardScope.includes('canReadTicketQueueScope')],
  ['Legacy reporter-name visibility fallback is allowed only when reporter_id is absent', dashboardScope.includes('!ticket.reporter_id && Boolean(ticket.reporter_name)')],
];

let failed = 0;
for (const [name, pass] of checks) {
  console.log((pass ? 'PASS' : 'FAIL') + ' | ' + name);
  if (!pass) failed += 1;
}
console.log('TOTAL: ' + checks.length + ' | PASS: ' + (checks.length - failed) + ' | FAIL: ' + failed);
process.exit(failed === 0 ? 0 : 1);
