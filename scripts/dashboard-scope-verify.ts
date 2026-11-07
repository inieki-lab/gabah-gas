import assert from 'node:assert/strict';
import type { Asset, Loan, Ticket } from '../src/types';
import { filterDashboardAssets, filterDashboardLoans, filterDashboardTickets } from '../src/dashboard/roleDashboardScope';
import { isExactIdentityNameMatch } from '../src/utils/identityMatching';

const asset = (id: string, owner_division: string, category_type: 'IT' | 'GA' | 'License' | 'General') =>
  ({ id, owner_division, category_type } as Asset);
const loan = (id: string, owner_division: string, category_type: 'IT' | 'GA' | 'License' | 'General') =>
  ({ id, owner_division, category_type } as Loan);
const ticket = (id: string, category: 'IT' | 'GA' | 'SC' | 'PIBC') =>
  ({ id, category } as Ticket);

const assets = [
  asset('it-device', 'IT', 'IT'),
  asset('it-license', 'IT', 'License'),
  asset('ga-device', 'GA', 'GA'),
  asset('sc-device', 'SC', 'General'),
  asset('pibc-device', 'PIBC', 'General'),
];
const loans = [
  loan('it-loan', 'IT', 'IT'),
  loan('ga-loan', 'GA', 'GA'),
  loan('sc-loan', 'SC', 'General'),
  loan('pibc-loan', 'PIBC', 'General'),
];
const tickets = [
  ticket('it-ticket', 'IT'),
  ticket('ga-ticket', 'GA'),
  ticket('sc-ticket', 'SC'),
  ticket('pibc-ticket', 'PIBC'),
];

assert.deepEqual(filterDashboardAssets(assets, 'IT').map(x => x.id), ['it-device', 'it-license']);
assert.deepEqual(filterDashboardAssets(assets, 'GA').map(x => x.id), ['ga-device']);
assert.deepEqual(filterDashboardAssets(assets, 'Supply Chain').map(x => x.id), ['sc-device']);
assert.deepEqual(filterDashboardAssets(assets, 'PIBC').map(x => x.id), ['pibc-device']);
assert.equal(filterDashboardAssets(assets, 'Admin GABAH').length, assets.length);
assert.equal(filterDashboardAssets(assets, 'Auditor').length, assets.length);

assert.deepEqual(filterDashboardLoans(loans, 'IT').map(x => x.id), ['it-loan']);
assert.deepEqual(filterDashboardLoans(loans, 'GA').map(x => x.id), ['ga-loan']);
assert.deepEqual(filterDashboardLoans(loans, 'Supply Chain').map(x => x.id), ['sc-loan']);
assert.deepEqual(filterDashboardLoans(loans, 'PIBC').map(x => x.id), ['pibc-loan']);
assert.equal(filterDashboardLoans(loans, 'Auditor').length, loans.length);

assert.equal(filterDashboardTickets(tickets, 'IT').length, tickets.length);
assert.equal(filterDashboardTickets(tickets, 'Admin GABAH').length, tickets.length);
assert.equal(filterDashboardTickets(tickets, 'Auditor').length, tickets.length);
assert.equal(filterDashboardTickets([tickets[1]], 'GA').length, 1, 'preserve GA reporter-visible ticket');
assert.equal(filterDashboardTickets([tickets[2]], 'Supply Chain').length, 1, 'preserve SC reporter-visible ticket');
assert.equal(filterDashboardTickets([tickets[3]], 'PIBC').length, 1, 'preserve PIBC reporter-visible ticket');

assert.equal(isExactIdentityNameMatch('Budi Santoso', 'budi santoso'), true);
assert.equal(isExactIdentityNameMatch('Budi', 'Budi Santoso'), false);
assert.equal(isExactIdentityNameMatch('Budi Santoso', 'Budi Santoso Putra'), false);
assert.equal(isExactIdentityNameMatch('', 'Budi Santoso'), false);

console.log('Role dashboard scope: PASS (asset, loan, ticket visibility, exact identity matching)');
