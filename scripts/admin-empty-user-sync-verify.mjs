import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/components/modals/AdministrationModal.tsx', import.meta.url), 'utf8');
const effectStart = source.indexOf('  useEffect(() => {\n    // The server is authoritative even when the legitimate result is empty.');
const effectEnd = source.indexOf('  }, [users]);', effectStart);
if (effectStart < 0 || effectEnd < 0) throw new Error('Administration user-list synchronization effect not found');
const effect = source.slice(effectStart, effectEnd + '  }, [users]);'.length);
const checks = [
  ['Administration mirrors an authoritative empty user list instead of retaining stale accounts', /setUserList\(Array\.isArray\(users\) \? users : \[\]\)/.test(effect)],
  ['User-list synchronization does not ignore empty arrays', !/users\.length\s*>\s*0/.test(effect)],
  ['User-list synchronization remains reactive to the users prop', /\}, \[users\]\);$/.test(effect)],
  ['Administration hook declarations remain before the closed-modal early return', source.indexOf('if (!isOpen) return null;') > effectStart && !['useState(', 'useEffect(', 'useMemo(', 'useCallback(', 'useRef(', 'useContext(', 'useReducer('].some(token => source.slice(source.indexOf('if (!isOpen) return null;')).includes(token))],
];
let failed = 0;
for (const [name, passed] of checks) {
  console.log((passed ? 'PASS' : 'FAIL') + ' | ' + name);
  if (!passed) failed += 1;
}
console.log(`TOTAL: ${checks.length} | PASS: ${checks.length - failed} | FAIL: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
