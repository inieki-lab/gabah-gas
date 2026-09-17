import { NextFunction, Request, Response } from 'express';
import { db, ServerUser } from './db';
import { authenticateRequest } from './auth';

const isSuperadmin = (actor: ServerUser) => actor.role === 'Superadmin' || actor.role === 'Admin GABAH';
const isGlobalObserver = (actor: ServerUser) => isSuperadmin(actor) || actor.role === 'Auditor';

export function actorFor(req: Request): ServerUser | null {
  if ((req as any).user) return (req as any).user as ServerUser;
  const result = authenticateRequest(req);
  return result.user;
}

function canSeeAsset(actor: ServerUser, assetId: string): boolean {
  const asset = db.assets.find(a => a.id === assetId);
  if (!asset) return false;
  if (isGlobalObserver(actor)) return true;
  if (actor.role === 'Karyawan') return asset.assigned_to?.id === actor.id || asset.is_loanable;
  if (actor.role === 'IT') return asset.owner_division === 'IT';
  if (actor.role === 'GA') return asset.owner_division === 'GA';
  if (actor.role === 'Supply Chain') return asset.owner_division === 'SC';
  if (actor.role === 'PIBC') return asset.owner_division === 'PIBC';
  return false;
}

function canManageTicket(actor: ServerUser, ticketId: string): boolean {
  const ticket = db.tickets.find(t => t.id === ticketId);
  if (!ticket) return false;
  if (isSuperadmin(actor)) return true;
  if (actor.role === 'Auditor') return false;
  if (actor.role === 'Karyawan') return ticket.reporter_id === actor.id;
  if (actor.role === 'IT') return ticket.category === 'IT' || ticket.category === 'License';
  if (actor.role === 'GA') return ticket.category === 'GA';
  if (actor.role === 'Supply Chain') return ticket.category === 'SC';
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

// Public endpoints that do not require an active session token
const PUBLIC_API_PATHS = [
  '/api/health',
  '/api/auth/login',
];

export function gabahSecurityMiddleware(req: Request, res: Response, next: NextFunction) {
  // Only intercept API calls
  if (!req.path.startsWith('/api/')) return next();

  // Allow public endpoints
  if (PUBLIC_API_PATHS.includes(req.path)) return next();

  // Validate server-side session token
  const authResult = authenticateRequest(req);

  // If a non-admin client attempted to forge identity via x-user-id header, immediately reject with 403
  if (authResult.spoofAttempt) {
    return res.status(403).json({
      success: false,
      message: 'Akses ditolak: Percobaan manipulasi identitas (ID spoofing) terdeteksi.',
    });
  }

  const actor = authResult.user;
  if (!actor) {
    return res.status(401).json({
      success: false,
      message: authResult.error || 'Sesi pengguna tidak valid atau telah kedaluwarsa. Silakan login kembali.',
    });
  }

  // Attach verified actor to request for all downstream route handlers
  (req as any).user = actor;

  if (req.path === '/api/audit-logs' && !isGlobalObserver(actor)) {
    return res.status(403).json({ success: false, message: 'Akses audit log tidak diizinkan.' });
  }
  if (req.path === '/api/reconciliation' && !isGlobalObserver(actor)) {
    return res.status(403).json({ success: false, message: 'Akses rekonsiliasi tidak diizinkan.' });
  }

  const assetMatch = req.path.match(/^\/api\/assets\/([^/]+)/);
  if (assetMatch && !canSeeAsset(actor, assetMatch[1])) {
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
