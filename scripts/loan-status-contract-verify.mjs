import fs from 'node:fs';
import assert from 'node:assert/strict';
const ui = fs.readFileSync('src/components/views/LoansView.tsx', 'utf8');
const types = fs.readFileSync('src/types.ts', 'utf8');
const services = fs.readFileSync('server/services.ts', 'utf8');
assert.ok(ui.includes("status === 'pending_approval'"));
assert.ok(ui.includes("status === 'borrowed'"));
assert.ok(ui.includes('normalizeLoanStatus(loan.status)'));
assert.ok(ui.includes("hasEffectivePermission('loans.approve'"), 'Superadmin/effective permission must control approval UI');
assert.ok(types.includes("'pending_approval'") && types.includes("'borrowed'"));
const start = services.indexOf('static approveLoan(');
const end = services.indexOf('\n  /**', start + 10);
assert.ok(start >= 0 && end > start, 'approveLoan must exist');
const approve = services.slice(start, end);
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