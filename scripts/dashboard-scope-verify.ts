import assert from 'node:assert/strict';
import type { Asset, Loan, Ticket, UserProfile } from '../src/types';
import { filterDashboardAssets, filterDashboardLoans, filterDashboardTickets, filterPersonalAssets, filterPersonalLoans, filterMaintenanceForRole, filterContractsForRole } from '../src/dashboard/roleDashboardScope';
import { isExactIdentityNameMatch } from '../src/utils/identityMatching';

const asset = (id: string, owner_division: string, category_type: 'IT' | 'GA' | 'License' | 'General') =>
  ({ id, owner_division, category_type } as Asset);
const loan = (id: string, owner_division: string, category_type: 'IT' | 'GA' | 'License' | 'General') =>
  ({ id, owner_division, category_type } as Loan);
const ticket = (id: string, category: 'IT' | 'GA' | 'RPC' | 'PIBC') =>
  ({ id, category } as Ticket);

const assets = [
  asset('it-device', 'IT', 'IT'),
  asset('it-license', 'IT', 'License'),
  asset('ga-device', 'GA', 'GA'),
  asset('rpc-device', 'RPC', 'General'),
  asset('pibc-device', 'PIBC', 'General'),
];
const loans = [
  loan('it-loan', 'IT', 'IT'),
  loan('ga-loan', 'GA', 'GA'),
  loan('rpc-loan', 'RPC', 'General'),
  loan('pibc-loan', 'PIBC', 'General'),
];
const tickets = [
  ticket('it-ticket', 'IT'),
  ticket('ga-ticket', 'GA'),
  ticket('sc-ticket', 'RPC'),
  ticket('pibc-ticket', 'PIBC'),
];

assert.deepEqual(filterDashboardAssets(assets, 'IT').map(x => x.id), ['it-device', 'it-license']);
assert.deepEqual(filterDashboardAssets(assets, 'GA').map(x => x.id), ['ga-device']);
assert.deepEqual(filterDashboardAssets(assets, 'RPC').map(x => x.id), []);
assert.deepEqual(filterDashboardAssets(assets, 'PIBC').map(x => x.id), []);
assert.equal(filterDashboardAssets(assets, 'Admin GABAH').length, assets.length);
assert.equal(filterDashboardAssets(assets, 'Auditor').length, assets.length);

assert.deepEqual(filterDashboardLoans(loans, 'IT').map(x => x.id), ['it-loan']);
assert.deepEqual(filterDashboardLoans(loans, 'GA').map(x => x.id), ['ga-loan']);
assert.deepEqual(filterDashboardLoans(loans, 'RPC').map(x => x.id), []);
assert.deepEqual(filterDashboardLoans(loans, 'PIBC').map(x => x.id), []);
assert.equal(filterDashboardLoans(loans, 'Auditor').length, loans.length);

assert.deepEqual(filterDashboardTickets(tickets, 'IT').map(x => x.id), ['it-ticket']);
assert.equal(filterDashboardTickets(tickets, 'Admin GABAH').length, tickets.length);
assert.equal(filterDashboardTickets(tickets, 'Auditor').length, tickets.length);
assert.equal(filterDashboardTickets([tickets[1]], 'GA').length, 1, 'preserve GA reporter-visible ticket');
assert.equal(filterDashboardTickets([tickets[2]], 'RPC').length, 0, 'branch location does not grant category-wide ticket visibility');
assert.equal(filterDashboardTickets([tickets[3]], 'PIBC').length, 0, 'branch location does not grant category-wide ticket visibility');

assert.equal(isExactIdentityNameMatch('Budi Santoso', 'budi santoso'), true);
assert.equal(isExactIdentityNameMatch('Budi', 'Budi Santoso'), false);
assert.equal(isExactIdentityNameMatch('Budi Santoso', 'Budi Santoso Putra'), false);
assert.equal(isExactIdentityNameMatch('', 'Budi Santoso'), false);


const user = {
  id: 'user-1',
  name: 'Alice Example',
  email: 'alice@example.test',
  role: 'Karyawan',
} as UserProfile;
const personalAssets = [
  { ...asset('assigned-to-alice', 'IT', 'IT'), assigned_to: { id: 'user-1', name: 'Alice Example', department: 'IT' } },
  { ...asset('assigned-to-alice-substring', 'IT', 'IT'), assigned_to: { id: 'user-2', name: 'Alice Example Putri', department: 'IT' } },
  asset('loaned-to-alice', 'GA', 'GA'),
] as Asset[];
const personalLoans = [
  { ...loan('alice-loan', 'GA', 'GA'), borrower_id: 'user-1', borrower_name: 'Alice Example', asset_id: 'loaned-to-alice', status: 'active' },
  { ...loan('similar-name-loan', 'GA', 'GA'), borrower_id: 'user-2', borrower_name: 'Alice Example Putri', asset_id: 'not-visible', status: 'active' },
] as Loan[];
assert.deepEqual(filterPersonalLoans(personalLoans, user).map(x => x.id), ['alice-loan']);
assert.deepEqual(filterPersonalAssets(personalAssets, personalLoans, user).map(x => x.id), ['assigned-to-alice', 'loaned-to-alice']);

const schedules = [
  { id: 'it-schedule', owner_division: 'IT' },
  { id: 'ga-schedule', owner_division: 'GA' },
  { id: 'sc-schedule', owner_division: 'RPC' },
  { id: 'pibc-schedule', owner_division: 'PIBC' },
];
assert.deepEqual(filterMaintenanceForRole(schedules, 'GA').map(x => x.id), ['ga-schedule']);
assert.deepEqual(filterMaintenanceForRole(schedules, 'RPC').map(x => x.id), []);
assert.equal(filterMaintenanceForRole(schedules, 'Auditor').length, schedules.length);

const contracts = [
  { id: 'it-contract', owner_division: 'IT', pic_user_id: 'other-user' },
  { id: 'ga-contract', owner_division: 'GA', pic_user_id: 'other-user' },
  { id: 'pic-contract', owner_division: 'RPC', pic_user_id: 'user-1' },
];
const gaUser = { ...user, role: 'GA' } as UserProfile;
assert.deepEqual(filterContractsForRole(contracts, gaUser).map(x => x.id), ['ga-contract', 'pic-contract'], 'division owners and assigned PICs can view their contracts');
assert.deepEqual(filterContractsForRole(contracts, user).map(x => x.id), ['pic-contract']);
assert.equal(filterContractsForRole(contracts, { ...user, role: 'Auditor' } as UserProfile).length, contracts.length);

console.log('Role dashboard scope: PASS (division, personal, maintenance, contract, and exact identity scopes)');
