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


const canonicalItEmployee = {
  ...operationalUser,
  role: 'Karyawan',
  role_keys: ['it'],
  permission_keys: undefined,
} as UserProfile;
assert.equal(GabahService.canEditAsset(canonicalItEmployee, asset), true,
  'file-store UI fallback must honor IT secondary capability on Karyawan profile');
assert.equal(GabahService.canManageTickets(canonicalItEmployee), true,
  'file-store UI fallback must expose IT ticket actions to Karyawan with IT capability');
assert.equal(GabahService.isTicketVisibleToUser({ id: 'TKT-IT', category: 'IT', reporter_id: 'OTHER' } as any, canonicalItEmployee), true,
  'IT secondary capability must expose the IT ticket queue in file-store mode');

const canonicalGaEmployee = {
  ...operationalUser,
  role: 'Karyawan',
  role_keys: ['ga'],
  permission_keys: undefined,
} as UserProfile;
const gaAsset = { id: 'ASSET-GA-001', owner_division: 'GA' } as Asset;
assert.equal(GabahService.canEditAsset(canonicalGaEmployee, gaAsset), true,
  'file-store UI fallback must honor GA secondary capability on Karyawan profile');
assert.equal(GabahService.canEditAsset(canonicalGaEmployee, asset), false,
  'GA may not edit IT assets through the legacy UI fallback');
assert.equal(GabahService.canManageTickets(canonicalGaEmployee), true,
  'file-store UI fallback must expose GA ticket actions to Karyawan with GA capability');

const customReadOnlyRole = {
  ...canonicalItEmployee,
  id: 'USR-CUSTOM-READONLY',
  role: 'Karyawan',
  role_keys: ['custom_facilities_operator'],
  permission_keys: ['security.read_only', 'assets.update', 'loans.approve', 'tickets.update'],
} as UserProfile;
assert.equal(GabahService.isAuditor(customReadOnlyRole), false,
  'custom read-only roles must not be misidentified as the Auditor function');
assert.equal(GabahService.isReadOnly(customReadOnlyRole), true,
  'security.read_only must apply to any custom Dynamic RBAC role');
assert.equal(GabahService.canEditAsset(customReadOnlyRole, asset), false,
  'generic read-only policy must deny asset edits even when another role grants assets.update');
assert.equal(GabahService.canApproveLoan(customReadOnlyRole), false,
  'generic read-only policy must deny loan approval even when another role grants loans.approve');
assert.equal(GabahService.canManageTickets(customReadOnlyRole), false,
  'generic read-only policy must deny ticket mutations even when another role grants tickets.update');

console.log('Read-only policy and Auditor additional-role deny-write regression: PASS');
