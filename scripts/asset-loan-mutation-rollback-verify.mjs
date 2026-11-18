import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');
const failures = [];
let passed = 0;
const assert = (name, condition) => {
  console.log(`[${condition ? 'PASS' : 'FAIL'}] ${name}`);
  if (condition) passed++; else failures.push(name);
};
function section(startMarker, endMarker) {
  const start = server.indexOf(startMarker);
  const end = server.indexOf(endMarker, start + 1);
  return start >= 0 ? server.slice(start, end < 0 ? undefined : end) : '';
}

const helper = section('type DomainMutationSnapshot', '  app.use(express.json())');
assert('mutation snapshot captures assets, loans, notifications, and audit logs', 
  ['assets', 'loans', 'notifications', 'auditLogs'].every(key => new RegExp(`\\b${key}: JSON\\.parse\\(JSON\\.stringify\\(db\\.${key}\\)\\)`).test(helper)));
assert('failed persistence restores all four in-memory collections', 
  ['assets', 'loans', 'notifications', 'auditLogs'].every(key => new RegExp(`db\\.${key}\\.splice\\(0, db\\.${key}\\.length, \.\.\.snapshot\\.${key}\\)`).test(helper)));
assert('failed persistence returns explicit HTTP 503 after rollback', /catch[\\s\\S]*?restoreDomainMutationState\\(snapshot\\)[\\s\\S]*?res\\.status\\(503\\)/.test(helper));

const createAsset = section("app.post('/api/assets',", "app.post('/api/assets/bulk-import'");
assert('single asset creation snapshots state before mutation and rolls back on persistence failure', /captureDomainMutationState\\(\\)[\\s\\S]*?GabahDomainService\\.createAsset[\\s\\S]*?persistMutationOrRollback\\(res, mutationSnapshot\\)/.test(createAsset));

const patchAsset = section("app.patch('/api/assets/:id',", "app.post('/api/assets/:id/assign'");
assert('asset PATCH snapshots before changing fields and uses rollback persistence', /captureDomainMutationState\\(\\)[\\s\\S]*?asset\\.updated_at[\\s\\S]*?persistMutationOrRollback\\(res, mutationSnapshot\\)/.test(patchAsset));

const loans = section("app.post('/api/loans',", '  // Helpdesk Tickets');
assert('loan request, approval, rejection, handover, and return use rollback persistence', 
  (loans.match(/persistMutationOrRollback\\(res, mutationSnapshot\\)/g) || []).length === 5);
assert('bulk loan request restores all affected collections when any item or persistence fails', 
  /const snapshots = captureDomainMutationState\\(\\)[\\s\\S]*?catch \\(bulkError\\)[\\s\\S]*?restoreDomainMutationState\\(snapshots\\)/.test(loans));
assert('all five loan state-changing endpoints capture snapshots before domain mutation',
  ['requestLoan', 'approveLoan', 'rejectLoan', 'handoverLoan', 'returnLoan'].every(method => {
    const i = loans.indexOf(`GabahDomainService.${method}(`);
    return i >= 0 && /captureDomainMutationState\\(\\)/.test(loans.slice(Math.max(0, i - 500), i));
  }));

console.log(`Asset and loan mutation rollback regression: ${passed}/${passed + failures.length} checks passed.`);
if (failures.length) process.exit(1);
