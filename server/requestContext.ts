/**
 * Per-request context (AsyncLocalStorage) — carries the client IP through the
 * async call chain so audit writers (services/contracts/notificationService)
 * can stamp `ip_address` without threading `req` through every call site.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestAuditContext {
  ip?: string;
}

export const requestContext = new AsyncLocalStorage<RequestAuditContext>();

/**
 * Extract the client IP resolved by Express. `req.ip` only honors
 * X-Forwarded-For when the application explicitly configures trusted proxies.
 * Never parse the raw header here: clients can forge it to evade rate limits
 * and falsify audit attribution when no trusted reverse proxy is configured.
 */
export function extractClientIp(req: { ip?: string; socket?: { remoteAddress?: string } }): string | undefined {
  const ip = String(req.ip || req.socket?.remoteAddress || '').trim();
  return ip || undefined;
}
