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
export function extractClientIp(req: { headers?: Record<string, unknown>; socket?: { remoteAddress?: string } }): string | undefined {
  const xff = typeof req.headers?.['x-forwarded-for'] === 'string' ? (req.headers['x-forwarded-for'] as string) : '';
  const ip = (xff || req.socket?.remoteAddress || '').split(',')[0].trim();
  return ip || undefined;
}
