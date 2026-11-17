import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const contracts = readFileSync(new URL('../server/contracts.ts', import.meta.url), 'utf8');
const server = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

assert.match(contracts, /async function persistContractMutation\(rollback: \(\) => void\)/,
  'Contract mutations must share an awaited durable persistence boundary');
assert.match(contracts, /await persistDataStore\(\)/,
  'Contract mutation persistence must be awaited');
assert.match(contracts, /catch \(error: any\)[\s\S]*rollback\(\)[\s\S]*statusCode: 503/,
  'A failed contract write must restore the in-memory mutation and surface service unavailable');

const cases = [
  ['createContract', /db\.contracts = db\.contracts\.filter\(item => item\.id !== contract\.id\)/],
  ['updateContract', /Object\.assign\(contract, previousContract\)/],
  ['addDocument', /Object\.assign\(contract, previousContract\)/],
  ['addMilestone', /Object\.assign\(contract, previousContract\)/],
  ['decideRenewal', /Object\.assign\(contract, previousContract\)/],
];
for (const [name, rollbackPattern] of cases) {
  const start = contracts.indexOf(name + '(');
  assert.ok(start >= 0, name + ' must exist');
  const next = contracts.indexOf('\n  },', start);
  const method = contracts.slice(start, next < 0 ? contracts.length : next);
  assert.match(method, /await persistContractMutation\(/, name + ' must await persistence');
  assert.match(method, rollbackPattern, name + ' must restore domain state on persistence failure');
  assert.match(method, /db\.auditLogs = db\.auditLogs\.filter\(log => log\.id !== auditLog\.id\)/,
    name + ' must remove its uncommitted audit event on failure');
}

const routeCases = [
  ['createContract', /await ContractDomainService\.createContract\(/],
  ['updateContract', /await ContractDomainService\.updateContract\(/],
  ['addDocument', /await ContractDomainService\.addDocument\(/],
  ['addMilestone', /await ContractDomainService\.addMilestone\(/],
  ['decideRenewal', /await ContractDomainService\.decideRenewal\(/],
];
for (const [name, pattern] of routeCases) {
  assert.match(server, pattern, 'HTTP route must await ' + name);
}
assert.equal((server.match(/res\.status\(typeof err\?\.statusCode === 'number' \? err\.statusCode : 400\)\.json/g) || []).length >= 5, true,
  'All five contract mutation routes must preserve HTTP 503 for persistence failures');

console.log('PASS | contract mutation persistence is awaited');
console.log('PASS | failed contract mutations restore in-memory domain state');
console.log('PASS | failed contract mutations remove their uncommitted audit event');
console.log('PASS | all contract mutation routes await durable domain operations');
console.log('TOTAL: 4 | PASS: 4 | FAIL: 0');
