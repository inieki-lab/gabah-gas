import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('server.ts', 'utf8');
const start = source.indexOf('const TICKET_TRANSITIONS: Record<string, string[]> = {');
const end = source.indexOf('\n  };', start);
assert.ok(start >= 0 && end > start, 'authoritative ticket transition map must exist');
const map = source.slice(start, end);
const expected = [
  "open: ['in_progress']",
  "assigned: ['in_progress']",
  "in_progress: ['resolved', 'open']",
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
console.log('PASS: ticket lifecycle rejects direct resolve/close skips and preserves explicit reopen transitions.');
