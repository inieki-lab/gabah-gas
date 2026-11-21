/**
 * Regression contract for module-scoped RBAC fail-closed semantics.
 * This guards the policy predicate against accidental cross-module grants.
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('server/rbac-policy.ts', 'utf8');
const start = source.indexOf('export function hasRbacScope(');
const end = source.indexOf('\nexport function getRbacPolicyStatus', start);
assert.ok(start >= 0 && end > start, 'hasRbacScope implementation must exist');
const fn = source.slice(start, end);

assert.match(fn, /scope\.module == null \|\| scope\.module === '\*' \|\| \(module != null && scope\.module === module\)/,
  'module-specific scopes must require an explicitly matching module');
assert.doesNotMatch(fn, /scope\.module === module \|\| module == null/,
  'omitted module must not turn a module-specific scope into a wildcard');

function matches(scopeModule, requestedModule) {
  return scopeModule == null || scopeModule === '*' || (requestedModule != null && scopeModule === requestedModule);
}

assert.equal(matches('tickets', undefined), false, 'tickets scope must not match omitted module');
assert.equal(matches('tickets', null), false, 'tickets scope must not match null module');
assert.equal(matches('tickets', 'tickets'), true, 'exact module must match');
assert.equal(matches('tickets', 'loans'), false, 'cross-module scope must be denied');
assert.equal(matches(null, 'loans'), true, 'unscoped grant remains global');
assert.equal(matches('*', 'loans'), true, 'explicit wildcard remains global');

console.log('PASS: Dynamic RBAC module scopes fail closed when module context is omitted.');
