import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../src/components/modals/AdministrationModal.tsx', import.meta.url), 'utf8');
const stateStart = source.indexOf('const [categories, setCategories] = useState<any[]>([]);');
assert.ok(stateStart >= 0, 'category state must start empty instead of containing demo records');

const fetchStart = source.indexOf('const fetchMasterData = async () => {');
const fetchEnd = source.indexOf('const handleAddCategorySubmit', fetchStart);
assert.ok(fetchStart >= 0 && fetchEnd > fetchStart, 'master-data fetch block must exist');
const fetchBlock = source.slice(fetchStart, fetchEnd);
assert.match(fetchBlock, /if \(Array\.isArray\(liveCats\)\)\s*\{\s*const mapped = liveCats\.map/,
  'an empty authoritative category array must still be mapped and synchronized');
assert.doesNotMatch(fetchBlock, /liveCats\.length\s*>\s*0/,
  'empty API results must not leave stale or fabricated category values in the UI');
assert.match(fetchBlock, /setCategories\(mapped\)/,
  'mapped server category list must replace local state');

console.log('PASS | Administration category list has no fabricated demo defaults');
console.log('PASS | empty server category list replaces local state with an empty list');
console.log('PASS | category list is populated only from the authoritative API response');
