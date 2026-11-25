import fs from 'node:fs';
import assert from 'node:assert/strict';
const ui = fs.readFileSync('src/components/views/LoansView.tsx', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');
const types = fs.readFileSync('src/types.ts', 'utf8');
const services = fs.readFileSync('server/services.ts', 'utf8');
const bastModal = fs.readFileSync('src/components/modals/BastDocumentModal.tsx', 'utf8');
assert.ok(ui.includes("status === 'pending_approval'"));
assert.ok(ui.includes("status === 'borrowed'"));
assert.ok(ui.includes('normalizeLoanStatus(loan.status)'));
assert.ok(ui.includes("const canPrintBast = ['approved', 'active', 'returned'].includes(loanStatus)"),
  'loan BAST must only be printable after approval / active handover / return');
assert.ok(ui.includes('{canPrintBast && ('), 'pending approval and rejected loans must not expose BAST printing');
assert.ok(!ui.includes("loanStatus !== 'rejected'"), 'BAST must not be shown for every non-rejected state');
assert.ok(app.includes('const [selectedAssetForBast, setSelectedAssetForBast] = useState<Asset | null>(null)'),
  'permanent assignment BAST must use asset state, not a fabricated loan');
assert.ok(app.includes("['active', 'borrowed', 'approved', 'overdue', 'returned'].includes(String(l.status).toLowerCase())"),
  'existing borrowed/overdue loan records must be recognized before generating assignment BAST');
assert.ok(app.includes('setSelectedAssetForBast(ast);') && app.includes('asset={selectedAssetForBast ||'),
  'assignment BAST must pass the real asset directly to the document modal');
assert.ok(!app.includes("borrower_phone: '021-5000-888'"),
  'BAST must not fabricate a borrower phone number');
assert.ok(app.includes('currentUser={currentUser}'), 'BAST assignment document must receive the authenticated actor');
assert.ok(bastModal.includes('formatOwnerDivision(isAssignmentMode ? asset?.owner_division : loan!.owner_division)'),
  'BAST responsible division must follow owner_division, not service category');
assert.ok(!bastModal.includes("loan!.category_type === 'IT'"),
  'BAST must not infer asset owner from category_type');
assert.ok(bastModal.includes("loan!.owner_division || 'UNASSIGNED'"),
  'loan BAST number must not invent an owner when owner_division is missing');


assert.ok(ui.includes("hasEffectivePermission('loans.approve'"), 'Superadmin/effective permission must control approval UI');
assert.ok(types.includes("'pending_approval'") && types.includes("'borrowed'"));
const start = services.indexOf('static approveLoan(');
const end = services.indexOf('\n  /**', start + 10);
assert.ok(start >= 0 && end > start, 'approveLoan must exist');
const approve = services.slice(start, end);
assert.ok(approve.includes("loan.borrower_id === actor.id && !isSuperadminActor(actor)"), 'non-Superadmin borrower cannot approve own loan');
assert.ok(approve.includes("LOAN_APPROVAL_DENIED"), 'self-approval attempts must be audited');
assert.ok(approve.includes("loan.status !== 'pending_approval'"), 'only pending requests may be approved');
assert.ok(approve.includes('statusCode: 409'), 'invalid transitions must return conflict');
const api = fs.readFileSync('server.ts', 'utf8');
const loanRouteStart = api.indexOf("app.get('/api/loans'");
const loanRouteEnd = api.indexOf("app.post('/api/loans'", loanRouteStart);
assert.ok(loanRouteStart >= 0 && loanRouteEnd > loanRouteStart, 'loan read route must exist');
const loanRoute = api.slice(loanRouteStart, loanRouteEnd);
for (const action of ['approve', 'reject', 'handover', 'return']) assert.ok(loanRoute.includes(action + ':'), 'server must expose ' + action + ' action capability');
assert.ok(ui.includes('loan.allowed_actions?.approve') && ui.includes('loan.allowed_actions?.handover') && ui.includes('loan.allowed_actions?.return'));
const normalize = s => s === 'pending_approval' ? 'pending' : s === 'borrowed' ? 'active' : s;
const returnStart = services.indexOf('static returnLoan(');
const returnEnd = services.indexOf('static createTicket(', returnStart + 10);
assert.ok(returnStart >= 0 && returnEnd > returnStart, 'returnLoan must exist');
const returnMethod = services.slice(returnStart, returnEnd);
assert.ok(returnMethod.includes("['borrowed', 'overdue'].includes(loan.status)"), 'overdue loans must be returnable after handover');
assert.ok(returnMethod.includes("asset.status !== 'assigned'"), 'return must still require assigned asset custody');
assert.ok(ui.includes("'poor' | 'broken' | 'damaged'"), 'UI callback must carry all backend inspection conditions');
const returnButtonStart = ui.indexOf('const succeeded = await onReturnLoan(returningLoan.id, returnCondition, returnNotes)');
const returnButtonEnd = ui.indexOf('Simpan &amp; Selesaikan', returnButtonStart);
assert.ok(returnButtonStart >= 0 && returnButtonEnd > returnButtonStart, 'return modal must await transaction result');
const returnButton = ui.slice(returnButtonStart, returnButtonEnd);
assert.ok(returnButton.indexOf('if (succeeded === false) return') < returnButton.indexOf('setReturningLoan(null)'), 'failed return must keep modal and entered notes open');
const appReturnStart = app.indexOf('const handleReturnLoan = async');
const appReturnEnd = app.indexOf('// Direct BAST generation keeps permanent asset assignment separate from a loan.', appReturnStart);
assert.ok(appReturnStart >= 0 && appReturnEnd > appReturnStart, 'App return handler must exist');
const appReturn = app.slice(appReturnStart, appReturnEnd);
assert.ok(appReturn.includes('return false;') && appReturn.includes('return true;'), 'App must distinguish failed API return from committed return');
assert.ok(appReturn.indexOf('await gabahApi.returnLoan') < appReturn.indexOf('return false;'), 'API failure must be handled before reporting transaction success');
for (const condition of ['excellent', 'good', 'fair', 'poor', 'damaged', 'broken']) {
  assert.ok(ui.includes(`value: '${condition}'`), 'return inspection UI must offer ' + condition);
}
for (const [a,b] of [['pending_approval','pending'],['pending','pending'],['borrowed','active'],['active','active'],['approved','approved'],['returned','returned'],['rejected','rejected']]) assert.equal(normalize(a),b);

const rejectStart = services.indexOf('static rejectLoan(');
const rejectEnd = services.indexOf('\n  /**', rejectStart + 10);
assert.ok(rejectStart >= 0 && rejectEnd > rejectStart, 'rejectLoan must exist');
const reject = services.slice(rejectStart, rejectEnd);
assert.ok(reject.indexOf('this.canOperateLoan(loan, actor, \'loans.reject\')') < reject.indexOf("loan.status !== 'pending_approval'"),
  'rejection authorization must run before workflow-state disclosure');
assert.ok(reject.includes('LOAN_REJECT_DENIED'), 'unauthorized rejection attempts must be audited');
assert.ok(reject.includes('statusCode: 409'), 'invalid rejection state must return conflict');
assert.ok(reject.includes('reason.trim().length > 1000'), 'rejection reason must be length-limited');

console.log('PASS: Loan API/UI states, approval/rejection transitions, and rejection authorization are guarded.');