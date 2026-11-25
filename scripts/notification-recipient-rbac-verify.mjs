import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import net from 'node:net';

const server = fs.readFileSync('server.ts', 'utf8');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const ci = fs.readFileSync('.github/workflows/ci.yml', 'utf8');

assert.match(server, /const isNotificationRecipient = \(actor: ServerUser, notification: any\): boolean =>/);
assert.match(server, /if \(notification\.recipient_user_id\) return notification\.recipient_user_id === actor\.id;/);
assert.match(server, /hasApplicationRole\(actor, primaryRoleKey\(notification\.recipient_role\)\)/);
assert.match(server, /if \(notification\.recipient_division\) return notification\.recipient_division === actor\.division;/);
assert.match(server, /const isRecipient = notif \? isNotificationRecipient\(actor, notif\) : false;/);
assert.match(server, /app\.patch\('\/api\/notifications\/:id\/read',[\s\S]*?requireRbacPermission\(req, res, 'notifications\.read'\)/);
assert.match(server, /app\.post\('\/api\/notifications\/read-all',[\s\S]*?requireRbacPermission\(req, res, 'notifications\.read_all'\)/);
assert.match(server, /const isRecipient = isNotificationRecipient\(actor, n\);/);
assert.match(server, /Recipient metadata is authoritative/);
assert.match(server, /db\.notifications\.filter\(n => isNotificationRecipient\(actor, n\)\)/);
assert.doesNotMatch(server, /isPhotoNotification && !hasApplicationRole\(actor, 'humas'\)/);
assert.equal(packageJson.scripts['test:notification-recipient-rbac'], 'node scripts/notification-recipient-rbac-verify.mjs');
assert.match(ci, /npm run test:notification-recipient-rbac/);

console.log('Notification recipient multi-role RBAC checks passed.');


// Live HTTP recipient-IDOR matrix in isolated file-store mode.
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
const results = [];
function record(name, expected, actual, pass) {
  results.push({ name, expected, actual, pass: Boolean(pass) });
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name} — expected: ${expected} | actual: ${actual}`);
}
function readCredentials() {
  const file = path.resolve(process.cwd(), 'server/data/initial_credentials_dev.txt');
  try {
    const map = {};
    for (const line of fs.readFileSync(file, 'utf8').split('\\n')) {
      const i = line.indexOf('=>');
      if (i > 0) map[line.slice(0, i).trim()] = line.slice(i + 2).trim();
    }
    return map;
  } catch { return {}; }
}
async function availablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') return server.close(() => reject(new Error('No ephemeral port')));
      server.close(error => error ? reject(error) : resolve(address.port));
    });
  });
}
async function request(base, method, url, { cookie, body } = {}) {
  const response = await fetch(base + url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
      ...(!['GET', 'HEAD', 'OPTIONS'].includes(method) && cookie ? { Origin: base } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  let json = {};
  try { json = await response.json(); } catch { /* empty response */ }
  return { status: response.status, json, cookie: response.headers.get('set-cookie')?.split(';', 1)[0] || cookie };
}
async function liveRecipientChecks() {
  const serverPath = path.resolve(process.cwd(), 'dist/server.cjs');
  if (!fs.existsSync(serverPath)) throw new Error('dist/server.cjs missing; live notification test requires production build');
  const dataDir = path.resolve(process.cwd(), 'server/data');
  const stateFile = path.join(dataDir, 'gabah_state.json');
  const backup = fs.existsSync(stateFile) ? fs.readFileSync(stateFile, 'utf8') : null;
  if (backup !== null) fs.rmSync(stateFile);
  const port = await availablePort();
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [serverPath], {
    env: { ...process.env, PORT: String(port), NODE_ENV: 'development' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverLog = '';
  child.stdout.on('data', data => { serverLog += data.toString(); });
  child.stderr.on('data', data => { serverLog += data.toString(); });
  const cleanup = () => {
    try { child.kill('SIGKILL'); } catch { /* already stopped */ }
    if (backup !== null) fs.writeFileSync(stateFile, backup);
    else fs.rmSync(stateFile, { force: true });
  };
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { const health = await fetch(base + '/api/health'); if (health.ok) { ready = true; break; } } catch { /* booting */ }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    record('Live notification test server boots', 'health 200', ready ? 'health 200' : 'not ready', ready);
    if (!ready) throw new Error('Server did not boot: ' + serverLog.slice(-1500));

    const credentials = readCredentials();
    const accounts = {
      admin: 'admin@foodstation.co.id',
      it: 'it.support@foodstation.co.id',
      ga: 'ga@foodstation.co.id',
    };
    const sessions = {};
    for (const [key, email] of Object.entries(accounts)) {
      const login = await request(base, 'POST', '/api/auth/login', {
        body: { email, password: credentials[email] || process.env.GABAH_TEST_PASSWORD || '' },
      });
      sessions[key] = login.cookie || '';
      record(`Login ${key}`, '200 + session cookie', `HTTP ${login.status}`, login.status === 200 && Boolean(sessions[key]));
    }

    const ticket = await request(base, 'POST', '/api/tickets', {
      cookie: sessions.admin,
      body: {
        title: 'VERIFY notification recipient boundary',
        description: 'Disposable test ticket to create a division-targeted notification.',
        category: 'IT',
        priority: 'low',
      },
    });
    const ticketId = ticket.json?.data?.id;
    record('Admin creates IT ticket for notification fixture', '201 + ticket id', `HTTP ${ticket.status}`, ticket.status === 201 && Boolean(ticketId));

    if (ticketId) {
      const itList = await request(base, 'GET', '/api/notifications', { cookie: sessions.it });
      const gaList = await request(base, 'GET', '/api/notifications', { cookie: sessions.ga });
      const itNotification = (itList.json?.data || []).find(item => item.link_id === ticketId);
      const gaNotification = (gaList.json?.data || []).find(item => item.link_id === ticketId);
      record('IT recipient sees its IT ticket notification', '200 + matching link_id',
        `HTTP ${itList.status}, match=${Boolean(itNotification)}`, itList.status === 200 && Boolean(itNotification));
      record('GA cannot list IT recipient notification', '200 + no matching link_id',
        `HTTP ${gaList.status}, match=${Boolean(gaNotification)}`, gaList.status === 200 && !gaNotification);

      if (itNotification?.id) {
        const gaRead = await request(base, 'PATCH', `/api/notifications/${encodeURIComponent(itNotification.id)}/read`, { cookie: sessions.ga });
        record('GA cannot mark IT notification as read (IDOR)', '404', `HTTP ${gaRead.status}`, gaRead.status === 404);
        const itRead = await request(base, 'PATCH', `/api/notifications/${encodeURIComponent(itNotification.id)}/read`, { cookie: sessions.it });
        record('IT recipient can mark its own notification as read', '200', `HTTP ${itRead.status}`, itRead.status === 200);
      } else {
        record('Non-recipient read-IDOR test has a fixture notification', 'notification id', 'missing', false);
      }
    }
  } finally {
    cleanup();
  }
  const failed = results.filter(item => !item.pass);
  console.log(`LIVE NOTIFICATION RECIPIENT TOTAL: ${results.length} | PASS: ${results.length - failed.length} | FAIL: ${failed.length}`);
  if (failed.length) process.exitCode = 1;
}
await liveRecipientChecks();
