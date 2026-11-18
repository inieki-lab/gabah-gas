import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');
const services = fs.readFileSync('server/services.ts', 'utf8');
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
assert('snapshot captures assets, loans, notifications, and audit logs',
  ['assets', 'loans', 'notifications', 'auditLogs'].every(key => helper.includes(`${key}: JSON.parse(JSON.stringify(db.${key}))`)));
assert('rollback restores all four in-memory collections',
  ['assets', 'loans', 'notifications', 'auditLogs'].every(key => helper.includes(`db.${key}.splice(0, db.${key}.length, ...snapshot.${key})`)));
assert('persistence failure rolls back before returning HTTP 503',
  helper.indexOf('restoreDomainMutationState(snapshot);') >= 0
  && helper.indexOf('restoreDomainMutationState(snapshot);') < helper.indexOf('res.status(503)'));

const createAsset = section("app.post('/api/assets',", "app.post('/api/assets/bulk-import'");
assert('asset creation snapshots before mutation and uses rollback persistence',
  createAsset.indexOf('captureDomainMutationState()') >= 0
  && createAsset.indexOf('captureDomainMutationState()') < createAsset.indexOf('GabahDomainService.createAsset')
  && createAsset.includes('persistMutationOrRollback(res, mutationSnapshot)'));

const bulkImport = section("app.post('/api/assets/bulk-import',", "app.get('/api/assets/:id',");
assert('bulk asset import snapshots before processing rows and rolls back on failed persistence',
  bulkImport.indexOf('captureDomainMutationState()') >= 0
  && bulkImport.indexOf('captureDomainMutationState()') < bulkImport.indexOf('for (let i = 0; i < rows.length')
  && bulkImport.includes('persistMutationOrRollback(res, mutationSnapshot)'));
assert('successful asset create and bulk audit events defer fire-and-forget persistence',
  services.includes("actor, newAsset.id, false);")
  && bulkImport.includes('actor, existing.id, false);')
  && bulkImport.includes('actor, asset.id, false);');

const patchAsset = section("app.patch('/api/assets/:id',", "app.post('/api/assets/:id/assign'");
assert('asset PATCH restores earlier field changes when a later location validation fails',
  patchAsset.includes('restoreDomainMutationState(mutationSnapshot);')
  && patchAsset.indexOf('asset.managing_unit_id = uid;') < patchAsset.indexOf('restoreDomainMutationState(mutationSnapshot);'));

assert('asset PATCH snapshots before mutation and uses rollback persistence',
  patchAsset.indexOf('captureDomainMutationState()') >= 0
  && patchAsset.indexOf('captureDomainMutationState()') < patchAsset.indexOf('asset.managing_unit_id =')
  && patchAsset.includes('persistMutationOrRollback(res, mutationSnapshot)'));

assert('successful loan transition audit events defer persistence to the awaited route write',
  ["LOAN_REQUESTED", "LOAN_APPROVED", "LOAN_REJECTED", "LOAN_HANDOVER", "LOAN_RETURNED"]
    .every(action => {
      const line = services.split(String.fromCharCode(10)).find(item => item.includes(`this.recordAudit('${action}'`));
      return Boolean(line && line.includes(', false);'));
    }));

const loans = section("app.post('/api/loans',", '  // Helpdesk Tickets');
assert('request, approve, reject, handover, and return use rollback persistence',
  (loans.match(/persistMutationOrRollback/g) || []).length === 6);
assert('bulk loan request restores snapshots on any failure',
  loans.includes('const snapshots = captureDomainMutationState();')
  && loans.includes('restoreDomainMutationState(snapshots);'));
assert('all five loan state-changing operations snapshot before domain mutation',
  ['requestLoan', 'approveLoan', 'rejectLoan', 'handoverLoan', 'returnLoan'].every(method => {
    const mutation = loans.indexOf(`GabahDomainService.${method}(`);
    const snapshot = loans.lastIndexOf('captureDomainMutationState()', mutation);
    return mutation >= 0 && snapshot >= 0 && mutation - snapshot < 600;
  }));

console.log(`Asset and loan mutation rollback regression: ${passed}/${passed + failures.length} checks passed.`);
if (failures.length) process.exit(1);
