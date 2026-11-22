import fs from 'node:fs';
import assert from 'node:assert/strict';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const server = fs.readFileSync('server.ts', 'utf8');
const dockerfile = fs.readFileSync('Dockerfile', 'utf8');
const workflow = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
const root = lock.packages?.[''];

for (const name of ['vite', '@vitejs/plugin-react', '@tailwindcss/vite']) {
  assert.ok(!pkg.dependencies?.[name], name + ' must not be a production dependency');
  assert.ok(pkg.devDependencies?.[name], name + ' must remain available to the build toolchain');
}
for (const section of ['dependencies', 'devDependencies']) {
  assert.deepEqual(root?.[section] || {}, pkg[section] || {}, 'package-lock root ' + section + ' must match package.json');
}
assert.doesNotMatch(server, /^import\s+.*from\s+['"]vite['"]/m, 'Production server must not statically import Vite');
assert.match(server, /if \(process\.env\.NODE_ENV !== 'production'\)[\s\S]*?await import\('vite'\)/,
  'Vite must be dynamically imported only in the development branch');
assert.match(dockerfile, /RUN npm ci --omit=dev/, 'Production Docker runtime must omit dev dependencies');
assert.match(workflow, /npm audit --omit=dev --audit-level=high/,
  'CI must block high-severity production dependency advisories');

console.log('PASS | Vite and build plugins are development-only dependencies');
console.log('PASS | package-lock root dependency declarations match package.json');
console.log('PASS | production server dynamically loads Vite only in development');
console.log('PASS | production Docker runtime installs without dev dependencies');
console.log('PASS | CI enforces the production dependency audit gate');
