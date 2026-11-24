import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { db, seedInitialData } from '../server/db.ts';
import { ContractDomainService } from '../server/contracts.ts';

// Isolated in-memory fixture: no production database or user input is used.
seedInitialData();
const actor = db.users.find(user => user.id === 'USR-03');
assert.ok(actor, 'IT actor fixture exists');

// Permission regression: update-only RBAC grants must never imply create authority.
const contractSource = readFileSync(new URL('../server/contracts.ts', import.meta.url), 'utf8');
const notificationSource = readFileSync(new URL('../server/notifications/notificationService.ts', import.meta.url), 'utf8');
const persistenceSource = readFileSync(new URL('../server/persistence.ts', import.meta.url), 'utf8');
const numberingSource = readFileSync(new URL('../server/numbering.ts', import.meta.url), 'utf8');
const serverSource = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const contractSequenceMigration = readFileSync(new URL('../server/migrations/104_contract_number_sequences.sql', import.meta.url), 'utf8');
const createStart = contractSource.indexOf('export function canCreateContract(');
const createEnd = contractSource.indexOf('// SEC-08:', createStart);
const createGuard = contractSource.slice(createStart, createEnd);
assert.ok(createGuard.includes("'contracts.create'"), 'Create permission must be checked explicitly');
assert.ok(!createGuard.includes("'contracts.update'"), 'Update permission must not imply create authority');
assert.ok(contractSource.includes("id: `LOG-CTR-${randomUUID()}`"), 'Contract audit records must use UUID identifiers');
assert.ok(notificationSource.includes("id: `AUD-CTR-${crypto.randomUUID()}`"), 'Contract reminder audit records must use UUID identifiers');
assert.ok(notificationSource.includes("id: `NTF-${crypto.randomUUID()}`"), 'In-app contract reminder notification IDs must use UUID identifiers');
assert.match(persistenceSource, /INSERT INTO contract_number_sequences \(sequence_year, last_sequence\)[\s\S]*ON CONFLICT \(sequence_year\)[\s\S]*last_sequence = contract_number_sequences\.last_sequence \+ 1[\s\S]*RETURNING last_sequence/);
assert.match(contractSource, /await reserveContractNumberSequence\(numberingYear\)/);
assert.match(contractSource, /isPostgresFailureLatched\(\)[\s\S]*throw Object\.assign/);
assert.match(numberingSource, /formatReservedContractNumber/);
assert.match(serverSource, /await ContractDomainService\.createContract\(req\.body, actor\)/);
assert.match(contractSequenceMigration, /CREATE TABLE IF NOT EXISTS contract_number_sequences/);
assert.match(contractSequenceMigration, /sequence_year INTEGER PRIMARY KEY/);


const base = {
  contract_type: 'Maintenance',
  title: '😀'.repeat(255),
  vendor_name: 'Fixture Vendor',
  owner_division: 'IT',
  pic_user_id: 'USR-03',
  start_date: '2026-01-01',
  end_date: '2027-01-01',
  notice_period_days: 30,
  contract_value: 1000000,
  reminder_config: { reminder1_days: 60, reminder2_days: 35, reminder3_days: 7 },
};

async function mustReject(payload, expectedMessage) {
  await assert.rejects(
    () => ContractDomainService.createContract({ ...base, ...payload }, actor),
    new RegExp(expectedMessage),
  );
}

await mustReject({ pic_user_id: 'USR-NOT-FOUND' }, /PIC kontrak tidak ditemukan/);
const inactivePic = db.users.find(user => user.id === 'USR-03');
inactivePic.is_active = false;
await mustReject({}, /PIC kontrak tidak ditemukan/);
inactivePic.is_active = true;

await mustReject({ escalation_user_id: 'USR-NOT-FOUND' }, /Pengguna eskalasi tidak ditemukan/);
await mustReject({ parent_contract_id: 'CTR-NOT-FOUND' }, /Kontrak induk tidak ditemukan/);
await mustReject({ parent_contract_id: 'CTR-SEED-002' }, /divisi pemilik yang sama/);
await mustReject({ start_date: '2027-02-01', end_date: '2027-01-01' }, /Periode kontrak tidak valid/);
await mustReject({ reminder_config: { reminder1_days: 7, reminder2_days: 35, reminder3_days: 60 } }, /Konfigurasi reminder/);
await mustReject({ contract_value: -1 }, /Notice period dan nilai kontrak/);
await mustReject({ contract_value: Number.MAX_SAFE_INTEGER + 1 }, /Notice period dan nilai kontrak/);
await mustReject({ notice_period_days: 2147483648 }, /Notice period dan nilai kontrak/);
await mustReject({ reminder_config: { reminder1_days: 2147483648, reminder2_days: 35, reminder3_days: 7 } }, /Konfigurasi reminder/);

await mustReject({ auto_renewal: 'false' }, /auto-renewal harus berupa boolean/);
await mustReject({ restricted: 'false' }, /Flag restricted harus berupa boolean/);

await mustReject({ title: 'x'.repeat(256) }, /Judul kontrak wajib diisi dan maksimal 255 karakter/);
await mustReject({ vendor_name: 'x'.repeat(256) }, /Nama vendor wajib diisi dan maksimal 255 karakter/);
await mustReject({ contract_type: 'x'.repeat(101) }, /Jenis kontrak maksimal 100 karakter/);
await mustReject({ title: 'NUL' + String.fromCharCode(0) + 'title' }, /Judul kontrak harus berupa teks dan tidak boleh mengandung karakter NUL/);
await mustReject({ notes: 'NUL' + String.fromCharCode(0) + 'notes' }, /Catatan kontrak harus berupa teks dan tidak boleh mengandung karakter NUL/);


const created = await ContractDomainService.createContract({
  ...base,
  parent_contract_id: 'CTR-SEED-001',
  escalation_user_id: 'USR-01', // Cross-division escalation is intentionally supported by the UI.
  documents: [{ id: 'FORGED-DOC', file_ref: '../../other-contract/private.pdf' }],
  milestones: [{ id: 'FORGED-MILESTONE', status: 'completed' }],
}, actor);

assert.match(created.contract_number, /^CTR-\d{4}-\d{4}$/);
assert.equal(created.parent_contract_id, 'CTR-SEED-001');
assert.equal(created.escalation_user_id, 'USR-01');
assert.deepEqual(created.documents, [], 'Client-supplied document metadata must not be trusted on creation');
assert.deepEqual(created.milestones, [], 'Client-supplied milestone state must not be trusted on creation');
assert.equal(db.contracts.length, 6, 'Only the valid fixture contract should be added');
const contractAudit = db.auditLogs.find(log => log.entity_id === created.id && log.action === 'CONTRACT_CREATED');
assert.ok(contractAudit, 'Contract creation must append an audit record');
assert.match(contractAudit.id, /^LOG-CTR-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  'Contract audit ID must use a cryptographically generated UUID');

const protectedUpdate = ContractDomainService.updateContract(created.id, {
  owner_division: 'SC',
  pic_user_id: 'USR-SC',
  created_by: 'USR-SC',
  contract_number: 'FORGED-NUMBER',
  notes: 'Protected fields must be ignored while allowed notes update.',
}, actor);
assert.equal(protectedUpdate.owner_division, 'IT');
assert.equal(protectedUpdate.pic_user_id, 'USR-03');
assert.notEqual(protectedUpdate.contract_number, 'FORGED-NUMBER');
assert.equal(protectedUpdate.notes, 'Protected fields must be ignored while allowed notes update.');
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
assert.throws(() => ContractDomainService.updateContract(created.id, { title: 'x'.repeat(256) }, actor), /Judul kontrak wajib diisi dan maksimal 255 karakter/);
assert.throws(() => ContractDomainService.updateContract(created.id, { contract_type: 'x'.repeat(101) }, actor), /Jenis kontrak maksimal 100 karakter/);
assert.throws(() => ContractDomainService.updateContract(created.id, { notice_period_days: 2147483648 }, actor), /Notice period harus berupa bilangan bulat non-negatif/);
assert.throws(() => ContractDomainService.updateContract(created.id, { contract_value: Number.MAX_SAFE_INTEGER + 1 }, actor), /Nilai kontrak harus berupa angka non-negatif yang valid/);
assert.throws(() => ContractDomainService.updateContract(created.id, { reminder_config: { reminder1_days: 2147483648, reminder2_days: 35, reminder3_days: 7 } }, actor), /Konfigurasi reminder/);

assert.throws(() => ContractDomainService.updateContract(created.id, { notes: 'NUL' + String.fromCharCode(0) + 'notes' }, actor), /Catatan kontrak harus berupa teks dan tidak boleh mengandung karakter NUL/);

assert.throws(
  () => ContractDomainService.updateContract(created.id, { auto_renewal: 'false' }, actor),
  /auto-renewal harus berupa boolean/,
);
assert.throws(
  () => ContractDomainService.updateContract(created.id, { renewal_notes: 'x'.repeat(2001) }, actor),
  /Catatan renewal maksimal 2000 karakter/,
);
assert.throws(
  () => ContractDomainService.decideRenewal(created.id, 'not_renewed', {}, null, actor),
  /Catatan keputusan renewal maksimal 2000 karakter/,
);
assert.throws(
  () => ContractDomainService.decideRenewal(created.id, 'not_renewed', 'x'.repeat(2001), null, actor),
  /Catatan keputusan renewal maksimal 2000 karakter/,
);

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

console.log('PASS | contract creation audit ID uses UUID v4');
console.log('PASS | contract reminder audit and in-app notification IDs use UUID');
console.log('PASS | update-only permission does not imply contract creation');
console.log('PASS | invalid/missing/inactive PIC rejected');
console.log('PASS | unknown escalation user rejected; supported cross-division escalation retained');
console.log('PASS | missing and cross-division parent contract rejected');
console.log('PASS | invalid date, reminder thresholds, and negative contract value rejected');
console.log('PASS | forged document/milestone metadata ignored on creation');
console.log('PASS | update allowlist ignores protected fields and validates editable values');
console.log('PASS | document metadata validated and uploader identity is server-derived');
console.log('PASS | milestone type/date/amount validated and status/id are server-derived');
console.log('PASS | auto-renewal/restricted flags and renewal notes are strictly validated');
console.log('TOTAL: 12 | PASS: 12 | FAIL: 0');
