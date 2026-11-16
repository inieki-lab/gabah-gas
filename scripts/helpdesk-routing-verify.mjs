import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = path => fs.readFileSync(path, 'utf8');
const server = read('server.ts');
const services = read('server/services.ts');
const db = read('server/db.ts');
const persistence = read('server/persistence.ts');
const types = read('src/types.ts');
const modal = read('src/components/modals/CreateTicketModal.tsx');
const view = read('src/components/views/TicketsView.tsx');
const app = read('src/App.tsx');
const api = read('src/services/gabahApi.ts');
const access = read('src/utils/access.ts');

const migrations = {
  unit: read('server/migrations/035_pibc_me_ticket_routing_and_rpc_location.sql'),
  meAdmin: read('server/migrations/037_admin_tiket_me_role_template.sql'),
  dispatch: read('server/migrations/038_ticket_dispatch_permission.sql'),
  gaOperator: read('server/migrations/039_ga_helpdesk_operator_template.sql'),
  requestPermissions: read('server/migrations/040_ticket_requester_category_permissions.sql'),
  requesterRoles: read('server/migrations/041_ticket_requester_role_templates.sql'),
};

assert.match(services, /export function getTicketOwnerDivision[\s\S]*normalized === 'ME' \? 'PIBC'/);
assert.match(services, /const VALID_TICKET_CATEGORIES = \['IT', 'GA', 'ME'\]/);
assert.match(services, /assigned_unit_id: payload\.category === 'ME' \? 'UNIT-PIBC-ME'/);
assert.match(services, /hasRbacPermission\(String\(user\.id\), 'tickets\.update'\)/);
assert.match(services, /!isSuperadminActor\(user\)/);
assert.match(services, /recipient_unit_id: payload\.category === 'ME' \? 'UNIT-PIBC-ME'/);
assert.match(services, /payload\.category === 'GA' \? 'ga_helpdesk_operator'/);

assert.match(server, /ME: 'tickets\.create\.me'/);
assert.match(server, /requestedCategory !== 'IT' && !requireRbacPermission/);
assert.match(server, /isAuditorActor\(actor\)/);
assert.match(server, /app\.get\('\/api\/tickets\/:id\/assignees'/);
assert.match(server, /app\.patch\('\/api\/tickets\/:id\/assign'/);
assert.match(server, /ticket\.assigned_unit_id === actor\.unit_id/);
assert.match(server, /!ticket\.assigned_unit_id && canReadTicketOwner\(ticket\.category\)/);
assert.match(server, /target\.unit_id === ticket\.assigned_unit_id/);
assert.match(server, /notification\.recipient_unit_id === actor\.unit_id/);

assert.match(db, /category: 'IT' \| 'GA' \| 'ME' \| 'SC' \| 'PIBC'/);
assert.match(db, /id: 'UNIT-PIBC-ME'/);
assert.match(db, /GABAH_ENABLE_ME_DUMMY_USER === 'true'/);
assert.match(persistence, /assigned_unit_id,assigned_agent_id/);
assert.match(persistence, /recipient_division_id,recipient_unit_id/);
assert.match(persistence, /ensureMeDummyRoleAssignment/);
assert.match(types, /TicketCategory = 'IT' \| 'GA' \| 'ME' \| 'SC' \| 'PIBC'/);
assert.match(types, /assigned_unit_id\?: string/);

assert.match(modal, /hasPermission\(currentUser, 'tickets\.create\.ga'/);
assert.match(modal, /hasPermission\(currentUser, 'tickets\.create\.me'/);
assert.match(modal, /category: 'ME' as TicketCategory/);
assert.doesNotMatch(modal, /setCategory\('SC'\)|setCategory\('PIBC'\)/);
assert.match(view, /hasPermission\('tickets\.assign'\)/);
assert.match(view, /onLoadTicketAssignees/);
assert.match(view, /onAssignTicket/);
assert.match(app, /gabahApi\.getTicketAssignees/);
assert.match(app, /gabahApi\.assignTicket/);
assert.match(api, /async getTicketAssignees/);
assert.match(api, /async assignTicket/);
assert.match(access, /if \(Array\.isArray\(user\.permission_keys\)\)/);

assert.match(migrations.unit, /UNIT-PIBC-ME/);
assert.match(migrations.unit, /assigned_unit_id/);
assert.match(migrations.unit, /recipient_unit_id/);
assert.match(migrations.meAdmin, /admin_tiket_me/);
assert.match(migrations.meAdmin, /UNIT-PIBC-ME/);
assert.match(migrations.dispatch, /tickets\.assign/);
assert.match(migrations.gaOperator, /ga_helpdesk_operator/);
assert.match(migrations.gaOperator, /DELETE FROM gabah_role_permissions/);
assert.match(migrations.gaOperator, /tickets\.close/);
assert.match(migrations.requestPermissions, /tickets\.create\.ga/);
assert.match(migrations.requestPermissions, /tickets\.create\.me/);
assert.match(migrations.requesterRoles, /pemohon_tiket_ga/);
assert.match(migrations.requesterRoles, /pemohon_tiket_me/);

console.log('Helpdesk IT/GA/ME routing: 44 checks passed');
