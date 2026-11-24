import assert from 'node:assert/strict';
import express from 'express';
import { parseTrustedProxyConfig } from '../server/trustedProxy.ts';

assert.equal(parseTrustedProxyConfig(undefined), false);
assert.equal(parseTrustedProxyConfig('  ,  '), false);
assert.deepEqual(parseTrustedProxyConfig('loopback, 10.20.0.4/32, 2001:db8::1'), [
  'loopback', '10.20.0.4/32', '2001:db8::1',
]);
assert.deepEqual(parseTrustedProxyConfig('linklocal,uniquelocal'), ['linklocal', 'uniquelocal']);

for (const invalid of ['*', 'true', '1', 'proxy.internal', '10.0.0.1/33', '2001:db8::1/129', '10.0.0.1/24/2']) {
  assert.throws(() => parseTrustedProxyConfig(invalid), undefined, `reject unsafe proxy value: ${invalid}`);
}

async function forwardedProtocol(config, forwardedProto) {
  const app = express();
  app.set('trust proxy', parseTrustedProxyConfig(config));
  app.get('/probe', (req, res) => res.json({ protocol: req.protocol }));
  const server = await new Promise(resolve => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/probe`, {
      headers: { 'X-Forwarded-Proto': forwardedProto },
    });
    assert.equal(response.status, 200);
    return (await response.json()).protocol;
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

assert.equal(await forwardedProtocol(undefined, 'https'), 'http',
  'unconfigured forwarded headers must not change Express protocol');
assert.equal(await forwardedProtocol('10.20.0.4', 'https'), 'http',
  'headers from an untrusted peer must not change Express protocol');
assert.equal(await forwardedProtocol('loopback', 'https'), 'https',
  'a configured trusted proxy may communicate the externally visible HTTPS protocol');

console.log('Trusted reverse proxy configuration verified: explicit IP/CIDR allowlist only.');
