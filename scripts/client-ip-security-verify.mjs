import fs from 'node:fs';
import assert from 'node:assert/strict';

const server = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const auth = fs.readFileSync(new URL('../server/auth.ts', import.meta.url), 'utf8');
const runtime = fs.readFileSync(new URL('../server/runtime-hardening.ts', import.meta.url), 'utf8');
const context = fs.readFileSync(new URL('../server/requestContext.ts', import.meta.url), 'utf8');
const env = fs.readFileSync(new URL('../.env.example', import.meta.url), 'utf8');

const checks = [
  ['Express proxy trust is an explicit CIDR allowlist', /app\.set\('trust proxy', trustedProxyCidrs\)/.test(server)],
  ['proxy allowlist comes from a dedicated environment variable', /GABAH_TRUST_PROXY_CIDRS/.test(server) && /GABAH_TRUST_PROXY_CIDRS=/.test(env)],
  ['blind proxy trust and hop-count shortcuts are absent', !/app\.set\('trust proxy',\s*(true|[0-9]+)/.test(server)],
  ['request context uses Express-resolved req.ip and socket fallback', /req\.ip \|\| req\.socket\?\.remoteAddress/.test(context)],
  ['rate limiter uses the shared trusted client-IP resolver', /extractClientIp\(req\)/.test(runtime) && !/x-forwarded-for/.test(runtime)],
  ['session metadata uses the shared trusted client-IP resolver', /extractClientIp\(req\)/.test(auth) && !/x-forwarded-for/.test(auth)],
];

let failed = 0;
for (const [name, pass] of checks) {
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${name}`);
  if (!pass) failed++;
}
console.log(`TOTAL: ${checks.length} | PASS: ${checks.length - failed} | FAIL: ${failed}`);
assert.equal(failed, 0, 'Trusted client IP contract failed.');
