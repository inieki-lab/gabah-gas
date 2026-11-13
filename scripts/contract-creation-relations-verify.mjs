import assert from 'node:assert/strict';
import { db, seedInitialData } from '../server/db.ts';
import { ContractDomainService } from '../server/contracts.ts';

// Isolated in-memory fixture: no production database or user input is used.
seedInitialData();
const actor = db.users.find(user => user.id === 'USR-03');
assert.ok(actor, 'IT actor fixture exists');

const base = {
  contract_type: 'Maintenance',
  title: 'Automated relation test',
  vendor_name: 'Fixture Vendor',
  owner_division: 'IT',
  pic_user_id: 'USR-03',
  start_date: '2026-01-01',
  end_date: '2027-01-01',
  notice_period_days: 30,
  contract_value: 1000000,
  reminder_config: { reminder1_days: 60, reminder2_days: 35, reminder3_days: 7 },
};

function mustReject(payload, expectedMessage) {
  assert.throws(
    () => ContractDomainService.createContract({ ...base, ...payload }, actor),
    new RegExp(expectedMessage),
  );
}

mustReject({ pic_user_id: 'USR-NOT-FOUND' }, /PIC kontrak tidak ditemukan/);
const inactivePic = db.users.find(user => user.id === 'USR-03');
inactivePic.is_active = false;
mustReject({}, /PIC kontrak tidak ditemukan/);
inactivePic.is_active = true;

mustReject({ escalation_user_id: 'USR-NOT-FOUND' }, /Pengguna eskalasi tidak ditemukan/);
mustReject({ parent_contract_id: 'CTR-NOT-FOUND' }, /Kontrak induk tidak ditemukan/);
mustReject({ parent_contract_id: 'CTR-SEED-002' }, /divisi pemilik yang sama/);
mustReject({ start_date: '2027-02-01', end_date: '2027-01-01' }, /Periode kontrak tidak valid/);
mustReject({ reminder_config: { reminder1_days: 7, reminder2_days: 35, reminder3_days: 60 } }, /Konfigurasi reminder/);
mustReject({ contract_value: -1 }, /Notice period dan nilai kontrak/);

const created = ContractDomainService.createContract({
  ...base,
  parent_contract_id: 'CTR-SEED-001',
  escalation_user_id: 'USR-01', // Cross-division escalation is intentionally supported by the UI.
  documents: [{ id: 'FORGED-DOC', file_ref: '../../other-contract/private.pdf' }],
  milestones: [{ id: 'FORGED-MILESTONE', status: 'completed' }],
}, actor);

assert.equal(created.parent_contract_id, 'CTR-SEED-001');
assert.equal(created.escalation_user_id, 'USR-01');
assert.deepEqual(created.documents, [], 'Client-supplied document metadata must not be trusted on creation');
assert.deepEqual(created.milestones, [], 'Client-supplied milestone state must not be trusted on creation');
assert.equal(db.contracts.length, 6, 'Only the valid fixture contract should be added');

assert.throws(
  () => ContractDomainService.updateContract(created.id, { owner_division: 'SC' }, actor),
  /Field kontrak tidak dapat diubah/,
);
assert.throws(
  () => ContractDomainService.updateContract(created.id, { contract_value: -10 }, actor),
  /Nilai kontrak harus/,
);
assert.throws(
  () => ContractDomainService.updateContract(created.id, { start_date: '2028-01-01' }, actor),
  /Periode kontrak tidak valid/,
);
assert.throws(
  () => ContractDomainService.updateContract(created.id, { escalation_user_id: 'USR-NOT-FOUND' }, actor),
  /Pengguna eskalasi tidak ditemukan/,
);
const updated = ContractDomainService.updateContract(created.id, { title: 'Updated fixture title', contract_value: 2000000 }, actor);
assert.equal(updated.title, 'Updated fixture title');
assert.equal(updated.contract_value, 2000000);

assert.throws(
  () => ContractDomainService.addDocument(created.id, { kind: 'forged', file_name: 'x.pdf', file_ref: 'memory://x' }, actor),
  /Metadata dokumen kontrak tidak valid/,
);
const document = ContractDomainService.addDocument(created.id, {
  kind: 'supporting_document', file_name: 'valid.pdf', file_ref: 'memory://fixture',
}, actor).documents.at(-1);
assert.equal(document.uploaded_by, actor.id, 'Document uploader must be session-derived');

assert.throws(
  () => ContractDomainService.addMilestone(created.id, { type: 'forged', title: 'x', due_date: '2027-02-01' }, actor),
  /Data milestone kontrak tidak valid/,
);
assert.throws(
  () => ContractDomainService.addMilestone(created.id, { type: 'payment', title: 'x', due_date: '2027-02-01', amount: -1 }, actor),
  /Data milestone kontrak tidak valid/,
);
const milestone = ContractDomainService.addMilestone(created.id, {
  type: 'payment', title: 'Fixture payment', due_date: '2027-02-01',
  id: 'FORGED-ID', status: 'completed',
}, actor).milestones.at(-1);
assert.notEqual(milestone.id, 'FORGED-ID');
assert.equal(milestone.status, 'pending');

console.log('PASS | invalid/missing/inactive PIC rejected');
console.log('PASS | unknown escalation user rejected; supported cross-division escalation retained');
console.log('PASS | missing and cross-division parent contract rejected');
console.log('PASS | invalid date, reminder thresholds, and negative contract value rejected');
console.log('PASS | forged document/milestone metadata ignored on creation');
console.log('PASS | update allowlist blocks protected fields and validates editable values');
console.log('PASS | document metadata validated and uploader identity is server-derived');
console.log('PASS | milestone type/date/amount validated and status/id are server-derived');
console.log('TOTAL: 8 | PASS: 8 | FAIL: 0');
