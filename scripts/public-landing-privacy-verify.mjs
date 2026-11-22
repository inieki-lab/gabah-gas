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

const login = fs.readFileSync('src/components/auth/LoginPage.tsx', 'utf8');
assert.ok(!landing.includes('100% Aktif'), 'Public landing must not claim an unverified 100% uptime/status metric');
assert.ok(!landing.includes('4.280+'), 'Public landing must not claim an unverified asset count');
assert.ok(!landing.includes('99.8%'), 'Public landing must not claim an unverified fleet readiness rate');
assert.ok(!landing.includes('&lt; 2 Jam'), 'Public landing must not claim an unverified response SLA');
assert.ok(!login.includes('SSL / TLS 256-Bit'), 'Login must not claim transport encryption that the UI cannot verify');
assert.ok(!login.includes('rememberMe'), 'Login must not display a nonfunctional remember-device control');
assert.ok(!login.includes('availableUsers'), 'Login must not accept an unused employee-directory prop');
assert.ok(!login.includes('INITIAL_USERS'), 'Login must not import mock employee identities');
assert.ok(!app.includes('availableUsers={allUsers}'), 'Employee directory must not be passed to the login form');

console.log('PASS: public claims are evidence-based and login contains no inert or unverified security controls.');
