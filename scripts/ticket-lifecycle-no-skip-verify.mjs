import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('server.ts', 'utf8');
const ticketTypes = fs.readFileSync('src/types.ts', 'utf8');
const ticketView = fs.readFileSync('src/components/views/TicketsView.tsx', 'utf8');
const start = source.indexOf('const TICKET_TRANSITIONS: Record<string, string[]> = {');
const end = source.indexOf('\n  };', start);
assert.ok(start >= 0 && end > start, 'authoritative ticket transition map must exist');
const map = source.slice(start, end);
const expected = [
  "open: ['in_progress']",
  "assigned: ['in_progress']",
  "in_progress: ['pending_vendor', 'resolved', 'open']",
  "pending_vendor: ['in_progress']",
  "resolved: ['closed', 'open']",
  "closed: ['open']",
];
for (const transition of expected) {
  assert.ok(map.includes(transition), `expected lifecycle transition: ${transition}`);
}
for (const forbidden of [
  "open: ['in_progress', 'resolved'",
  "assigned: ['in_progress', 'resolved'",
  "in_progress: ['resolved', 'closed'",
]) {
  assert.ok(!map.includes(forbidden), `skipped lifecycle transition must stay forbidden: ${forbidden}`);
}
assert.ok(ticketTypes.includes("'assigned'") && ticketTypes.includes("'pending_vendor'"), 'TicketStatus must include legacy assigned and vendor-waiting states');
assert.ok(ticketView.includes("id: 'assigned'") && ticketView.includes("id: 'pending_vendor'"), 'Kanban must display assigned and vendor-waiting tickets');
assert.ok(ticketView.includes("onUpdateTicketStatus(ticket.id, 'pending_vendor')"), 'operator UI must expose the vendor-waiting transition');
assert.ok(ticketView.includes("ticket.status === 'pending_vendor' ? 'Lanjutkan"), 'operator UI must allow resuming vendor-waiting tickets');
console.log('PASS: ticket lifecycle supports vendor waiting, rejects skipped stages, and preserves explicit reopen transitions.');
