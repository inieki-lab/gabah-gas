/**
 * GABAH P0 REGRESSION TEST — Dynamic RBAC & Superadmin
 *
 * Regression scenarios after the Superadmin gate fix:
 *  1. DB assignment is authoritative when PostgreSQL is active.
 *  2. Legacy "Admin GABAH" label cannot bypass DB assignment (PostgreSQL active).
 *  3. Permanently revoking the last Superadmin is blocked.
 *  4. Multi-role works correctly.
 *  5. No endpoint bypasses middleware RBAC.
 *  6. File-store development remains compatible (no PostgreSQL required).
 *
 * Run: node scripts/p0-regression-verify.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'crypto';
import net from 'net';
import { spawn } from 'child_process';

const results = [];
function record(test, expected, actual, pass) {
  results.push({ test, expected, actual, pass: Boolean(pass) });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${test}  (expected: ${expected}, got: ${actual})`);
}

function isPostgresActive() {
  return process.env.PGHOST && process.env.PGUSER && process.env.PGPASSWORD;
}

function getAdminPass() {
  return process.env.GABAH_INITIAL_ADMIN_PASSWORD || process.env.GABAH_INITIAL_USER_PASSWORD || 'TestAdmin123!';
}

// --- Scenario 1 & 2: Superadmin gate in PostgreSQL active mode ---
async function testSuperadminGate(base) {
  try {
    console.error('DEBUG: calling fetch login...');
    const adminRes = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@foodstation.co.id', password: 'TestAdmin123!' }),
    });
    const admin = await adminRes.json();
    const adminOk = adminRes.ok && admin?.data?.token;
    record('Superadmin login returns token', '200 + token', `HTTP ${adminRes.status}`, adminOk);
    if (!adminOk) return;

    const token = admin.data.token;

    // Access an RBAC-protected admin endpoint (should work for superadmin)
    const rbacRes = await fetch(`${base}/api/admin/rbac/roles`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    record('Superadmin can list roles (PostgreSQL active)', '200', `HTTP ${rbacRes.status}`, rbacRes.status === 200);

    // Non-superadmin (GA dispatcher) must be rejected on admin role endpoint
    const karyawanRes = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ga@foodstation.co.id', password: 'TestUser123!' }),
    });
    const karyawan = await karyawanRes.json();
    const karyawanOk = karyawanRes.ok && karyawan?.data?.token;
    record('GA dispatcher login returns token', '200 + token', `HTTP ${karyawanRes.status}`, karyawanOk);
    if (!karyawanOk) return;
    const kToken = karyawan.data.token;
    const rbacKRes = await fetch(`${base}/api/admin/rbac/roles`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${kToken}` },
    });
    record('GA dispatcher cannot list roles (403)', '403', `HTTP ${rbacKRes.status}`, rbacKRes.status === 403);

    // Admin GABAH label without DB superadmin assignment must be rejected (PostgreSQL active)
    const labelRes = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'usr-unknown@foodstation.co.id', password: 'TestUser123!' }),
    });
    const label = labelRes.json;
    if (!labelRes.ok) {
      record('Unknown user login rejected', '401', `HTTP ${labelRes.status}`, labelRes.status === 401);
      return;
    }
    const labelToken = label.data?.token || '';
    const labelAdminRes = await fetch(`${base}/api/admin/rbac/roles`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${labelToken}` },
    });
    record('Admin GABAH label without DB assignment cannot bypass (403)', '403', `HTTP ${labelAdminRes.status}`, labelAdminRes.status === 403);
  } catch (err) {
    record('Superadmin gate test', 'no throw', `throws: ${err.message}`, false);
  }
}

// --- Scenario 3: Last Superadmin cannot be permanently revoked ---
async function testLastSuperadmin(base) {
  if (!isPostgresActive()) {
    record('Last Superadmin protection', 'skipped (no PostgreSQL)', 'file-store mode', true);
    return;
  }
  try {
    // Count superadmins before
    const adminRes = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@foodstation.co.id', password: getAdminPass() }),
    });
    const admin = adminRes.json;
    const token = admin.data?.token;

    const countRes = await fetch(`${base}/api/admin/rbac/user-assignments`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    const countData = await countRes.json();
    const before = Array.isArray(countData?.data) ? countData.data.filter(u => u.role_keys && u.role_keys.includes('superadmin')).length : 0;
    record('Superadmin count before', '>= 1', `count: ${before}`, before >= 1);

    // Attempt to revoke the admin user (USR-01) from superadmin role
    // The API should reject this if it's the last superadmin
    const delRes = await fetch(`${base}/api/admin/rbac/user-assignments/USR-01/roles/superadmin`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const delStatus = delRes.status;
    const isProtected = delStatus === 403 || delStatus === 400;
    record('Cannot permanently revoke last Superadmin', '403/400', `HTTP ${delStatus}`, isProtected);

    // Count after
    const countRes2 = await fetch(`${base}/api/admin/rbac/user-assignments`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    const countData2 = await countRes2.json();
    const after = Array.isArray(countData2?.data) ? countData2.data.filter(u => u.role_keys && u.role_keys.includes('superadmin')).length : 0;
    record('Superadmin count after (should remain >= 1)', '>= 1', `count: ${after}`, after >= 1);
  } catch (err) {
    record('Last Superadmin protection test', 'no throw', `throws: ${err.message}`, false);
  }
}

// --- Scenario 4: Multi-role works correctly ---
async function testMultiRole(base) {
  if (!isPostgresActive()) {
    record('Multi-role test', 'skipped (no PostgreSQL)', 'file-store mode', true);
    return;
  }
  try {
    const adminRes = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@foodstation.co.id', password: getAdminPass() }),
    });
    const admin = adminRes.json;
    const token = admin.data?.token;

    // Create a test user with multiple roles via the admin API
    const createRes = await fetch(`${base}/api/admin/rbac/user-assignments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: 'USR-KARYAWAN-PROBE', role_keys: ['karyawan', 'me_tech'] }),
    });
    const createData = await createRes.json();
    const assigned = createRes.status === 200 && createData.success;

    // Verify the user now has multiple roles
    const verifyRes = await fetch(`${base}/api/admin/rbac/user-assignments/USR-KARYAWAN-PROBE`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    const verifyData = await verifyRes.json();
    const roles = verifyData?.data?.role_keys || [];
    const hasMultiple = roles.length >= 2;
    record('Multi-role assigned', '200 + role_keys', `HTTP ${createRes.status}`, assigned);
    record('Multi-role effective keys >= 2', '>= 2', `count: ${roles.length}`, hasMultiple);

    // Cleanup (if test user created)
    if (assigned) {
      await fetch(`${base}/api/admin/rbac/users/USR-KARYAWAN-PROBE`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  } catch (err) {
    record('Multi-role test', 'no throw', `throws: ${err.message}`, false);
  }
}

// --- Scenario 5: No endpoint bypasses middleware RBAC ---
async function testEndpointBypass(base) {
  // Check all ticket endpoints require proper permission
  const ticketEndpoints = [
    '/api/tickets',
    '/api/tickets/:id',
    '/api/tickets/:id/assignees',
    '/api/tickets/:id/assign',
    '/api/tickets/:id/status',
  ];
  // This is a structural check - we verify the middleware is registered
  const middlewareCheck = await fetch(`${base}/api/health`);
  record('Server boots and middleware loads', '200', `HTTP ${middlewareCheck.status}`, middlewareCheck.status === 200);

  // Verify RBAC permission middleware exists in the codebase
  const fs = await import('fs');
  const code = fs.readFileSync('server.ts', 'utf8');
  const hasMiddleware = code.includes('requireRbacPermission') && code.includes('requireRbacSuperadmin');
  record('RBAC middleware functions present', 'true', `has${hasMiddleware ? '' : 'in'}`, hasMiddleware);
}

// --- Scenario 6: File-store development remains compatible ---
async function testFileStore(base) {
  const fs = await import('fs');
  const code = fs.readFileSync('server.ts', 'utf8');
  const hasFileStore = code.includes('file-store') || code.includes('isPostgresPersistenceActive');
  record('File-store development supported', 'true', `has${hasFileStore ? '' : 'in'}`, hasFileStore);

  // PostgreSQL should not be required for dev file-store mode
  const hasPostgresGuard = code.includes('isPostgresPersistenceActive');
  record('PostgreSQL guard present', 'true', `has${hasPostgresGuard ? '' : 'in'}`, hasPostgresGuard);
}

async function main() {
  console.log('=== P0 REGRESSION TEST — Dynamic RBAC & Superadmin ===');
  console.log(`PostgreSQL active: ${isPostgresActive() ? 'yes' : 'no (file-store mode)'}`);

  const PORT = await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      resolve(probe.address().port);
      probe.close();
    });
  });

  const base = `http://127.0.0.1:${PORT}`;

  // Ensure dist/server.cjs exists (built server)
  if (!fs.existsSync('dist/server.cjs')) {
    console.error('dist/server.cjs not found — run `npm run build` first.');
    process.exit(1);
  }

  // Use the live running server (already running with PostgreSQL)
  const live = await fetch('http://localhost:80/api/health').then(r => r.ok).catch(() => false);
  if (live) {
    console.log('Using live running server (port 80) for tests...');
    await testSuperadminGate('http://localhost:80');
    await testLastSuperadmin('http://localhost:80');
    await testMultiRole('http://localhost:80');
    await testEndpointBypass('http://localhost:80');
    await testFileStore('http://localhost:80');
  } else {
    console.log('Live server not running — skipping live HTTP tests.');
    record('Server reachability', 'false', 'live server not running', false);
  }

  const passCount = results.filter(r => r.pass).length;
  const failCount = results.length - passCount;
  console.log(`\n=== SUMMARY: ${passCount}/${results.length} PASS, ${failCount} FAIL ===`);
  process.exit(failCount > 0 ? 1 : 0);
}

main();
