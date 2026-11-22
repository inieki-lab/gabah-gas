import fs from 'node:fs';
import assert from 'node:assert/strict';

const compose = fs.readFileSync(new URL('../docker-compose.yml', import.meta.url), 'utf8');
const deploy = fs.readFileSync(new URL('../deploy.sh', import.meta.url), 'utf8');
const provisioner = fs.readFileSync(new URL('../scripts/provision-postgres-app-role.sh', import.meta.url), 'utf8');
const envExample = fs.readFileSync(new URL('../.env.example', import.meta.url), 'utf8');

const appBlock = compose.split('\n  app:\n')[1] || '';
const provisionerBlock = compose.split('\n  database-provisioner:\n')[1]?.split('\n  app:\n')[0] || '';
const databaseBlock = compose.split('\n  database:\n')[1]?.split('\n  database-provisioner:\n')[0] || '';

assert.match(databaseBlock, /POSTGRES_USER: \$\{PGADMIN_USER:/,
  'PostgreSQL bootstrap account must be separate from the app login');
assert.match(databaseBlock, /POSTGRES_PASSWORD: \$\{PGADMIN_PASSWORD:/,
  'database bootstrap password must be independently configured');
assert.match(provisionerBlock, /PGADMIN_PASSWORD:/,
  'one-shot provisioner must receive the admin password');
assert.match(provisionerBlock, /PGAPP_PASSWORD:/,
  'one-shot provisioner must receive the app password');
assert.match(provisionerBlock, /provision-postgres-app-role\.sh:ro/,
  'provisioner script must be mounted read-only');
assert.match(appBlock, /PGUSER: \$\{PGUSER:/,
  'app must connect using the restricted app role');
assert.match(appBlock, /PGPASSWORD: \$\{PGPASSWORD:/,
  'app must receive only its own database password');
assert.doesNotMatch(appBlock, /PGADMIN_(USER|PASSWORD)/,
  'admin credentials must never be passed to the application container');
assert.match(appBlock, /database-provisioner:[\s\S]*service_completed_successfully/,
  'application must wait for successful role provisioning');
assert.match(deploy, /docker compose run --rm database-provisioner[\s\S]*docker compose up -d --no-deps --force-recreate app/,
  'deployment must provision the app role before replacing the app');
assert.match(provisioner, /NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS/,
  'app role must not receive cluster administration capabilities');
assert.match(provisioner, /REASSIGN OWNED BY/,
  'existing database object ownership must be transferred safely');
assert.match(envExample, /^PGADMIN_USER=gabah_admin$/m, 'example admin role must be distinct');
assert.match(envExample, /^PGUSER=gabah_app$/m, 'example app role must be distinct');

console.log('PASS | PostgreSQL admin and app roles are separated');
console.log('PASS | app container receives no bootstrap admin credentials');
console.log('PASS | provisioning is required before app startup and deployment');
console.log('PASS | app role is explicitly non-superuser with ownership transfer');
