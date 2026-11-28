import fs from 'node:fs';
import assert from 'node:assert/strict';
const source = fs.readFileSync('src/services/gabahService.ts', 'utf8');
const header = fs.readFileSync('src/components/HeaderNavbar.tsx', 'utf8');
assert.ok(source.includes('static isSuperAdmin(user?: UserProfile): boolean'));
assert.ok(source.includes("user.is_superadmin === true"));
assert.ok(source.includes("user.role_keys?.includes('superadmin') === true"));
assert.ok(source.includes("user.permission_keys.includes('*') || user.permission_keys.includes(permission)"));
assert.ok(source.includes("this.hasEffectivePermission(user, 'assets.update')"));
assert.ok(source.includes("this.hasEffectivePermission(user, 'loans.approve')"));
assert.ok(source.includes("this.hasEffectivePermission(user, key)"));
const auditor = source.indexOf('static canApproveLoan(');
assert.ok(source.slice(auditor, auditor + 220).includes('this.isReadOnly(user)'), 'Auditor remains deny-write');
assert.match(header, /isSuperadmin \? \(/, 'Account directory must only render for Superadmin');
assert.match(header, /Direktori akun hanya dapat diakses Superadmin/, 'Non-Superadmin receives a privacy-safe account menu state');
assert.match(header, /\{\(allUsers \|\| \[\]\)\.map\(user =>/, 'Registered account list remains available inside the Superadmin-only branch');
console.log('PASS: Superadmin and wildcard permissions are consistent; account directory is hidden from non-Superadmin users.');
const app = fs.readFileSync('src/App.tsx', 'utf8');
assert.match(app, /useRef/);
assert.match(app, /const dataRefreshGeneration = useRef\(0\)/);
assert.match(app, /const generation = dataRefreshGeneration\.current/);
assert.match(app, /generation !== dataRefreshGeneration\.current/);
assert.match(app, /if \(generation === dataRefreshGeneration\.current\) setIsLoading\(false\)/);
assert.match(app, /gabahApi\.getUsers\(\)\.catch\(\(\) => \[\]\)/);
assert.match(app, /const \[allUsers, setAllUsers\] = useState<UserProfile\[]>\(\[\]\)/);
assert.match(app, /dataRefreshGeneration\.current \+= 1;\s*clearRoleScopedData\(\);\s*setCurrentUser\(targetUser\)/);
assert.match(app, /onLoginSuccess=\{\(u\) => \{\s*dataRefreshGeneration\.current \+= 1;\s*clearRoleScopedData\(\);\s*setCurrentUser\(u\)/);
assert.match(app, /if \(me\) \{\s*dataRefreshGeneration\.current \+= 1;\s*clearRoleScopedData\(\);\s*setCurrentUser\(me\)/);
assert.ok(app.includes('setActiveModuleKeys(null)'));
assert.ok(app.includes('setModuleStatusLoadFailed(false)'));
assert.match(app, /dataRefreshGeneration\.current \+= 1;\s*clearRoleScopedData\(\);\s*setCurrentUser\(null\)/);
for (const state of ['setAssets([])', 'setLoans([])', 'setTickets([])', 'setAuditLogs([])', 'setAllUsers([])', 'setVendors([])', 'setKnowledgeBase([])', 'setMaintenanceSchedules([])', 'setMeetingRooms([])', 'setRoomReservations([])', 'setContracts([])', 'setMovements([])']) {
  assert.ok(app.includes(state), `Identity reset must clear ${state}`);
}
for (const transient of ["setSelectedAssetForDetail(null)","setSelectedAssetForEdit(null)","setSelectedAssetForQr(null)","setSelectedLoanForBast(null)","setPreselectedTicketAssetId(undefined)","setContractForLinkedTicket(null)","setLinkedTicketContractId(undefined)","setIsCreateAssetModalOpen(false)","setIsCreateLoanModalOpen(false)","setIsCreateTicketModalOpen(false)","setIsCreateContractModalOpen(false)","setIsChangePasswordOpen(false)","setIsAssetImportOpen(false)","setIsScannerModalOpen(false)","setIsGlobalSearchOpen(false)","setIsAdministrationModalOpen(false)"]) {
  assert.ok(app.includes(transient), `Identity reset must clear transient state ${transient}`);
}
console.log('PASS: role switch, login, and logout clear role-scoped data and invalidate stale in-flight refreshes.');


const ticketModal = fs.readFileSync('src/components/modals/CreateTicketModal.tsx', 'utf8');
const assetModal = fs.readFileSync('src/components/modals/CreateAssetModal.tsx', 'utf8');
const ticketCreateHandler = app.slice(app.indexOf('const handleCreateTicket = async'), app.indexOf('// 9. Update Ticket Status'));
const assetCreateHandler = app.slice(app.indexOf('const handleCreateAsset = async'), app.indexOf('// 2. Update Asset'));

assert.match(ticketModal, /onCreateTicket:[\s\S]*?=> Promise<boolean>/,
  'ticket modal must receive an explicit save result');
assert.match(ticketModal, /const handleSubmit = async/);
assert.match(ticketModal, /const saved = await onCreateTicket\(/);
assert.match(ticketModal, /if \(!saved\)[\s\S]*?setSubmitError/);
assert.match(ticketModal, /disabled=\{isSubmitting \|\|/);
assert.doesNotMatch(ticketModal, /onCreateTicket\([\s\S]*?\);\s*onClose\(\);/,
  'ticket modal must not close immediately after starting an API request');
assert.match(ticketCreateHandler, /return true;/);
assert.match(ticketCreateHandler, /return false;/);

assert.match(assetModal, /onCreateAsset:[\s\S]*?=> Promise<boolean>/,
  'asset modal must receive an explicit save result');
assert.match(assetModal, /const handleSubmit = async/);
assert.match(assetModal, /const saved = await onCreateAsset\(newAsset\)/);
assert.match(assetModal, /if \(!saved\)[\s\S]*?setSubmitError/);
assert.match(assetModal, /disabled=\{isSubmitting\}/);
assert.doesNotMatch(assetModal, /onCreateAsset\(newAsset\);\s*onClose\(\);/,
  'asset modal must not close immediately after starting an API request');
assert.match(assetCreateHandler, /return true;/);
assert.match(assetCreateHandler, /return false;/);
console.log('PASS: asset and ticket create forms retain input after failed saves and close only after confirmed success.');


const maintenanceView = fs.readFileSync('src/components/views/MaintenanceView.tsx', 'utf8');
const maintenanceCreateHandler = app.slice(app.indexOf('onAddSchedule={async (newSch) => {'), app.indexOf('            />', app.indexOf('onAddSchedule={async (newSch) => {')));
assert.match(maintenanceView, /onAddSchedule\?: \(newSchedule: Partial<MaintenanceSchedule>\) => Promise<boolean>/);
assert.match(maintenanceView, /const handleCreateSubmit = async/);
assert.match(maintenanceView, /const saved = await onAddSchedule\(newObj\)/);
assert.match(maintenanceView, /if \(!saved\)[\s\S]*?setSubmitError/);
assert.match(maintenanceView, /disabled=\{isSubmitting\}/);
assert.doesNotMatch(maintenanceView, /Jadwal pemeliharaan berhasil didaftarkan/,
  'maintenance form must not show success before the server confirms persistence');
const maintenanceSaveAwait = maintenanceView.indexOf('const saved = await onAddSchedule(newObj);');
const maintenanceFailureGuard = maintenanceView.indexOf('if (!saved)', maintenanceSaveAwait);
const maintenanceClose = maintenanceView.indexOf('setIsCreateModalOpen(false)', maintenanceSaveAwait);
assert.ok(maintenanceSaveAwait >= 0 && maintenanceFailureGuard > maintenanceSaveAwait && maintenanceClose > maintenanceFailureGuard,
  'maintenance form must await save, handle false, then close only on success');
assert.match(maintenanceCreateHandler, /return true;/);
assert.match(maintenanceCreateHandler, /return false;/);
console.log('PASS: maintenance create form waits for backend success and retains input after failure.');


const loansView = fs.readFileSync('src/components/views/LoansView.tsx', 'utf8');
const rejectLoanHandler = app.slice(app.indexOf('const handleRejectLoan = async'), app.indexOf('// 6. Handover Loan'));
assert.match(loansView, /onRejectLoan: \(loanId: string, reason: string\) => Promise<boolean>/);
assert.match(loansView, /const handleRejectSubmit = async/);
assert.match(loansView, /await onRejectLoan\(rejectingLoanId, rejectReason\.trim\(\)\)/);
assert.match(loansView, /if \(!saved\)[\s\S]*?setRejectError/);
assert.match(loansView, /disabled=\{isRejecting \|\| !rejectReason\.trim\(\)\}/);
assert.doesNotMatch(loansView, /onRejectLoan\(rejectingLoanId, rejectReason\);[\s\S]*?setRejectingLoanId\(null\)/,
  'reject modal must not close before the API confirms the rejection');
assert.match(rejectLoanHandler, /Promise<boolean>/);
assert.match(rejectLoanHandler, /return true;/);
assert.match(rejectLoanHandler, /return false;/);
console.log('PASS: loan rejection keeps the reason and dialog open until the server confirms success.');


const loanRequestModal = fs.readFileSync('src/components/modals/CreateLoanModal.tsx', 'utf8');
const loanRequestHandler = app.slice(app.indexOf('const handleRequestLoan = async'), app.indexOf('// 4.'));
assert.match(loanRequestModal, /onRequestLoan:[\s\S]*?=> Promise<string \| null>/);
assert.match(loanRequestModal, /const requestResult = await onRequestLoan\(/);
assert.match(loanRequestModal, /setRequestError\(requestResult \|\| ''\)/);
assert.match(loanRequestModal, /requestError &&/);
assert.match(loanRequestModal, /disabled=\{isSubmitting/);
assert.match(loanRequestHandler, /Promise<string \| null>/);
assert.match(loanRequestHandler, /return null;/);
assert.match(loanRequestHandler, /return err\?\.message/);
console.log('PASS: loan request displays authoritative API validation/collision errors and retains all form inputs.');


const ticketsView = fs.readFileSync('src/components/views/TicketsView.tsx', 'utf8');
const ticketStatusHandler = app.slice(app.indexOf('const handleUpdateTicketStatus = async'), app.indexOf('const handleUpdateTicketAssignment'));
assert.match(ticketsView, /onUpdateTicketStatus:[\\s\\S]*?=> Promise<string \\| null>/);
assert.match(ticketsView, /const handleResolveTicket = async/);
assert.match(ticketsView, /await onUpdateTicketStatus\\([\\s\\S]*?'resolved'/);
assert.match(ticketsView, /if \\(result\\)[\\s\\S]*?setResolveError/);
assert.match(ticketsView, /resolveError &&/);
assert.match(ticketsView, /disabled=\\{isResolving\\}/);
assert.match(ticketStatusHandler, /Promise<string \\| null>/);
assert.match(ticketStatusHandler, /return null;/);
assert.match(ticketStatusHandler, /return message;/);
console.log('PASS: ticket resolution keeps solution notes and dialog open until API confirms success.');
