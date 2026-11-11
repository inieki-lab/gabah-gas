import { NextFunction, Request, Response } from 'express';
import { db, ServerUser, ServerSession } from './db';
import { authenticateRequest, checkApiRateLimit } from './auth';
import { isPostgresPersistenceActive } from './persistence';
import { isSuperadminActor, isAuditorActor, hasRbacScope } from './rbac-policy';
import { GabahDomainService } from './services';

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
  if (isAuditorActor(actor)) return false;
  if (ticket.reporter_id === actor.id || ticket.assigned_agent_id === actor.id) return true;
  if (isPostgresPersistenceActive()) {
    // PostgreSQL RBAC is owner-code agnostic: custom operational functions
    // (e.g. RPC) need the same explicit Tickets scope as IT/GA.
    const owner = String(ticket.category || '').trim();
    return Boolean(owner) && hasRbacScope(String(actor.id), 'division', owner, 'tickets');
  }
  // File-store compatibility only. Production PostgreSQL never grants ticket
  // authority from a legacy role label alone.
  if (actor.role === 'IT') return ticket.category === 'IT';
  if (actor.role === 'GA') return ticket.category === 'GA';
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
      return (actor.role === 'IT' || actor.role === 'GA') && loan.owner_division === actor.role;
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

export function gabahSecurityMiddleware(req: Request, res: Response, next: NextFunction) {
  // Only intercept API calls
  if (!req.path.startsWith('/api/')) return next();

  // General API rate limiter across all endpoints (mitigates brute-force, scraping, and enumeration)
  const clientIp = (req.headers['x-forwarded-for'] as string || req.socket?.remoteAddress || '127.0.0.1').split(',')[0].trim();
  const rateLimit = checkApiRateLimit(clientIp);
  res.setHeader('X-RateLimit-Limit', '200');
  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());
  res.setHeader('X-RateLimit-Reset', rateLimit.resetSeconds.toString());

  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', rateLimit.resetSeconds.toString());
    return res.status(429).json({
      success: false,
      message: `Terlalu banyak permintaan API. Harap tunggu ${rateLimit.resetSeconds} detik sebelum mencoba kembali.`,
      retry_after_seconds: rateLimit.resetSeconds,
    });
  }

  // Allow public endpoints
  if (PUBLIC_API_PATHS.includes(req.path)) return next();

  // Validate server-side session token
  const authResult = authenticateRequest(req);

  // If a client attempted to forge identity via x-user-id header or without a valid token, immediately reject with 403
  if (authResult.spoofAttempt) {
    return res.status(403).json({
      success: false,
      message: authResult.error || 'Akses ditolak: Percobaan manipulasi identitas (ID spoofing) terdeteksi.',
    });
  }

  const actor = authResult.user;
  if (!actor) {
    return res.status(401).json({
      success: false,
      message: authResult.error || 'Sesi pengguna tidak valid atau telah kedaluwarsa. Silakan login kembali.',
    });
  }

  // Attach verified actor and session to request for all downstream route handlers
  (req as any).user = actor;
  if (authResult.session) {
    (req as any).session = authResult.session;
  }

  // Auditor is strictly READ-ONLY across the entire system.
  // SECURITY (CR-01): switch-role is no longer an auditor exemption —
  // identity switching must never be usable to escape the read-only gate.
  if (isAuditorActor(actor) && req.method !== 'GET') {
    const allowedAuditorActions = ['/api/auth/logout', '/api/notifications/read-all'];
    const isNotificationRead = req.path.match(/^\/api\/notifications\/[^/]+\/read$/);
    if (!allowedAuditorActions.includes(req.path) && !isNotificationRead) {
      return res.status(403).json({
        success: false,
        message: 'Akses ditolak: Peran Auditor memiliki hak akses Read-Only dan dilarang membuat atau mengubah data.',
      });
    }
  }

  if (req.path === '/api/audit-logs' && !isGlobalObserver(actor)) {
    return res.status(403).json({ success: false, message: 'Akses audit log tidak diizinkan.' });
  }
  if (req.path === '/api/reconciliation' && !isGlobalObserver(actor)) {
    return res.status(403).json({ success: false, message: 'Akses rekonsiliasi tidak diizinkan.' });
  }

  const assetMatch = req.path.match(/^\/api\/assets\/([^/]+)/);
  // '/bulk-import' adalah operasi collection-level (bukan asset id);
  // authority per baris ditegakkan di handler + domain service.
  if (assetMatch && assetMatch[1] !== 'bulk-import' && !canSeeAsset(actor, assetMatch[1])) {
    return res.status(403).json({ success: false, message: 'Aset berada di luar scope pengguna.' });
  }

  const ticketMatch = req.path.match(/^\/api\/tickets\/([^/]+)\/status$/);
  if (ticketMatch && !canManageTicket(actor, ticketMatch[1])) {
    return res.status(403).json({ success: false, message: 'Pengguna tidak berwenang mengubah tiket ini.' });
  }

  if (req.path === '/api/dashboard/attention') {
    const originalJson = res.json.bind(res);
    res.json = ((body: any) => {
      if (body && Array.isArray(body.data)) body = { ...body, data: scopedAttention(actor, body.data) };
      return originalJson(body);
    }) as Response['json'];
  }
  return next();
}
