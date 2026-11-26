/**
 * GABAH MAINTENANCE AUTHZ — LIVE HTTP VERIFICATION SCRIPT (Stage 13F)
 *
 * Self-terminating: boots the compiled server bundle with PostgreSQL explicitly
 * disabled and verifies the documented fail-closed contract. Maintenance APIs
 * require the authoritative PostgreSQL RBAC policy store; every authenticated
 * role must receive RBAC_POLICY_UNAVAILABLE (503), never a legacy role bypass.
 * Dynamic owner-scope implementation is covered by the RBAC contract tests.
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.PORT = process.env.PORT || '0';

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const results = [];
function record(test, expected, actual, pass) {
  results.push({ test, expected, actual, pass: Boolean(pass) });
}

function readDevCredentials() {
  const file = path.resolve(process.cwd(), 'server/data/initial_credentials_dev.txt');
  try {
    const content = fs.readFileSync(file, 'utf8');
    const map = {};
    for (const line of content.split('\n')) {
      const idx = line.indexOf('=>');
      if (idx > 0) map[line.slice(0, idx).trim()] = line.slice(idx + 2).trim();
    }
    return map;
  } catch {
    return {};
  }
}

async function req(base, method, urlPath, { token, body } = {}) {
  const res = await fetch(`${base}${urlPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json = {};
  try { json = await res.json(); } catch { /* empty body */ }
  return { status: res.status, json };
}

async function waitForServer(base, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) return true;
    } catch { /* not ready yet */ }
    await new Promise(r => setTimeout(r, 300));
  }
  return false;
}

function codes(data) {
  return new Set((data || []).map(m => String(m.schedule_code || '')));
}

async function main() {
  const serverPath = path.resolve(process.cwd(), 'dist/server.cjs');
  if (!fs.existsSync(serverPath)) {
    console.error('dist/server.cjs not found — run `npm run build` first.');
    process.exit(1);
  }

  // Isolated runtime state dir so tests never touch the repo snapshot.
  const dataDir = path.resolve(process.cwd(), 'server/data');
  const stateFile = path.join(dataDir, 'gabah_state.json');
  let backupState = null;
  if (fs.existsSync(stateFile)) {
    backupState = fs.readFileSync(stateFile, 'utf8');
    fs.rmSync(stateFile);
  }

  const PORT = 39500 + Math.floor(Math.random() * 2000);
  const base = `http://127.0.0.1:${PORT}`;
  const child = spawn(process.execPath, [serverPath], {
    env: { ...process.env, DATABASE_URL: '', PGHOST: '', DOTENV_CONFIG_PATH: '/dev/null', PORT: String(PORT), NODE_ENV: 'development' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverLog = '';
  child.stdout.on('data', d => { serverLog += d.toString(); });
  child.stderr.on('data', d => { serverLog += d.toString(); });

  const cleanup = () => {
    try { child.kill('SIGKILL'); } catch { /* already dead */ }
    if (backupState !== null) fs.writeFileSync(stateFile, backupState);
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(130); });

  let failed = 0;
  try {
    if (!(await waitForServer(base))) {
      console.error('Server failed to start. Log tail:\n' + serverLog.slice(-2000));
      process.exit(1);
    }
    record('Server boots on isolated port', 'health 200', 'health 200', true);

    const health = await req(base, 'GET', '/api/health');
    const persistence = health.json?.persistence || 'unknown';
    record('Test runtime is isolated file-store', 'file-store (development fallback)', persistence,
      health.status === 200 && persistence.startsWith('file-store'));

    const creds = readDevCredentials();
    const accounts = {
      admin: 'admin@foodstation.co.id',
      it: 'it.support@foodstation.co.id',
      ga: 'ga@foodstation.co.id',
      karyawan: 'hendra.w@foodstation.co.id',
      auditor: 'auditor@foodstation.co.id',
    };
    const tokens = {};
    for (const [key, email] of Object.entries(accounts)) {
      const pass = creds[email] || process.env.GABAH_TEST_PASSWORD || '';
      const login = await req(base, 'POST', '/api/auth/login', { body: { email, password: pass } });
      const token = login.json?.data?.token;
      record(`login ${key}`, '200 + token', `HTTP ${login.status}`, login.status === 200 && Boolean(token));
      if (token) tokens[key] = token;
    }

    const anonGet = await req(base, 'GET', '/api/maintenances');
    record('GET anonymous maintenance', '401', `HTTP ${anonGet.status}`, anonGet.status === 401);
    const anonPost = await req(base, 'POST', '/api/maintenances', { body: { asset_id: 'AST-HSV-001', title: 'anonymous' } });
    record('POST anonymous maintenance', '401', `HTTP ${anonPost.status}`, anonPost.status === 401);
    const anonPatch = await req(base, 'PATCH', '/api/maintenances/mnt-002', { body: { notes: 'anonymous' } });
    record('PATCH anonymous maintenance', '401', `HTTP ${anonPatch.status}`, anonPatch.status === 401);

    for (const [key, token] of Object.entries(tokens)) {
      const get = await req(base, 'GET', '/api/maintenances', { token });
      record(`GET maintenance ${key} fails closed without PostgreSQL policy`, '503 RBAC_POLICY_UNAVAILABLE',
        `HTTP ${get.status} ${get.json?.code || ''}`,
        get.status === 503 && get.json?.code === 'RBAC_POLICY_UNAVAILABLE');

      const post = await req(base, 'POST', '/api/maintenances', {
        token, body: { asset_id: 'AST-HSV-001', title: `RBAC fail-closed ${key}` },
      });
      record(`POST maintenance ${key} fails closed without PostgreSQL policy`, '503 RBAC_POLICY_UNAVAILABLE',
        `HTTP ${post.status} ${post.json?.code || ''}`,
        post.status === 503 && post.json?.code === 'RBAC_POLICY_UNAVAILABLE');

      const patch = await req(base, 'PATCH', '/api/maintenances/mnt-002', {
        token, body: { notes: `RBAC fail-closed ${key}` },
      });
      record(`PATCH maintenance ${key} fails closed without PostgreSQL policy`, '503 RBAC_POLICY_UNAVAILABLE',
        `HTTP ${patch.status} ${patch.json?.code || ''}`,
        patch.status === 503 && patch.json?.code === 'RBAC_POLICY_UNAVAILABLE');
    }
  } catch (err) {
    console.error('Unexpected failure:', err);
    failed = 1;
  } finally {
    cleanup();
  }

  console.log('='.repeat(70));
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'} | ${r.test} | expected: ${r.expected} | actual: ${r.actual}`);
  }
  failed = failed + results.filter(r => !r.pass).length;
  console.log('='.repeat(70));
  console.log(`TOTAL: ${results.length} | PASS: ${results.filter(r => r.pass).length} | FAIL: ${results.filter(r => !r.pass).length}`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
