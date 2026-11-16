import net from 'node:net';

/**
 * Ask the OS for an available loopback TCP port instead of guessing from a
 * small fixed range. The probe is closed before the app binds the port.
 */
export async function getAvailablePort() {
  const probe = net.createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const address = probe.address();
  if (!address || typeof address === 'string') {
    await new Promise(resolve => probe.close(resolve));
    throw new Error('Unable to allocate an isolated verification port');
  }
  await new Promise((resolve, reject) => probe.close(err => err ? reject(err) : resolve()));
  return address.port;
}
