import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../src/components/modals/AdministrationModal.tsx', import.meta.url), 'utf8');
const initializer = source.match(/const \[newUserData, setNewUserData\] = useState<Partial<UserProfile>>\(\{([\s\S]*?)\n  \}\);/);
assert.ok(initializer, 'new employee form initializer must exist');
assert.match(initializer[1], /division:\s*''\s+as OwnerDivision/,
  'new employee form must start with no selected owner domain');
assert.doesNotMatch(initializer[1], /division:\s*['"]SC['"]/,
  'new employee must never silently inherit retired SC owner domain');

const resetStart = source.indexOf('setNewUserData({', source.indexOf('const handleAddUserSubmit'));
const resetEnd = source.indexOf('});', resetStart);
assert.ok(resetStart >= 0 && resetEnd > resetStart, 'new employee form reset must exist');
const reset = source.slice(resetStart, resetEnd);
assert.match(reset, /division:\s*''\s+as OwnerDivision/,
  'after creation the form must reset to an unselected owner domain');

console.log('PASS | new employee creation does not silently assign retired SC domain');
console.log('PASS | new employee form resets with no default owner domain');
