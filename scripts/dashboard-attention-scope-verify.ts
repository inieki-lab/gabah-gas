import assert from 'node:assert/strict';
import { filterDashboardAttentionItems } from '../server/dashboard-attention-scope';

const items = [
  { id: 'ticket-own', link_type: 'ticket', link_id: 't-own' },
  { id: 'ticket-assigned', link_type: 'ticket', link_id: 't-assigned' },
  { id: 'ticket-owner-scope', link_type: 'ticket', link_id: 't-it' },
  { id: 'ticket-other', link_type: 'ticket', link_id: 't-ga' },
  { id: 'loan-own', link_type: 'loan', link_id: 'l-own' },
  { id: 'loan-owner-scope', link_type: 'loan', link_id: 'l-it' },
  { id: 'loan-other', link_type: 'loan', link_id: 'l-ga' },
  { id: 'asset-visible', link_type: 'asset', link_id: 'a-visible' },
  { id: 'asset-hidden', link_type: 'asset', link_id: 'a-hidden' },
  { id: 'missing-record', link_type: 'ticket', link_id: 'missing' },
  { id: 'unknown-type', link_type: 'reconciliation', link_id: 'x' },
];

const scope = {
  actorId: 'user-1',
  isGlobalReader: false,
  visibleAssetIds: new Set(['a-visible']),
  loans: [
    { id: 'l-own', borrower_id: 'user-1', owner_division: 'GA' },
    { id: 'l-it', borrower_id: 'user-2', owner_division: 'IT' },
    { id: 'l-ga', borrower_id: 'user-2', owner_division: 'GA' },
  ],
  tickets: [
    { id: 't-own', reporter_id: 'user-1', category: 'GA' },
    { id: 't-assigned', reporter_id: 'user-2', assigned_agent_id: 'user-1', category: 'GA' },
    { id: 't-it', reporter_id: 'user-2', category: 'IT' },
    { id: 't-ga', reporter_id: 'user-2', category: 'GA' },
  ],
  canReadOwnerScope: (module: 'loans' | 'tickets', owner: string) => owner === 'IT',
};

assert.deepEqual(
  filterDashboardAttentionItems(items, scope).map(item => item.id),
  ['ticket-own', 'ticket-assigned', 'ticket-owner-scope', 'loan-own', 'loan-owner-scope', 'asset-visible'],
  'non-global users see only personal, assigned, module-owner-scoped, and visible-asset attention cards',
);
assert.equal(filterDashboardAttentionItems(items, { ...scope, isGlobalReader: true }).length, items.length,
  'Superadmin/Auditor global read scope preserves all attention cards');
console.log('Dashboard attention scope: PASS (personal, assigned, module scope, asset scope, global reader, fail-closed)');
