import { isIP } from 'node:net';

const TRUSTED_PROXY_ALIASES = new Set(['loopback', 'linklocal', 'uniquelocal']);

/**
 * Parse an explicit reverse-proxy allowlist for Express.
 *
 * Only IP addresses, CIDRs, and Express's named private-network aliases are
 * accepted. Booleans, hop counts, wildcards, hostnames, and arbitrary strings
 * are rejected so a typo cannot silently broaden the trust boundary.
 */
export function parseTrustedProxyConfig(value: string | undefined): false | string[] {
  const entries = (value ?? '').split(',').map(entry => entry.trim()).filter(Boolean);
  if (entries.length === 0) return false;

  for (const entry of entries) {
    if (TRUSTED_PROXY_ALIASES.has(entry)) continue;

    const parts = entry.split('/');
    if (parts.length > 2) {
      throw new Error(`Invalid GABAH_TRUST_PROXY entry: ${entry}`);
    }

    const family = isIP(parts[0]);
    if (family === 0) {
      throw new Error(`Invalid GABAH_TRUST_PROXY IP/CIDR: ${entry}`);
    }

    if (parts.length === 2) {
      if (!/^[0-9]+$/.test(parts[1])) {
        throw new Error(`Invalid GABAH_TRUST_PROXY CIDR prefix: ${entry}`);
      }
      const prefix = Number(parts[1]);
      const maxPrefix = family === 4 ? 32 : 128;
      if (!Number.isInteger(prefix) || prefix < 0 || prefix > maxPrefix) {
        throw new Error(`GABAH_TRUST_PROXY CIDR prefix out of range: ${entry}`);
      }
    }
  }

  return entries;
}
