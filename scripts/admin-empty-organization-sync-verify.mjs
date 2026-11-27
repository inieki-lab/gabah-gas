import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../src/components/modals/AdministrationModal.tsx', import.meta.url), 'utf8');
assert.match(source, /const \[locations, setLocations\] = useState<MasterLocation\[]>\(\[\]\)/,
  'locations must not start from fabricated defaults');
assert.match(source, /const \[divisions, setDivisions\] = useState<OrgDivision\[]>\(\[\]\)/,
  'divisions must not start from fabricated defaults');

const start = source.indexOf('const fetchMasterData = async () => {');
const end = source.indexOf('const handleAddCategorySubmit', start);
assert.ok(start >= 0 && end > start, 'master-data fetch block must exist');
const block = source.slice(start, end);
for (const [response, setter] of [
  ['liveLocs', 'setLocations'],
  ['liveDivs', 'setDivisions'],
  ['liveJobLevels', 'setJobLevels'],
  ['liveOrgUnits', 'setOrgUnits'],
  ['liveOffices', 'setOfficeLocations'],
]) {
  assert.match(block, new RegExp('if \\(Array\\.isArray\\(' + response + '\\)\\)[\\s\\S]{0,100}' + setter + '\\('),
    response + ' empty array must synchronize through ' + setter);
  assert.doesNotMatch(block, new RegExp(response + '\\.length\\s*>\\s*0'),
    response + ' must not retain stale values when the server returns an empty list');
}

console.log('PASS | locations and divisions start without fabricated fallback values');
console.log('PASS | empty API arrays replace locations, divisions, job levels, org units, and office locations');
