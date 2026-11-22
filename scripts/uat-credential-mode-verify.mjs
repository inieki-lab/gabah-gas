import fs from 'node:fs';
import assert from 'node:assert/strict';

const persistence = fs.readFileSync(new URL('../server/persistence.ts', import.meta.url), 'utf8');
const compose = fs.readFileSync(new URL('../docker-compose.yml', import.meta.url), 'utf8');
const envExample = fs.readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');

assert.match(persistence, /process\.env\.GABAH_APP_MODE \|\| 'production'/,
  'application mode must default to production');
assert.match(persistence, /\['development', 'test', 'uat'\]\.includes\(appMode\)/,
  'shared test credentials must require an explicit non-production app mode');
assert.match(persistence, /testCredentialsAllowed \? process\.env\.GABAH_TEST_PASSWORD : undefined/,
  'test password must be ignored unless the explicit mode is allowed');
assert.match(compose, /GABAH_APP_MODE: \$\{GABAH_APP_MODE:-production\}/,
  'Docker Compose must default the app mode to production');
assert.match(compose, /GABAH_TEST_PASSWORD: \$\{GABAH_TEST_PASSWORD:-\}/,
  'Docker Compose must pass the optional test password to the app');
assert.match(envExample, /^GABAH_APP_MODE=production$/m,
  '.env.example must keep production as the safe default');
assert.match(envExample, /^GABAH_TEST_PASSWORD=$/m,
  '.env.example must document the optional shared UAT password');
assert.match(readme, /GABAH_APP_MODE=uat.*GABAH_TEST_PASSWORD/,
  'README must explain the explicit UAT setup');

console.log('PASS | shared test password requires explicit UAT/development mode');
console.log('PASS | Docker Compose defaults to production mode');
console.log('PASS | README and .env.example document UAT configuration');
