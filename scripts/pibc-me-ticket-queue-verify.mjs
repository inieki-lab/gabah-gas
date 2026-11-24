import fs from 'node:fs';

const service = fs.readFileSync('server/services.ts', 'utf8');
const runtimeHardening = fs.readFileSync('server/runtime-hardening.ts', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');
const db = fs.readFileSync('server/db.ts', 'utf8');
const persistence = fs.readFileSync('server/persistence.ts', 'utf8');
const migration = fs.readFileSync('server/migrations/044_pibc_me_helpdesk_queue.sql', 'utf8');
const meQueueCapabilityMigration = fs.readFileSync('server/migrations/046_dynamic_me_queue_capability.sql', 'utf8');
const meAssignmentPermissionMigration = fs.readFileSync('server/migrations/047_me_ticket_assignment_permission.sql', 'utf8');
const form = fs.readFileSync('src/components/modals/CreateTicketModal.tsx', 'utf8');
const ticketView = fs.readFileSync('src/components/views/TicketsView.tsx', 'utf8');
const checks = [
  ['File-store ME ticket operator capability resolves the canonical admin_tiket_me secondary role', /secondaryRoleAliases[\s\S]*me: \['admin_tiket_me'\]/.test(server) && /secondaryRoleAliases\[roleKey\]/.test(server)],
  ['File-store ME ticket creation requires the dedicated pemohon_tiket_me capability', /payload\.category === 'ME'[\s\S]*!isPostgresPersistenceActive\(\)[\s\S]*pemohon_tiket_me/.test(service)],
  ['File-store attention scope recognizes Admin Tiket ME only for UNIT-PIBC-ME tickets', /ticket\.category === 'ME'[\s\S]*ticket\.assigned_unit_id === 'UNIT-PIBC-ME'[\s\S]*capabilities\.has\('admin_tiket_me'\)/.test(runtimeHardening)],
  ['File-store ME unit notifications are visible only to Admin Tiket ME', /notification\.recipient_unit_id === 'UNIT-PIBC-ME'[\s\S]*hasApplicationRole\(actor, 'me'\)/.test(server)],

  ['ME queue administrator receives tickets.assign separately from tickets.update', /role_key = 'admin_tiket_me'/.test(meAssignmentPermissionMigration) && /'tickets\.assign'/.test(meAssignmentPermissionMigration) && /ON CONFLICT \(role_id, permission_key\) DO NOTHING/.test(meAssignmentPermissionMigration)],
  ['ME has a dedicated unit and least-privilege requester/admin role templates', /UNIT-PIBC-ME/.test(migration) && /admin_tiket_me/.test(migration) && /pemohon_tiket_me/.test(migration) && /tickets\.create\.me/.test(migration)],
  ['New ticket categories are IT, GA, and ME; legacy SC/PIBC are not accepted for new submissions', /VALID_TICKET_CATEGORIES = \['IT', 'GA', 'ME'\]/.test(service)],
  ['ME tickets are routed to the maintenance unit, not a location/division owner', /assigned_unit_id: payload\.category === 'ME' \? 'UNIT-PIBC-ME'/.test(service) && /recipient_unit_id: payload\.category === 'ME' \? 'UNIT-PIBC-ME'/.test(service)],
  ['ME submission requires the dedicated requester permission', /requestedCategory === 'ME' \? 'tickets\.create\.me' : 'tickets\.create'/.test(server)],
  ['Ticket list and status mutation enforce the assigned unit scope', /canReadTicketUnit\(ticket\.assigned_unit_id\)/.test(server) && /hasRbacScope\(String\(actor\.id\), 'unit', ticket\.assigned_unit_id, 'tickets'\)/.test(server)],
  ['Notification delivery is scoped to the ME unit', /notification\.recipient_unit_id/.test(server) && /hasRbacScope\(String\(actor\.id\), 'unit', notification\.recipient_unit_id, 'tickets'\)/.test(server)],
  ['Attention center object guard recognizes assigned unit scope', /ticket\.assigned_unit_id[\s\S]*?hasRbacScope\(String\(actor\.id\), 'unit', ticket\.assigned_unit_id, 'tickets'\)/.test(fs.readFileSync('server/runtime-hardening.ts', 'utf8'))],
  ['Dashboard Attention final card filter also honors assigned ME unit scope', /assigned_unit_id\?: string/.test(fs.readFileSync('server/dashboard-attention-scope.ts', 'utf8')) && /scope\.canReadTicketUnit\(ticket\.assigned_unit_id\)/.test(fs.readFileSync('server/dashboard-attention-scope.ts', 'utf8')) && /canReadTicketUnit: \(unitId: string\) =>[\s\S]*hasRbacScope\(String\(actor\.id\), 'unit', unitId, 'tickets'\)/.test(server)],
  ['File-store Dashboard Attention fallback uses the canonical ME capability alias', /unitId === 'UNIT-PIBC-ME' && hasApplicationRole\(actor, 'me'\)/.test(server)],
  ['PostgreSQL persistence stores assigned unit and notification recipient unit', /assigned_unit_id,related_asset_id/.test(persistence) && /recipient_unit_id,title/.test(persistence)],
  ['Ticket model carries ME and assigned_unit_id', /category: 'IT' \| 'GA' \| 'ME' \| 'SC' \| 'PIBC'/.test(db) && /assigned_unit_id\?: string/.test(db)],
  ['Ticket creation modal resolves Auditor from all Dynamic RBAC assignments and keeps it deny-write', /const isAuditor = GabahService\.isAuditor\(currentUser\)/.test(form) && /const canRequestMe = !isAuditor &&/.test(form)],
  ['ME ticket request UI uses stable Superadmin metadata or tickets.create.me permission, not primary role labels', /const hasPermissionMetadata = Array\.isArray\(currentUser\.permission_keys\)/.test(form) && /tickets\.create\.me/.test(form) && !/currentUser\.role === 'Admin GABAH' \|\| currentUser\.permission_keys/.test(form)],
  ['Ticket form uses GA category correctly and exposes permission-gated ME, not SC/PIBC choices', /setCategory\('GA'\)/.test(form) && /setCategory\('ME'\)/.test(form) && !/setCategory\('SC'\)|setCategory\('PIBC'\)/.test(form)],
  ['Machine and electrical service catalog template targets ME and is permission-gated', /category: 'ME' as TicketCategory/.test(form) && /serviceCatalogTemplates\.filter\(tpl => tpl\.category === 'ME' \? canRequestMe : canCreateStandard\)/.test(form) && !/category: 'SC' as TicketCategory/.test(form)],
  ['ME-only requester defaults to ME and cannot select or submit IT/GA categories', /initialCategory: TicketCategory = canCreateStandard \? 'IT' : canRequestMe \? 'ME' : 'IT'/.test(form) && (form.match(/disabled=\{!canCreateStandard\}/g) || []).length === 3 && /const canCreateSelectedCategory = category === 'ME' \? canRequestMe : canCreateStandard/.test(form) && /disabled=\{category === 'ME' \? !canRequestMe : !canCreateStandard\}/.test(form)],
  ['Generic ticket entry points recognize the ME-only requester capability', /tickets\.create\.me/.test(fs.readFileSync('src/components/views/DashboardView.tsx', 'utf8')) && /tickets\.create\.me/.test(ticketView) && /canCreateAnyTicket/.test(fs.readFileSync('src/components/views/MyAssetsView.tsx', 'utf8'))],
  ['ME queue UI is driven by explicit tickets.queue.me capability, with file-store role fallback only', /currentUser\?\.permission_keys\)/.test(ticketView) && /tickets\.queue\.me/.test(ticketView) && /: hasAssignedRole\('admin_tiket_me'\)/.test(ticketView) && /Helpdesk & Tiket ME/.test(ticketView) && ticketView.includes(": isMEOperator\n    ? ['ALL', 'ME'")],
  ['ME queue capability is seeded only for the canonical ME operator template; custom roles require explicit Superadmin assignment', /tickets\.queue\.me/.test(meQueueCapabilityMigration) && /WHERE r\.role_key = 'admin_tiket_me'/.test(meQueueCapabilityMigration) && !/INSERT INTO gabah_role_permissions[\s\S]*SELECT .*FROM gabah_roles r[\s\S]*WHERE r\.role_key <> 'admin_tiket_me'/.test(meQueueCapabilityMigration)],

  ['Ticket UI resolves Auditor deny-write from additional Dynamic RBAC assignments', /const isAuditor = GabahService\.isAuditor\(currentUser\)/.test(ticketView)],
  ['Ticket UI uses effective ticket-management permissions instead of a hardcoded employee-role list', /!GabahService\.canManageTickets\(currentUser\)/.test(ticketView) && !/\['Karyawan', 'Sekretaris Direksi', 'Humas'\]\.includes\(currentUser\?\.role/.test(ticketView)],
  ['SC/PIBC ticket role labels remain compatibility-only and are ignored when PostgreSQL permission metadata exists', /!Array\.isArray\(currentUser\?\.permission_keys\) && currentUser\?\.role === 'Supply Chain'/.test(ticketView) && /!Array\.isArray\(currentUser\?\.permission_keys\) && currentUser\?\.role === 'PIBC'/.test(ticketView)],
  ['Ticket UI resolves IT and GA functions from additional role assignments', /hasAssignedRole\('it'\)/.test(ticketView) && /hasAssignedRole\('ga'\)/.test(ticketView)],
];

for (const [name, pass] of checks) console.log(`${pass ? 'PASS' : 'FAIL'} | ${name}`);
const failed = checks.filter(([, pass]) => !pass);
console.log(`TOTAL: ${checks.length} | PASS: ${checks.length - failed.length} | FAIL: ${failed.length}`);
if (failed.length) process.exit(1);
