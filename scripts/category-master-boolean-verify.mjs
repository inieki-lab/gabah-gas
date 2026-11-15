import fs from 'node:fs';

const source = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const start = source.indexOf("app.post('/api/taxonomy/categories'");
const end = source.indexOf("// Master Locations API", start);
if (start < 0 || end < 0) throw new Error('Category routes not found');
const routes = source.slice(start, end);
const patchStart = routes.indexOf("app.patch('/api/taxonomy/categories/:code'");
if (patchStart < 0) throw new Error('Category PATCH route not found');
const post = routes.slice(0, patchStart);
const patch = routes.slice(patchStart);
const checks = [
  ['POST rejects non-boolean is_active', /typeof is_active !== 'boolean'/.test(post)],
  ['POST rejects non-boolean is_loanable_by_default', /typeof is_loanable_by_default !== 'boolean'/.test(post)],
  ['POST no longer coerces category flags', !/Boolean\(is_active\)|Boolean\(is_loanable_by_default\)/.test(post)],
  ['PATCH rejects non-boolean is_active', /typeof is_active !== 'boolean'/.test(patch)],
  ['PATCH rejects non-boolean is_loanable_by_default', /typeof is_loanable_by_default !== 'boolean'/.test(patch)],
  ['PATCH assigns validated booleans without coercion', /target\.is_active = is_active/.test(patch) && /target\.is_loanable_by_default = is_loanable_by_default/.test(patch)],
  ['PATCH no longer coerces category flags', !/Boolean\(is_active\)|Boolean\(is_loanable_by_default\)/.test(patch)],
];
let failed = false;
for (const [name, passed] of checks) {
  console.log((passed ? 'PASS' : 'FAIL') + ' ' + name);
  if (!passed) failed = true;
}
if (failed) process.exit(1);
