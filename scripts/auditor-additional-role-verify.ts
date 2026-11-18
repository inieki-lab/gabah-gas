import assert from 'node:assert/strict';
import { GabahService } from '../src/services/gabahService';
import type { Asset, UserProfile } from '../src/types';

const asset = { id: 'ASSET-IT-001', owner_division: 'IT' } as Asset;
const auditorWithOperationalRole = {
  id: 'USR-AUDITOR-CAPABILITY',
  name: 'Auditor Capability Test',
  email: 'auditor-capability-test@example.invalid',
  role: 'IT',
  role_label: 'IT + Auditor',
  department: 'IT',
  avatar: '',
  role_keys: ['it', 'auditor'],
  permission_keys: ['assets.update', 'loans.approve', 'tickets.update'],
} as UserProfile;

assert.equal(GabahService.isAuditor(auditorWithOperationalRole), true);
assert.equal(GabahService.canEditAsset(auditorWithOperationalRole, asset), false,
  'additional Auditor must deny asset edit even when IT grants assets.update');
assert.equal(GabahService.canApproveLoan(auditorWithOperationalRole), false,
  'additional Auditor must deny loan approval even when another role grants loans.approve');
assert.equal(GabahService.canManageTickets(auditorWithOperationalRole), false,
  'additional Auditor must deny ticket writes even when another role grants tickets.update');

const primaryAuditor = {
  ...auditorWithOperationalRole,
  role: 'Auditor',
  role_keys: undefined,
} as UserProfile;
assert.equal(GabahService.isAuditor(primaryAuditor), true);
assert.equal(GabahService.canEditAsset(primaryAuditor, asset), false);

const operationalUser = {
  ...auditorWithOperationalRole,
  role: 'IT',
  role_keys: ['it'],
} as UserProfile;
assert.equal(GabahService.isAuditor(operationalUser), false);
assert.equal(GabahService.canEditAsset(operationalUser, asset), true,
  'non-Auditor with effective assets.update retains the edit action');

console.log('Auditor additional-role deny-write regression: 6/6 PASS');
