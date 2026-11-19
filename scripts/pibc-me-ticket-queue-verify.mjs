import fs from 'node:fs';

const service = fs.readFileSync('server/services.ts', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');
const db = fs.readFileSync('server/db.ts', 'utf8');
const persistence = fs.readFileSync('server/persistence.ts', 'utf8');
const migration = fs.readFileSync('server/migrations/044_pibc_me_helpdesk_queue.sql', 'utf8');
const form = fs.readFileSync('src/components/modals/CreateTicketModal.tsx', 'utf8');
const ticketView = fs.readFileSync('src/components/views/TicketsView.tsx', 'utf8');
const checks = [
  ['ME has a dedicated unit and least-privilege requester/admin role templates', /UNIT-PIBC-ME/.test(migration) && /admin_tiket_me/.test(migration) && /pemohon_tiket_me/.test(migration) && /tickets\.create\.me/.test(migration)],
  ['New ticket categories are IT, GA, and ME; legacy SC/PIBC are not accepted for new submissions', /VALID_TICKET_CATEGORIES = \['IT', 'GA', 'ME'\]/.test(service)],
  ['ME tickets are routed to the maintenance unit, not a location/division owner', /assigned_unit_id: payload\.category === 'ME' \? 'UNIT-PIBC-ME'/.test(service) && /recipient_unit_id: payload\.category === 'ME' \? 'UNIT-PIBC-ME'/.test(service)],
  ['ME submission requires the dedicated requester permission', /requestedCategory === 'ME' \? 'tickets\.create\.me' : 'tickets\.create'/.test(server)],
  ['Ticket list and status mutation enforce the assigned unit scope', /canReadTicketUnit\(ticket\.assigned_unit_id\)/.test(server) && /hasRbacScope\(String\(actor\.id\), 'unit', ticket\.assigned_unit_id, 'tickets'\)/.test(server)],
  ['Notification delivery is scoped to the ME unit', /notification\.recipient_unit_id/.test(server) && /hasRbacScope\(String\(actor\.id\), 'unit', notification\.recipient_unit_id, 'tickets'\)/.test(server)],
  ['Attention center object guard recognizes assigned unit scope', /ticket\.assigned_unit_id[\s\S]*?hasRbacScope\(String\(actor\.id\), 'unit', ticket\.assigned_unit_id, 'tickets'\)/.test(fs.readFileSync('server/runtime-hardening.ts', 'utf8'))],
  ['PostgreSQL persistence stores assigned unit and notification recipient unit', /assigned_unit_id,related_asset_id/.test(persistence) && /recipient_unit_id,title/.test(persistence)],
  ['Ticket model carries ME and assigned_unit_id', /category: 'IT' \| 'GA' \| 'ME' \| 'SC' \| 'PIBC'/.test(db) && /assigned_unit_id\?: string/.test(db)],
  ['Ticket form uses GA category correctly and exposes permission-gated ME, not SC/PIBC choices', /setCategory\('GA'\)/.test(form) && /setCategory\('ME'\)/.test(form) && !/setCategory\('SC'\)|setCategory\('PIBC'\)/.test(form)],
  ['ME operator receives an ME queue view', /admin_tiket_me/.test(ticketView) && /Helpdesk & Tiket ME/.test(ticketView)],
];

for (const [name, pass] of checks) console.log(`${pass ? 'PASS' : 'FAIL'} | ${name}`);
const failed = checks.filter(([, pass]) => !pass);
console.log(`TOTAL: ${checks.length} | PASS: ${checks.length - failed.length} | FAIL: ${failed.length}`);
if (failed.length) process.exit(1);
