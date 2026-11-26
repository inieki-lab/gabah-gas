import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const assets = read('src/components/views/AssetsView.tsx');
const loans = read('src/components/views/LoansView.tsx');
const tickets = read('src/components/views/TicketsView.tsx');
const rooms = read('src/components/views/MeetingRoomsView.tsx');
const maintenance = read('src/components/views/MaintenanceView.tsx');
const vendors = read('src/components/views/VendorsView.tsx');
const dashboard = read('src/components/views/DashboardView.tsx');
const sidebar = read('src/components/Sidebar.tsx');
const knowledge = read('src/components/views/KnowledgeBaseView.tsx');
const licenses = read('src/components/views/LicensesView.tsx');
const gabahService = read('src/services/gabahService.ts');

const checks = [
  ['Asset creation and ticket report buttons use effective permissions',
    /hasEffectivePermission\(\s*currentUser,\s*'assets\.create'/.test(assets)
    && /hasEffectivePermission\(currentUser, 'tickets\.create'/.test(assets)
    && /onReportAsset && canReportAsset/.test(assets)],
  ['Loan view derives self-service scope from primary + additional role persona',
    /resolveDashboardPersona\(currentUser\)/.test(loans)
    && /const isEmployee = dashboardPersona\?\.isStaff/.test(loans)
    && /const isAuditor = dashboardPersona\?\.isAuditor/.test(loans)],
  ['Ticket queues honor additional IT/GA roles and Auditor read-only',
    /resolveDashboardPersona\(currentUser\)/.test(tickets)
    && /const isIT = persona\.isIT/.test(tickets)
    && /const isGA = persona\.isGA/.test(tickets)
    && /const isSelfTicketsOnly = persona\.isStaff/.test(tickets)
    && /hasEffectivePermission\(currentUser, 'tickets\.create'/.test(tickets)],
  ['Meeting room create, approve, reject, cancel, and room update controls use separate permissions',
    /'room_reservations\.create'/.test(rooms)
    && /'room_reservations\.approve'/.test(rooms)
    && /'room_reservations\.reject'/.test(rooms)
    && /'room_reservations\.cancel'/.test(rooms)
    && /'meeting_rooms\.update'/.test(rooms)
    && /canApproveReservations/.test(rooms)
    && /canRejectReservations/.test(rooms)],
  ['Specialist IT/Humas meeting queues require their explicit capabilities',
    /'room_reservations\.it_facilities\.read'/.test(rooms)
    && /'room_reservations\.documentation\.read'/.test(rooms)
    && /canReadITFacilityQueue/.test(rooms)
    && /canReadDocumentationQueue/.test(rooms)],
  ['Maintenance create and update actions are separately permission-gated',
    /'maintenances\.create'/.test(maintenance)
    && /'maintenances\.update'/.test(maintenance)
    && /canCreate && \(/.test(maintenance)
    && /canUpdate && onUpdateScheduleStatus/.test(maintenance)],
  ['Vendor create and update actions use effective permissions',
    /hasEffectivePermission\(currentUser, 'vendors\.create'/.test(vendors)
    && /hasEffectivePermission\(currentUser, 'vendors\.update'/.test(vendors)],
  ['Loan approval and return controls use effective permissions, not primary role labels',
    /user\.permission_keys\.includes\('loans\.approve'\)/.test(gabahService)
    && /hasEffectivePermission\(currentUser, 'loans\.create'/.test(loans)
    && /hasEffectivePermission\(currentUser, 'loans\.return'/.test(loans)
    && /canReturnLoan && \(loan\.status/.test(loans)],
  ['Ticket list trusts backend effective scopes instead of re-filtering by primary role',
    /Array\.isArray\(user\.permission_keys\)\) return user\.permission_keys\.includes\('\*'\) \|\| user\.permission_keys\.includes\('tickets\.read'\)/.test(gabahService)
    && /resolveDashboardPersona\(user\)/.test(gabahService)],
  ['Ticket update and close controls require their separate permissions',
    /action: 'update' \| 'close' = 'update'/.test(gabahService)
    && /action === 'close' \? 'tickets\.close' : 'tickets\.update'/.test(gabahService)
    && /canManageTicket\(ticket, currentUser, 'update'\)/.test(tickets)
    && /canManageTicket\(ticket, currentUser, 'close'\)/.test(tickets)],
  ['Knowledge base create and update controls use separate permissions',
    /hasEffectivePermission\(currentUser, 'knowledge\.create'/.test(knowledge)
    && /hasEffectivePermission\(currentUser, 'knowledge\.update'/.test(knowledge)
    && /canCreate && \(/.test(knowledge)
    && /canUpdate && \(/.test(knowledge)],
  ['License creation uses effective license management permission',
    /hasEffectivePermission\(currentUser, 'licenses\.manage'/.test(licenses)],
  ['Dashboard and sidebar share the effective persona resolver',
    /resolveDashboardPersona\(currentUser\)/.test(dashboard)
    && /resolveDashboardPersona\(/.test(sidebar)
    && /currentUserRoleKeys/.test(sidebar)],
];

let failed = 0;
for (const [name, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${name}`);
  if (!pass) failed++;
}
console.log(`TOTAL: ${checks.length} | PASS: ${checks.length - failed} | FAIL: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
