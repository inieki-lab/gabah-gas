import { NextFunction, Request, Response } from 'express';
import { db, ServerUser, ServerSession } from './db';
import { authenticateRequest, checkApiRateLimit } from './auth';
import { isPostgresPersistenceActive, isPostgresFailureLatched } from './persistence';
import { isSuperadminActor, isAuditorActor, isReadOnlyActor, hasRbacScope, hasRbacPermission } from './rbac-policy';
import { GabahDomainService } from './services';
import { extractClientIp } from './requestContext';

const isSuperadmin = (actor: ServerUser) => isSuperadminActor(actor);
const isGlobalObserver = (actor: ServerUser) => isSuperadmin(actor) || isAuditorActor(actor);

export function actorFor(req: Request): ServerUser | null {
  if ((req as any).user) return (req as any).user as ServerUser;
  const result = authenticateRequest(req);
  return result.user;
}

function canSeeAsset(actor: ServerUser, assetId: string): boolean {
  // The asset catalogue is the canonical read-scope resolver. Reusing it here
  // keeps list, direct-ID routes, and linked attention cards consistent for
  // primary roles plus any explicitly assigned additional role scopes.
  return GabahDomainService.getScopedAssets(actor).some(asset => asset.id === assetId);
}

function canManageTicket(actor: ServerUser, ticketId: string): boolean {
  const ticket = db.tickets.find(t => t.id === ticketId);
  if (!ticket) return false;
  if (isSuperadmin(actor)) return true;
  // Read-only denies mutation, not scoped visibility. A custom read-only role
  // must still see tickets allowed by reporter ownership or explicit RBAC scope.
  if (ticket.reporter_id === actor.id || ticket.assigned_agent_id === actor.id) return true;
  if (isPostgresPersistenceActive()) {
    // PostgreSQL RBAC is owner-code agnostic: custom operational functions
    // (e.g. RPC/SC) need the same explicit Tickets scope as IT/GA.
    if (ticket.assigned_unit_id
      && hasRbacScope(String(actor.id), 'unit', ticket.assigned_unit_id, 'tickets')) return true;
    const owner = String(ticket.category || '').trim();
    return Boolean(owner) && hasRbacScope(String(actor.id), 'division', owner, 'tickets');
  }
  // File-store compatibility only. Canonical employees carry operational
  // functions in role_keys while their primary profile remains Karyawan.
  // Production PostgreSQL still requires explicit ticket scopes above.
  const capabilities = new Set([actor.role, ...(actor.role_keys || [])]
    .map(value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')));
  if (capabilities.has('it')) return ticket.category === 'IT';
  if (capabilities.has('ga')) return ticket.category === 'GA';
  if (ticket.category === 'ME') {
    return ticket.assigned_unit_id === 'UNIT-PIBC-ME' && capabilities.has('admin_tiket_me');
  }
  return false;
}

function scopedAttention(actor: ServerUser, items: any[]) {
  if (isGlobalObserver(actor)) return items;
  return items.filter(item => {
    if (item.link_type === 'asset') return canSeeAsset(actor, item.link_id);
    if (item.link_type === 'loan') {
      const loan = db.loans.find(l => l.id === item.link_id);
      if (!loan) return false;
      if (loan.borrower_id === actor.id) return true;
      if (isPostgresPersistenceActive()) {
        const owner = String(loan.owner_division || '').trim();
        return Boolean(owner) && hasRbacScope(String(actor.id), 'division', owner, 'loans');
      }
      // File-store compatibility only. Production PostgreSQL uses explicit
      // module scope, never a primary-role label, for owner-division visibility.
      const capabilities = new Set([actor.role, ...(actor.role_keys || [])]
        .map(value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').toUpperCase()));
      return capabilities.has(String(loan.owner_division || '').trim().toUpperCase());
    }
    if (item.link_type === 'ticket') return canManageTicket(actor, item.link_id);
    return false;
  });
}

// Public endpoints that do not require an active session token.
// SECURITY (CR-01): /api/auth/switch-role is NOT public — it requires an
// authenticated session and enforces server-side privilege validation.
const PUBLIC_API_PATHS = [
  '/api/health',
  '/api/auth/login',
];

export async function gabahSecurityMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Express routes are case-insensitive and accept a trailing slash by default.
  // Normalize paths before authorization comparisons so route variants cannot
  // bypass exact-path security checks.
  const normalizedPath = req.path.toLowerCase().replace(/\/+$/, '') || '/';
  // Only intercept API calls
  if (!normalizedPath.startsWith('/api/')) return next();

  // General API rate limiter across all endpoints (mitigates brute-force, scraping, and enumeration)
  const clientIp = extractClientIp(req) || 'unknown';
  // Keep orchestration health probes available even if the rate-limit store is
  // degraded. All other API traffic fails closed when shared PostgreSQL state
  // cannot be read or updated.
  let rateLimit = { allowed: true, remaining: 200, resetSeconds: 60 };
  try {
    rateLimit = await checkApiRateLimit(clientIp);
  } catch {
    // Health probes remain available if the limiter store is unavailable, but
    // they are still rate-limited whenever PostgreSQL is healthy.
    if (normalizedPath !== '/api/health') {
      res.setHeader('Retry-After', '5');
      res.setHeader('X-RateLimit-Limit', '200');
      res.setHeader('X-RateLimit-Remaining', '0');
      return void res.status(503).json({
        success: false,
        code: 'RATE_LIMIT_STORE_UNAVAILABLE',
        message: 'Layanan pembatasan permintaan sementara tidak tersedia. Coba kembali.',
      });
    }
  }
  res.setHeader('X-RateLimit-Limit', '200');
  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());
  res.setHeader('X-RateLimit-Reset', rateLimit.resetSeconds.toString());

  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', rateLimit.resetSeconds.toString());
    return void res.status(429).json({
      success: false,
      message: `Terlalu banyak permintaan API. Harap tunggu ${rateLimit.resetSeconds} detik sebelum mencoba kembali.`,
      retry_after_seconds: rateLimit.resetSeconds,
    });
  }

  // A runtime failure after PostgreSQL became authoritative leaves the
  // in-memory snapshot potentially newer than the last committed DB state.
  // Do not serve operational reads or accept writes from that uncertain state.
  // Only health remains available so orchestration can detect degraded readiness.
  if (isPostgresFailureLatched() && normalizedPath !== '/api/health') {
    res.setHeader('Retry-After', '30');
    return void res.status(503).json({
      success: false,
      code: 'PERSISTENCE_DEGRADED',
      message: 'PostgreSQL mengalami kegagalan setelah menjadi penyimpanan utama. API dikarantina sampai proses aplikasi direstart dan state dipulihkan dari database.',
    });
  }

  // Allow public endpoints
  if (PUBLIC_API_PATHS.includes(normalizedPath)) return next();

  // Cookie-authenticated mutations require a same-origin request. SameSite
  // cookies are defense in depth; Origin validation is the CSRF boundary.
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.cookie?.includes('gabah_session=')) {
    const origin = req.headers.origin;
    const expectedOrigin = `${req.protocol}://${req.get('host')}`;
    if (!origin || origin !== expectedOrigin) {
      return void res.status(403).json({ success: false, message: 'Permintaan lintas origin ditolak.' });
    }
  }

  // Validate server-side session token
  const authResult = authenticateRequest(req);

  // If a client attempted to forge identity via x-user-id header or without a valid token, immediately reject with 403
  if (authResult.spoofAttempt) {
    return void res.status(403).json({
      success: false,
      message: authResult.error || 'Akses ditolak: Percobaan manipulasi identitas (ID spoofing) terdeteksi.',
    });
  }

  const actor = authResult.user;
  if (!actor) {
    return void res.status(401).json({
      success: false,
      message: authResult.error || 'Sesi pengguna tidak valid atau telah kedaluwarsa. Silakan login kembali.',
    });
  }

  // Attach verified actor and session to request for all downstream route handlers
  (req as any).user = actor;
  if (authResult.session) {
    (req as any).session = authResult.session;
  }

  // Read-only policy blocks every mutation, regardless of the role name that carries it.
  // The legacy Auditor role remains a compatible source of this policy, while
  // custom roles can receive it through the security.read_only permission.
  if (isReadOnlyActor(actor) && req.method !== 'GET') {
    const allowedReadOnlyActions = ['/api/auth/logout', '/api/notifications/read-all'];
    const isNotificationRead = normalizedPath.match(/^\/api\/notifications\/[^/]+\/read$/);
    if (!allowedReadOnlyActions.includes(normalizedPath) && !isNotificationRead) {
      return void res.status(403).json({
        success: false,
        message: 'Akses ditolak: akun ini memiliki kebijakan read-only.',
      });
    }
  }

  // Keep canonical-path protection for case and trailing-slash variants,
  // while honoring explicit dynamic permissions for custom roles. The route
  // handlers repeat these checks for defense in depth.
  const hasObserverRoutePermission = (permission: string) => isPostgresPersistenceActive()
    ? hasRbacPermission(String(actor.id), permission)
    : isGlobalObserver(actor);
  if (normalizedPath === '/api/audit-logs' && !hasObserverRoutePermission('audit.read')) {
    return void res.status(403).json({ success: false, message: 'Akses audit log tidak diizinkan.' });
  }
  if (normalizedPath === '/api/reconciliation' && !hasObserverRoutePermission('reconciliation.read')) {
    return void res.status(403).json({ success: false, message: 'Akses rekonsiliasi tidak diizinkan.' });
  }

  // Match the route case-insensitively, but preserve the original ID casing:
  // asset IDs are case-sensitive even though Express paths are not.
  const assetMatch = req.path.replace(/\/+$/, '').match(/^\/api\/assets\/([^/]+)/i);
  const assetCollectionActions = new Set(['bulk-import', 'create-options']);
  const assetAction = assetMatch?.[1].toLowerCase();
  if (assetMatch && !assetCollectionActions.has(assetAction || '') && !canSeeAsset(actor, assetMatch[1])) {
    return void res.status(403).json({ success: false, message: 'Aset berada di luar scope pengguna.' });
  }

  const ticketMatch = req.path.match(/^\/api\/tickets\/([^/]+)\/status\/?$/i);
  if (ticketMatch && !canManageTicket(actor, ticketMatch[1])) {
    return void res.status(403).json({ success: false, message: 'Pengguna tidak berwenang mengubah tiket ini.' });
  }

  if (normalizedPath === '/api/dashboard/attention') {
    const originalJson = res.json.bind(res);
    res.json = ((body: any) => {
      if (body && Array.isArray(body.data)) body = { ...body, data: scopedAttention(actor, body.data) };
      return originalJson(body);
    }) as Response['json'];
  }
  return next();
}
