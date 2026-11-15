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

/** Extract the best-effort client IP from an Express request. */
export function extractClientIp(req: { socket?: { remoteAddress?: string } }): string | undefined {
  // X-Forwarded-For is client-controlled unless a trusted proxy chain is
  // explicitly configured. This deployment has no Express trust-proxy setup,
  // so use the transport peer and never accept the request header as identity.
  const ip = String(req.socket?.remoteAddress || '').trim();
  return ip || undefined;
}
