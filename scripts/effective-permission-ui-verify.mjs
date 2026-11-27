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
assert.match(app, /const \[allUsers, setAllUsers\] = useState<UserProfile\[]>\(\[\]\)/);
assert.match(app, /dataRefreshGeneration\.current \+= 1;\s*clearRoleScopedData\(\);\s*setCurrentUser\(targetUser\)/);
assert.match(app, /onLoginSuccess=\{\(u\) => \{\s*authInitializationGeneration\.current \+= 1;\s*dataRefreshGeneration\.current \+= 1;\s*clearRoleScopedData\(\);\s*setCurrentUser\(u\)/, 'interactive login must invalidate the initial session restore before resetting role-scoped state');
assert.match(app, /const authInitializationGeneration = useRef\(0\)/);
assert.match(app, /if \(generation !== authInitializationGeneration\.current\) return/);
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


const refreshStart = app.indexOf('const refreshData = useCallback');
const refreshEnd = app.indexOf("\n  useEffect(() => {\n    async function initAuth()", refreshStart);
assert.ok(refreshStart >= 0 && refreshEnd > refreshStart, 'refreshData function boundaries must be present');
const refreshSource = app.slice(refreshStart, refreshEnd);
assert.match(refreshSource, /Promise\.allSettled\(\[/, 'refreshData must distinguish empty success from request failure');
assert.match(refreshSource, /result\.status === 'fulfilled'[\s\S]*?setCollection\(result\.value\)/, 'a successful empty response must replace stale seeded data');
assert.match(refreshSource, /Failed to refresh \$\{collectionName\}; keeping last known data\./, 'failed requests must be reported instead of masquerading as empty results');
assert.match(refreshSource, /applyCollection\(maintenancesResult, setMaintenanceSchedules/);
assert.match(refreshSource, /applyCollection\(vendorsResult, setVendors/);
assert.match(refreshSource, /applyCollection\(knowledgeResult, setKnowledgeBase/);
assert.doesNotMatch(refreshSource, /length > 0/, 'empty server collections must not preserve mock/demo rows');
console.log('PASS: authoritative empty collections clear stale seed rows; failed API requests preserve last-known data and are logged.');


assert.match(app, /const \[dataRefreshErrors, setDataRefreshErrors\] = useState<string\[\]>\(\[\]\)/,
  'collection failures must have user-visible state');
assert.match(app, /dataRefreshErrors\.length > 0[\s\S]*?role="alert"[\s\S]*?Coba muat ulang data/,
  'collection failures must display an alert and an explicit retry action');
assert.match(app, /setDataRefreshErrors\(previous => previous\.includes\(collectionName\)/,
  'collection failures must be aggregated without duplicate labels');
console.log('PASS: failed page data loads are visible to users with a retry action.');


const boundary = fs.readFileSync('src/components/PageErrorBoundary.tsx', 'utf8');
assert.match(app, /import \{ PageErrorBoundary \} from '\.\/components\/PageErrorBoundary'/,
  'App must import the page-level error boundary');
assert.match(app, /<PageErrorBoundary key=\{activeTab \|\| 'no-access'\}>[\s\S]*?<main className="gabah-main-content/,
  'page content must be isolated so a render exception does not destroy the sidebar shell');
assert.match(app, /<\/main>\s*<\/PageErrorBoundary>/,
  'page boundary must close after the main content');
assert.match(boundary, /static getDerivedStateFromError/);
assert.match(boundary, /componentDidCatch/);
assert.match(boundary, /Menu navigasi tetap tersedia/);
console.log('PASS: page render exceptions are contained inside the content pane; keyed navigation can recover.');


const apiClient = fs.readFileSync('src/services/gabahApi.ts', 'utf8');
assert.match(apiClient, /err\.status = res\.status/);
assert.match(apiClient, /err\.code = json\.code/);
assert.match(app, /result\.reason\?\.status === 403[\s\S]*?setCollection\(\[\]\)/,
  'expected permission/module 403 responses must not create a false data-load error banner');
console.log('PASS: expected 403 denials for unassigned/inactive modules are not reported as server outages.');
