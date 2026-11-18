/**
 * Live HTTP regression for ticket status object-level authorization.
 * Boots an isolated file-store server and restores any pre-existing state file.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { getAvailablePort } from './test-port.mjs';

const results = [];
function record(name, expected, actual, pass) {
  results.push({ name, expected, actual, pass: Boolean(pass) });
}
async function request(base, method, route, { token, body } = {}) {
  const response = await fetch(base + route, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = {};
  try { json = await response.json(); } catch { /* no JSON body */ }
  return { status: response.status, json };
}
async function waitForServer(base) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(base + '/api/health');
      if (response.ok) return true;
    } catch { /* server is still booting */ }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  return false;
}

async function main() {
  const serverPath = path.resolve(process.cwd(), 'dist/server.cjs');
  if (!fs.existsSync(serverPath)) throw new Error('dist/server.cjs not found; build must run first.');
  const dataDir = path.resolve(process.cwd(), 'server/data');
  const stateFile = path.join(dataDir, 'gabah_state.json');
  fs.mkdirSync(dataDir, { recursive: true });
  const backupState = fs.existsSync(stateFile) ? fs.readFileSync(stateFile, 'utf8') : null;
  if (fs.existsSync(stateFile)) fs.rmSync(stateFile);

  const port = await getAvailablePort();
  const base = `http://127.0.0.1:${port}`;
  const adminPassword = crypto.randomBytes(16).toString('base64url');
  const userPassword = crypto.randomBytes(16).toString('base64url');
  const child = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'development',
      GABAH_INITIAL_ADMIN_PASSWORD: adminPassword,
      GABAH_INITIAL_USER_PASSWORD: userPassword,
      GABAH_TEST_PASSWORD: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverLog = '';
  child.stdout.on('data', chunk => { serverLog += chunk.toString(); });
  child.stderr.on('data', chunk => { serverLog += chunk.toString(); });
  const cleanup = () => {
    try { child.kill('SIGKILL'); } catch { /* already stopped */ }
    if (backupState !== null) fs.writeFileSync(stateFile, backupState);
    else if (fs.existsSync(stateFile)) fs.rmSync(stateFile);
  };

  try {
    if (!await waitForServer(base)) throw new Error('Server did not start. Log tail: ' + serverLog.slice(-2500));
    record('Isolated HTTP server starts', '200', '200', true);

    const login = async email => {
      const result = await request(base, 'POST', '/api/auth/login', {
        body: { email, password: email === 'admin@foodstation.co.id' ? adminPassword : userPassword },
      });
      return { status: result.status, token: result.json?.data?.token || result.json?.token || '' };
    };
    const badLoginStatuses = [];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failedLogin = await request(base, 'POST', '/api/auth/login', {
        body: { email: 'auditor@foodstation.co.id', password: 'intentionally-wrong-password' },
      });
      badLoginStatuses.push(failedLogin.status);
    }
    record('Login lockout activates after five failures in development/UAT', '401,401,401,401,429', badLoginStatuses.join(','), badLoginStatuses.join(',') === '401,401,401,401,429');

    const admin = await login('admin@foodstation.co.id');
    const reporter = await login('hendra.w@foodstation.co.id');
    const unrelated = await login('humas@foodstation.co.id');
    const unrelatedAccountLogin = await login('auditor@foodstation.co.id');
    record('One account lockout does not block a different account behind the same IP', 'Humas login succeeds', unrelated.token ? 'Humas login succeeds' : `HTTP ${unrelated.status}`, Boolean(unrelated.token));
    record('Locked account remains blocked until timeout', 'HTTP 429', String(unrelatedAccountLogin.status), unrelatedAccountLogin.status === 429);
    if (!admin.token || !reporter.token || !unrelated.token) {
      throw new Error(`Fixture login failed: admin=${admin.status}, reporter=${reporter.status}, unrelated=${unrelated.status}`);
    }
    record('Admin, reporter, and unrelated staff authenticate', '3 tokens', '3 tokens', true);

    const created = await request(base, 'POST', '/api/tickets', {
      token: reporter.token,
      body: {
        title: 'Ticket ownership authorization regression',
        description: 'Isolated test fixture; automatically discarded.',
        category: 'IT',
        priority: 'low',
      },
    });
    const ticketId = created.json?.data?.id;
    record('Reporter creates an isolated ticket', '201', String(created.status), created.status === 201 && Boolean(ticketId));
    if (!ticketId) throw new Error('Ticket fixture creation failed: ' + JSON.stringify(created.json));

    const denied = await request(base, 'PATCH', `/api/tickets/${encodeURIComponent(ticketId)}/status`, {
      token: unrelated.token,
      body: { status: 'in_progress' },
    });
    record('Unrelated staff cannot change another user ticket', '403', String(denied.status), denied.status === 403);

    const stillOpen = await request(base, 'GET', '/api/tickets', { token: reporter.token });
    const afterDenied = (stillOpen.json?.data || []).find(ticket => ticket.id === ticketId);
    record('Denied update does not mutate ticket state', 'open', String(afterDenied?.status), afterDenied?.status === 'open');

    const ownUpdate = await request(base, 'PATCH', `/api/tickets/${encodeURIComponent(ticketId)}/status`, {
      token: reporter.token,
      body: { status: 'in_progress' },
    });
    record('Reporter can update their own ticket', '200', String(ownUpdate.status), ownUpdate.status === 200 && ownUpdate.json?.data?.status === 'in_progress');

    const adminUpdate = await request(base, 'PATCH', `/api/tickets/${encodeURIComponent(ticketId)}/status`, {
      token: admin.token,
      body: { status: 'resolved' },
    });
    record('Superadmin retains cross-ticket administrative access', '200', String(adminUpdate.status), adminUpdate.status === 200 && adminUpdate.json?.data?.status === 'resolved');

    for (const result of results) console.log(`${result.pass ? 'PASS' : 'FAIL'} | ${result.name} | expected=${result.expected} actual=${result.actual}`);
    const failed = results.filter(result => !result.pass);
    console.log(`TOTAL: ${results.length} | PASS: ${results.length - failed.length} | FAIL: ${failed.length}`);
    if (failed.length) process.exitCode = 1;
  } finally {
    cleanup();
  }
}
main().catch(error => {
  console.error('FAIL | ticket status ownership live verification | ' + (error?.stack || error));
  process.exitCode = 1;
});
