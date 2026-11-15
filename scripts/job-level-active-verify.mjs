import fs from 'node:fs';

const source = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const start = source.indexOf("app.patch('/api/master/job-levels/:code'");
const end = source.indexOf("app.get('/api/master/org-units'", start);
if (start < 0 || end < 0) throw new Error('Job-level PATCH route not found');
const route = source.slice(start, end);
const checks = [
  ['PATCH rejects non-boolean is_active', /typeof req\.body\.is_active !== 'boolean'/.test(route)],
  ['PATCH stores validated boolean without coercion', /level\.is_active = req\.body\.is_active/.test(route)],
  ['PATCH does not Boolean-coerce is_active', !/level\.is_active = Boolean\(req\.body\.is_active\)/.test(route)],
];
let failed = false;
for (const [name, passed] of checks) {
  console.log((passed ? 'PASS' : 'FAIL') + ' ' + name);
  if (!passed) failed = true;
}
if (failed) process.exit(1);
