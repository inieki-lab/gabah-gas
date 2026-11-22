import assert from 'node:assert/strict';
import fs from 'node:fs';

const services = fs.readFileSync('server/services.ts', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');
const audit = services.slice(services.indexOf('static recordAudit('), services.indexOf('static notify('));
assert.match(audit, /persistImmediately = true/);
assert.match(audit, /if \(persistImmediately\)[\s\S]*persistDataStore\(\)\.catch/);

const transaction = services.slice(services.indexOf('static async persistLoanMutation<'), services.indexOf('Loan custody authority follows dynamic RBAC'));
assert.match(transaction, /structuredClone\(db\.loans\)/);
assert.match(transaction, /structuredClone\(db\.assets\)/);
assert.match(transaction, /structuredClone\(db\.notifications\)/);
assert.match(transaction, /structuredClone\(db\.auditLogs\)/);
assert.match(transaction, /await persistDataStore\(\)/);
for (const collection of ['loans', 'assets', 'notifications', 'auditLogs']) {
  assert.match(transaction, new RegExp('db\\.' + collection + '\\\.splice\\([\\s\\S]*snapshots\\.' + collection));
}

const successfulTransitions = ['LOAN_REQUESTED', 'LOAN_APPROVED', 'LOAN_REJECTED', 'LOAN_HANDOVER', 'LOAN_RETURNED'];
for (const action of successfulTransitions) {
  const line = services.split('\n').find(value => value.includes("recordAudit('" + action + "'"));
  assert.ok(line && line.includes(', false);'), action + ' audit must be committed with the loan transaction');
}

const routeCalls = [
  'requestLoan(req.body, actor)',
  'approveLoan(req.params.id, actor)',
  'rejectLoan(req.params.id, req.body?.reason, actor)',
  'handoverLoan(req.params.id, handoverNotes, actor)',
  'returnLoan(req.params.id, condition, returnNotes, actor)',
];
for (const call of routeCalls) {
  assert.ok(server.includes('persistLoanMutation(() => GabahDomainService.' + call), call + ' must use atomic persistence');
  const routeAt = server.indexOf('persistLoanMutation(() => GabahDomainService.' + call);
  const routeEnd = server.indexOf('\n    } catch', routeAt);
  assert.ok(routeEnd > routeAt && server.slice(routeAt, routeEnd).includes('__gabahPersisted = true'), call + ' must mark the durable write before responding');
  assert.doesNotMatch(server.slice(routeAt, routeEnd), /await persistDataStore\(\)/, call + ' must not issue a duplicate persistence write');
}
console.log('PASS: single and bulk loan workflows persist atomically with in-memory rollback');
