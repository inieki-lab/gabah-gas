import { NextFunction, Request, Response } from 'express';
import { db, ServerUser, ServerSession } from './db';
import { authenticateRequest, checkApiRateLimit } from './auth';

const isSuperadmin = (actor: ServerUser) => actor.role === 'Admin GABAH';
const isGlobalObserver = (actor: ServerUser) => isSuperadmin(actor) || actor.role === 'Auditor';

export function actorFor(req: Request): ServerUser | null {
  if ((req as any).user) return (req as any).user as ServerUser;
  const result = authenticateRequest(req);
  return result.user;
}

function isItWorkstation(asset: any): boolean {
  const code = String(asset.category_code || asset.asset_code || '').toUpperCase();
  const name = String(asset.name || '').toLowerCase();
  return ['HLT', 'HPC'].includes(code)
    || code.includes('LAP')
    || code.includes('PC')
    || /\blaptop\b|\bnotebook\b|\bpc\b|\bdesktop\b/.test(name);
}

function canSeeAsset(actor: ServerUser, assetId: string): boolean {
  const asset = db.assets.find(a => a.id === assetId);
  if (!asset) return false;
  if (isGlobalObserver(actor)) return true;
  if (actor.role === 'Karyawan') return asset.assigned_to?.id === actor.id || asset.is_loanable;
  if (actor.role === 'IT') return asset.owner_division === 'IT' || asset.owner_division === 'GA';
  if (actor.role === 'GA') return asset.owner_division === 'GA' || (asset.owner_division === 'IT' && isItWorkstation(asset));
  if (actor.role === 'Supply Chain') {
    const loc = String(asset.location || '').toLowerCase();
    const dept = String(actor.department || '').toLowerCase();
    return asset.owner_division === 'SC' || loc.includes('supply chain') || loc.includes('rpc') || (dept.length >= 3 && loc.includes(dept));
  }
  if (actor.role === 'PIBC') {
    const loc = String(asset.location || '').toLowerCase();
    const dept = String(actor.department || '').toLowerCase();
    return asset.owner_division === 'PIBC' || loc.includes('pibc') || (dept.length >= 3 && loc.includes(dept));
  }
  return false;
}

function canManageTicket(actor: ServerUser, ticketId: string): boolean {
  const ticket = db.tickets.find(t => t.id === ticketId);
  if (!ticket) return false;
  if (isSuperadmin(actor)) return true;
  if (actor.role === 'Auditor') return false;
  if (actor.role === 'Karyawan') return ticket.reporter_id === actor.id;
  if (actor.role === 'IT') return ticket.category === 'IT'; // software/license tickets are IT
  if (actor.role === 'GA') return ticket.category === 'GA';
  if (actor.role === 'Supply Chain') return ticket.category === 'SC';
  if (actor.role === 'PIBC') return (ticket.category as string) === 'PIBC';
  return false;
}

function scopedAttention(actor: ServerUser, items: any[]) {
  if (isGlobalObserver(actor)) return items;
  return items.filter(item => {
    if (item.link_type === 'asset') return canSeeAsset(actor, item.link_id);
    if (item.link_type === 'loan') {
      const loan = db.loans.find(l => l.id === item.link_id);
      if (!loan) return false;
      if (actor.role === 'Karyawan') return loan.borrower_id === actor.id;
      return loan.owner_division === actor.division;
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
  if (actor.role === 'Auditor' && req.method !== 'GET') {
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

  if (req.method === 'POST' && req.path === '/api/notifications/read-all') {
    for (const n of db.notifications) {
      if (isGlobalObserver(actor) || n.recipient_role === actor.role || n.recipient_user_id === actor.id || n.recipient_division === actor.division) n.is_read = true;
    }
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
