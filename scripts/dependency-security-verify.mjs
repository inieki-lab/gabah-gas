import fs from 'node:fs';
import assert from 'node:assert/strict';

const lock = JSON.parse(fs.readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
const packages = lock.packages || {};

const checks = [
  ['multer runtime', packages['node_modules/multer']?.version, '2.5.0'],
  ['body-parser runtime', packages['node_modules/body-parser']?.version, '1.20.9'],
  ['multer TypeScript definitions', packages['node_modules/@types/multer']?.version, '2.3.0'],
];

let failed = 0;
for (const [name, actual, expected] of checks) {
  const pass = actual === expected;
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${name} | expected ${expected} | actual ${actual ?? '(missing)'}`);
  if (!pass) failed++;
}

assert.equal(failed, 0, 'Dependency security baseline is not satisfied.');
console.log(`Dependency security baseline: ${checks.length}/${checks.length} PASS`);
