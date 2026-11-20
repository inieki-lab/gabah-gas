import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const dashboard = read('../src/components/views/DashboardView.tsx');
const sidebar = read('../src/components/Sidebar.tsx');
const app = read('../src/App.tsx');
const loans = read('../src/components/views/LoansView.tsx');

// Superadmin capability must outrank a narrower primary/secondary operational role.
assert.match(dashboard, /currentUser\?\.is_superadmin \|\| currentUser\?\.role === 'Admin GABAH'\) return true;/);
assert.match(dashboard, /const isEmployee = !currentUser\?\.is_superadmin && !isAuditor/);
assert.match(dashboard, /currentUser\.is_superadmin \|\| currentUser\.role === 'Admin GABAH'[\s\S]*?roleDescriptions\['Admin GABAH'\]/);

// Sidebar presentation and menu visibility must not inherit Humas/staff restrictions.
assert.match(sidebar, /const isStaff = !isSuperAdmin && activeRole/);
assert.match(sidebar, /const isHumas = !isSuperAdmin && activeRole === 'Humas'/);
assert.match(sidebar, /isSuperAdmin \|\| \(activeRole \? isNavTabAllowedForRole/);

// App-level navigation guards must honor the server-issued Superadmin capability.
assert.match(app, /effectiveNavigationPermissions = currentUser\?\.is_superadmin\s*\? \['\*'\]/);
assert.match(app, /currentUser\.is_superadmin \? \['\*'\] : currentUser\.permission_keys/);

// Loan actions must use the same Superadmin precedence, while server RBAC remains authoritative.
assert.match(loans, /const isSuperAdminUser = isSuperAdmin\(currentUser\)/);
assert.match(loans, /if \(isSuperAdminUser\) return true/);
assert.match(loans, /const isEmployee = !isSuperAdminUser/);
assert.match(loans, /if \(isSuperAdminUser\) return true/);
assert.match(loans, /const canApprove = \(loan: Loan\) => \{[\\s\\S]*?if \(isSuperAdminUser\) return true/);

console.log('Superadmin persona regression: PASS');
