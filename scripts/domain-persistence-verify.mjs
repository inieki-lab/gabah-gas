import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('server.ts', 'utf8');

function route(start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, 'route boundaries must exist: ' + start);
  return source.slice(from, to);
}

const vendorCreate = route("app.post('/api/vendors'", "app.patch('/api/vendors/:id'");
const vendorUpdate = route("app.patch('/api/vendors/:id'", "// Knowledge Base");
const knowledgeCreate = route("app.post('/api/knowledge'", "app.patch('/api/knowledge/:id'");
const knowledgeUpdate = route("app.patch('/api/knowledge/:id'", "app.post('/api/knowledge/:id/vote'");
const knowledgeVote = route("app.post('/api/knowledge/:id/vote'", "app.post('/api/knowledge/:id/view'");
const knowledgeView = route("app.post('/api/knowledge/:id/view'", "// Notifications");
const passwordChange = route("app.post('/api/auth/change-password'", "app.get('/api/auth/me'");

for (const [name, body] of [
  ['vendor create', vendorCreate],
  ['vendor update', vendorUpdate],
  ['knowledge create', knowledgeCreate],
  ['knowledge update', knowledgeUpdate],
  ['knowledge vote', knowledgeVote],
  ['knowledge view', knowledgeView],
]) {
  assert.match(body, /await persistDataStore\(\)/, name + ' must await persistence');
  assert.doesNotMatch(body, /persistDataStore\(\)\.catch\(\(\) => \{\}\)/, name + ' must not hide persistence failures');
  assert.match(body, /catch \(persistenceError\)/, name + ' must handle persistence failure');
}

assert.match(vendorCreate, /splice\(index, 1\)[\s\S]*?auditIndex/, 'vendor create must rollback record and audit');
assert.match(vendorUpdate, /Object\.assign\(vendor, previousVendor\)[\s\S]*?auditIndex/, 'vendor update must restore record and audit');
assert.match(knowledgeCreate, /splice\(index, 1\)[\s\S]*?auditIndex/, 'knowledge create must rollback record and audit');
assert.match(knowledgeUpdate, /Object\.assign\(article, previousArticle\)[\s\S]*?auditIndex/, 'knowledge update must restore record and audit');
assert.match(knowledgeVote, /article\.helpful_votes = previousVotes/, 'knowledge vote counter must rollback');
assert.match(knowledgeView, /article\.view_count = previousViews/, 'knowledge view counter must rollback');
assert.match(passwordChange, /app\.post\('\/api\/auth\/change-password', async/);
assert.match(passwordChange, /await persistDataStore\(\)[\s\S]*?revokeUserSessions\(user\.id\)[\s\S]*?createSession\(user\.id, req\)/,
  'password change must persist before session revocation and reissue');
assert.match(passwordChange, /password_hash = previousCredentials\.password_hash[\s\S]*?auditIndex/,
  'password change must restore credentials and audit on persistence failure');
assert.doesNotMatch(passwordChange, /persistDataStore\(\)\.catch\(\(\) => \{\}\)/);
assert.match(source, /void persistDataStore\(\)\.catch\(error =>/,
  'post-response compatibility safety net must catch persistence failures');

console.log('Vendor, Knowledge Base, password, and persistence safety-net checks: 23/23 passed');
