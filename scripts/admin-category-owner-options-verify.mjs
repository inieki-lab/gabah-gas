import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../src/components/modals/AdministrationModal.tsx', import.meta.url), 'utf8');
const initial = source.slice(source.indexOf('const [newCategoryData, setNewCategoryData] = useState({'), source.indexOf('});', source.indexOf('const [newCategoryData, setNewCategoryData] = useState({')));
assert.match(initial, /owner_division:\s*''/,
  'category owner must require an explicit selection');
assert.match(source, /if \(!newCategoryData\.owner_division\)[\s\S]*Divisi pemilik aset wajib dipilih/,
  'category creation must reject an empty owner selection before API submission');

const selectStart = source.indexOf('value={newCategoryData.owner_division}');
const selectEnd = source.indexOf('</select>', selectStart);
assert.ok(selectStart >= 0 && selectEnd > selectStart, 'category owner select must exist');
const ownerSelect = source.slice(selectStart, selectEnd);
assert.match(ownerSelect, /option value="IT"/);
assert.match(ownerSelect, /option value="GA"/);
assert.match(ownerSelect, /Pilih owner domain/);
assert.doesNotMatch(ownerSelect, /option value="SC"|option value="PIBC"/,
  'retired location labels SC and PIBC must not be selectable as new asset owners');

console.log('PASS | new category requires explicit owner-domain selection');
console.log('PASS | new category owner choices exclude legacy SC and PIBC location labels');
