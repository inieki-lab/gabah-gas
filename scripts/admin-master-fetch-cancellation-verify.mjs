import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../src/components/modals/AdministrationModal.tsx', import.meta.url), 'utf8');
const start = source.indexOf('useEffect(() => {\n    let cancelled = false;\n    const fetchMasterData = async () => {');
const end = source.indexOf('  }, [isOpen, assets]);', start);
assert.ok(start >= 0 && end > start, 'master data effect must define a cancellable lifecycle');
const effect = source.slice(start, end);
assert.match(effect, /if \(cancelled\) return;[\s\S]*if \(Array\.isArray\(liveCats\)\)/,
  'a response arriving after cancellation must not update category/master state');
assert.match(effect, /catch \(e\) \{\s*if \(cancelled\) return;/,
  'a stale rejected request must not emit a toast after cancellation');
assert.match(effect, /return \(\) => \{ cancelled = true; \};/,
  'effect cleanup must invalidate outstanding master requests');
assert.match(effect, /if \(isOpen\) \{\s*fetchMasterData\(\);/,
  'master data fetch must remain gated by modal visibility');

console.log('PASS | stale successful master-data responses are ignored');
console.log('PASS | stale failed requests do not emit warnings after modal close/reopen');
console.log('PASS | effect cleanup invalidates in-flight requests');
