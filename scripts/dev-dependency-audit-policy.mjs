import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const advisoryUrl = 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf';
const allowedPackages = new Set(['picomatch', 'fdir', 'tinyglobby', 'vite']);
const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
const root = lock.packages?.[''];
assert.ok(root, 'package-lock root metadata must exist');

// Build tooling is intentionally development-only. This advisory exception must
// never mask a production dependency or any unrelated high/critical advisory.
for (const name of allowedPackages) {
  const entry = lock.packages?.[`node_modules/${name}`];
  assert.ok(entry, `expected locked build-tool dependency: ${name}`);
  assert.equal(entry.dev, true, `${name} must remain development-only`);
}
for (const name of ['vite', '@tailwindcss/vite', '@vitejs/plugin-react']) {
  assert.ok(root.devDependencies?.[name], `${name} must be declared as a devDependency`);
  assert.ok(!root.dependencies?.[name], `${name} must not be a production dependency`);
}

const result = spawnSync('npm', ['audit', '--json'], { encoding: 'utf8' });
let audit;
try {
  audit = JSON.parse(result.stdout);
} catch {
  throw new Error(`npm audit did not return valid JSON (exit ${result.status}): ${result.stderr || result.stdout}`);
}
const vulnerabilities = audit.vulnerabilities || {};
const names = Object.keys(vulnerabilities);
assert.ok(names.length > 0, 'Expected the currently documented development advisory to be reported; review this policy when upstream changes');
for (const name of names) {
  assert.ok(allowedPackages.has(name), `Unexpected dependency vulnerability: ${name}`);
  const vulnerability = vulnerabilities[name];
  assert.equal(vulnerability.severity, 'high', `${name}: severity changed; review policy`);
  const via = vulnerability.via || [];
  if (name === 'picomatch') {
    assert.ok(via.some(item => typeof item === 'object' && item.url === advisoryUrl),
      'picomatch must be reported only for the explicitly reviewed GHSA');
  }
  for (const item of via) {
    if (typeof item === 'string') {
      assert.ok(allowedPackages.has(item), `${name}: unexpected transitive advisory path ${item}`);
    } else {
      assert.equal(item.url, advisoryUrl, `${name}: unexpected advisory ${item.url}`);
    }
  }
  for (const node of vulnerability.nodes || []) {
    const entry = lock.packages?.[node.replace(/^node_modules\\//, '')] || lock.packages?.[node];
    assert.ok(entry?.dev === true, `${name}: vulnerable node is not confirmed dev-only: ${node}`);
  }
}
assert.equal(result.status, 1, 'npm audit should exit 1 only while the reviewed high advisory remains; review if it changes');
console.log(`PASS: production audit is handled by CI separately; only the reviewed dev-tool advisory is temporarily allowlisted (${names.join(', ')}).`);
