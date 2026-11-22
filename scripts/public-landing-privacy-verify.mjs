import fs from 'node:fs';
import assert from 'node:assert/strict';

const landing = fs.readFileSync('src/components/landing/LandingPage.tsx', 'utf8');
const app = fs.readFileSync('src/App.tsx', 'utf8');

assert.ok(!landing.includes('demoUsers'), 'Public landing must not accept a user directory prop');
assert.ok(!landing.includes('onQuickLogin'), 'Public landing must not expose account-prefill actions');
assert.ok(!landing.includes('INITIAL_USERS'), 'Public landing must not import seeded employee accounts');
assert.ok(!landing.includes('user.email'), 'Public landing must not render employee login email addresses');
assert.ok(!landing.includes('user.department'), 'Public landing must not render employee department records');
assert.ok(!landing.includes('Daftar Akun Pengguna'), 'Public landing must not render an employee directory');
assert.match(app, /<LandingPage\s+onOpenLogin=\{\(\) => setViewMode\('login'\)\}\s*\/>/);
assert.ok(!app.includes('demoUsers={allUsers}'), 'Authenticated directory state must never be passed into public landing');
assert.ok(!app.includes('onQuickLogin={(u)'), 'Public account shortcuts must not prefill real employee identities');

console.log('PASS: public landing is independent of employee directory data and exposes no account identities.');
