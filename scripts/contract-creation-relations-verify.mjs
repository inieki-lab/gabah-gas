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

console.log('PASS | invalid/missing/inactive PIC rejected');
console.log('PASS | unknown escalation user rejected; supported cross-division escalation retained');
console.log('PASS | missing and cross-division parent contract rejected');
console.log('PASS | invalid date, reminder thresholds, and negative contract value rejected');
console.log('PASS | forged document/milestone metadata ignored');
console.log('TOTAL: 5 | PASS: 5 | FAIL: 0');
