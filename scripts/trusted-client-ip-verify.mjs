import fs from 'node:fs';

const context = fs.readFileSync(new URL('../server/requestContext.ts', import.meta.url), 'utf8');
const auth = fs.readFileSync(new URL('../server/auth.ts', import.meta.url), 'utf8');
const middleware = fs.readFileSync(new URL('../server/runtime-hardening.ts', import.meta.url), 'utf8');
const server = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

const checks = [
  ['Client IP resolver never reads X-Forwarded-For', !context.includes('x-forwarded-for') && /req\.socket\?\.remoteAddress/.test(context)],
  ['Session metadata uses the shared transport-peer resolver', /extractClientIp\(req\)/.test(auth)],
  ['Global API rate limiter uses the shared transport-peer resolver', /const clientIp = extractClientIp\(req\)/.test(middleware)],
  ['Login lockout uses the shared transport-peer resolver', /const ip = extractClientIp\(req\)/.test(server)],
  ['No application source trusts X-Forwarded-For for client identity', !auth.includes('x-forwarded-for') && !middleware.includes('x-forwarded-for') && !server.includes("req.headers['x-forwarded-for']")],
  ['Expired API rate-limit buckets are reclaimed', /apiRateLimits\.delete\(key\)/.test(auth) && /entry\.resetAt <= now/.test(auth)],
  ['Expired login lockout records are reclaimed', /loginAttempts\.delete\(key\)/.test(auth) && /entry\.lockedUntil <= now/.test(auth),
];

let failed = 0;
for (const [name, pass] of checks) {
  console.log((pass ? 'PASS' : 'FAIL') + ' | ' + name);
  if (!pass) failed += 1;
}
console.log('TOTAL: ' + checks.length + ' | PASS: ' + (checks.length - failed) + ' | FAIL: ' + failed);
process.exit(failed === 0 ? 0 : 1);
