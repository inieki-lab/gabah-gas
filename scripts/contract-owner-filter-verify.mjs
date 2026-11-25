import fs from 'node:fs';
import assert from 'node:assert/strict';

const contractsService = fs.readFileSync(new URL('../server/contracts.ts', import.meta.url), 'utf8');
const notificationLogMethod = contractsService.slice(contractsService.indexOf('getNotificationLogs('));
assert.ok(notificationLogMethod.includes('isSuperadminActor(user) || isAuditorActor(user)'), 'contract notification logs must use effective Superadmin, not stored Admin GABAH label');
assert.ok(!notificationLogMethod.includes("user.role === 'Admin GABAH'"), 'stored primary profile label must not grant global contract log visibility');

const source = fs.readFileSync(new URL('../src/components/views/ContractsView.tsx', import.meta.url), 'utf8');
const createModal = fs.readFileSync(new URL('../src/components/modals/CreateContractModal.tsx', import.meta.url), 'utf8');
const linkedTicketButton = source.indexOf('{canCreateLinkedTicket && (');
const linkedTicketAction = source.indexOf('onCreateLinkedTicket(contract)', linkedTicketButton);
const renewalDecisionButton = source.indexOf('{canDecide && (');

const checks = [
  [
    'Contract owner filter options come from persisted owner_division values',
    source.includes('const ownerDomains = useMemo')
      && source.includes('contract.owner_division')
      && source.includes("options: ['ALL', ...ownerDomains], label: 'Owner'"),
  ],
  [
    'Legacy file-store create permission is limited to IT and GA',
    source.includes("hasPermission('contracts.create', ['IT', 'GA'])")
      && !source.includes("hasPermission('contracts.create', ['IT', 'GA', 'Supply Chain")
      && !source.includes("hasPermission('contracts.create', ['IT', 'GA', 'PIBC"),
  ],
  [
    'Legacy file-store document upload permission is limited to IT and GA',
    source.includes("hasPermission('contracts.documents.upload', ['IT', 'GA'])")
      && !source.includes("hasPermission('contracts.documents.upload', ['IT', 'GA', 'Supply Chain")
      && !source.includes("hasPermission('contracts.documents.upload', ['IT', 'GA', 'PIBC"),
  ],
  [
    'Legacy file-store renewal decision permission is limited to IT and GA',
    source.includes("hasPermission('contracts.renewal.decide', ['IT', 'GA'])")
      && !source.includes("hasPermission('contracts.renewal.decide', ['IT', 'GA', 'Supply Chain")
      && !source.includes("hasPermission('contracts.renewal.decide', ['IT', 'GA', 'PIBC"),
  ],
  [
    'Contract creation form independently enforces contracts.create and Auditor deny-write',
    createModal.includes("const isReadOnly = GabahService.isReadOnly(currentUser)")
      && createModal.includes("const canCreateContract = !isReadOnly")
      && createModal.includes("currentUser.permission_keys!.includes('contracts.create')")
      && createModal.includes('if (!canCreateContract) return;')
      && createModal.includes('disabled={saving || !canCreateContract}')
      && createModal.includes("GabahService.hasLegacyCapability(currentUser, 'it')")
      && createModal.includes("GabahService.hasLegacyCapability(currentUser, 'ga')")
      && !createModal.includes("['IT', 'GA'].includes(currentUser.role)"),
  ],
  [
    'Contract creation owner choices are loaded from the configurable master, not a hard-coded role/division list',
    createModal.includes('gabahApi.getContractCreateOwnerOptions()')
      && createModal.includes('ownerDomains.map')
      && !createModal.includes('gabahApi.getDivisions()')
      && !createModal.includes('OWNER_DIVISION_OPTIONS')
      && !createModal.includes("['GA', 'IT', 'SC', 'PIBC', 'Sekretariat Direksi', 'Humas', 'Komersial', 'Keuangan', 'SDM']"),
  ],
  [
    'Contract creation filters location-only legacy codes and fails closed without an active owner',
    contractsService.includes("['SC', 'SUPPLY CHAIN', 'PIBC', 'RPC']")
      && createModal.includes('ownerDomains.some(option => option.code === ownerDivision)')
      && createModal.includes('Tidak ada owner domain yang diizinkan'),
  ],
  [
    'Creating a linked helpdesk ticket is gated by tickets.create, not contract renewal decision',
    source.includes("const canCreateLinkedTicket = !isReadOnly && hasPermission('tickets.create'")
      && linkedTicketButton >= 0
      && linkedTicketAction > linkedTicketButton
      && (renewalDecisionButton < 0 || linkedTicketButton < renewalDecisionButton),
  ],
];

let failed = 0;
for (const [name, passed] of checks) {
  console.log((passed ? 'PASS' : 'FAIL') + ' | ' + name);
  if (!passed) failed += 1;
}
console.log('TOTAL: ' + checks.length + ' | PASS: ' + (checks.length - failed) + ' | FAIL: ' + failed);
process.exit(failed === 0 ? 0 : 1);
