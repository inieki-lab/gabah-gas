import fs from 'node:fs';

const source = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const cases = [
  ["org-units", "app.patch('/api/master/org-units/:id'", "app.get('/api/master/office-locations'"],
  ["office-locations", "app.patch('/api/master/office-locations/:id'", "// T2B-2: Master Lokasi Fisik Aset"],
  ["asset-locations", "app.patch('/api/master/asset-locations/:id'", "app.post('/api/taxonomy/resolve'"],
];
let failed = false;
for (const [name, startMarker, endMarker] of cases) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error(name + ' PATCH route not found');
  const route = source.slice(start, end);
  const checks = [
    ['rejects non-boolean is_active', /typeof req\.body\.is_active !== 'boolean'/.test(route)],
    ['stores validated boolean without coercion', new RegExp(name === 'org-units' ? 'unit\\.is_active = req\\.body\\.is_active' : 'loc\\.is_active = req\\.body\\.is_active').test(route)],
    ['does not Boolean-coerce is_active', !new RegExp(name === 'org-units' ? 'unit\\.is_active = Boolean\\(req\\.body\\.is_active\\)' : 'loc\\.is_active = Boolean\\(req\\.body\\.is_active\\)').test(route)],
  ];
  for (const [label, passed] of checks) {
    console.log((passed ? 'PASS' : 'FAIL') + ' ' + name + ' ' + label);
    if (!passed) failed = true;
  }
}
if (failed) process.exit(1);
