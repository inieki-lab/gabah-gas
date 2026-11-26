import assert from 'node:assert/strict';
import { db, seedInitialData } from '../server/db';
import { ContractDomainService } from '../server/contracts';
import { AssetNumberingEngine } from '../server/numbering';

seedInitialData();
AssetNumberingEngine._resetForTesting();

const actor = {
  id: 'TEST-IT-SECURITY-001',
  name: 'IT Security Test',
  role: 'IT',
  division: 'IT',
  department: 'IT',
} as any;

const created = ContractDomainService.createContract({
  title: 'Kontrak uji allowlist',
  vendor_name: 'Vendor Uji',
  contract_type: 'Maintenance',
  owner_division: 'IT',
  pic_user_id: actor.id,
  start_date: '2026-01-01',
  end_date: '2027-01-01',
} as any, actor);

const original = {
  id: created.id,
  contract_number: created.contract_number,
  owner_division: created.owner_division,
  pic_user_id: created.pic_user_id,
  restricted: created.restricted,
  status: created.status,
  renewal_outcome: created.renewal_outcome,
  created_by: created.created_by,
  documents: created.documents,
  milestones: created.milestones,
  escalation_user_id: created.escalation_user_id,
};

const updated = ContractDomainService.updateContract(created.id, {
  title: 'Judul kontrak diperbarui',
  owner_division: 'GA',
  pic_user_id: 'ATTACKER',
  restricted: true,
  status: 'terminated',
  renewal_outcome: 'terminated',
  created_by: 'ATTACKER',
  contract_number: 'CTR-2026-9999',
  documents: [{ id: 'INJECTED' }],
  milestones: [{ id: 'INJECTED' }],
  escalation_user_id: 'ATTACKER',
  updated_at: '2000-01-01T00:00:00.000Z',
} as any, actor);

assert.equal(updated.title, 'Judul kontrak diperbarui', 'allowlisted business metadata remains editable');
for (const key of Object.keys(original) as Array<keyof typeof original>) {
  if (key === 'status') {
    // updateContract recomputes status from end_date; the client-supplied
    // "terminated" value must be ignored, but a server-derived status may change.
    assert.notEqual(updated.status, 'terminated', 'client must not force contract lifecycle status');
  } else {
    assert.deepEqual((updated as any)[key], original[key], `protected field ${key} must not be client-mutable`);
  }
}

console.log('Contract update mass-assignment verification: PASS (allowlisted title update; protected ownership, identity, governance, lifecycle and relations unchanged)');
