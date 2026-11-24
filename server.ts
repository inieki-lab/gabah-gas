import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import { parseTrustedProxyConfig } from './server/trustedProxy';
import multer from 'multer';
import fs from 'node:fs/promises';
import path from 'path';
import { db, seedInitialData, ServerUser, ServerAsset, ServerSession, CANONICAL_USERS } from './server/db';
import { CANONICAL_TAXONOMY, FIXED_ASSET_MAIN_TYPES, isFixedAssetMainType, isGabahCategoryType, isOwnerDivision, normalizeCategoryMaster, resolveTaxonomyByHumanName } from './server/taxonomy';
import { AssetNumberingEngine } from './server/numbering';
import { GabahDomainService, assetVisibleUnderDynamicScopes, canMutateAssetOwner, filterMaintenanceSchedulesByDynamicScopes, isNonLoanableInfrastructureAsset } from './server/services';
import { validateAssetLocation, resolveAssetLocationIdByText, assertValidLocationParent, getAssetLocationPath } from './server/asset-location';
import { ContractDomainService, canSeeContract, canEditContract } from './server/contracts';
import { isEmailConfigured } from './server/notifications/emailProvider';
import { isTelegramConfigured } from './server/notifications/telegramProvider';
import { initializePersistence, persistDataStore, isPostgresPersistenceActive, isPostgresFailureLatched, queryRbac, withRbacTransaction, withLastSuperadminGuard } from './server/persistence';
import { refreshRbacPolicy, startRbacPolicyRefresh, isRbacSuperadmin, isSuperadminActor, countRbacSuperadmins, hasRbacPermission, hasRbacScope, getEffectivePermissionKeys, getEffectiveRoleKeys, isAuditorActor, isAuditorReadPermissionKey } from './server/rbac-policy';
import { startReminderScheduler, runManualOnce as runReminderManualOnce, getSchedulerStatus } from './server/notifications/reminderScheduler';
import { gabahSecurityMiddleware, actorFor } from './server/runtime-hardening';
import { requestContext, extractClientIp } from './server/requestContext';
import { createUploadConcurrencyLimiter, normalizeContractUploadError } from './server/upload-security';
import { filterDashboardAttentionItems } from './server/dashboard-attention-scope';
import {
  createSession,
  destroySession,
  destroyAllUserSessions,
  revokeUserSessions,
  extractToken,
  hashPassword,
  verifyPassword,
  isLoginLocked,
  recordFailedLogin,
  clearFailedLogins,
  sanitizeUser,
  validateRateLimitSecretConfiguration,
} from './server/auth';

// Initialize seed data
seedInitialData();

async function startServer() {
  // Fail before opening listeners or initializing production services if the
  // shared rate limiter would otherwise reuse a database credential.
  validateRateLimitSecretConfiguration();
  await initializePersistence();
  await refreshRbacPolicy();
  startRbacPolicyRefresh();
  AssetNumberingEngine.syncFromExistingRecords({ tickets: db.tickets, loans: db.loans, contracts: db.contracts });

  // CR-05 STEP 4: internal production scheduler for contract reminders.
  // Timezone-aware (GABAH_REMINDER_TIMEZONE, default Asia/Jakarta), configurable
  // interval, leader-locked for multi-instance deployments, and fully contained
  // (a failing tick never crashes the API server).
  startReminderScheduler();

  const app = express();
  // Forwarded protocol/host headers are trusted only from explicitly configured
  // proxy addresses. An unset value preserves Express's secure default (no proxy trust).
  app.set('trust proxy', parseTrustedProxyConfig(process.env.GABAH_TRUST_PROXY));
  const PORT = Number(process.env.PORT || 3000);
  const setSessionCookie = (res: express.Response, token: string) => res.cookie('gabah_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  const clearSessionCookie = (res: express.Response) => res.clearCookie('gabah_session', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });

  // Baseline browser security headers apply to API, HTML, and static assets.
  // CSP starts in report-only mode: script execution is same-origin only, while
  // known inline styles and current external font/image integrations are inventoried.
  const cspReportOnlyPolicy = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https: wss:",
    "media-src 'self' blob: https:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
  ].join('; ');
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Content-Security-Policy-Report-Only', cspReportOnlyPolicy);
    if (req.path.toLowerCase().startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Pragma', 'no-cache');
    }
    next();
  });

  // Keep JSON API payloads explicitly bounded while allowing legitimate bulk imports.
  // The 2 MiB cap is a server-side ceiling; multipart uploads have separate stricter limits below.
  app.use(express.json({ limit: '2mb' }));

  // Body-parser errors occur before route handlers. Return stable JSON errors rather
  // than Express's default HTML response, and never continue to a mutation route.
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({
        success: false,
        code: 'REQUEST_BODY_TOO_LARGE',
        message: 'Ukuran request melebihi batas 2 MB.',
      });
    }
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({
        success: false,
        code: 'INVALID_JSON',
        message: 'Format JSON pada request tidak valid.',
      });
    }
    return next(err);
  });

  // Per-request audit context: carry the client IP through the async chain so
  // recordAudit writers can stamp ip_address (P2#9).
  app.use((req, res, next) => {
    requestContext.run({ ip: extractClientIp(req) }, () => next());
  });

  // Production API security and session/role hardening
  app.use(gabahSecurityMiddleware);

  // Gate successful state-changing API responses on durable persistence.
  // Express res.json() delegates to res.send(), so this also covers JSON APIs
  // whose handlers do not explicitly call persistDataStore().
  app.use((req, res, next) => {
    if (req.method === 'GET' || !req.path.toLowerCase().startsWith('/api/')) return next();
    const originalSend = res.send.bind(res);
    res.send = ((body?: any) => {
      if (res.statusCode < 200 || res.statusCode >= 400 || (req as any).__gabahPersisted) {
        return originalSend(body);
      }
      // A duplicate send during the persistence wait must not bypass the gate.
      if ((req as any).__gabahPersisting) return res;
      (req as any).__gabahPersisting = true;
      void persistDataStore().then(() => {
        (req as any).__gabahPersisted = true;
        originalSend(body);
      }).catch(error => {
        console.error('[persistence] API response blocked because state was not committed:', error?.message || error);
        if (!res.headersSent) {
          res.status(typeof error?.statusCode === 'number' ? error.statusCode : 503);
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          originalSend(JSON.stringify({
            success: false,
            code: 'PERSISTENCE_UNAVAILABLE',
            message: 'Perubahan belum dapat disimpan. Silakan coba kembali setelah layanan database pulih.',
          }));
        }
      });
      return res;
    }) as typeof res.send;
    next();
  });

  // Helper to extract authenticated user from verified request context
  const getActor = (req: express.Request): ServerUser => {
    const verified = (req as any).user || actorFor(req);
    if (verified) return verified;
    throw new Error('Pengguna tidak terautentikasi.');
  };

  // Persist state-changing API requests before reporting success. A failed
  // authoritative write must be visible to the caller as HTTP 503, not hidden
  // behind a successful response or an unhandled post-response rejection.
  const persistBeforeSuccess = async (req: express.Request, res: express.Response): Promise<boolean> => {
    try {
      await persistDataStore();
      (req as any).__gabahPersisted = true;
      return true;
    } catch (error: any) {
      console.error('[persistence] API mutation was not committed:', error?.message || error);
      if (!res.headersSent) {
        res.status(typeof error?.statusCode === 'number' ? error.statusCode : 503).json({
          success: false,
          code: 'PERSISTENCE_UNAVAILABLE',
          message: 'Perubahan belum dapat disimpan. Silakan coba kembali setelah layanan database pulih.',
        });
      }
      return false;
    }
  };
  // Module availability is a separate global lifecycle switch from Dynamic RBAC.
  // Cache status briefly to avoid a PostgreSQL round-trip on every API request.
  const moduleStatusCache = new Map<string, { is_active: boolean; expires_at: number }>();
  const MODULE_STATUS_CACHE_MS = 5000;

  const readModuleStatus = async (moduleKey: string): Promise<boolean> => {
    const now = Date.now();
    const cached = moduleStatusCache.get(moduleKey);
    if (cached && cached.expires_at > now) return cached.is_active;
    const result = await queryRbac<{ is_active: boolean }>(
      'SELECT is_active FROM gabah_modules WHERE module_key = $1',
      [moduleKey],
    );
    if (!result.rows.length) throw new Error(`Module registry entry missing: ${moduleKey}`);
    const isActive = result.rows[0].is_active === true;
    moduleStatusCache.set(moduleKey, { is_active: isActive, expires_at: now + MODULE_STATUS_CACHE_MS });
    return isActive;
  };

  const matchesApiPrefix = (path: string, prefix: string): boolean =>
    path === prefix || path.startsWith(prefix + '/');

  const resolveModuleKeyForRequest = (req: express.Request, actor: ServerUser): string | null => {
    const path = req.path.toLowerCase().replace(/\/+$/, '') || '/';
    if (matchesApiPrefix(path, '/api/modules')) return null;

    if (matchesApiPrefix(path, '/api/assets/create-options')) return 'assets';

    if (matchesApiPrefix(path, '/api/assets')) {
      if (req.method === 'GET') {
        // My Assets and the full asset catalogue share the read endpoint.
        // A principal with catalogue/audit capability must have the Assets
        // module enabled; a self-service reader uses the My Assets module.
        const canReadCatalogue = hasRbacPermission(actor.id, 'assets.catalog.read')
          || hasRbacPermission(actor.id, 'assets.audit.read');
        return canReadCatalogue ? 'assets' : 'my_assets';
      }
      return 'assets';
    }
    if (['/api/taxonomy', '/api/numbering', '/api/movements', '/api/master/asset-locations'].some(prefix => matchesApiPrefix(path, prefix))) return 'assets';
    if (matchesApiPrefix(path, '/api/dashboard')) return 'dashboard';
    if (matchesApiPrefix(path, '/api/loans')) return 'loans';
    if (matchesApiPrefix(path, '/api/tickets')) return 'tickets';
    if (matchesApiPrefix(path, '/api/maintenances')) return 'maintenance';
    if (matchesApiPrefix(path, '/api/vendors')) return 'vendors';
    if (matchesApiPrefix(path, '/api/knowledge')) return 'knowledge';
    if (matchesApiPrefix(path, '/api/contracts')) return 'contracts';
    if (matchesApiPrefix(path, '/api/meeting-rooms') || matchesApiPrefix(path, '/api/room-reservations') || matchesApiPrefix(path, '/api/meeting-types') || matchesApiPrefix(path, '/api/meeting-facilities')) return 'meeting_rooms';
    return null;
  };

  const isModuleManagedPath = (req: express.Request): boolean => {
    const path = req.path.toLowerCase().replace(/\/+$/, '') || '/';
    if (matchesApiPrefix(path, '/api/modules')) return false;
    return [
      '/api/assets', '/api/taxonomy', '/api/numbering', '/api/movements',
      '/api/master/asset-locations', '/api/dashboard', '/api/loans',
      '/api/tickets', '/api/maintenances', '/api/vendors', '/api/knowledge',
      '/api/contracts', '/api/meeting-rooms', '/api/room-reservations',
      '/api/meeting-types', '/api/meeting-facilities',
    ].some(prefix => matchesApiPrefix(path, prefix));
  };

  // This guard runs after authentication and before all business routes.
  // Unmanaged endpoints (login, health, notifications, administration) bypass
  // module status checks; missing registry state fails closed for managed APIs.
  app.use(async (req, res, next) => {
    const requestPath = req.path.toLowerCase().replace(/\/+$/, '') || '/';
    if (!requestPath.startsWith('/api/') || !isPostgresPersistenceActive() || !isModuleManagedPath(req)) return next();
    let actor: ServerUser;
    try {
      actor = getActor(req);
    } catch {
      return res.status(401).json({ success: false, code: 'UNAUTHENTICATED', message: 'Sesi tidak valid.' });
    }
    const moduleKey = resolveModuleKeyForRequest(req, actor);
    if (!moduleKey) return next();
    try {
      if (!(await readModuleStatus(moduleKey))) {
        return res.status(403).json({
          success: false,
          code: 'MODULE_DISABLED',
          module_key: moduleKey,
          message: 'Modul sedang dinonaktifkan oleh administrator.',
        });
      }
      return next();
    } catch {
      return res.status(503).json({
        success: false,
        code: 'MODULE_STATUS_UNAVAILABLE',
        module_key: moduleKey,
        message: 'Status modul belum dapat diverifikasi. Operasi ditolak sementara.',
      });
    }
  });

  // Authenticated users may read global module availability to build navigation.
  app.get('/api/modules', async (req, res) => {
    try {
      getActor(req);
      if (!isPostgresPersistenceActive()) {
        return res.status(503).json({ success: false, code: 'MODULE_REGISTRY_UNAVAILABLE', message: 'Registry modul memerlukan PostgreSQL aktif.' });
      }
      const result = await queryRbac(
        'SELECT module_key, name, description, is_active, is_system, sort_order, updated_at FROM gabah_modules ORDER BY sort_order, module_key',
      );
      res.json({ success: true, data: result.rows });
    } catch (err: any) {
      res.status(503).json({ success: false, code: 'MODULE_REGISTRY_UNAVAILABLE', message: 'Status modul belum dapat dibaca.' });
    }
  });

  app.get('/api/modules/:moduleKey/audit', async (req, res) => {
    try {
      const actor = getActor(req);
      if (!isSuperadminActor(actor)) return res.status(403).json({ success: false, message: 'Hanya Superadmin yang dapat melihat histori perubahan modul.' });
      if (!isPostgresPersistenceActive()) return res.status(503).json({ success: false, code: 'MODULE_REGISTRY_UNAVAILABLE' });
      const moduleKey = String(req.params.moduleKey || '').trim();
      if (!/^[a-z][a-z0-9_]{1,79}$/.test(moduleKey)) return res.status(400).json({ success: false, message: 'Kode modul tidak valid.' });
      const exists = await queryRbac('SELECT 1 FROM gabah_modules WHERE module_key = $1', [moduleKey]);
      if (!exists.rows.length) return res.status(404).json({ success: false, message: 'Modul tidak ditemukan.' });
      const audit = await queryRbac(
        'SELECT id, module_key, previous_is_active, new_is_active, reason, changed_by_user_id, changed_at FROM gabah_module_status_audit WHERE module_key = $1 ORDER BY changed_at DESC LIMIT 50',
        [moduleKey],
      );
      res.json({ success: true, data: audit.rows });
    } catch {
      res.status(503).json({ success: false, code: 'MODULE_AUDIT_UNAVAILABLE', message: 'Histori modul belum dapat dibaca.' });
    }
  });

  app.patch('/api/modules/:moduleKey', async (req, res) => {
    try {
      const actor = getActor(req);
      if (!isSuperadminActor(actor)) return res.status(403).json({ success: false, message: 'Hanya Superadmin yang dapat mengubah status modul.' });
      if (!isPostgresPersistenceActive()) return res.status(503).json({ success: false, code: 'MODULE_REGISTRY_UNAVAILABLE' });
      const moduleKey = String(req.params.moduleKey || '').trim();
      const { is_active, reason } = req.body || {};
      if (!/^[a-z][a-z0-9_]{1,79}$/.test(moduleKey)) return res.status(400).json({ success: false, message: 'Kode modul tidak valid.' });
      if (typeof is_active !== 'boolean') return res.status(400).json({ success: false, message: 'is_active harus berupa boolean true atau false.' });
      if (typeof reason !== 'string' || reason.trim().length < 5 || reason.trim().length > 500) {
        return res.status(400).json({ success: false, message: 'Alasan perubahan wajib 5–500 karakter.' });
      }
      const updated = await withRbacTransaction(async client => {
        const current = await client.query(
          'SELECT module_key, name, is_active, is_system, sort_order FROM gabah_modules WHERE module_key = $1 FOR UPDATE',
          [moduleKey],
        );
        if (!current.rows.length) {
          throw Object.assign(new Error('Modul tidak ditemukan.'), { statusCode: 404 });
        }
        const previous = current.rows[0].is_active === true;
        if (previous === is_active) return current.rows[0];
        const result = await client.query(
          'UPDATE gabah_modules SET is_active = $2, updated_by_user_id = $3, updated_at = NOW() WHERE module_key = $1 RETURNING module_key, name, description, is_active, is_system, sort_order, updated_at',
          [moduleKey, is_active, actor.id],
        );
        await client.query(
          'INSERT INTO gabah_module_status_audit (module_key, previous_is_active, new_is_active, reason, changed_by_user_id) VALUES ($1, $2, $3, $4, $5)',
          [moduleKey, previous, is_active, reason.trim(), actor.id],
        );
        return result.rows[0];
      });
      moduleStatusCache.delete(moduleKey);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      const status = typeof err?.statusCode === 'number' ? err.statusCode : 503;
      res.status(status).json({ success: false, message: status === 404 ? 'Modul tidak ditemukan.' : 'Status modul gagal diperbarui.' });
    }
  });


  // Effective permissions are returned only to the authenticated principal.
  // This drives the UI menu; backend route guards remain authoritative.
  const serializeAuthenticatedUser = (user: ServerUser): any => {
    const safe = sanitizeUser(user) as any;
    if (isPostgresPersistenceActive()) {
      safe.is_superadmin = isRbacSuperadmin(String(user.id));
      safe.permission_keys = safe.is_superadmin ? ['*'] : getEffectivePermissionKeys(String(user.id));
      safe.role_keys = getEffectiveRoleKeys(String(user.id));
    } else {
      safe.is_superadmin = user.role === 'Admin GABAH';
    }
    return safe;
  };

  const hasApplicationRole = (actor: ServerUser, roleKey: string): boolean => {
    const legacyLabels: Record<string, string> = {
      superadmin: 'Admin GABAH',
      it: 'IT',
      ga: 'GA',
      karyawan: 'Karyawan',
      auditor: 'Auditor',
      humas: 'Humas',
      sekretaris_direksi: 'Sekretaris Direksi',
      supply_chain: 'Supply Chain',
      pibc: 'PIBC',
    };
    // File-store compatibility aliases for the dedicated ME ticket templates.
    // The ME queue is a unit-scoped capability, not a primary profile or owner division.
    const secondaryRoleAliases: Record<string, string[]> = {
      me: ['admin_tiket_me'],
    };
    // Production authorization is assignment-only: legacy profile labels must
    // never grant operational capabilities without an active Dynamic RBAC role.
    if (isPostgresPersistenceActive()) {
      return getEffectiveRoleKeys(String(actor.id)).includes(roleKey);
    }
    // File-store development retains compatibility while PostgreSQL is absent.
    return actor.role === legacyLabels[roleKey]
      || actor.role_keys?.includes(roleKey) === true
      || (secondaryRoleAliases[roleKey] || []).some(alias => actor.role_keys?.includes(alias) === true);
  };

  // Permission guard for migrated endpoints. PostgreSQL policy is authoritative in
  // production; JSON/file-store development retains legacy behavior during migration.
  const requireRbacPermission = (req: express.Request, res: express.Response, permissionKey: string): boolean => {
    const actor = (req as any).user as ServerUser | undefined;
    // Auditor deny-write applies in both PostgreSQL and file-store modes and
    // takes precedence over any other assigned role or permission.
    if (actor && isAuditorActor(actor) && !isAuditorReadPermissionKey(permissionKey)) {
      res.status(403).json({ success: false, message: 'Akses ditolak: Auditor hanya memiliki izin baca (read-only).' });
      return false;
    }
    if (!isPostgresPersistenceActive()) return true;
    if (!actor || !hasRbacPermission(actor.id, permissionKey)) {
      res.status(403).json({ success: false, message: 'Akses ditolak: permission ' + permissionKey + ' tidak diberikan kepada user ini.' });
      return false;
    }
    return true;
  };

  // Dynamic RBAC administration API. Runtime business authorization remains legacy
  // until all endpoints are migrated and regression-tested.
  const requireRbacSuperadmin = (req: express.Request, res: express.Response): ServerUser | null => {
    const actor = (req as any).user as ServerUser | undefined;
    if (!isPostgresPersistenceActive()) {
      res.status(503).json({ success: false, message: 'Dynamic RBAC memerlukan PostgreSQL aktif.' });
      return null;
    }
    if (!actor || !isRbacSuperadmin(actor.id)) {
      res.status(403).json({ success: false, message: 'Hanya user dengan assignment Superadmin aktif yang berwenang mengelola role dan permission.' });
      return null;
    }
    return actor;
  };
  const primaryRoleKey = (label: string): string => {
    const normalized = String(label || 'Karyawan').trim();
    return normalized === 'Admin GABAH' || normalized === 'Superadmin'
      ? 'superadmin'
      : 'karyawan';
  };

  // Keep users.role and the primary dynamic RBAC assignment synchronized,
  // while preserving any additional job-function roles assigned by Super Admin.
  const syncPrimaryRbacRoles = async (users: Array<{ id: string; role: string }>): Promise<void> => {
    if (!isPostgresPersistenceActive() || users.length === 0) return;
    await withRbacTransaction(async client => {
      for (const user of users) {
        const roleKey = primaryRoleKey(user.role);
        const result = await client.query(
          'SELECT id FROM gabah_roles WHERE is_active = TRUE AND (role_key = $1 OR name = $2) ORDER BY CASE WHEN role_key = $1 THEN 0 ELSE 1 END LIMIT 1',
          [roleKey, user.role]
        );
        const roleId = Number(result.rows[0]?.id);
        if (!Number.isSafeInteger(roleId) || roleId < 1) {
          throw new Error('Role aplikasi "' + user.role + '" belum tersedia/aktif di master RBAC.');
        }
        await client.query('DELETE FROM gabah_user_roles WHERE user_id = $1 AND is_primary = TRUE AND role_id <> $2', [user.id, roleId]);
        await client.query(
          'INSERT INTO gabah_user_roles (user_id, role_id, is_primary) VALUES ($1, $2, TRUE) ON CONFLICT (user_id, role_id) DO UPDATE SET is_primary = TRUE',
          [user.id, roleId]
        );
      }
    });
  };
  const syncPrimaryRbacRole = async (userId: string, roleLabel: string): Promise<void> => {
    await syncPrimaryRbacRoles([{ id: userId, role: roleLabel }]);
  };

  // Last-Superadmin decisions must read the authoritative database while the
  // shared advisory lock is held; process-local RBAC caches are not sufficient.
  const isActiveSuperadminInDatabase = async (userId: string): Promise<boolean> => {
    const result = await queryRbac<{ is_superadmin: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM users u JOIN gabah_user_roles ur ON ur.user_id = u.id::text JOIN gabah_roles r ON r.id = ur.role_id WHERE u.id = $1 AND u.is_active = TRUE AND r.is_superadmin = TRUE AND NOT EXISTS (SELECT 1 FROM gabah_user_roles aur JOIN gabah_roles ar ON ar.id = aur.role_id WHERE aur.user_id = u.id::text AND ar.role_key = 'auditor')) AS is_superadmin",
      [userId],
    );
    return result.rows[0]?.is_superadmin === true;
  };
  const countActiveSuperadminsInDatabase = async (): Promise<number> => {
    const result = await queryRbac<{ count: number }>(
      "SELECT COUNT(DISTINCT u.id)::int AS count FROM users u JOIN gabah_user_roles ur ON ur.user_id = u.id::text JOIN gabah_roles r ON r.id = ur.role_id WHERE u.is_active = TRUE AND r.is_superadmin = TRUE AND NOT EXISTS (SELECT 1 FROM gabah_user_roles aur JOIN gabah_roles ar ON ar.id = aur.role_id WHERE aur.user_id = u.id::text AND ar.role_key = 'auditor')",
    );
    return Number(result.rows[0]?.count || 0);
  };

  const rbacFailure = (res: express.Response, error: any) => {
    if (error?.code === '23505') return res.status(409).json({ success: false, message: 'Nama atau kunci role sudah digunakan.' });
    if (error?.code === '23503') return res.status(409).json({ success: false, message: 'Role masih memiliki relasi yang digunakan.' });
    const message = String(error?.message || '');
    if (message.includes('memerlukan PostgreSQL aktif')) return res.status(503).json({ success: false, message });
    if (message === 'RBAC_ROLE_NOT_FOUND') return res.status(404).json({ success: false, message: 'Role tidak ditemukan.' });
    if (message === 'RBAC_SUPERADMIN_PROTECTED') return res.status(409).json({ success: false, message: 'Role Superadmin dilindungi dan tidak dapat dinonaktifkan, dihapus, atau kehilangan kendali tertingginya.' });
    if (message === 'RBAC_ROLE_IN_USE') return res.status(409).json({ success: false, message: 'Role masih ditetapkan ke user. Pindahkan assignment terlebih dahulu.' });
    if (message === 'RBAC_PERMISSION_INVALID') return res.status(400).json({ success: false, message: 'Satu atau lebih permission tidak terdaftar atau sudah nonaktif.' });
    if (message === 'RBAC_PERMISSION_PROTECTED') return res.status(409).json({ success: false, message: 'Permission sistem inti hanya dapat dikelola melalui konfigurasi Superadmin dan tidak dapat diberikan ke role kustom.' });
    if (message === 'RBAC_USER_NOT_FOUND') return res.status(404).json({ success: false, message: 'User target tidak ditemukan.' });
    if (message === 'RBAC_ROLE_INVALID') return res.status(400).json({ success: false, message: 'Satu atau lebih role tidak terdaftar atau sudah nonaktif.' });
    if (message === 'RBAC_LAST_SUPERADMIN') return res.status(409).json({ success: false, message: 'Superadmin aktif terakhir tidak boleh kehilangan role Superadmin.' });
    if (message === 'RBAC_AUDITOR_SUPERADMIN_CONFLICT') return res.status(409).json({ success: false, message: 'Role Auditor read-only tidak dapat digabung dengan role Superadmin pada satu akun.' });
    return res.status(400).json({ success: false, message: 'Permintaan Dynamic RBAC tidak valid atau gagal diproses.' });
  };

  app.get('/api/admin/rbac/permissions', async (req, res) => {
    if (!requireRbacSuperadmin(req, res)) return;
    try {
      const result = await queryRbac("SELECT permission_key, module, action, description, is_active FROM gabah_permissions WHERE is_active = TRUE AND permission_key NOT IN ('system.authentication', 'system.audit', 'system.super_admin') ORDER BY module, action, permission_key");
      return res.json({ success: true, data: result.rows });
    } catch (error: any) { return rbacFailure(res, error); }
  });

  app.get('/api/admin/rbac/roles', async (req, res) => {
    if (!requireRbacSuperadmin(req, res)) return;
    try {
      const roles = await queryRbac<any>('SELECT r.id, r.role_key, r.name, r.description, r.is_superadmin, r.is_active, r.created_at, r.updated_at, (SELECT COUNT(*)::int FROM gabah_user_roles ur WHERE ur.role_id = r.id) AS assigned_user_count FROM gabah_roles r ORDER BY r.is_superadmin DESC, r.name');
      const [permissions, scopes] = await Promise.all([
        queryRbac<any>('SELECT rp.role_id, p.permission_key FROM gabah_role_permissions rp JOIN gabah_permissions p USING (permission_key) WHERE p.is_active = TRUE ORDER BY p.module, p.action'),
        queryRbac<any>('SELECT role_id, module, scope_type, scope_value FROM gabah_role_division_scopes ORDER BY role_id, module, scope_type, scope_value')
      ]);
      return res.json({ success: true, data: roles.rows.map(role => ({
        ...role,
        permissions: permissions.rows.filter(p => p.role_id === role.id).map(p => p.permission_key),
        scopes: scopes.rows.filter(s => s.role_id === role.id).map(s => ({ module: s.module || '*', type: s.scope_type, value: s.scope_value }))
      })) });
    } catch (error: any) { return rbacFailure(res, error); }
  });

  app.get('/api/admin/rbac/user-assignments', async (req, res) => {
    if (!requireRbacSuperadmin(req, res)) return;
    try {
      const result = await queryRbac<any>(
        'SELECT u.id AS user_id, u.name, u.email, u.role AS primary_profile_role, ' +
        'COALESCE(array_agg(ur.role_id ORDER BY ur.is_primary DESC, ur.role_id) FILTER (WHERE ur.role_id IS NOT NULL), ARRAY[]::bigint[]) AS role_ids, ' +
        'MAX(ur.role_id) FILTER (WHERE ur.is_primary = TRUE) AS primary_role_id ' +
        'FROM users u LEFT JOIN gabah_user_roles ur ON ur.user_id = u.id::text ' +
        'GROUP BY u.id, u.name, u.email, u.role ORDER BY u.name'
      );
      return res.json({ success: true, data: result.rows.map(row => ({
        ...row,
        role_ids: (row.role_ids || []).map(Number),
        primary_role_id: row.primary_role_id == null ? null : Number(row.primary_role_id),
      })) });
    } catch (error: any) { return rbacFailure(res, error); }
  });

  app.post('/api/admin/rbac/roles', async (req, res) => {
    const actor = requireRbacSuperadmin(req, res);
    if (!actor) return;
    try {
      const name = String(req.body?.name || '').trim();
      const description = String(req.body?.description || '').trim() || null;
      const roleKey = String(req.body?.role_key || name).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      if (name.length < 2 || name.length > 120 || !/^[a-z][a-z0-9_]{1,79}$/.test(roleKey) || roleKey === 'superadmin') {
        return res.status(400).json({ success: false, message: 'Nama role harus 2–120 karakter dan kunci internal harus valid. Kunci superadmin dicadangkan.' });
      }
      const requestedKeys = req.body?.permission_keys === undefined ? [] : req.body.permission_keys;
      if (!Array.isArray(requestedKeys) || requestedKeys.some((key: unknown) => typeof key !== 'string')) {
        return res.status(400).json({ success: false, message: 'Daftar permission role tidak valid.' });
      }
      const permissionKeys = [...new Set(requestedKeys as string[])];
      if (permissionKeys.length === 0) return res.status(400).json({ success: false, message: 'Role baru wajib memiliki minimal satu permission aktif.' });
      if (permissionKeys.some(key => ['system.authentication', 'system.audit', 'system.super_admin'].includes(key))) throw new Error('RBAC_PERMISSION_PROTECTED');
      const result = await withRbacTransaction(async client => {
        if (permissionKeys.length > 0) {
          const valid = await client.query('SELECT permission_key FROM gabah_permissions WHERE is_active = TRUE AND permission_key = ANY($1::varchar[])', [permissionKeys]);
          if (valid.rowCount !== permissionKeys.length) throw new Error('RBAC_PERMISSION_INVALID');
        }
        const inserted = await client.query(
          'INSERT INTO gabah_roles (role_key, name, description, is_superadmin, is_active) VALUES ($1, $2, $3, FALSE, TRUE) RETURNING id, role_key, name, description, is_superadmin, is_active, created_at, updated_at',
          [roleKey, name, description],
        );
        for (const permissionKey of permissionKeys) {
          await client.query('INSERT INTO gabah_role_permissions (role_id, permission_key) VALUES ($1, $2)', [inserted.rows[0].id, permissionKey]);
        }
        return inserted.rows[0];
      });
      await refreshRbacPolicy();
      GabahDomainService.recordAudit('RBAC_ROLE_CREATED', 'Administration', 'Superadmin membuat role "' + name + '" (' + roleKey + ') dengan ' + permissionKeys.length + ' permission.', actor);
      return res.status(201).json({ success: true, data: { ...result, permissions: permissionKeys, scopes: [], assigned_user_count: 0 } });
    } catch (error: any) { return rbacFailure(res, error); }
  });

  app.patch('/api/admin/rbac/roles/:id', async (req, res) => {
    const actor = requireRbacSuperadmin(req, res);
    if (!actor) return;
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ success: false, message: 'ID role tidak valid.' });
    if (req.body?.is_active !== undefined && typeof req.body.is_active !== 'boolean') return res.status(400).json({ success: false, message: 'Status role harus berupa boolean.' });
    try {
      const result = await withRbacTransaction(async client => {
        const found = await client.query('SELECT id, role_key, name, description, is_superadmin, is_active FROM gabah_roles WHERE id = $1 FOR UPDATE', [id]);
        const role = found.rows[0];
        if (!role) throw new Error('RBAC_ROLE_NOT_FOUND');
        if (role.is_superadmin && req.body?.is_active === false) throw new Error('RBAC_SUPERADMIN_PROTECTED');
        if (req.body?.is_active === false) {
          const assigned = await client.query('SELECT COUNT(*)::int AS count FROM gabah_user_roles WHERE role_id = $1', [id]);
          if (Number(assigned.rows[0]?.count || 0) > 0) throw new Error('RBAC_ROLE_IN_USE');
        }
        const name = req.body?.name === undefined ? role.name : String(req.body.name).trim();
        const description = req.body?.description === undefined ? role.description : (String(req.body.description).trim() || null);
        const active = req.body?.is_active === undefined ? role.is_active : Boolean(req.body.is_active);
        if (name.length < 2 || name.length > 120) throw new Error('Nama role harus 2–120 karakter.');
        const updated = await client.query('UPDATE gabah_roles SET name = $2, description = $3, is_active = $4, updated_at = NOW() WHERE id = $1 RETURNING id, role_key, name, description, is_superadmin, is_active, created_at, updated_at', [id, name, description, active]);
        return updated.rows[0];
      });
      await refreshRbacPolicy();
      GabahDomainService.recordAudit('RBAC_ROLE_UPDATED', 'Administration', 'Superadmin memperbarui role "' + result.name + '" (' + result.role_key + ').', actor);
      return res.json({ success: true, data: result });
    } catch (error: any) { return rbacFailure(res, error); }
  });

  app.delete('/api/admin/rbac/roles/:id', async (req, res) => {
    const actor = requireRbacSuperadmin(req, res);
    if (!actor) return;
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ success: false, message: 'ID role tidak valid.' });
    try {
      const deleted = await withRbacTransaction(async client => {
        const found = await client.query('SELECT id, role_key, name, is_superadmin FROM gabah_roles WHERE id = $1 FOR UPDATE', [id]);
        const role = found.rows[0];
        if (!role) throw new Error('RBAC_ROLE_NOT_FOUND');
        if (role.is_superadmin || role.role_key === 'superadmin') throw new Error('RBAC_SUPERADMIN_PROTECTED');
        const assigned = await client.query('SELECT COUNT(*)::int AS count FROM gabah_user_roles WHERE role_id = $1', [id]);
        if (Number(assigned.rows[0]?.count || 0) > 0) throw new Error('RBAC_ROLE_IN_USE');
        await client.query('DELETE FROM gabah_roles WHERE id = $1', [id]);
        return role;
      });
      await refreshRbacPolicy();
      GabahDomainService.recordAudit('RBAC_ROLE_DELETED', 'Administration', 'Superadmin menghapus role "' + deleted.name + '" (' + deleted.role_key + ').', actor);
      return res.json({ success: true, data: { id: deleted.id, role_key: deleted.role_key } });
    } catch (error: any) { return rbacFailure(res, error); }
  });

  app.put('/api/admin/rbac/roles/:id/permissions', async (req, res) => {
    const actor = requireRbacSuperadmin(req, res);
    if (!actor) return;
    const id = Number(req.params.id);
    const keys = req.body?.permission_keys;
    if (!Number.isSafeInteger(id) || id < 1 || !Array.isArray(keys) || keys.some((key: unknown) => typeof key !== 'string')) {
      return res.status(400).json({ success: false, message: 'ID role atau daftar permission tidak valid.' });
    }
    try {
      const result = await withRbacTransaction(async client => {
        const found = await client.query('SELECT id, role_key, is_superadmin FROM gabah_roles WHERE id = $1 FOR UPDATE', [id]);
        const role = found.rows[0];
        if (!role) throw new Error('RBAC_ROLE_NOT_FOUND');
        if (role.is_superadmin || role.role_key === 'superadmin') throw new Error('RBAC_SUPERADMIN_PROTECTED');
        const uniqueKeys = [...new Set(keys as string[])];
        if (uniqueKeys.some(key => ['system.authentication', 'system.audit', 'system.super_admin'].includes(key))) throw new Error('RBAC_PERMISSION_PROTECTED');
        const valid = await client.query('SELECT permission_key FROM gabah_permissions WHERE is_active = TRUE AND permission_key = ANY($1::varchar[])', [uniqueKeys]);
        if (valid.rowCount !== uniqueKeys.length) throw new Error('RBAC_PERMISSION_INVALID');
        await client.query('DELETE FROM gabah_role_permissions WHERE role_id = $1', [id]);
        for (const key of uniqueKeys) await client.query('INSERT INTO gabah_role_permissions (role_id, permission_key) VALUES ($1, $2)', [id, key]);
        await client.query('UPDATE gabah_roles SET updated_at = NOW() WHERE id = $1', [id]);
        return { role_key: role.role_key, permission_keys: uniqueKeys };
      });
      await refreshRbacPolicy();
      GabahDomainService.recordAudit('RBAC_PERMISSIONS_UPDATED', 'Administration', 'Superadmin mengubah permission role "' + result.role_key + '".', actor);
      return res.json({ success: true, data: result });
    } catch (error: any) { return rbacFailure(res, error); }
  });

  app.put('/api/admin/rbac/roles/:id/scopes', async (req, res) => {
    const actor = requireRbacSuperadmin(req, res);
    if (!actor) return;
    const id = Number(req.params.id);
    const scopes = req.body?.scopes;
    const validTypes = new Set(['all', 'own', 'division', 'division_except', 'unit', 'location']);
    if (!Number.isSafeInteger(id) || id < 1 || !Array.isArray(scopes)) {
      return res.status(400).json({ success: false, message: 'ID role atau daftar scope tidak valid.' });
    }
    if (scopes.some((scope: any) => !scope || !validTypes.has(scope.type)
      || (scope.module !== undefined && (typeof scope.module !== 'string' || !scope.module.trim()))
      || (['division', 'division_except', 'unit', 'location'].includes(scope.type) && (typeof scope.value !== 'string' || !scope.value.trim()))
      || (['all', 'own'].includes(scope.type) && scope.value != null))) {
      return res.status(400).json({ success: false, message: 'Scope harus memiliki modul, tipe all/own tanpa nilai, atau division/division_except/unit/location dengan nilai.' });
    }
    try {
      const result = await withRbacTransaction(async client => {
        const found = await client.query('SELECT id, role_key, is_superadmin FROM gabah_roles WHERE id = $1 FOR UPDATE', [id]);
        const role = found.rows[0];
        if (!role) throw new Error('RBAC_ROLE_NOT_FOUND');
        if (role.is_superadmin || role.role_key === 'superadmin') throw new Error('RBAC_SUPERADMIN_PROTECTED');
        const moduleRows = await client.query('SELECT DISTINCT module FROM gabah_permissions WHERE is_active = TRUE');
        const validModules = new Set(['*', ...moduleRows.rows.map((row: any) => String(row.module))]);
        if (scopes.some((scope: any) => !validModules.has(scope.module || '*'))) {
          throw new Error('RBAC_SCOPE_MODULE_INVALID');
        }
        await client.query('DELETE FROM gabah_role_division_scopes WHERE role_id = $1', [id]);
        for (const scope of scopes) {
          await client.query(
            'INSERT INTO gabah_role_division_scopes (role_id, module, scope_type, scope_value) VALUES ($1, $2, $3, $4)',
            [id, scope.module || '*', scope.type, ['all', 'own'].includes(scope.type) ? null : scope.value.trim()]
          );
        }
        await client.query('UPDATE gabah_roles SET updated_at = NOW() WHERE id = $1', [id]);
        return { role_key: role.role_key, scopes };
      });
      await refreshRbacPolicy();
      GabahDomainService.recordAudit('RBAC_SCOPES_UPDATED', 'Administration', 'Superadmin mengubah scope role "' + result.role_key + '".', actor);
      return res.json({ success: true, data: result });
    } catch (error: any) { return rbacFailure(res, error); }
  });

  app.put('/api/admin/rbac/users/:id/roles', async (req, res) => {
    const actor = requireRbacSuperadmin(req, res);
    if (!actor) return;
    const userId = String(req.params.id || '');
    const roleIds = req.body?.role_ids;
    if (!userId || !Array.isArray(roleIds) || roleIds.some((value: unknown) => !Number.isSafeInteger(value) || (value as number) < 1)) {
      return res.status(400).json({ success: false, message: 'ID user atau daftar role tidak valid.' });
    }
    try {
      await withLastSuperadminGuard(async () => {
      if (isPostgresPersistenceActive() && !(await isActiveSuperadminInDatabase(actor.id))) {
        return res.status(403).json({ success: false, message: 'Assignment Superadmin Anda sudah tidak aktif.' });
      }
      const result = await withRbacTransaction(async client => {}
        const target = await client.query('SELECT id, name, email, role, is_active FROM users WHERE id = $1', [userId]);
        const user = target.rows[0];
        if (!user) throw new Error('RBAC_USER_NOT_FOUND');
        const uniqueIds = [...new Set((roleIds as number[]).map(Number))];
        const primaryKey = primaryRoleKey(String(user.role || 'Karyawan'));
        const primaryResult = await client.query('SELECT id FROM gabah_roles WHERE is_active = TRUE AND (role_key = $1 OR name = $2) ORDER BY CASE WHEN role_key = $1 THEN 0 ELSE 1 END LIMIT 1', [primaryKey, String(user.role || 'Karyawan')]);
        const primaryRoleId = Number(primaryResult.rows[0]?.id);
        if (!Number.isSafeInteger(primaryRoleId) || primaryRoleId < 1) throw new Error('RBAC_PRIMARY_ROLE_NOT_FOUND');
        const assignmentIds = [...new Set([...uniqueIds, primaryRoleId])];
        const valid = await client.query('SELECT id, name, role_key, is_superadmin FROM gabah_roles WHERE is_active = TRUE AND id = ANY($1::bigint[])', [assignmentIds]);
        if (valid.rowCount !== assignmentIds.length) throw new Error('RBAC_ROLE_INVALID');
        if (valid.rows.some(row => row.role_key === 'auditor') && valid.rows.some(row => row.is_superadmin)) {
          throw new Error('RBAC_AUDITOR_SUPERADMIN_CONFLICT');
        }
        // Last-superadmin protection mirrors PATCH/DELETE /api/users/:id: the
        // target must keep a superadmin-capable role if it is the only holder.
        const current = await client.query('SELECT ur.role_id FROM gabah_user_roles ur JOIN gabah_roles r ON r.id = ur.role_id WHERE ur.user_id = $1 AND r.is_superadmin = TRUE', [userId]);
        if (user.is_active === true && current.rowCount > 0 && !valid.rows.some(row => row.is_superadmin)) {
          const remaining = await client.query(
            'SELECT COUNT(*)::int AS count FROM gabah_user_roles ur JOIN gabah_roles r ON r.id = ur.role_id ' +
            'JOIN users active_user ON active_user.id::text = ur.user_id AND active_user.is_active = TRUE ' +
            'WHERE r.is_superadmin = TRUE AND ur.user_id <> $1 ' +
            'AND NOT EXISTS (SELECT 1 FROM gabah_user_roles aur JOIN gabah_roles ar ON ar.id = aur.role_id WHERE aur.user_id = ur.user_id AND ar.role_key = \'auditor\')',
            [userId],
          );
          if (Number(remaining.rows[0]?.count || 0) === 0) throw new Error('RBAC_LAST_SUPERADMIN');
        }
        // Replace whole assignment set in one transaction: partial writes roll
        // back together, so a user is never left with half of a new set.
        await client.query('DELETE FROM gabah_user_roles WHERE user_id = $1', [userId]);
        for (const roleId of assignmentIds) {
          await client.query(
            'INSERT INTO gabah_user_roles (user_id, role_id, is_primary, assigned_by_user_id) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, role_id) DO UPDATE SET is_primary = EXCLUDED.is_primary',
            [userId, roleId, roleId === primaryRoleId, actor.id],
          );
        }
        return {
          user_id: userId,
          user_name: String(user.name),
          user_email: String(user.email),
          role_ids: assignmentIds,
          role_names: valid.rows.map(row => String(row.name)),
          primary_role_id: primaryRoleId,
        };
      });
      // A role-set change is a material privilege change: invalidate every existing session.
      revokeUserSessions(userId);
      await refreshRbacPolicy();
     GabahDomainService.recordAudit(
        'RBAC_USER_ROLES_UPDATED',
        'Administration',
        'Superadmin mengubah assignment role untuk user "' + result.user_name + '" (' + result.user_email + ') menjadi: ' + result.role_names.join(', ') + '.',
        actor,
      );
      return res.json({ success: true, data: result });
      });
    } catch (error: any) { return rbacFailure(res, error); }
  });

  // Notification rule switches are server-authoritative. Rule definitions remain code-owned.
  const NOTIFICATION_RULE_IDS = new Set(['rule-warranty', 'rule-loan', 'rule-sla', 'rule-bast']);
  app.get('/api/admin/notification-rules', async (req, res) => {
    try {
      getActor(req);
      if (!isPostgresPersistenceActive()) {
        return res.status(503).json({ success: false, code: 'NOTIFICATION_RULE_SETTINGS_UNAVAILABLE', message: 'Konfigurasi aturan notifikasi memerlukan PostgreSQL aktif.' });
      }
      const result = await queryRbac<any>(
        'SELECT rule_id, is_active, updated_at, updated_by_user_id FROM gabah_notification_rule_settings ORDER BY rule_id',
      );
      if (result.rows.length !== NOTIFICATION_RULE_IDS.size) {
        return res.status(503).json({ success: false, code: 'NOTIFICATION_RULE_SETTINGS_UNAVAILABLE', message: 'Konfigurasi aturan notifikasi belum lengkap di database.' });
      }
      return res.json({ success: true, data: result.rows });
    } catch (error: any) { return rbacFailure(res, error); }
  });

  app.patch('/api/admin/notification-rules/:ruleId', async (req, res) => {
    const actor = requireRbacSuperadmin(req, res);
    if (!actor) return;
    const ruleId = String(req.params.ruleId || '');
    if (!NOTIFICATION_RULE_IDS.has(ruleId) || typeof req.body?.is_active !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Aturan notifikasi atau status tidak valid.' });
    }
    try {
      const updated = await withRbacTransaction(async client => {
        const current = await client.query<{ is_active: boolean }>(
          'SELECT is_active FROM gabah_notification_rule_settings WHERE rule_id = $1 FOR UPDATE',
          [ruleId],
        );
        if (!current.rows.length) throw new Error('NOTIFICATION_RULE_NOT_FOUND');
        const previous = current.rows[0].is_active === true;
        const next = req.body.is_active as boolean;
        if (previous === next) {
          const unchanged = await client.query(
            'SELECT rule_id, is_active, updated_at, updated_by_user_id FROM gabah_notification_rule_settings WHERE rule_id = $1',
            [ruleId],
          );
          return unchanged.rows[0];
        }
        const result = await client.query(
          'UPDATE gabah_notification_rule_settings SET is_active = $2, updated_at = NOW(), updated_by_user_id = $3 WHERE rule_id = $1 RETURNING rule_id, is_active, updated_at, updated_by_user_id',
          [ruleId, next, String(actor.id)],
        );
        await client.query(
          'INSERT INTO gabah_notification_rule_audit (rule_id, previous_is_active, new_is_active, changed_by_user_id) VALUES ($1, $2, $3, $4)',
          [ruleId, previous, next, String(actor.id)],
        );
        return result.rows[0];
      });
      return res.json({ success: true, data: updated });
    } catch (error: any) {
      if (error?.message === 'NOTIFICATION_RULE_NOT_FOUND') return res.status(404).json({ success: false, message: 'Aturan notifikasi tidak ditemukan.' });
      return rbacFailure(res, error);
    }
  });

  // Company profile metadata is centralized in PostgreSQL. Operational SLA thresholds
  // remain server-owned policy and are not writable through this endpoint.
  const SYSTEM_SETTING_KEYS = ['companyName', 'accountingStandard', 'baseCurrency', 'fiscalYear'] as const;
  app.get('/api/admin/system-settings', async (req, res) => {
    try {
      getActor(req);
      if (!isPostgresPersistenceActive()) {
        return res.status(503).json({ success: false, code: 'SYSTEM_SETTINGS_UNAVAILABLE', message: 'Pengaturan sistem memerlukan PostgreSQL aktif.' });
      }
      const result = await queryRbac<any>(
        "SELECT settings, updated_at, updated_by_user_id FROM gabah_system_settings WHERE settings_key = 'company_profile'",
      );
      if (!result.rows.length) {
        return res.status(503).json({ success: false, code: 'SYSTEM_SETTINGS_UNAVAILABLE', message: 'Profil perusahaan belum tersedia di database.' });
      }
      return res.json({
        success: true,
        data: {
          ...result.rows[0].settings,
          updated_at: result.rows[0].updated_at,
          updated_by_user_id: result.rows[0].updated_by_user_id,
        },
      });
    } catch (error: any) {
      console.error('[GABAH API] System settings read failed:', error?.message || error);
      return res.status(503).json({ success: false, code: 'SYSTEM_SETTINGS_UNAVAILABLE', message: 'Pengaturan sistem tidak dapat dibaca dari database.' });
    }
  });

  app.patch('/api/admin/system-settings', async (req, res) => {
    const actor = requireRbacSuperadmin(req, res);
    if (!actor) return;
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const suppliedKeys = Object.keys(body).sort();
    const expectedKeys = [...SYSTEM_SETTING_KEYS].sort();
    if (suppliedKeys.length !== expectedKeys.length || suppliedKeys.some((key, index) => key !== expectedKeys[index])
      || SYSTEM_SETTING_KEYS.some(key => typeof body[key] !== 'string')) {
      return res.status(400).json({ success: false, message: 'Field pengaturan sistem tidak valid.' });
    }
    const nextSettings = {
      companyName: String(body.companyName || '').trim(),
      accountingStandard: String(body.accountingStandard || '').trim(),
      baseCurrency: String(body.baseCurrency || '').trim(),
      fiscalYear: String(body.fiscalYear || '').trim(),
    };
    if (nextSettings.companyName.length < 3 || nextSettings.companyName.length > 160
      || nextSettings.accountingStandard.length < 3 || nextSettings.accountingStandard.length > 160
      || nextSettings.baseCurrency.length < 3 || nextSettings.baseCurrency.length > 40
      || !/^(20[0-9]{2}|2100)$/.test(nextSettings.fiscalYear)) {
      return res.status(400).json({ success: false, message: 'Nama perusahaan, standar akuntansi, mata uang, atau tahun buku tidak valid.' });
    }
    try {
      const updated = await withRbacTransaction(async client => {
        const current = await client.query<{ settings: Record<string, string> }>(
          "SELECT settings FROM gabah_system_settings WHERE settings_key = 'company_profile' FOR UPDATE",
        );
        if (!current.rows.length) throw new Error('SYSTEM_SETTINGS_NOT_FOUND');
        const previous = current.rows[0].settings;
        const unchanged = SYSTEM_SETTING_KEYS.every(key => previous?.[key] === nextSettings[key]);
        if (unchanged) {
          const result = await client.query(
            "SELECT settings, updated_at, updated_by_user_id FROM gabah_system_settings WHERE settings_key = 'company_profile'",
          );
          return {
            ...result.rows[0].settings,
            updated_at: result.rows[0].updated_at,
            updated_by_user_id: result.rows[0].updated_by_user_id,
          };
        }
        const result = await client.query(
          "UPDATE gabah_system_settings SET settings = $1::jsonb, updated_at = NOW(), updated_by_user_id = $2 WHERE settings_key = 'company_profile' RETURNING settings, updated_at, updated_by_user_id",
          [JSON.stringify(nextSettings), String(actor.id)],
        );
        await client.query(
          "INSERT INTO gabah_system_settings_audit (settings_key, previous_settings, new_settings, changed_by_user_id) VALUES ('company_profile', $1::jsonb, $2::jsonb, $3)",
          [JSON.stringify(previous), JSON.stringify(nextSettings), String(actor.id)],
        );
        return {
          ...result.rows[0].settings,
          updated_at: result.rows[0].updated_at,
          updated_by_user_id: result.rows[0].updated_by_user_id,
        };
      });
      return res.json({ success: true, data: updated });
    } catch (error: any) {
      if (error?.message === 'SYSTEM_SETTINGS_NOT_FOUND') {
        return res.status(503).json({ success: false, code: 'SYSTEM_SETTINGS_UNAVAILABLE', message: 'Profil perusahaan belum tersedia di database.' });
      }
      console.error('[GABAH API] System settings update failed:', error?.message || error);
      return res.status(503).json({ success: false, code: 'SYSTEM_SETTINGS_SAVE_FAILED', message: 'Pengaturan sistem gagal disimpan secara permanen.' });
    }
  });

  // ==========================================
  // API ROUTES (FIRST)
  // ==========================================

  // Health check
  app.get('/api/health', (req, res) => {
    const persistenceDegraded = isPostgresFailureLatched();
    res.status(persistenceDegraded ? 503 : 200).json({
      status: persistenceDegraded ? 'degraded' : 'ok',
      ready: !persistenceDegraded,
      app: 'GABAH (General Asset & Business Administration Hub)',
      version: '2026.1.0-enterprise',
      organization: 'PT Food Station Tjipinang Jaya (BUMD DKI Jakarta)',
      persistence: persistenceDegraded
        ? 'postgresql-unavailable-restart-required'
        : isPostgresPersistenceActive() ? 'postgresql' : 'file-store (development fallback)',
      scheduler: getSchedulerStatus(),
    });
  });

  // Auth / Users
  app.get('/api/users', (req, res) => {
    const actor = getActor(req);
    if (isPostgresPersistenceActive()) {
      if (!requireRbacPermission(req, res, 'users.read')) return;
    } else if (!isSuperadminActor(actor) && !hasApplicationRole(actor, 'it') && !hasApplicationRole(actor, 'ga')) {
      return res.status(403).json({ success: false, message: 'Akses direktori pegawai hanya untuk Super Admin, IT, dan GA.' });
    }
    res.json({ success: true, data: db.users.map(u => sanitizeUser(u, { includeTelegramChatId: isSuperadminActor(actor) })) });
  });

  app.post('/api/users', async (req, res) => {
    try {
      const actor = getActor(req);
      if (!isSuperadminActor(actor)) {
        return res.status(403).json({ success: false, message: 'Hanya Admin GABAH yang berwenang menambah pengguna.' });
      }
      const { name, email, role, division, department, password, phone } = req.body || {};
      const validPrimaryRoles = ['Admin GABAH', 'Karyawan'];
      const profileTextFields: Array<[string, unknown, number]> = [
        ['division', division, 120],
        ['department', department, 120],
        ['phone', phone, 40],
      ];
      for (const [field, value, maxLength] of profileTextFields) {
        if (value !== undefined && (typeof value !== 'string' || value.includes('\u0000') || value.length > maxLength)) {
          return res.status(400).json({ success: false, message: field + ' harus berupa teks maksimal ' + maxLength + ' karakter.' });
        }
      }
      const requestedPrimaryRole = role === 'Superadmin' ? 'Admin GABAH' : (role || 'Karyawan');
      if (typeof requestedPrimaryRole !== 'string' || !validPrimaryRoles.includes(requestedPrimaryRole)) {
        return res.status(400).json({ success: false, message: 'Role primer tidak valid. Humas/Sekretariat adalah role fungsi; RPC/SC dan PIBC adalah lokasi kerja.' });
      }
      if (typeof name !== 'string' || !name.trim() || name.includes('\u0000') || name.length > 160
        || typeof email !== 'string' || email.includes('\u0000') || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) || email.length > 254) {
        return res.status(400).json({ success: false, message: 'Nama dan email wajib diisi dengan format yang valid.' });
      }
      const normalizedDivision = (typeof division === 'string' && division.trim() ? division.trim() : 'Umum') as ServerUser['division'];
      const normalizedDepartment = typeof department === 'string' && department.trim() ? department.trim() : 'Operasional';
      const normalizedPhone = typeof phone === 'string' ? phone.trim() : '';
      const primaryRole = requestedPrimaryRole as ServerUser['role'];
      // ORG-MODEL: jabatan/unit/lokasi opsional saat pembuatan user — atribut
      // independen dari role. Divalidasi terhadap master masing-masing.
      let newJobLevel: string | undefined;
      if (req.body.job_level_code) {
        const code = String(req.body.job_level_code).trim().toUpperCase();
        if (!(db.jobLevels || []).some(j => j.code === code && j.is_active)) {
          return res.status(400).json({ success: false, message: `Jabatan "${code}" tidak terdaftar atau sedang nonaktif.` });
        }
        newJobLevel = code;
      }
      let newUnitId: string | undefined;
      if (req.body.unit_id) {
        const uid = String(req.body.unit_id).trim();
        if (!(db.orgUnits || []).some(x => x.id === uid && x.is_active)) {
          return res.status(400).json({ success: false, message: `Unit "${uid}" tidak terdaftar atau sedang nonaktif.` });
        }
        newUnitId = uid;
      }
      let newOfficeId: string | undefined;
      if (req.body.office_location_id) {
        const lid = String(req.body.office_location_id).trim();
        if (!(db.officeLocations || []).some(x => x.id === lid && x.is_active)) {
          return res.status(400).json({ success: false, message: `Lokasi kantor "${lid}" tidak terdaftar atau sedang nonaktif.` });
        }
        newOfficeId = lid;
      }
      if (!name || !email) {
        return res.status(400).json({ success: false, message: 'Nama dan email wajib diisi' });
      }
      if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase().trim())) {
        return res.status(400).json({ success: false, message: 'Email sudah digunakan oleh akun lain' });
      }

      const roleLabels: Record<string, string> = {
        'Admin GABAH': 'Super Admin',
        'Superadmin': 'Super Admin',
        'IT': 'IT Technical Support',
        'GA': 'Fasilitas & Gedung',
        'Auditor': 'Internal Auditor',
        'Karyawan': 'Pegawai Operasional'
      };

      // SECURITY (CR-02): no client-supplied password and no plaintext echo.
      // The initial password is generated server-side with CSPRNG and is
      // delivered out-of-band by the administrator (documented policy); the
      // API response NEVER contains it.
      const generatedTempPassword = crypto.randomBytes(12).toString('base64url');
      const { hash, salt } = hashPassword(generatedTempPassword);

      const newUser: ServerUser = {
        id: `USR-${crypto.randomUUID()}`,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: primaryRole,
        role_label: roleLabels[primaryRole] || 'Pegawai Operasional',
        division: normalizedDivision,
        department: normalizedDepartment,
        job_level_code: newJobLevel,
        unit_id: newUnitId || null,
        office_location_id: newOfficeId || null,
        phone: normalizedPhone,
        avatar: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80`,
        is_active: true,
        password_hash: hash,
        password_salt: salt,
        authVersion: 1,
      };

      db.users.unshift(newUser);
      GabahDomainService.recordAudit(
        'USER_CREATED',
        'Users',
        `Menambahkan pengguna baru: ${newUser.name} (${newUser.email}) - Peran: ${newUser.role}. Password awal dibuat server-side dan dikirim out-of-band.`,
        actor,
        newUser.id
      );

      await persistDataStore();
      (req as any).__gabahPersisted = true;
      await syncPrimaryRbacRole(newUser.id, newUser.role);
      await refreshRbacPolicy();

      res.status(201).json({
        success: true,
        data: sanitizeUser(newUser, { includeTelegramChatId: true }),
      });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message });
    }
  });

  // Bulk import pegawai (IMPORT Excel/CSV). Upsert per email:
  //  - email BARU    → akun dibuat (password CSPRNG server-side, out-of-band).
  //  - email SUDAH ADA → data profil (nama/divisi/departemen/telepon/role) di-update,
  //    password & status sesi TIDAK disentuh.
  // Guard: hanya Admin GABAH. Setiap baris divalidasi individual agar satu
  // baris buruk tidak menggagalkan seluruh batch.
  app.post('/api/users/bulk-import', async (req, res) => {
    try {
      const actor = getActor(req);
      if (!isSuperadminActor(actor)) {
        return res.status(403).json({ success: false, message: 'Hanya Admin GABAH yang berwenang mengimpor data pegawai.' });
      }

      const rows: any[] = Array.isArray(req.body?.users) ? req.body.users : [];
      if (rows.length === 0) {
        return res.status(400).json({ success: false, message: 'Tidak ada baris data pegawai untuk diimpor.' });
      }
      if (rows.length > 500) {
        return res.status(400).json({ success: false, message: 'Maksimal 500 baris per impor. Pisahkan menjadi beberapa berkas.' });
      }

      const validRoles = ['Admin GABAH', 'Superadmin', 'Karyawan', 'PIBC', 'Supply Chain', 'SC'];
      const roleLabels: Record<string, string> = {
        'Admin GABAH': 'Super Admin',
        'IT': 'IT Technical Support',
        'GA': 'Fasilitas & Gedung',
        'Auditor': 'Internal Auditor',
        'Karyawan': 'Pegawai Operasional'
      };

      let created = 0;
      let updated = 0;
      const errors: string[] = [];
      const warnings: string[] = [];
      const importedUsers: ServerUser[] = [];
      const seenEmails = new Set<string>();

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i] || {};
        const rowNo = i + 1;
        const name = String(row.name || '').trim();
        const email = String(row.email || '').trim().toLowerCase();
        const roleRaw = String(row.role || '').trim();
        const division = String(row.division || '').trim() || 'Umum';
        const department = String(row.department || '').trim() || 'Operasional';
        const phone = String(row.phone || '').trim();
        const jobLevelCode = String(row.job_level_code || '').trim().toUpperCase();
        if (name.includes('\u0000') || name.length > 160) { errors.push(`Baris ${rowNo}: Nama maksimal 160 karakter.`); continue; }
        if (email.includes('\u0000') || email.length > 254) { errors.push(`Baris ${rowNo}: Email maksimal 254 karakter.`); continue; }
        if (division.includes('\u0000') || division.length > 120) { errors.push(`Baris ${rowNo}: Divisi maksimal 120 karakter.`); continue; }
        if (department.includes('\u0000') || department.length > 120) { errors.push(`Baris ${rowNo}: Departemen maksimal 120 karakter.`); continue; }
        if (phone.includes('\u0000') || phone.length > 40) { errors.push(`Baris ${rowNo}: Telepon maksimal 40 karakter.`); continue; }
        // Unit is an organizational attribute; SC/RPC and PIBC are office locations.
        const unitId = String(row.unit_id || '').trim().toUpperCase();
        const requestedOfficeLocation = String(row.office_location_id || '').trim().toUpperCase();
        const inferredOfficeLocation = ['Supply Chain', 'SC'].includes(roleRaw) ? 'OFF-RPC' : roleRaw === 'PIBC' ? 'OFF-PIBC' : '';
        const officeLocationId = requestedOfficeLocation || inferredOfficeLocation;

        if (!name) { errors.push(`Baris ${rowNo}: Nama wajib diisi.`); continue; }
        if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { errors.push(`Baris ${rowNo}: Email "${email}" tidak valid.`); continue; }
        if (roleRaw && !validRoles.includes(roleRaw)) {
          errors.push(`Baris ${rowNo}: Role primer "${roleRaw}" adalah role tambahan, bukan profil utama. Gunakan role profil utama yang valid.`);
          continue;
        }
        if (seenEmails.has(email)) { errors.push(`Baris ${rowNo}: Email duplikat di dalam berkas (${email}).`); continue; }
        seenEmails.add(email);
        if (jobLevelCode && !(db.jobLevels || []).some(item => item.code === jobLevelCode && item.is_active)) {
          errors.push(`Baris ${rowNo}: Jabatan "${jobLevelCode}" tidak terdaftar/aktif.`); continue;
        }
        if (unitId && !(db.orgUnits || []).some(item => item.id === unitId && item.is_active)) {
          errors.push(`Baris ${rowNo}: Unit "${unitId}" tidak terdaftar/aktif.`); continue;
        }
        if (officeLocationId && !(db.officeLocations || []).some(item => item.id === officeLocationId && item.is_active)) {
          errors.push(`Baris ${rowNo}: Lokasi kantor "${officeLocationId}" tidak terdaftar/aktif.`); continue;
        }

        const requestedRole = roleRaw || 'Karyawan';
        const role = ['Admin GABAH', 'Superadmin'].includes(requestedRole) ? 'Admin GABAH' : 'Karyawan';
        if (requestedRole !== role) {
          const locationNote = ['Supply Chain', 'SC'].includes(requestedRole) ? ' Lokasi RPC diterapkan.' : requestedRole === 'PIBC' ? ' Lokasi PIBC diterapkan.' : '';
          warnings.push(`Baris ${rowNo}: "${requestedRole}" bukan profil utama; akun disimpan sebagai Karyawan. Tetapkan role fungsi melalui Administrasi > Role & Hak Akses setelah impor.${locationNote}`);
        }

        const existing = db.users.find(u => u.email.toLowerCase().trim() === email);
        if (existing) {
          // UPDATE profil; perubahan role utama adalah perubahan privilege dan
          // harus membatalkan seluruh sesi lama.
          const previousPrimaryRole = existing.role;
          existing.name = name;
          existing.role = role as ServerUser['role'];
          if (previousPrimaryRole !== existing.role) {
            revokeUserSessions(existing.id);
          }
          const existingFunctionLabel = String(existing.role_label || '').trim();
          (existing as any).role_label = existingFunctionLabel
            || (['Supply Chain', 'SC'].includes(requestedRole) ? 'Karyawan — Lokasi RPC'
              : requestedRole === 'PIBC' ? 'Karyawan — Lokasi PIBC'
                : (roleLabels[requestedRole] || roleLabels[role] || 'Pegawai'));
          existing.division = division as ServerUser['division'];
          existing.department = department;
          if (jobLevelCode) existing.job_level_code = jobLevelCode;
          if (unitId) existing.unit_id = unitId;
          if (officeLocationId) existing.office_location_id = officeLocationId;
          if (phone) existing.phone = phone;
          importedUsers.push(existing);
          updated++;
          GabahDomainService.recordAudit(
            'USER_BULK_UPDATED',
            'Users',
            `Impor massal: profil ${existing.name} (${existing.email}) diperbarui (divisi: ${division}, departemen: ${department}).`,
            actor,
            existing.id
          );
        } else {
          // CREATE — password CSPRNG server-side (CR-02), tidak pernah dikirim balik.
          const generatedTempPassword = crypto.randomBytes(12).toString('base64url');
          const { hash, salt } = hashPassword(generatedTempPassword);
          const newUser: ServerUser = {
            id: `USR-${crypto.randomUUID()}`,
            name,
            email,
            role: role as ServerUser['role'],
            role_label: ['Supply Chain', 'SC'].includes(requestedRole) ? 'Karyawan — Lokasi RPC'
              : requestedRole === 'PIBC' ? 'Karyawan — Lokasi PIBC'
                : (roleLabels[requestedRole] || roleLabels[role] || 'Pegawai Operasional'),
            division: division as ServerUser['division'],
            department,
            job_level_code: jobLevelCode || undefined,
            unit_id: unitId || null,
            office_location_id: officeLocationId || undefined,
            phone,
            avatar: `https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80`,
            is_active: true,
            password_hash: hash,
            password_salt: salt,
            authVersion: 1,
          };
          db.users.unshift(newUser);
          importedUsers.push(newUser);
          created++;
          GabahDomainService.recordAudit(
            'USER_BULK_CREATED',
            'Users',
            `Impor massal: pengguna baru ${newUser.name} (${newUser.email}) - Peran: ${newUser.role}. Password awal dibuat server-side.`,
            actor,
            newUser.id
          );
        }
      }

      if (created > 0 || updated > 0) {
        await persistDataStore();
      (req as any).__gabahPersisted = true;
        await syncPrimaryRbacRoles(importedUsers.map(user => ({ id: user.id, role: user.role })));
        await refreshRbacPolicy();
      }

      res.json({
        success: true,
        data: {
          created,
          updated,
          failed: errors.length,
          errors: errors.slice(0, 50),
          warnings: warnings.slice(0, 50),
          users: importedUsers.map(u => sanitizeUser(u, { includeTelegramChatId: true })),
        },
      });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message });
    }
  });

  app.patch('/api/users/:id', async (req, res) => {
    try {
      const actor = getActor(req);
      if (!isSuperadminActor(actor)) {
        return res.status(403).json({ success: false, message: 'Hanya Admin GABAH yang berwenang mengubah akun pengguna.' });
      }

      await withLastSuperadminGuard(async () => {
      if (isPostgresPersistenceActive() && !(await isActiveSuperadminInDatabase(actor.id))) {
        return res.status(403).json({ success: false, message: 'Assignment Superadmin Anda sudah tidak aktif.' });
      }
      const targetUser = db.users.find(u => u.id === req.params.id);
      if (!targetUser) {
        return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan' });
      }

      const { name, email, role, division, department, is_active, password, phone, telegram_chat_id } = req.body || {};
      // Validate the complete request before mutating the in-memory user record.
      const stringFields: Array<[string, unknown, number]> = [
        ['name', name, 160], ['email', email, 254], ['division', division, 120],
        ['department', department, 120], ['phone', phone, 40],
        ['telegram_chat_id', telegram_chat_id, 128],
      ];
      for (const [field, value, maxLength] of stringFields) {
        if (value !== undefined && (typeof value !== 'string' || value.includes('\u0000') || value.length > maxLength)) {
          return res.status(400).json({ success: false, message: field + ' harus berupa teks maksimal ' + maxLength + ' karakter.' });
        }
      }
      if (name !== undefined && !name.trim()) {
        return res.status(400).json({ success: false, message: 'Nama tidak boleh kosong.' });
      }
      if (email !== undefined && (!email.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()))) {
        return res.status(400).json({ success: false, message: 'Format email tidak valid.' });
      }
      // Primary profile roles are the built-in identity roles; custom job-function
      // roles remain independently assignable through Dynamic RBAC.
      const validRoles = ['Admin GABAH', 'Superadmin', 'Karyawan'];
      if (role !== undefined && (typeof role !== 'string' || !validRoles.includes(role))) {
        return res.status(400).json({ success: false, message: 'Role tidak dikenal.' });
      }
      if (is_active !== undefined && typeof is_active !== 'boolean') {
        return res.status(400).json({ success: false, message: 'is_active harus berupa boolean true atau false.' });
      }
      if (password !== undefined && (typeof password !== 'string' || (password.length > 0 && password.trim().length < 8) || password.length > 256)) {
        return res.status(400).json({ success: false, message: 'Password harus berupa teks 8–256 karakter.' });
      }
      const normalizedName = name === undefined ? undefined : name.trim();
      const normalizedEmail = email === undefined ? undefined : email.trim().toLowerCase();
      const normalizedDivision = division === undefined ? undefined : division.trim();
      const normalizedDepartment = department === undefined ? undefined : department.trim();
      const normalizedPhone = phone === undefined ? undefined : phone.trim();
      const normalizedTelegramChatId = telegram_chat_id === undefined ? undefined : telegram_chat_id.trim();
      if (normalizedEmail !== undefined && db.users.some(u => u.id !== targetUser.id && u.email.toLowerCase().trim() === normalizedEmail)) {
        return res.status(400).json({ success: false, message: 'Email sudah digunakan oleh akun lain.' });
      }
      const primaryRole = role === 'Superadmin' ? 'Admin GABAH' : role;
      const targetIsSuperadmin = isPostgresPersistenceActive()
        ? await isActiveSuperadminInDatabase(targetUser.id)
        : targetUser.is_active && isRbacSuperadmin(targetUser.id);
      const wouldDemoteSuperadmin = role !== undefined && primaryRole !== 'Admin GABAH';
      const wouldDeactivateSuperadmin = is_active === false;
      const activeSuperadminCount = isPostgresPersistenceActive()
        ? await countActiveSuperadminsInDatabase()
        : countRbacSuperadmins(db.users.filter(u => u.is_active).map(u => u.id));
      if (targetIsSuperadmin && (wouldDemoteSuperadmin || wouldDeactivateSuperadmin)
        && activeSuperadminCount <= 1) {
        return res.status(409).json({ success: false, message: 'Superadmin aktif terakhir tidak boleh diturunkan atau dinonaktifkan.' });
      }
      // ORG-MODEL: jabatan/unit/lokasi ditugaskan independen — TIDAK mengubah
      // role/permission (RBAC). Nilai divalidasi terhadap master masing-masing.
      let orgJobLevel: string | undefined | null;
      let orgUnit: string | undefined | null;
      let orgOffice: string | undefined | null;
      if (req.body.job_level_code !== undefined) {
        const code = String(req.body.job_level_code || '').trim().toUpperCase() || null;
        if (code && !(db.jobLevels || []).some(j => j.code === code && j.is_active)) {
          return res.status(400).json({ success: false, message: `Jabatan "${code}" tidak terdaftar atau sedang nonaktif.` });
        }
        orgJobLevel = code;
      }
      if (req.body.unit_id !== undefined) {
        const uid = req.body.unit_id ? String(req.body.unit_id).trim() : null;
        if (uid && !(db.orgUnits || []).some(x => x.id === uid && x.is_active)) {
          return res.status(400).json({ success: false, message: `Unit "${uid}" tidak terdaftar atau sedang nonaktif.` });
        }
        orgUnit = uid;
      }
      if (req.body.office_location_id !== undefined) {
        const lid = req.body.office_location_id ? String(req.body.office_location_id).trim() : null;
        if (lid && !(db.officeLocations || []).some(x => x.id === lid && x.is_active)) {
          return res.status(400).json({ success: false, message: `Lokasi kantor "${lid}" tidak terdaftar atau sedang nonaktif.` });
        }
        orgOffice = lid;
      }
      const privilegeChanged = role !== undefined && primaryRole !== targetUser.role;
      const accountDeactivated = is_active !== undefined && is_active === false && targetUser.is_active === true;

      // Personnel offboarding must not hide unresolved physical custody.
      // Keep the account active until its loan requests and assigned assets
      // have been returned/transferred through their own audited workflows.
      if (accountDeactivated) {
        const activeLoans = (db.loans || []).filter(loan =>
          loan.borrower_id === targetUser.id
          && ['pending_approval', 'approved', 'borrowed', 'overdue'].includes(loan.status)
        );
        const assignedAssets = (db.assets || []).filter(asset => asset.assigned_to?.id === targetUser.id);
        if (activeLoans.length || assignedAssets.length) {
          return res.status(409).json({
            success: false,
            message: `Akun belum dapat dinonaktifkan: ${activeLoans.length} pinjaman aktif dan ${assignedAssets.length} aset masih tercatat pada pengguna. Selesaikan pengembalian atau alih penanggung jawab terlebih dahulu.`,
          });
        }
      }

      if (normalizedName !== undefined) targetUser.name = normalizedName;
      // CR-05: Telegram chat id is an admin-managed profile field (server-side only);
      // it is NEVER accepted from non-admin input and never echoed in login flows.
      if (normalizedTelegramChatId !== undefined) targetUser.telegram_chat_id = normalizedTelegramChatId || undefined;
      if (normalizedEmail !== undefined) targetUser.email = normalizedEmail;

      if (role !== undefined) {
        targetUser.role = primaryRole;
        const roleLabels: Record<string, string> = {
          'Admin GABAH': 'Admin GABAH (Super Admin)',
          'IT': 'Staff Divisi IT',
          'GA': 'Staff Divisi General Affairs',
          'Auditor': 'Satuan Pengawas Internal (SPI)',
          'Karyawan': 'Karyawan / Pemohon',
        };
        const existingFunctionLabel = String(targetUser.role_label || '');
        const hasFunctionLabel = /humas|sekretariat/i.test(existingFunctionLabel);
        (targetUser as any).role_label = hasFunctionLabel
          ? existingFunctionLabel
          : (roleLabels[primaryRole] || primaryRole);
      }
      if (normalizedDivision !== undefined) targetUser.division = normalizedDivision;
      if (normalizedDepartment !== undefined) targetUser.department = normalizedDepartment;
      if (is_active !== undefined) targetUser.is_active = is_active;
      if (normalizedPhone !== undefined) targetUser.phone = normalizedPhone;
      // ORG-MODEL: atribut jabatan/unit/lokasi — independen dari role/permission.
      if (orgJobLevel !== undefined) targetUser.job_level_code = orgJobLevel ?? undefined;
      if (orgUnit !== undefined) targetUser.unit_id = orgUnit;
      if (orgOffice !== undefined) targetUser.office_location_id = orgOffice;
      if (role === 'Supply Chain' && !targetUser.office_location_id && orgOffice === undefined) targetUser.office_location_id = 'OFF-RPC';
      if (role === 'PIBC' && !targetUser.office_location_id && orgOffice === undefined) targetUser.office_location_id = 'OFF-PIBC';

      const passwordChanged = typeof password === 'string' && password.trim().length > 0;
      if (passwordChanged) {
        const plain = password.trim();
        if (plain) {
          const { hash, salt } = hashPassword(plain);
          targetUser.password_hash = hash;
          targetUser.password_salt = salt;
          delete targetUser.temp_password;
        }
      }

      // SECURITY (CR-03 §3.4): password change, privilege change, or
      // deactivation invalidates ALL active sessions of this user.
      if (passwordChanged || privilegeChanged || accountDeactivated) {
        revokeUserSessions(targetUser.id);
      }

      GabahDomainService.recordAudit(
        'USER_UPDATED',
        'Users',
        `Memperbarui profil pengguna ${targetUser.name} (${targetUser.email})`,
        actor,
        targetUser.id
      );

      await persistDataStore();
      (req as any).__gabahPersisted = true;
      if (role !== undefined) await syncPrimaryRbacRole(targetUser.id, targetUser.role);
      await refreshRbacPolicy();

      res.json({ success: true, data: sanitizeUser(targetUser, { includeTelegramChatId: true }) });
      });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message });
    }
  });

  app.delete('/api/users/:id', async (req, res) => {
    try {
      const actor = getActor(req);
      if (!isSuperadminActor(actor)) {
        return res.status(403).json({ success: false, message: 'Hanya Admin GABAH yang berwenang menghapus pengguna.' });
      }

      await withLastSuperadminGuard(async () => {
      if (isPostgresPersistenceActive() && !(await isActiveSuperadminInDatabase(actor.id))) {
        return res.status(403).json({ success: false, message: 'Assignment Superadmin Anda sudah tidak aktif.' });
      }
      const targetId = req.params.id;

      // Cannot delete current active user
      if (targetId === actor.id) {
        return res.status(400).json({
          success: false,
          message: 'Tidak dapat menghapus akun Anda sendiri yang sedang aktif digunakan.'
        });
      }

      const userIndex = db.users.findIndex(u => u.id === targetId);
      if (userIndex === -1) {
        return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
      }

      const targetUser = db.users[userIndex];
      // Do not delete a borrower while any loan is operationally active.
      // Closing a borrowed loan here would fabricate a physical return and
      // could leave its asset incorrectly reserved/assigned.
      const activeBorrowerLoans = (db.loans || []).filter(loan =>
        loan.borrower_id === targetId
        && ['pending_approval', 'approved', 'borrowed', 'overdue'].includes(loan.status)
      );
      const assignedAssets = (db.assets || []).filter(asset => asset.assigned_to?.id === targetId);
      // Keep non-terminal ticket ownership resolvable. Deleting an assigned
      // operator otherwise leaves an active queue item pointing at a user who
      // can no longer authenticate; deleting a reporter removes their
      // self-service close/reopen path and audit identity from the live roster.
      const activeTickets = (db.tickets || []).filter(ticket =>
        (ticket.reporter_id === targetId || ticket.assigned_agent_id === targetId)
        && String(ticket.status).toLowerCase() !== 'closed'
      );
      if (activeBorrowerLoans.length > 0 || assignedAssets.length > 0 || activeTickets.length > 0) {
        return res.status(409).json({
          success: false,
          message: `Akun tidak dapat dihapus: ${activeBorrowerLoans.length} pinjaman aktif, ${assignedAssets.length} aset masih tercatat, dan ${activeTickets.length} tiket belum ditutup terkait pengguna. Selesaikan pinjaman, alihkan aset, dan tutup atau alihkan tiket terlebih dahulu.`,
        });
      }

      const targetIsSuperadmin = isPostgresPersistenceActive()
        ? await isActiveSuperadminInDatabase(targetId)
        : targetUser.is_active && isRbacSuperadmin(targetUser.id);
      const activeSuperadminCount = isPostgresPersistenceActive()
        ? await countActiveSuperadminsInDatabase()
        : countRbacSuperadmins(db.users.filter(u => u.is_active).map(u => u.id));
      if (targetIsSuperadmin && activeSuperadminCount <= 1) {
        return res.status(409).json({ success: false, message: 'Superadmin aktif terakhir tidak boleh dihapus.' });
      }

      // Cancel any pending reservations organized by this user
      for (const r of db.roomReservations) {
        if (r.organizer_id === targetId && ['pending_approval', 'approved', 'in_use'].includes(r.status)) {
          r.status = 'cancelled';
        }
      }

      // Invalidate all active sessions for this user
      destroyAllUserSessions(targetId);

      // Perform deletion from database
      db.users.splice(userIndex, 1);

      GabahDomainService.recordAudit(
        'USER_DELETED',
        'Users',
        `Menghapus akun pengguna: ${targetUser.name} (${targetUser.email}, ${targetUser.role}) - tidak ada pinjaman aktif atau aset dalam penguasaan yang dilepas otomatis`,
        actor,
        targetId
      );

      await persistDataStore();
      (req as any).__gabahPersisted = true;
      await refreshRbacPolicy();

      res.json({
        success: true,
        message: `Pengguna ${targetUser.name} berhasil dihapus.`
      });
      });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message });
    }
  });

  // P1#2 (admin UX honesty): REAL password reset endpoint. The server issues a
  // CSPRNG temporary password, stores ONLY its PBKDF2 hash, revokes the user's
  // sessions (CR-03), and returns the plaintext exactly once so the admin can
  // deliver it out-of-band. No fake "reset link sent" claims — email delivery
  // for resets is a separate, explicitly-configured feature.
  app.post('/api/users/:id/reset-password', async (req, res) => {
    try {
      const actor = getActor(req);
      if (!isSuperadminActor(actor)) {
        return res.status(403).json({ success: false, message: 'Hanya Admin GABAH yang berwenang mereset sandi pengguna.' });
      }

      const targetUser = db.users.find(u => u.id === req.params.id);
      if (!targetUser) {
        return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
      }

      // Mirrors POST /api/users password policy: 12-char CSPRNG, base64url.
      const tempPassword = crypto.randomBytes(12).toString('base64url');
      const { hash, salt } = hashPassword(tempPassword);
      targetUser.password_hash = hash;
      targetUser.password_salt = salt;
      delete targetUser.temp_password;

      // SECURITY (CR-03 §3.4): a password change revokes ALL active sessions.
      revokeUserSessions(targetUser.id);

      GabahDomainService.recordAudit(
        'USER_PASSWORD_RESET',
        'Users',
        `Menerbitkan sandi sementara baru untuk pengguna ${targetUser.name} (${targetUser.email}); seluruh sesi aktif dicabut`,
        actor,
        targetUser.id
      );

      await persistDataStore();
      (req as any).__gabahPersisted = true;

      res.json({ success: true, data: { temp_password: tempPassword, user_id: targetUser.id } });
    } catch (err: any) {
      res.status(err.statusCode || 400).json({ success: false, message: err.message });
    }
  });

  // P2#10: live numbering sequence snapshot for the admin Asset Numbering panel
  // (replaces the hardcoded sample counters previously shown in the UI).
  app.get('/api/numbering/sequences', async (req, res) => {
    // This endpoint exposes live asset-numbering counters for the Administration panel.
    // Keep it Admin GABAH-only even in file-store compatibility mode, where dynamic
    // RBAC permission checks intentionally defer to legacy application-role guards.
    const actor = getActor(req);
    if (!isSuperadminActor(actor)) {
      return res.status(403).json({ success: false, message: 'Akses ditolak: hanya Admin GABAH yang dapat melihat sequence penomoran.' });
    }
    if (!requireRbacPermission(req, res, 'numbering.read')) return;

    try {
      if (isPostgresPersistenceActive()) {
        const result = await queryRbac<any>(
          `SELECT d.code AS division, s.asset_code AS code, s.sequence_year AS year,
                  s.last_sequence AS current,
                  d.code || ':' || s.asset_code || ':' || s.sequence_year::text AS key
           FROM asset_number_sequences s
           JOIN divisions d ON d.id = s.owner_division_id
           ORDER BY s.sequence_year DESC, d.code, s.asset_code`,
        );
        return res.json({ success: true, data: result.rows });
      }
      return res.json({ success: true, data: AssetNumberingEngine.getAssetSequenceSnapshot() });
    } catch (error: any) {
      return res.status(503).json({ success: false, message: error.message || 'Sequence penomoran tidak tersedia.' });
    }
  });

  // Configurable numbering rules: Superadmin-only, persisted in PostgreSQL and audited.
  app.get('/api/numbering/rules', async (req, res) => {
    const actor = getActor(req);
    if (!isSuperadminActor(actor)) {
      return res.status(403).json({ success: false, message: 'Hanya Superadmin yang dapat melihat aturan penomoran.' });
    }
    if (!requireRbacPermission(req, res, 'numbering.read')) return;
    try {
      const result = await queryRbac<any>(
        'SELECT id, owner_division, asset_code, separator, sequence_digits, is_active, notes, created_at, updated_at FROM asset_numbering_rules ORDER BY owner_division, asset_code'
      );
      const data = await Promise.all(result.rows.map(async rule => {
        const usage = await queryRbac<{ count: string }>(
          `SELECT COUNT(*)::text AS count
           FROM assets a
           JOIN divisions d ON d.id = a.owner_division_id
           LEFT JOIN asset_categories c ON c.id = a.category_id
           WHERE UPPER(d.code) = UPPER($1)
             AND (UPPER(c.code) = UPPER($2) OR a.asset_number LIKE $3)`,
          [rule.owner_division, rule.asset_code, `${rule.owner_division}-${rule.asset_code}-%`]
        );
        const sequence = await queryRbac<{ current: number }>(
          `SELECT s.last_sequence AS current
           FROM asset_number_sequences s
           JOIN divisions d ON d.id = s.owner_division_id
           WHERE UPPER(d.code) = UPPER($1) AND UPPER(s.asset_code) = UPPER($2)
             AND s.sequence_year = $3`,
          [rule.owner_division, rule.asset_code, new Date().getFullYear()],
        );
        return { ...rule, usage_count: Number(usage.rows[0]?.count || 0), sequence_current: Number(sequence.rows[0]?.current || 0) };
      }));
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(503).json({ success: false, message: err.message || 'Aturan penomoran tidak tersedia.' });
    }
  });

  app.post('/api/numbering/rules', async (req, res) => {
    const actor = getActor(req);
    if (!isSuperadminActor(actor)) {
      return res.status(403).json({ success: false, message: 'Hanya Superadmin yang dapat membuat aturan penomoran.' });
    }
    if (!requireRbacPermission(req, res, 'numbering.manage')) return;
    const owner = String(req.body?.owner_division || '').trim().toUpperCase();
    const code = String(req.body?.asset_code || '').trim().toUpperCase();
    const separator = String(req.body?.separator ?? '-');
    const digits = Number(req.body?.sequence_digits ?? 4);
    const notes = String(req.body?.notes || '').trim().slice(0, 500);
    if (!/^[A-Z0-9]{2,12}$/.test(owner) || !/^[A-Z0-9][A-Z0-9-]{1,29}$/.test(code)) {
      return res.status(400).json({ success: false, message: 'Kode divisi dan kode aset tidak valid.' });
    }
    if (!/^[-_/]$/.test(separator) || !Number.isInteger(digits) || digits < 3 || digits > 8) {
      return res.status(400).json({ success: false, message: 'Pemisah harus satu karakter (-, _, /) dan digit sequence 3–8.' });
    }
    try {
      const id = crypto.randomUUID();
      const result = await queryRbac<any>(
        `INSERT INTO asset_numbering_rules (id, owner_division, asset_code, separator, sequence_digits, is_active, notes)
         VALUES ($1, $2, $3, $4, $5, TRUE, $6)
         RETURNING id, owner_division, asset_code, separator, sequence_digits, is_active, notes, created_at, updated_at`,
        [id, owner, code, separator, digits, notes]
      );
      AssetNumberingEngine.upsertRule(result.rows[0]);
      GabahDomainService.recordAudit('NUMBERING_RULE_CREATED', 'Asset Numbering', `Membuat aturan penomoran ${owner}/${code}; pemisah "${separator}", digit ${digits}.`, actor);
      await persistDataStore();
      (req as any).__gabahPersisted = true;
      res.status(201).json({ success: true, data: { ...result.rows[0], usage_count: 0 } });
    } catch (err: any) {
      const duplicate = err.code === '23505';
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : (duplicate ? 409 : 400)).json({ success: false, message: duplicate ? `Aturan ${owner}/${code} sudah terdaftar.` : (err.message || 'Gagal membuat aturan penomoran.') });
    }
  });

  app.patch('/api/numbering/rules/:id', async (req, res) => {
    const actor = getActor(req);
    if (!isSuperadminActor(actor)) {
      return res.status(403).json({ success: false, message: 'Hanya Superadmin yang dapat mengubah aturan penomoran.' });
    }
    if (!requireRbacPermission(req, res, 'numbering.manage')) return;
    try {
      const currentResult = await queryRbac<any>(
        'SELECT id, owner_division, asset_code, separator, sequence_digits, is_active, notes FROM asset_numbering_rules WHERE id = $1',
        [req.params.id]
      );
      const current = currentResult.rows[0];
      if (!current) return res.status(404).json({ success: false, message: 'Aturan penomoran tidak ditemukan.' });
      const usageResult = await queryRbac<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM assets a
         JOIN divisions d ON d.id = a.owner_division_id
         LEFT JOIN asset_categories c ON c.id = a.category_id
         WHERE UPPER(d.code) = UPPER($1)
           AND (UPPER(c.code) = UPPER($2) OR a.asset_number LIKE $3)`,
        [current.owner_division, current.asset_code, `${current.owner_division}-${current.asset_code}-%`]
      );
      const usageCount = Number(usageResult.rows[0]?.count || 0);
      // Once a rule has issued numbers, its identity (owner + asset code) is immutable.
      // Formatting may still be changed; existing asset numbers are never rewritten.
      if (req.body?.owner_division || req.body?.asset_code) {
        const requestedOwner = String(req.body.owner_division || current.owner_division).trim().toUpperCase();
        const requestedCode = String(req.body.asset_code || current.asset_code).trim().toUpperCase();
        if (usageCount > 0 && (requestedOwner !== current.owner_division || requestedCode !== current.asset_code)) {
          return res.status(409).json({ success: false, message: 'Aturan sudah digunakan. Divisi dan kode aset dikunci; format nomor berikutnya masih dapat disesuaikan.' });
        }
        if (requestedOwner !== current.owner_division || requestedCode !== current.asset_code) {
          return res.status(409).json({ success: false, message: 'Perubahan identitas aturan belum didukung. Buat aturan baru untuk kombinasi divisi/kode yang berbeda.' });
        }
      }
      const separator = req.body?.separator === undefined ? current.separator : String(req.body.separator);
      const digits = req.body?.sequence_digits === undefined ? Number(current.sequence_digits) : Number(req.body.sequence_digits);
      const isActive = req.body?.is_active === undefined ? current.is_active : req.body.is_active === true;
      const notes = req.body?.notes === undefined ? current.notes : String(req.body.notes).trim().slice(0, 500);
      if (!/^[-_/]$/.test(separator) || !Number.isInteger(digits) || digits < 3 || digits > 8) {
        return res.status(400).json({ success: false, message: 'Pemisah harus satu karakter (-, _, /) dan digit sequence 3–8.' });
      }
      const sequence = AssetNumberingEngine.getAssetSequenceSnapshot().find(s =>
        s.division === current.owner_division && s.code === current.asset_code
      );
      if (sequence && sequence.current >= Math.pow(10, digits)) {
        return res.status(409).json({ success: false, message: `Digit sequence ${digits} terlalu pendek untuk counter ${sequence.current}. Pilih minimal ${String(sequence.current + 1).length} digit.` });
      }
      const preview = AssetNumberingEngine.previewAssetNumber(current.owner_division, current.asset_code, new Date().getFullYear(), {
        separator, sequence_digits: digits,
      });
      const collision = await queryRbac('SELECT 1 FROM assets WHERE asset_number = $1 LIMIT 1', [preview]);
      if (collision.rowCount > 0) {
        return res.status(409).json({ success: false, message: `Format baru berpotensi menghasilkan nomor yang sudah terpakai (${preview}).` });
      }
      const updated = await queryRbac<any>(
        `UPDATE asset_numbering_rules SET separator = $2, sequence_digits = $3, is_active = $4, notes = $5, updated_at = NOW()
         WHERE id = $1
         RETURNING id, owner_division, asset_code, separator, sequence_digits, is_active, notes, created_at, updated_at`,
        [current.id, separator, digits, isActive, notes]
      );
      AssetNumberingEngine.upsertRule(updated.rows[0]);
      GabahDomainService.recordAudit('NUMBERING_RULE_UPDATED', 'Asset Numbering', `Memperbarui aturan ${current.owner_division}/${current.asset_code} (terpakai: ${usageCount}); nomor yang telah terbit tidak diubah.`, actor);
      await persistDataStore();
      (req as any).__gabahPersisted = true;
      res.json({ success: true, data: { ...updated.rows[0], usage_count: usageCount } });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message || 'Gagal memperbarui aturan penomoran.' });
    }
  });

  app.delete('/api/numbering/rules/:id', async (req, res) => {
    const actor = getActor(req);
    if (!isSuperadminActor(actor)) {
      return res.status(403).json({ success: false, message: 'Hanya Superadmin yang dapat menghapus aturan penomoran.' });
    }
    if (!requireRbacPermission(req, res, 'numbering.manage')) return;
    try {
      const result = await queryRbac<any>(
        'SELECT id, owner_division, asset_code FROM asset_numbering_rules WHERE id = $1',
        [req.params.id]
      );
      const rule = result.rows[0];
      if (!rule) return res.status(404).json({ success: false, message: 'Aturan penomoran tidak ditemukan.' });
      const usageResult = await queryRbac<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM assets a
         JOIN divisions d ON d.id = a.owner_division_id
         LEFT JOIN asset_categories c ON c.id = a.category_id
         WHERE UPPER(d.code) = UPPER($1)
           AND (UPPER(c.code) = UPPER($2) OR a.asset_number LIKE $3)`,
        [rule.owner_division, rule.asset_code, `${rule.owner_division}-${rule.asset_code}-%`]
      );
      const usageCount = Number(usageResult.rows[0]?.count || 0);
      const sequence = AssetNumberingEngine.getAssetSequenceSnapshot().find(s =>
        s.division === rule.owner_division && s.code === rule.asset_code
      );
      if (usageCount > 0 || (sequence?.current || 0) > 0) {
        return res.status(409).json({ success: false, message: `Aturan ${rule.owner_division}/${rule.asset_code} sudah memiliki riwayat penggunaan. Aturan tidak boleh dihapus; nonaktifkan bila tidak lagi digunakan.` });
      }
      const confirmation = String(req.body?.confirmation_code || '').trim().toUpperCase();
      const reason = String(req.body?.reason || '').trim();
      const expected = `${rule.owner_division}/${rule.asset_code}`;
      if (confirmation !== expected || reason.length < 20) {
        return res.status(400).json({ success: false, message: `Konfirmasi harus mengetik "${expected}" dan alasan penghapusan minimal 20 karakter.` });
      }
      await queryRbac('DELETE FROM asset_numbering_rules WHERE id = $1', [rule.id]);
      AssetNumberingEngine.removeRule(rule.owner_division, rule.asset_code);
      GabahDomainService.recordAudit('NUMBERING_RULE_DELETED', 'Asset Numbering', `Menghapus aturan ${expected}. Alasan: ${reason}`, actor);
      await persistDataStore();
      (req as any).__gabahPersisted = true;
      res.json({ success: true, data: { id: rule.id, deleted: true } });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message || 'Gagal menghapus aturan penomoran.' });
    }
  });

  // P2#11: CR-05 reminder subsystem overview for the admin Notification Center —
  // scheduler state, provider configuration presence, thresholds, and delivery
  // statistics derived from the authoritative notification log. Admin-only;
  // no provider secrets are exposed (only configured true/false).
  app.get('/api/contracts/reminders/overview', (req, res) => {
    try {
      
    if (!requireRbacPermission(req, res, 'contracts.read')) return;
    const actor = getActor(req);
      if (!isSuperadminActor(actor)) {
        return res.status(403).json({ success: false, message: 'Hanya Admin GABAH yang dapat melihat overview reminder.' });
      }
      const logs = db.contractNotificationLogs || [];
      const byStatus: Record<string, number> = { sent: 0, failed: 0, skipped: 0 };
      for (const l of logs) byStatus[l.status] = (byStatus[l.status] || 0) + 1;
      const byChannel: Record<string, { total: number; sent: number; failed: number; skipped: number }> = {};
      for (const l of logs) {
        byChannel[l.channel] = byChannel[l.channel] || { total: 0, sent: 0, failed: 0, skipped: 0 };
        byChannel[l.channel].total++;
        byChannel[l.channel][l.status as 'sent' | 'failed' | 'skipped']++;
      }
      const failures = logs.filter(l => l.status === 'failed').slice(0, 5).map(l => ({
        id: l.id,
        contract_id: l.contract_id,
        notification_type: l.notification_type,
        channel: l.channel,
        recipient: l.recipient,
        error_message: l.error_message,
        scheduled_at: l.scheduled_at,
      }));
      res.json({
        success: true,
        data: {
          scheduler: getSchedulerStatus(),
          providers: {
            email_configured: isEmailConfigured(),
            telegram_configured: isTelegramConfigured(),
          },
          thresholds: ContractDomainService.DEFAULT_REMINDER_CONFIG,
          timezone: process.env.GABAH_REMINDER_TIMEZONE || 'Asia/Jakarta',
          contracts_monitored: db.contracts.filter(c => !['draft', 'terminated', 'renewed'].includes(c.status)).length,
          delivery: { total_logs: logs.length, by_status: byStatus, by_channel: byChannel },
          recent_failures: failures,
        },
      });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  // Secure Authentication Endpoints
  app.post('/api/auth/login', async (req, res) => {
    try {
      const ip = extractClientIp(req) || 'unknown';
      const { email, password } = req.body || {};
      if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
        return res.status(400).json({ success: false, message: 'Email dan password wajib diisi.' });
      }
      // Bound attacker-controlled strings before alias lookup and synchronous PBKDF2.
      if (email.trim().length > 254 || password.length > 256) {
        return res.status(400).json({ success: false, message: 'Email atau kata sandi melebihi batas panjang yang diizinkan.' });
      }

      const inputEmail = email.trim().toLowerCase();
      const inPrefix = inputEmail.split('@')[0];

      // Robust Enterprise User Resolver with Alias Mapping.
      // FIX: two-pass resolution — exact email/prefix matches always win over
      // role aliases, so a person's address (hendra.w@…) can never be captured
      // by an earlier account that merely shares the same role.
      const exactUser = db.users.find(u => {
        const uEmail = u.email.toLowerCase().trim();
        if (uEmail === inputEmail) return true;
        const uPrefix = uEmail.split('@')[0];
        return uPrefix === inPrefix;
      });
      const user = exactUser ?? db.users.find(u => {
        // Role-based Alias Matching (fallback only — e.g. `karyawan@`, `it@`, `sc@`)
        if (u.role === 'Admin GABAH' && ['admin', 'admin.gabah', 'budi.santoso', 'superadmin'].includes(inPrefix)) return true;
        if (u.role === 'IT' && ['it', 'it.support', 'dani', 'dani.setiawan'].includes(inPrefix)) return true;
        if (u.role === 'GA' && ['ga', 'ga.officer', 'siti', 'siti.rahmawati'].includes(inPrefix)) return true;
        if (u.role === 'Sekretaris Direksi' && ['sekdir', 'sekretariat.direksi', 'dewi', 'dewi.anggraini'].includes(inPrefix)) return true;
        if (u.role === 'Humas' && ['humas', 'rina', 'rina.kartika'].includes(inPrefix)) return true;
        if (u.role === 'Supply Chain' && ['sc', 'sc.warehouse', 'supplychain', 'agus', 'agus.pratama'].includes(inPrefix)) return true;
        if (u.role === 'PIBC' && ['pibc', 'pibc.admin', 'pasar', 'bambang', 'bambang.h'].includes(inPrefix)) return true;
        if (u.role === 'Karyawan' && ['karyawan', 'pegawai', 'hendra', 'hendra.w'].includes(inPrefix)) return true;
        if (u.role === 'Auditor' && ['auditor', 'spi', 'maya', 'maya.indriani'].includes(inPrefix)) return true;

        return false;
      });

      // Use the resolved immutable user ID when possible so legacy login aliases
      // cannot create separate lockout buckets for the same account. Unknown
      // emails remain isolated by their normalized input value.
      const loginIdentifier = `${ip}|${user?.id ?? inputEmail}`;
      const lockCheck = await isLoginLocked(loginIdentifier);
      if (lockCheck.isLocked) {
        return res.status(429).json({
          success: false,
          message: `Terlalu banyak percobaan login gagal. Silakan coba lagi dalam ${lockCheck.remainingLockoutSeconds} detik.`,
        });
      }

      if (!user || !user.is_active) {
        const lock = await recordFailedLogin(loginIdentifier);
        if (lock.isLocked) {
          return res.status(429).json({
            success: false,
            message: `Terlalu banyak percobaan login gagal. IP dikunci selama ${lock.remainingLockoutSeconds} detik.`,
          });
        }
        return res.status(401).json({ success: false, message: 'Email atau kata sandi tidak valid.' });
      }

      // SECURITY (CR-02): password verification uses ONLY the stored PBKDF2
      // hash (server/crypto.ts). There is no hardcoded role-password list, no
      // universal fallback password, and no plaintext temp_password path.
      let isValidPassword = false;

      if (user.password_hash && user.password_salt && verifyPassword(password, user.password_hash, user.password_salt)) {
        isValidPassword = true;
      } else if (user.temp_password && user.temp_password === password) {
        // Legacy field only; hashed + consumed immediately and never returned.
        const { hash, salt } = hashPassword(password);
        user.password_hash = hash;
        user.password_salt = salt;
        delete user.temp_password;
        isValidPassword = true;
      }

      if (!isValidPassword) {
        const lock = await recordFailedLogin(loginIdentifier);
        GabahDomainService.recordAudit(
          'AUTH_LOGIN_FAILED',
          'Auth',
          `Gagal login untuk pengguna ${user.name} (${user.email}) - Kata sandi tidak cocok`,
          user
        );
        if (lock.isLocked) {
          return res.status(429).json({
            success: false,
            message: `Terlalu banyak percobaan login gagal. IP dikunci selama ${lock.remainingLockoutSeconds} detik.`,
          });
        }
        return res.status(401).json({ success: false, message: 'Email atau kata sandi tidak valid.' });
      }

      // Reset lockout counter on success
      await clearFailedLogins(loginIdentifier);

      // Create persistent session
      const session = createSession(user.id, req);
      GabahDomainService.recordAudit(
        'AUTH_LOGIN_SUCCESS',
        'Auth',
        `Pengguna ${user.name} (${user.role}) berhasil masuk dari IP ${session.ip_address}`,
        user
      );

      setSessionCookie(res, session.token);
      res.json({
        success: true,
        data: {
          user: serializeAuthenticatedUser(user),
          expires_at: session.expires_at,
        },
      });
    } catch (err: any) {
      if (isPostgresFailureLatched()) {
        return res.status(503).json({
          success: false,
          code: 'PERSISTENCE_DEGRADED',
          message: 'Autentikasi sementara tidak tersedia. Silakan coba kembali.',
        });
      }
      res.status(500).json({ success: false, message: 'Autentikasi gagal sementara.' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    try {
      const token = extractToken(req);
      if (token) {
        destroySession(token);
      }
      clearSessionCookie(res);
      res.json({ success: true, message: 'Logout berhasil.' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Self-service password change (P1): the CURRENT user rotates their own
  // password. Requires the current password; revokes all other sessions but
  // issues a fresh token for THIS device so the user is not logged out.
  app.post('/api/auth/change-password', async (req, res) => {
    try {
      const actor = getActor(req);
      const { currentPassword, newPassword } = req.body;
      if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || !currentPassword || !newPassword) {
        return res.status(400).json({ success: false, message: 'Kata sandi lama dan baru wajib diisi.' });
      }
      // Keep attacker-controlled KDF input bounded on self-service password changes.
      if (currentPassword.length > 256 || newPassword.length > 256) {
        return res.status(400).json({ success: false, message: 'Kata sandi maksimal 256 karakter.' });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ success: false, message: 'Kata sandi baru minimal 8 karakter.' });
      }
      if (newPassword === currentPassword) {
        return res.status(400).json({ success: false, message: 'Kata sandi baru harus berbeda dari kata sandi lama.' });
      }

      const user = db.users.find(u => u.id === actor.id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan.' });
      }
      if (!user.password_hash || !user.password_salt || !verifyPassword(currentPassword, user.password_hash, user.password_salt)) {
        return res.status(401).json({ success: false, message: 'Kata sandi lama tidak cocok.' });
      }

      const { hash, salt } = hashPassword(newPassword);
      user.password_hash = hash;
      user.password_salt = salt;
      delete user.temp_password;
      if (typeof user.authVersion === 'number') user.authVersion += 1;

      // SECURITY (CR-03 §3.4): rotate credentials ⇒ revoke ALL sessions, then
      // re-issue one session for the calling device so it stays signed in.
      revokeUserSessions(user.id);
      const session = createSession(user.id, req);

      GabahDomainService.recordAudit(
        'USER_PASSWORD_SELF_CHANGED',
        'Auth',
        `Pengguna ${user.name} (${user.email}) mengganti kata sandinya sendiri; seluruh sesi lain dicabut`,
        actor,
        user.id
      );
      if (!(await persistBeforeSuccess(req, res))) return;

      setSessionCookie(res, session.token);
      res.json({
        success: true,
        data: { user: sanitizeUser(user), expires_at: session.expires_at },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get('/api/auth/me', (req, res) => {
    try {
      const actor = getActor(req);
      res.json({ success: true, data: serializeAuthenticatedUser(actor) });
    } catch {
      res.status(401).json({ success: false, message: 'Sesi pengguna tidak valid.' });
    }
  });

  /**
   * SECURITY (CR-01): role/account switching is a privileged operation.
   * - Requires an authenticated session (anonymous ⇒ 401).
   * - Identity comes EXCLUSIVELY from the server-side session token; client
   *   role / userId / x-user-id can never select or forge the actor.
   * - Only Admin GABAH may switch into another account or role; every other
   *   principal receives 403. The "SIM-*" virtual persona mechanism is removed.
   * - Every successful switch is audit-logged and produces a NEW token
   *   (session rotation) bound to the real target user.
   */
  app.post('/api/auth/switch-role', async (req, res) => {
    try {
      let actor: ServerUser;
      try {
        actor = getActor(req);
      } catch {
        // No valid session — never fall back to db.users[0] or any default admin.
        return res.status(401).json({
          success: false,
          message: 'Autentikasi diperlukan. Role switching memerlukan sesi yang valid.',
        });
      }

      if (!isSuperadminActor(actor)) {
        GabahDomainService.recordAudit(
          'AUTH_SWITCH_ROLE_DENIED',
          'Auth',
          `Percobaan role switch oleh principal tanpa kewenangan: ${actor.name} (${actor.role})`,
          actor
        );
        return res.status(403).json({
          success: false,
          message: 'Akses ditolak: Hanya Admin GABAH yang berwenang melakukan alih peran ke akun/peran lain.',
        });
      }

      const { userId, role } = req.body || {};
      if (!userId && !role) {
        return res.status(400).json({ success: false, message: 'Target alih peran wajib diisi (userId atau role).' });
      }

      let targetUser = userId
        ? db.users.find(u => u.id === userId || u.email?.toLowerCase() === String(userId).toLowerCase() || u.name?.toLowerCase() === String(userId).toLowerCase())
        : null;

      if (!targetUser && role) {
        targetUser = db.users.find(u => u.role === role);
      }

      if (!targetUser) {
        return res.status(404).json({ success: false, message: 'User atau role target tidak ditemukan.' });
      }
      if (!targetUser.is_active) {
        return res.status(403).json({ success: false, message: 'Akun target tidak aktif.' });
      }

      const currentSession = (req as any).session as ServerSession | undefined;
      const originalAdminId = currentSession?.original_admin_id || actor.id;

      // Rotate: the previous admin session is revoked; a fresh token is issued
      // for the target identity (new token per authentication event — CR-03).
      if (currentSession?.token) {
        destroySession(currentSession.token);
      }

      const session = createSession(targetUser.id, req, undefined, originalAdminId);

      GabahDomainService.recordAudit(
        'AUTH_SWITCH_ROLE',
        'Auth',
        `Admin ${actor.name} beralih identitas aktif ke ${targetUser.name} (${targetUser.role})`,
        actor,
        targetUser.id
      );

      await persistDataStore();
      (req as any).__gabahPersisted = true;

      setSessionCookie(res, session.token);
      res.json({
        success: true,
        data: {
          user: serializeAuthenticatedUser(targetUser),
          expires_at: session.expires_at,
        },
      });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message });
    }
  });

  // Master Taxonomy
  // T2B-3: master kategori & aset tetap — respons selalu dinormalkan (kode
  // uppercase, main_type pada domain kanonikal, is_active default true) sehingga
  // data lama tanpa field baru tetap terbaca konsisten oleh UI.
  app.get('/api/taxonomy/categories', (req, res) => {
    const source = (db.categories && db.categories.length > 0) ? db.categories : CANONICAL_TAXONOMY;
    res.json({ success: true, data: normalizeCategoryMaster(source) });
  });

  app.post('/api/taxonomy/categories', async (req, res) => {
    try {
      const actor = getActor(req);
      if (!isSuperadminActor(actor)) {
        return res.status(403).json({ 
          success: false, 
          message: 'Akses ditolak: Hanya Super Admin (Admin GABAH) yang berwenang menambahkan Master Kategori Aset.' 
        });
      }

      const { code, name, main_type, owner_division, category_type, description, is_loanable_by_default, is_active } = req.body || {};
      if (is_loanable_by_default !== undefined && typeof is_loanable_by_default !== 'boolean') {
        return res.status(400).json({ success: false, message: 'is_loanable_by_default harus berupa boolean.' });
      }
      if (is_active !== undefined && typeof is_active !== 'boolean') {
        return res.status(400).json({ success: false, message: 'is_active harus berupa boolean.' });
      }
      if (!code || !name || !main_type || !owner_division) {
        return res.status(400).json({ 
          success: false, 
          message: 'Kode, Nama, Jenis Utama (main_type), dan Divisi Pemilik wajib diisi.' 
        });
      }

      // T2B-3: validasi domain master — jenis utama aset tetap (PSAK 16),
      // divisi pemilik, dan tipe taksonomi harus berada pada enum kanonikal.
      if (!isFixedAssetMainType(main_type)) {
        return res.status(400).json({
          success: false,
          message: `Jenis utama aset "${main_type}" tidak dikenal. Nilai yang diizinkan: ${FIXED_ASSET_MAIN_TYPES.join(', ')}.`
        });
      }
      if (!isOwnerDivision(owner_division)) {
        return res.status(400).json({ success: false, message: `Kode owner "${owner_division}" wajib diisi dan maksimal 20 karakter.` });
      }
      const normalizedOwnerCode = String(owner_division).trim().toUpperCase();
      if (['SC', 'PIBC', 'UNASSIGNED'].includes(normalizedOwnerCode)) {
        return res.status(400).json({ success: false, message: 'SC/PIBC adalah kode lokasi legacy, bukan owner kategori baru.' });
      }
      if (!(db.divisions || []).some(d => String(d.code || '').trim().toUpperCase() === normalizedOwnerCode && d.is_active !== false)) {
        return res.status(400).json({ success: false, message: `Owner "${normalizedOwnerCode}" harus terdaftar dan aktif pada Master Divisi/Owner.` });
      }
      const normalizedCategoryType = category_type || (owner_division === 'IT' ? 'IT' : 'General');
      if (!isGabahCategoryType(normalizedCategoryType)) {
        return res.status(400).json({ success: false, message: `Tipe taksonomi "${normalizedCategoryType}" tidak dikenal. Nilai yang diizinkan: IT, General, License.` });
      }

      const normalizedCode = code.trim().toUpperCase();
      if (!db.categories) db.categories = [...CANONICAL_TAXONOMY];

      const existing = db.categories.find(c => c.code.toUpperCase() === normalizedCode);
      if (existing) {
        return res.status(400).json({ 
          success: false, 
          message: `Kategori dengan kode "${normalizedCode}" sudah terdaftar (${existing.name}).` 
        });
      }

      // Validasi duplikat nama (case-insensitive) — satu nama hanya boleh
      // merepresentasikan satu kategori agar resolusi by-name tetap unik.
      const normalizedName = String(name).trim().toLowerCase();
      const dupName = db.categories.find(c => String(c && c.name || '').trim().toLowerCase() === normalizedName);
      if (dupName) {
        return res.status(400).json({
          success: false,
          message: `Kategori dengan nama "${name.trim()}" sudah terdaftar (${dupName.code}).`
        });
      }

      const newCategory = {
        code: normalizedCode,
        name: name.trim(),
        main_type,
        owner_division: normalizedOwnerCode,
        category_type: normalizedCategoryType,
        description: description || `Kategori ${name.trim()} (Milik ${owner_division})`,
        is_loanable_by_default: is_loanable_by_default === undefined ? false : is_loanable_by_default,
        // T2B-3: default aktif; nonaktif hanya lewat toggle PATCH (disable,
        // bukan hapus permanen) agar relasi aset tidak pernah rusak.
        is_active: is_active === undefined ? true : is_active,
      };

      db.categories.push(newCategory);
      GabahDomainService.recordAudit('CATEGORY_CREATED', 'MasterData', `Menambahkan master kategori ${newCategory.code} - ${newCategory.name}`, actor);
      await persistDataStore();
      (req as any).__gabahPersisted = true;

      res.status(201).json({ success: true, data: newCategory });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 500).json({ success: false, message: err.message });
    }
  });

  app.patch('/api/taxonomy/categories/:code', async (req, res) => {
    try {
      const actor = getActor(req);
      if (!isSuperadminActor(actor)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak: Hanya Super Admin (Admin GABAH) yang berwenang mengubah Master Kategori.' });
      }
      const code = req.params.code.trim().toUpperCase();
      if (!db.categories) db.categories = [...CANONICAL_TAXONOMY];
      const target = db.categories.find(c => c.code.toUpperCase() === code);
      if (!target) return res.status(404).json({ success: false, message: `Kategori "${code}" tidak ditemukan.` });

      const { name, main_type, owner_division, category_type, description, is_loanable_by_default, is_active } = req.body || {};
      if (is_loanable_by_default !== undefined && typeof is_loanable_by_default !== 'boolean') {
        return res.status(400).json({ success: false, message: 'is_loanable_by_default harus berupa boolean.' });
      }
      if (is_active !== undefined && typeof is_active !== 'boolean') {
        return res.status(400).json({ success: false, message: 'is_active harus berupa boolean.' });
      }
      // T2B-3: validasi domain (bila field dikirim) — nilai di luar enum
      // kanonikal ditolak sehingga master tidak pernah menyimpan junk.
      if (main_type !== undefined && !isFixedAssetMainType(main_type)) {
        return res.status(400).json({
          success: false,
          message: `Jenis utama aset "${main_type}" tidak dikenal. Nilai yang diizinkan: ${FIXED_ASSET_MAIN_TYPES.join(', ')}.`
        });
      }
      if (owner_division !== undefined && !isOwnerDivision(owner_division)) {
        return res.status(400).json({ success: false, message: `Owner "${owner_division}" harus berupa kode valid.` });
      }
      if (owner_division !== undefined) {
        const normalizedOwnerCode = String(owner_division).trim().toUpperCase();
        if (['SC', 'PIBC', 'UNASSIGNED'].includes(normalizedOwnerCode)) {
          return res.status(400).json({ success: false, message: 'SC/PIBC adalah kode lokasi legacy, bukan owner kategori baru.' });
        }
        if (!(db.divisions || []).some(d => String(d.code || '').trim().toUpperCase() === normalizedOwnerCode && d.is_active !== false)) {
          return res.status(400).json({ success: false, message: `Owner "${normalizedOwnerCode}" harus terdaftar dan aktif pada Master Divisi/Owner.` });
        }
      }
      if (category_type !== undefined && !isGabahCategoryType(category_type)) {
        return res.status(400).json({ success: false, message: `Tipe taksonomi "${category_type}" tidak dikenal. Nilai yang diizinkan: IT, General, License.` });
      }
      if (name !== undefined && !String(name).trim()) {
        return res.status(400).json({ success: false, message: 'Nama kategori tidak boleh kosong.' });
      }
      if (name !== undefined) {
        const normalizedName = String(name).trim().toLowerCase();
        const dup = db.categories.find(c => c.code !== target.code && String(c && c.name || '').trim().toLowerCase() === normalizedName);
        if (dup) {
          return res.status(400).json({ success: false, message: `Kategori dengan nama "${String(name).trim()}" sudah terdaftar (${dup.code}).` });
        }
      }

      if (name) target.name = String(name).trim();
      if (main_type) target.main_type = main_type;
      if (owner_division) target.owner_division = String(owner_division).trim().toUpperCase();
      if (category_type) target.category_type = category_type;
      if (description !== undefined) target.description = description;
      if (is_loanable_by_default !== undefined) target.is_loanable_by_default = is_loanable_by_default;
      // T2B-3: toggle enable/disable (bukan hard-delete). Kategori nonaktif
      // tetap terbaca untuk aset historis, tetapi ditolak sebagai nilai baru.
      if (is_active !== undefined) target.is_active = is_active;
      if (typeof target.is_active !== 'boolean') target.is_active = true;

      GabahDomainService.recordAudit(
        'CATEGORY_UPDATED',
        'MasterData',
        `Memperbarui master kategori ${target.code} - ${target.name}${is_active !== undefined ? (target.is_active ? ' (diaktifkan)' : ' (dinonaktifkan)') : ''}`,
        actor,
      );
      await persistDataStore();
      (req as any).__gabahPersisted = true;
      res.json({ success: true, data: target });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 500).json({ success: false, message: err.message });
    }
  });

  app.delete('/api/taxonomy/categories/:code', async (req, res) => {
    try {
      const actor = getActor(req);
      if (!isSuperadminActor(actor)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak: Hanya Super Admin (Admin GABAH) yang berwenang menghapus Master Kategori.' });
      }
      const code = req.params.code.trim().toUpperCase();
      const inUse = db.assets.filter(a => a.category_code === code || a.asset_number?.includes(`-${code}-`));
      if (inUse.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Tidak dapat menghapus kategori "${code}" karena masih digunakan oleh ${inUse.length} aset terdaftar.`
        });
      }

      if (!db.categories) db.categories = [...CANONICAL_TAXONOMY];
      const initialLen = db.categories.length;
      db.categories = db.categories.filter(c => c.code.toUpperCase() !== code);
      if (db.categories.length === initialLen) {
        return res.status(404).json({ success: false, message: `Kategori "${code}" tidak ditemukan.` });
      }

      GabahDomainService.recordAudit('CATEGORY_DELETED', 'MasterData', `Menghapus master kategori ${code}`, actor);
      await persistDataStore();
      (req as any).__gabahPersisted = true;
      res.json({ success: true, message: `Kategori ${code} berhasil dihapus.` });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 500).json({ success: false, message: err.message });
    }
  });

  // Master Locations API
  app.get('/api/master/locations', (req, res) => {
    res.json({ success: true, data: db.locations || [] });
  });

  app.post('/api/master/locations', async (req, res) => {
    try {
      const actor = getActor(req);
      if (!isSuperadminActor(actor)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak: Hanya Super Admin yang berwenang menambah master lokasi.' });
      }
      const { name, address, capacity } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Nama lokasi fasilitas wajib diisi.' });
      }
      if (!db.locations) db.locations = [];
      const newLoc = {
        id: `loc-${Date.now()}`,
        name: name.trim(),
        address: address?.trim() || 'Kawasan PIBC, Jakarta Timur',
        capacity: capacity?.trim() || 'Fasilitas Operasional'
      };
      db.locations.push(newLoc);
      GabahDomainService.recordAudit('LOCATION_CREATED', 'MasterData', `Menambahkan master lokasi ${newLoc.name}`, actor);
      await persistDataStore();
      (req as any).__gabahPersisted = true;
      res.status(201).json({ success: true, data: newLoc });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 500).json({ success: false, message: err.message });
    }
  });

  app.patch('/api/master/locations/:id', async (req, res) => {
    try {
      const actor = getActor(req);
      if (!isSuperadminActor(actor)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak: Hanya Super Admin yang berwenang mengedit master lokasi.' });
      }
      if (!db.locations) db.locations = [];
      const target = db.locations.find(l => l.id === req.params.id);
      if (!target) return res.status(404).json({ success: false, message: 'Lokasi tidak ditemukan.' });

      const { name, address, capacity } = req.body;
      if (name) target.name = name.trim();
      if (address !== undefined) target.address = address.trim();
      if (capacity !== undefined) target.capacity = capacity.trim();

      GabahDomainService.recordAudit('LOCATION_UPDATED', 'MasterData', `Memperbarui master lokasi ${target.name}`, actor);
      await persistDataStore();
      (req as any).__gabahPersisted = true;
      res.json({ success: true, data: target });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 500).json({ success: false, message: err.message });
    }
  });

  app.delete('/api/master/locations/:id', async (req, res) => {
    try {
      const actor = getActor(req);
      if (!isSuperadminActor(actor)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak: Hanya Super Admin yang berwenang menghapus master lokasi.' });
      }
      if (!db.locations) db.locations = [];
      const loc = db.locations.find(l => l.id === req.params.id);
      if (!loc) return res.status(404).json({ success: false, message: 'Lokasi tidak ditemukan.' });

      db.locations = db.locations.filter(l => l.id !== req.params.id);
      GabahDomainService.recordAudit('LOCATION_DELETED', 'MasterData', `Menghapus master lokasi ${loc.name}`, actor);
      await persistDataStore();
      (req as any).__gabahPersisted = true;
      res.json({ success: true, message: `Lokasi ${loc.name} berhasil dihapus.` });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 500).json({ success: false, message: err.message });
    }
  });

  // Master Organization Divisions API
  app.get('/api/master/divisions', (req, res) => {
    res.json({ success: true, data: db.divisions || [] });
  });

  app.post('/api/master/divisions', async (req, res) => {
    try {
      const actor = getActor(req);
      if (!isSuperadminActor(actor)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak: Hanya Super Admin yang berwenang menambah divisi.' });
      }
      const { code, name, leader, depts } = req.body;
      if (!code || !name) {
        return res.status(400).json({ success: false, message: 'Kode divisi dan nama divisi wajib diisi.' });
      }
      const normCode = code.trim().toUpperCase();
      if (!/^[A-Z0-9_-]{2,20}$/.test(normCode)) {
        return res.status(400).json({ success: false, message: 'Kode owner harus 2–20 karakter dan hanya boleh berisi huruf, angka, tanda hubung, atau garis bawah.' });
      }
      if (!db.divisions) db.divisions = [];
      if (db.divisions.some(d => d.code.toUpperCase() === normCode)) {
        return res.status(400).json({ success: false, message: `Divisi dengan kode "${normCode}" sudah ada.` });
      }

      const newDiv = {
        code: normCode,
        name: name.trim(),
        leader: leader?.trim() || 'Kepala Divisi',
        depts: Array.isArray(depts) && depts.length > 0 ? depts : ['Operasional']
      };
      db.divisions.push(newDiv);
      GabahDomainService.recordAudit('DIVISION_CREATED', 'Organization', `Menambahkan divisi baru ${newDiv.code} - ${newDiv.name}`, actor);
      await persistDataStore();
      (req as any).__gabahPersisted = true;
      res.status(201).json({ success: true, data: newDiv });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 500).json({ success: false, message: err.message });
    }
  });

  app.patch('/api/master/divisions/:code', async (req, res) => {
    try {
      const actor = getActor(req);
      if (!isSuperadminActor(actor)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak: Hanya Super Admin yang berwenang mengubah struktur divisi.' });
      }
      const code = req.params.code.trim().toUpperCase();
      if (!db.divisions) db.divisions = [];
      const div = db.divisions.find(d => d.code.toUpperCase() === code);
      if (!div) return res.status(404).json({ success: false, message: 'Divisi tidak ditemukan.' });

      const { name, leader, depts } = req.body;
      if (name) div.name = name.trim();
      if (leader) div.leader = leader.trim();
      if (Array.isArray(depts)) div.depts = depts;

      GabahDomainService.recordAudit('DIVISION_UPDATED', 'Organization', `Memperbarui divisi ${div.code} - ${div.name}`, actor);
      await persistDataStore();
      (req as any).__gabahPersisted = true;
      res.json({ success: true, data: div });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 500).json({ success: false, message: err.message });
    }
  });

  app.delete('/api/master/divisions/:code', async (req, res) => {
    try {
      const actor = getActor(req);
      if (!isSuperadminActor(actor)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak: Hanya Super Admin yang berwenang menghapus divisi.' });
      }
      const code = req.params.code.trim().toUpperCase();
      const assetsCount = db.assets.filter(a => String(a.owner_division || '').toUpperCase() === code).length;
      const categoriesCount = (db.categories || []).filter(c => String(c.owner_division || '').toUpperCase() === code).length;
      const usersCount = db.users.filter(u => String(u.division || '').toUpperCase() === code).length;
      const unitsCount = (db.orgUnits || []).filter(u => String(u.division_code || '').toUpperCase() === code).length;
      const vendorsCount = (db.vendors || []).filter(v => String(v.owner_division || '').toUpperCase() === code).length;
      const contractsCount = (db.contracts || []).filter(item => String(item.owner_division || '').toUpperCase() === code).length;
      const maintenanceCount = (db.maintenances || []).filter(item => String(item.owner_division || '').toUpperCase() === code).length;
      const loanCount = (db.loans || []).filter(item => String(item.owner_division || '').toUpperCase() === code).length;
      // Tickets retain their routing category as a historical business reference.
      // A division cannot be deleted while tickets still target that queue.
      const ticketsCount = (db.tickets || []).filter(item => String(item.category || '').trim().toUpperCase() === code).length;
      const references = assetsCount + categoriesCount + usersCount + unitsCount + vendorsCount + contractsCount + maintenanceCount + loanCount + ticketsCount;
      if (references > 0) {
        return res.status(400).json({
          success: false,
          message: `Tidak dapat menghapus owner "${code}". Referensi: aset (${assetsCount}), kategori (${categoriesCount}), pegawai (${usersCount}), unit (${unitsCount}), vendor (${vendorsCount}), kontrak (${contractsCount}), maintenance (${maintenanceCount}), peminjaman (${loanCount}), tiket (${ticketsCount}).`
        });
      }

      if (!db.divisions) db.divisions = [];
      const div = db.divisions.find(d => d.code.toUpperCase() === code);
      if (!div) return res.status(404).json({ success: false, message: 'Divisi tidak ditemukan.' });

      db.divisions = db.divisions.filter(d => d.code.toUpperCase() !== code);
      GabahDomainService.recordAudit('DIVISION_DELETED', 'Organization', `Menghapus struktur divisi ${code} (${div.name})`, actor);
      await persistDataStore();
      (req as any).__gabahPersisted = true;
      res.json({ success: true, message: `Divisi ${code} berhasil dihapus.` });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 500).json({ success: false, message: err.message });
    }
  });

  // =========================
  // ORG-MODEL: Master Jabatan/Level, Unit, dan Kantor/Lokasi.
  // Ketiganya master terpisah & configurable (tambah/edit/disable) oleh
  // Admin GABAH. Jabatan TIDAK memberikan permission (RBAC tetap per role);
  // Unit ≠ Jabatan ≠ Lokasi; lokasi tidak memengaruhi owner/numbering aset.
  // =========================
  app.get('/api/master/job-levels', (req, res) => {
    res.json({ success: true, data: db.jobLevels || [] });
  });

  app.post('/api/master/job-levels', async (req, res) => {
    try {
      const actor = getActor(req);
      if (!isSuperadminActor(actor)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak: hanya Admin GABAH yang berwenang mengelola master jabatan.' });
      }
      const code = String(req.body.code || '').trim().toUpperCase();
      const label = String(req.body.label || '').trim();
      if (!code || !label) return res.status(400).json({ success: false, message: 'Kode dan nama jabatan wajib diisi.' });
      if (!db.jobLevels) db.jobLevels = [];
      if (db.jobLevels.some(j => j.code === code)) {
        return res.status(400).json({ success: false, message: `Jabatan dengan kode "${code}" sudah ada.` });
      }
      const maxOrder = db.jobLevels.reduce((m, j) => Math.max(m, j.order || 0), 0);
      const level = { code, label, order: Number(req.body.order) || maxOrder + 1, is_active: true };
      db.jobLevels.push(level);
      GabahDomainService.recordAudit('JOB_LEVEL_CREATED', 'Organization', `Menambahkan master jabatan ${level.code} (${level.label})`, actor);
      await persistDataStore();
      (req as any).__gabahPersisted = true;
      res.status(201).json({ success: true, data: level });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message });
    }
  });

  app.patch('/api/master/job-levels/:code', async (req, res) => {
    try {
      const actor = getActor(req);
      if (!isSuperadminActor(actor)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak: hanya Admin GABAH yang berwenang mengelola master jabatan.' });
      }
      if (!db.jobLevels) db.jobLevels = [];
      const level = db.jobLevels.find(j => j.code === req.params.code.trim().toUpperCase());
      if (!level) return res.status(404).json({ success: false, message: 'Jabatan tidak ditemukan.' });
      if (req.body?.is_active !== undefined && typeof req.body.is_active !== 'boolean') {
        return res.status(400).json({ success: false, message: 'is_active harus berupa boolean true atau false.' });
      }
      if (req.body.label !== undefined) level.label = String(req.body.label).trim() || level.label;
      if (req.body.order !== undefined) level.order = Number(req.body.order);
      if (req.body.is_active !== undefined) level.is_active = req.body.is_active;
      GabahDomainService.recordAudit('JOB_LEVEL_UPDATED', 'Organization', `Memperbarui master jabatan ${level.code} (${level.label}) — aktif: ${level.is_active}`, actor);
      await persistDataStore();
      (req as any).__gabahPersisted = true;
      res.json({ success: true, data: level });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message });
    }
  });

  app.get('/api/master/org-units', (req, res) => {
    res.json({ success: true, data: db.orgUnits || [] });
  });

  app.post('/api/master/org-units', async (req, res) => {
    try {
      const actor = getActor(req);
      if (!isSuperadminActor(actor)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak: hanya Admin GABAH yang berwenang mengelola master unit.' });
      }
      const name = String(req.body.name || '').trim();
      const requestedDivisionCode = String(req.body.division_code || 'Umum').trim();
      const configuredDivision = (db.divisions || []).find(d => String(d.code || '').trim().toLowerCase() === requestedDivisionCode.toLowerCase());
      if (!name) return res.status(400).json({ success: false, message: 'Nama unit wajib diisi.' });
      if (!configuredDivision) return res.status(400).json({ success: false, message: `Divisi "${requestedDivisionCode}" tidak terdaftar pada Master Divisi.` });
      const divisionCode = String(configuredDivision.code);
      if (!db.orgUnits) db.orgUnits = [];
      if (db.orgUnits.some(u => u.name.toLowerCase() === name.toLowerCase())) {
        return res.status(400).json({ success: false, message: `Unit "${name}" sudah ada.` });
      }
      const unit = { id: `UNIT-${Date.now().toString(36).toUpperCase()}`, name, division_code: divisionCode as any, is_active: true };
      db.orgUnits.push(unit);
      GabahDomainService.recordAudit('ORG_UNIT_CREATED', 'Organization', `Menambahkan master unit ${unit.name} (divisi ${unit.division_code})`, actor);
      await persistDataStore();
      (req as any).__gabahPersisted = true;
      res.status(201).json({ success: true, data: unit });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message });
    }
  });

  app.patch('/api/master/org-units/:id', async (req, res) => {
    try {
      const actor = getActor(req);
      if (!isSuperadminActor(actor)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak: hanya Admin GABAH yang berwenang mengelola master unit.' });
      }
      if (!db.orgUnits) db.orgUnits = [];
      const unit = db.orgUnits.find(u => u.id === req.params.id);
      if (!unit) return res.status(404).json({ success: false, message: 'Unit tidak ditemukan.' });
      if (req.body?.is_active !== undefined && typeof req.body.is_active !== 'boolean') {
        return res.status(400).json({ success: false, message: 'is_active harus berupa boolean true atau false.' });
      }
      // Resolve and validate every supplied relation before mutating the
      // in-memory master row, so a rejected division cannot partially apply
      // an otherwise valid name change.
      let resolvedDivisionCode: string | undefined;
      if (req.body.division_code !== undefined) {
        const requestedDivisionCode = String(req.body.division_code || '').trim();
        const configuredDivision = (db.divisions || []).find(d => String(d.code || '').trim().toLowerCase() === requestedDivisionCode.toLowerCase());
        if (!configuredDivision) return res.status(400).json({ success: false, message: `Divisi "${requestedDivisionCode}" tidak terdaftar pada Master Divisi.` });
        resolvedDivisionCode = String(configuredDivision.code);
      }
      if (req.body.name !== undefined) {
        const requestedName = String(req.body.name).trim();
        if (requestedName && (db.orgUnits || []).some(existing =>
          existing.id !== unit.id && String(existing.name || '').trim().toLowerCase() === requestedName.toLowerCase()
        )) {
          return res.status(400).json({ success: false, message: `Unit "${requestedName}" sudah digunakan.` });
        }
        if (requestedName) unit.name = requestedName;
      }
      if (resolvedDivisionCode !== undefined) unit.division_code = resolvedDivisionCode as any;
      if (req.body.is_active !== undefined) unit.is_active = req.body.is_active;
      GabahDomainService.recordAudit('ORG_UNIT_UPDATED', 'Organization', `Memperbarui master unit ${unit.name} — aktif: ${unit.is_active}`, actor);
      await persistDataStore();
      (req as any).__gabahPersisted = true;
      res.json({ success: true, data: unit });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message });
    }
  });

  app.get('/api/master/office-locations', (req, res) => {
    res.json({ success: true, data: db.officeLocations || [] });
  });

  app.post('/api/master/office-locations', async (req, res) => {
    try {
      const actor = getActor(req);
      if (!isSuperadminActor(actor)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak: hanya Admin GABAH yang berwenang mengelola master lokasi kantor.' });
      }
      const name = String(req.body.name || '').trim();
      if (!name) return res.status(400).json({ success: false, message: 'Nama lokasi kantor wajib diisi.' });
      if (!db.officeLocations) db.officeLocations = [];
      if (db.officeLocations.some(l => l.name.toLowerCase() === name.toLowerCase())) {
        return res.status(400).json({ success: false, message: `Lokasi kantor "${name}" sudah ada.` });
      }
      const loc = { id: `OFF-${Date.now().toString(36).toUpperCase()}`, name, is_active: true };
      db.officeLocations.push(loc);
      GabahDomainService.recordAudit('OFFICE_LOCATION_CREATED', 'Organization', `Menambahkan master lokasi kantor ${loc.name}`, actor);
      await persistDataStore();
      (req as any).__gabahPersisted = true;
      res.status(201).json({ success: true, data: loc });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message });
    }
  });

  app.patch('/api/master/office-locations/:id', async (req, res) => {
    try {
      const actor = getActor(req);
      if (!isSuperadminActor(actor)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak: hanya Admin GABAH yang berwenang mengelola master lokasi kantor.' });
      }
      if (!db.officeLocations) db.officeLocations = [];
      const loc = db.officeLocations.find(l => l.id === req.params.id);
      if (!loc) return res.status(404).json({ success: false, message: 'Lokasi kantor tidak ditemukan.' });
      if (req.body?.is_active !== undefined && typeof req.body.is_active !== 'boolean') {
        return res.status(400).json({ success: false, message: 'is_active harus berupa boolean true atau false.' });
      }
      if (req.body.name !== undefined) loc.name = String(req.body.name).trim() || loc.name;
      if (req.body.is_active !== undefined) loc.is_active = req.body.is_active;
      GabahDomainService.recordAudit('OFFICE_LOCATION_UPDATED', 'Organization', `Memperbarui master lokasi kantor ${loc.name} — aktif: ${loc.is_active}`, actor);
      await persistDataStore();
      (req as any).__gabahPersisted = true;
      res.json({ success: true, data: loc });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message });
    }
  });

  // =========================
  // T2B-2: Master Lokasi Fisik Aset — TERPISAH dari office-locations
  // (penempatan user) dan org-units (unit pengelola). Hierarki sederhana
  // via parent_id; nonaktif = tidak dapat dipilih untuk aset baru, tetapi
  // data historis tetap terbaca. Tidak ada hard-delete (pola disable,
  // seperti master organisasi lain) — lokasi tereferensi aset aman.
  // =========================
  app.get('/api/master/asset-locations', (req, res) => {
    res.json({ success: true, data: db.assetLocations || [] });
  });

  app.post('/api/master/asset-locations', async (req, res) => {
    try {
      const actor = getActor(req);
      if (!isSuperadminActor(actor)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak: hanya Admin GABAH yang berwenang mengelola master lokasi aset.' });
      }
      const name = String(req.body.name || '').trim();
      if (!name) return res.status(400).json({ success: false, message: 'Nama lokasi wajib diisi.' });
      if (!db.assetLocations) db.assetLocations = [];
      const parentId = req.body.parent_id ? String(req.body.parent_id).trim() : null;
      if (parentId && !(db.assetLocations || []).some(l => l.id === parentId)) {
        return res.status(400).json({ success: false, message: `Lokasi induk "${parentId}" tidak terdaftar.` });
      }
      // Duplikasi: nama + induk yang sama tidak boleh dobel (case-insensitive).
      if ((db.assetLocations || []).some(l => l.name.trim().toLowerCase() === name.toLowerCase() && (l.parent_id || null) === parentId)) {
        return res.status(400).json({ success: false, message: `Lokasi "${name}" sudah ada di level yang sama.` });
      }
      const loc = { id: `ALOC-${Date.now().toString(36).toUpperCase()}`, name, parent_id: parentId, is_active: true };
      db.assetLocations.push(loc);
      GabahDomainService.recordAudit('ASSET_LOCATION_CREATED', 'Assets', `Menambahkan master lokasi fisik aset ${getAssetLocationPath(loc)}`, actor);
      await persistDataStore();
      (req as any).__gabahPersisted = true;
      res.status(201).json({ success: true, data: loc });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message });
    }
  });

  app.patch('/api/master/asset-locations/:id', async (req, res) => {
    try {
      const actor = getActor(req);
      if (!isSuperadminActor(actor)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak: hanya Admin GABAH yang berwenang mengelola master lokasi aset.' });
      }
      if (!db.assetLocations) db.assetLocations = [];
      const loc = db.assetLocations.find(l => l.id === req.params.id);
      if (!loc) return res.status(404).json({ success: false, message: 'Lokasi tidak ditemukan.' });
      if (req.body?.is_active !== undefined && typeof req.body.is_active !== 'boolean') {
        return res.status(400).json({ success: false, message: 'is_active harus berupa boolean true atau false.' });
      }
      if (req.body.name !== undefined) {
        const newName = String(req.body.name).trim() || loc.name;
        const newParent = req.body.parent_id !== undefined ? (req.body.parent_id ? String(req.body.parent_id).trim() : null) : (loc.parent_id || null);
        if ((db.assetLocations || []).some(l => l.id !== loc.id && l.name.trim().toLowerCase() === newName.toLowerCase() && (l.parent_id || null) === newParent)) {
          return res.status(400).json({ success: false, message: `Lokasi "${newName}" sudah ada di level yang sama.` });
        }
        loc.name = newName;
      }
      if (req.body.parent_id !== undefined) {
        const parentId = req.body.parent_id ? String(req.body.parent_id).trim() : null;
        if (parentId) {
          if (!(db.assetLocations || []).some(l => l.id === parentId)) {
            return res.status(400).json({ success: false, message: `Lokasi induk "${parentId}" tidak terdaftar.` });
          }
          // Guard hierarki: parent baru tidak boleh membentuk siklus.
          assertValidLocationParent(loc.id, parentId);
        }
        if (parentId === loc.id) {
          return res.status(400).json({ success: false, message: 'Lokasi tidak boleh menjadi induk bagi dirinya sendiri.' });
        }
        loc.parent_id = parentId;
      }
      if (req.body.is_active !== undefined) loc.is_active = req.body.is_active;
      GabahDomainService.recordAudit('ASSET_LOCATION_UPDATED', 'Assets', `Memperbarui master lokasi fisik aset ${getAssetLocationPath(loc)} — aktif: ${loc.is_active}`, actor);
      await persistDataStore();
      (req as any).__gabahPersisted = true;
      res.json({ success: true, data: loc });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/taxonomy/resolve', (req, res) => {
    try {
      const { nameOrCode, owner_division } = req.body;
      // T2B-3: resolve terhadap master kategori yang sedang berlaku.
      const resolved = resolveTaxonomyByHumanName(
        nameOrCode,
        owner_division,
        (db.categories && db.categories.length > 0) ? db.categories : CANONICAL_TAXONOMY,
      );
      res.json({ success: true, data: resolved });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  // Server-authoritative asset creation choices. The UI must never infer write authority from a role label.
  app.get('/api/assets/create-options', (req, res) => {
    if (!requireRbacPermission(req, res, 'assets.create')) return;
    const actor = getActor(req);
    const ownerDomains = (db.divisions || [])
      .filter(owner => owner && owner.is_active !== false
        && canMutateAssetOwner(actor, String(owner.code || ''), 'assets.create'))
      .map(owner => ({ code: String(owner.code || '').trim().toUpperCase(), name: String(owner.name || owner.code || '').trim() }))
      .filter(owner => owner.code && !['SC', 'PIBC'].includes(owner.code));
    const allowedOwnerCodes = new Set(ownerDomains.map(owner => owner.code));
    const categories = (db.categories || [])
      .filter(category => {
        if (!category || category.is_active === false) return false;
        const masterOwner = String(category.owner_division || '').trim().toUpperCase();
        const code = String(category.code || '').trim().toUpperCase();
        const mainType = String(category.main_type || '').trim().toUpperCase();
        const categoryType = String(category.category_type || '').trim().toUpperCase();
        // Mirror createAsset() corporate ownership overrides so the UI never
        // offers a category that the authoritative mutation service will reject.
        const effectiveOwner = ['IT-H', 'IT-S'].includes(mainType) || ['IT', 'LICENSE'].includes(categoryType)
          ? 'IT'
          : code === 'INV-F' ? 'GA' : masterOwner;
        return masterOwner === effectiveOwner && allowedOwnerCodes.has(effectiveOwner);
      })
      .map(category => ({ ...category, owner_division: String(category.owner_division || '').trim().toUpperCase() }));
    const categoryOwnerCodes = new Set(categories.map(category => category.owner_division));
    const selectableOwners = ownerDomains.filter(owner => categoryOwnerCodes.has(owner.code));
    return res.json({ success: true, data: { owner_domains: selectableOwners, categories } });
  });

  // Assets Management
  app.get('/api/assets', (req, res) => {
    if (!requireRbacPermission(req, res, 'assets.read')) return;
    const actor = getActor(req);
    const scopedAssets = GabahDomainService.getScopedAssets(actor);
    res.json({ success: true, data: scopedAssets });
  });

  app.post('/api/assets', async (req, res) => {
    if (!requireRbacPermission(req, res, 'assets.create')) return;
    try {
      const actor = getActor(req);
      // Effective permission and explicit owner-domain scope are enforced by
      // createAsset() for every user, regardless of job title or work location.
      const auditIdsBefore = new Set(db.auditLogs.map(item => item.id));
      const newAsset = await GabahDomainService.createAsset(req.body, actor, false);
      const createdAuditIds = new Set(db.auditLogs.filter(item => !auditIdsBefore.has(item.id)).map(item => item.id));
      if (!(await persistBeforeSuccess(req, res))) {
        db.assets.splice(0, db.assets.length, ...db.assets.filter(item => item.id !== newAsset.id));
        db.auditLogs.splice(0, db.auditLogs.length, ...db.auditLogs.filter(item => !createdAuditIds.has(item.id)));
        return;
      }
      res.status(201).json({ success: true, data: newAsset });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message });
    }
  });

  // Bulk import aset (IMPORT Excel/CSV). Setiap baris diproses individual via
  // GabahDomainService.createAsset sehingga resolusi taxonomi, authority divisi,
  // deteksi duplikat SN/ERP, dan penomoran aset tetap server-authoritative.
  // Satu baris buruk tidak menggagalkan batch.
  // Upsert opsional: allow_update=true → baris yang serial/No. Accurate-nya
  // sudah terdaftar DIPERBARUI (allowlist sama dengan PATCH /api/assets/:id),
  // bukan ditolak.
  app.post('/api/assets/bulk-import', async (req, res) => {
    if (!requireRbacPermission(req, res, 'assets.bulk_import')) return;
    try {
      const actor = getActor(req);
      // Permission and owner scope are checked per imported row by createAsset().
      // Do not block a Karyawan who has an explicit additional asset capability.

      const rows: any[] = Array.isArray(req.body?.assets) ? req.body.assets : [];
      if (rows.length === 0) {
        return res.status(400).json({ success: false, message: 'Tidak ada baris data aset untuk diimpor.' });
      }
      if (rows.length > 500) {
        return res.status(400).json({ success: false, message: 'Maksimal 500 baris per impor. Pisahkan menjadi beberapa berkas.' });
      }
      const allowUpdate = req.body?.allow_update === true;

      const VALID_CONDITIONS = ['new', 'good', 'fair', 'poor', 'broken', 'excellent', 'damaged'];
      const VALID_ASSET_STATUSES = ['active', 'assigned', 'available', 'reserved', 'in_repair', 'damaged', 'cannibalized', 'pending_disposal', 'pending_auction', 'auctioned', 'disposed', 'lost', 'inactive', 'in_use', 'loaned', 'maintenance'];
      const VALID_DIVISIONS = (db.divisions || []).map(d => String(d.code).trim().toUpperCase());
      // CR-06: allowlist identik dengan PATCH /api/assets/:id
      const UPDATE_FIELDS = ['name', 'brand', 'model', 'serial_number', 'specifications', 'location', 'condition', 'notes', 'is_loanable', 'corporate_asset_number'];

      let created = 0;
      let updated = 0;
      const errors: string[] = [];
      const warnings: string[] = [];
      const importedAssets: ServerAsset[] = [];
      const seenKeys = new Set<string>();
      const originalAssets = new Map<string, ServerAsset>();
      const createdAssetIds = new Set<string>();
      const auditIdsBefore = new Set(db.auditLogs.map(item => item.id));

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i] || {};
        const rowNo = i + 1;
        const name = String(row.name || '').trim();
        const serial = String(row.serial_number || '').trim();
        const corp = String(row.corporate_asset_number || '').trim();

        if (!name) { errors.push(`Baris ${rowNo}: Nama aset wajib diisi.`); continue; }

        // Duplikat kunci di dalam satu berkas (SN atau No. Accurate)
        const fileKey = serial ? `sn:${serial.toLowerCase()}` : (corp ? `corp:${corp.toLowerCase()}` : '');
        if (fileKey) {
          if (seenKeys.has(fileKey)) {
            errors.push(`Baris ${rowNo}: ${serial ? 'Serial number' : 'Nomor Accurate'} duplikat di dalam berkas.`);
            continue;
          }
          seenKeys.add(fileKey);
        }

        // Divisi pemilik opsional (kategori menentukan default-nya)
        let division = String(row.owner_division || '').trim().toUpperCase();
        if (division && !VALID_DIVISIONS.includes(division)) {
          warnings.push(`Baris ${rowNo}: Divisi "${division}" tidak dikenali (mengikuti kategori).`);
          division = '';
        }

        // Kondisi fisik dinormalisasi; nilai asing → dilewati + warning
        let condition = String(row.condition || '').trim().toLowerCase();
        if (condition && !VALID_CONDITIONS.includes(condition)) {
          warnings.push(`Baris ${rowNo}: Kondisi "${condition}" tidak dikenali (dilewati).`);
          condition = '';
        }

        let isLoanable: boolean | undefined = undefined;
        if (row.is_loanable !== undefined && String(row.is_loanable).trim() !== '') {
          const loanableText = String(row.is_loanable).trim().toLowerCase();
          if (!['true', 'false', '1', '0', 'ya', 'tidak', 'yes', 'no'].includes(loanableText)) {
            errors.push(`Baris ${rowNo}: Nilai is_loanable harus boolean (true/false).`);
            continue;
          }
          isLoanable = ['true', '1', 'ya', 'yes'].includes(loanableText);
        }
        const requestedStatus = row.status === undefined || String(row.status).trim() === ''
          ? undefined
          : String(row.status).trim();
        if (requestedStatus !== undefined && !VALID_ASSET_STATUSES.includes(requestedStatus)) {
          errors.push(`Baris ${rowNo}: Status aset "${requestedStatus}" tidak valid.`);
          continue;
        }

        const existing = (serial && db.assets.find(a => a.serial_number && a.serial_number.trim().toLowerCase() === serial.toLowerCase()))
          || (corp && db.assets.find(a => a.corporate_asset_number && a.corporate_asset_number.trim().toLowerCase() === corp.toLowerCase()));

        if (existing) {
          if (!allowUpdate) {
            errors.push(`Baris ${rowNo}: ${serial ? `Serial "${serial}"` : `Nomor Accurate "${corp}"`} sudah terdaftar pada aset ${existing.asset_number} (${existing.name}). Aktifkan opsi perbarui bila ingin memperbarui.`);
            continue;
          }
          // Generic import edits must never bypass the dedicated lifecycle workflow.
          // Status changes belong to /api/assets/:id/lifecycle or the loan workflow.
          if (requestedStatus !== undefined && requestedStatus !== existing.status) {
            errors.push(`Baris ${rowNo}: ${existing.asset_number} tidak dapat mengubah status melalui impor massal. Gunakan alur lifecycle atau peminjaman.`);
            continue;
          }
          // Bulk UPDATE uses the same owner-domain authorization as PATCH.
          // No role-name or physical-location shortcut grants mutation rights.
          if (isAuditorActor(actor) || !canMutateAssetOwner(actor, existing.owner_division, 'assets.update')) {
            errors.push(`Baris ${rowNo}: ${existing.asset_number} ditolak. Permission assets.update dan scope owner "${existing.owner_division}" wajib dimiliki.`);
            continue;
          }
          // The bulk-update path must enforce the same active-loan lock as
          // PATCH /api/assets/:id; otherwise CSV import could bypass custody state.
          const activeLoan = (db.loans || []).find(loan =>
            loan.asset_id === existing.id && ['approved', 'borrowed'].includes(loan.status)
          );
          if (activeLoan) {
            const changesStatus = requestedStatus !== undefined && requestedStatus !== existing.status;
            const changesLoanability = isLoanable !== undefined && isLoanable !== existing.is_loanable;
            if (changesStatus || changesLoanability) {
              errors.push(`Baris ${rowNo}: ${existing.asset_number} tidak dapat mengubah status atau konfigurasi pinjam selama pinjaman ${activeLoan.loan_number} berstatus ${activeLoan.status}.`);
              continue;
            }
          }

          // UPDATE path — allowlist eksplisit, asset_number & owner_division server-owned
          if (isLoanable === true && isNonLoanableInfrastructureAsset(existing as any)) {
            errors.push(`Baris ${rowNo}: ${existing.asset_number} termasuk kategori infrastruktur/lisensi dan tidak dapat dijadikan aset pinjaman.`);
            continue;
          }
          if (!originalAssets.has(existing.id)) originalAssets.set(existing.id, structuredClone(existing));
          for (const key of UPDATE_FIELDS) {
            if (key === 'condition') {
              if (condition) (existing as any).condition = condition;
              continue;
            }
            if (key === 'is_loanable') {
              if (isLoanable !== undefined) (existing as any).is_loanable = isLoanable;
              continue;
            }
            const value = key === 'status' ? requestedStatus : row[key];
            if (value !== undefined && String(value).trim() !== '') {
              (existing as any)[key] = typeof value === 'string' ? value.trim() : value;
            }
          }
          existing.updated_at = new Date().toISOString();
          GabahDomainService.recordAudit('ASSET_BULK_UPDATED', 'Assets', `Impor massal: data aset ${existing.asset_number} (${existing.name}) diperbarui.`, actor, existing.id, false);
          importedAssets.push(existing);
          updated++;
          continue;
        }

        // CREATE path — domain service yang otoritatif
        const priceRaw = String(row.purchase_price ?? '').replace(/[^0-9.-]/g, '');
        const priceNum = Number(priceRaw);
        try {
          const asset = await GabahDomainService.createAsset({
            category_name_or_code: String(row.category_name_or_code || row.category || '').trim() || undefined,
            name,
            owner_division: (division || undefined) as any,
            corporate_asset_number: corp || undefined,
            brand: String(row.brand || '').trim() || undefined,
            model: String(row.model || '').trim() || undefined,
            serial_number: serial || undefined,
            specifications: String(row.specifications || '').trim() || undefined,
            purchase_date: String(row.purchase_date || '').trim() || undefined,
            purchase_price: Number.isFinite(priceNum) && priceNum > 0 ? priceNum : undefined,
            location: String(row.location || '').trim() || undefined,
            is_loanable: isLoanable,
            condition: (condition || undefined) as any,
            notes: String(row.notes || '').trim() || undefined,
          }, actor, false);
          createdAssetIds.add(asset.id);
          GabahDomainService.recordAudit('ASSET_BULK_CREATED', 'Assets', `Impor massal: aset baru ${asset.asset_number} (${asset.name}) didaftarkan.`, actor, asset.id, false);
          importedAssets.push(asset);
          created++;
        } catch (rowErr: any) {
          errors.push(`Baris ${rowNo}: ${rowErr.message}`);
        }
      }

      if (created > 0 || updated > 0) {
        const updatedAssetsAfter = new Map<string, ServerAsset>();
        for (const id of originalAssets.keys()) {
          const current = db.assets.find(item => item.id === id);
          if (current) updatedAssetsAfter.set(id, structuredClone(current));
        }
        const createdAuditIds = new Set(db.auditLogs.filter(item => !auditIdsBefore.has(item.id)).map(item => item.id));
        if (!(await persistBeforeSuccess(req, res))) {
          for (const [id, before] of originalAssets) {
            const current = db.assets.find(item => item.id === id);
            const after = updatedAssetsAfter.get(id);
            if (current && after && JSON.stringify(current) === JSON.stringify(after)) {
              for (const key of Object.keys(current)) {
                if (!Object.prototype.hasOwnProperty.call(before, key)) delete (current as any)[key];
              }
              Object.assign(current, before);
            }
          }
          db.assets.splice(0, db.assets.length, ...db.assets.filter(item => !createdAssetIds.has(item.id)));
          db.auditLogs.splice(0, db.auditLogs.length, ...db.auditLogs.filter(item => !createdAuditIds.has(item.id)));
          return;
        }
      }

      res.json({
        success: true,
        data: {
          created,
          updated,
          failed: errors.length,
          errors: errors.slice(0, 50),
          warnings: warnings.slice(0, 50),
          assets: importedAssets,
        },
      });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message });
    }
  });

  app.get('/api/assets/:id', (req, res) => {
    if (!requireRbacPermission(req, res, 'assets.read')) return;
    const actor = getActor(req);
    // Apply the same legacy division/ownership scope as the catalogue endpoint;
    // a direct ID lookup must not bypass list-level visibility.
    const asset = GabahDomainService.getScopedAssets(actor).find(a => a.id === req.params.id);
    if (!asset) return res.status(404).json({ success: false, message: 'Aset tidak ditemukan atau tidak berada dalam cakupan akses Anda.' });
    res.json({ success: true, data: asset });
  });

  app.patch('/api/assets/:id', async (req, res) => {
    if (!requireRbacPermission(req, res, 'assets.update')) return;
    const actor = getActor(req);
    const asset = db.assets.find(a => a.id === req.params.id);
    if (!asset) return res.status(404).json({ success: false, message: 'Aset tidak ditemukan' });

    // Auditor remains strictly read-only. Every other user, including a
    // Karyawan with an explicitly assigned additional capability, is judged
    // by the same permission + owner-scope policy used by domain mutations.
    if (isAuditorActor(actor)) {
      return res.status(403).json({ success: false, message: 'Akses ditolak: Auditor hanya memiliki izin baca (read-only).' });
    }
    if (!canMutateAssetOwner(actor, asset.owner_division, 'assets.update')) {
      return res.status(403).json({
        success: false,
        message: `Akses ditolak: permission assets.update dan scope owner "${asset.owner_division}" wajib dimiliki.`,
      });
    }

    // Check duplicate serial number
    if (req.body.serial_number && typeof req.body.serial_number === 'string' && req.body.serial_number.trim()) {
      const sn = req.body.serial_number.trim();
      const existingSN = db.assets.find(a => a.id !== asset.id && a.serial_number && a.serial_number.trim().toLowerCase() === sn.toLowerCase());
      if (existingSN) {
        return res.status(400).json({ success: false, message: `Nomor Seri (Serial Number) "${sn}" sudah terdaftar pada aset ${existingSN.asset_number} (${existingSN.name}).` });
      }
    }

    // Check duplicate corporate asset number
    if (req.body.corporate_asset_number && typeof req.body.corporate_asset_number === 'string' && req.body.corporate_asset_number.trim()) {
      const corpNo = req.body.corporate_asset_number.trim();
      const existingCorp = db.assets.find(a => a.id !== asset.id && a.corporate_asset_number && a.corporate_asset_number.trim().toLowerCase() === corpNo.toLowerCase());
      if (existingCorp) {
        return res.status(400).json({ success: false, message: `Nomor Aset Accurate/ERP "${corpNo}" sudah terdaftar pada aset ${existingCorp.asset_number} (${existingCorp.name}).` });
      }
    }

    // Validate mutable asset fields before any mutation.
    const validAssetStatuses = ['active', 'assigned', 'available', 'reserved', 'in_repair', 'damaged', 'cannibalized', 'pending_disposal', 'pending_auction', 'auctioned', 'disposed', 'lost', 'inactive', 'in_use', 'loaned', 'maintenance'];
    const validAssetConditions = ['new', 'good', 'fair', 'poor', 'broken', 'excellent', 'damaged'];
    if (req.body.status !== undefined && !validAssetStatuses.includes(String(req.body.status))) {
      return res.status(400).json({ success: false, message: 'Status aset tidak valid.' });
    }
    if (req.body.condition !== undefined && !validAssetConditions.includes(String(req.body.condition))) {
      return res.status(400).json({ success: false, message: 'Kondisi aset tidak valid.' });
    }
    if (req.body.is_loanable !== undefined && typeof req.body.is_loanable !== 'boolean') {
      return res.status(400).json({ success: false, message: 'is_loanable harus berupa boolean.' });
    }
    if (req.body.is_loanable === true && isNonLoanableInfrastructureAsset(asset as any)) {
      return res.status(409).json({ success: false, message: 'Kategori infrastruktur/server dan lisensi tidak boleh dikonfigurasikan sebagai aset pinjaman.' });
    }

    // Asset status is controlled by dedicated lifecycle and loan workflows.
    // Generic PATCH/import must not jump directly to disposed, auctioned, lost,
    // in_repair, or other states without lifecycle authorization and audit rules.
    if (req.body.status !== undefined && String(req.body.status) !== asset.status) {
      return res.status(409).json({
        success: false,
        message: 'Status aset tidak dapat diubah melalui edit umum. Gunakan menu Lifecycle atau alur peminjaman/pengembalian.',
      });
    }

    // Loan workflow owns status and loanability while a reservation is approved
    // or a unit is physically borrowed. Manual edits here could desynchronize
    // the asset and its active loan, so require the loan workflow to finish first.
    const activeLoan = db.loans.find(loan =>
      loan.asset_id === asset.id && ['approved', 'borrowed'].includes(loan.status)
    );
    if (activeLoan) {
      const changesStatus = req.body.status !== undefined && String(req.body.status) !== asset.status;
      const changesLoanability = req.body.is_loanable !== undefined && req.body.is_loanable !== asset.is_loanable;
      if (changesStatus || changesLoanability) {
        return res.status(409).json({
          success: false,
          message: `Status dan konfigurasi pinjam aset dikunci selama pinjaman ${activeLoan.loan_number} berstatus ${activeLoan.status}.`,
        });
      }
    }

    // T2B-1: managing unit operasional (relasi ke org_units.id) — divalidasi
    // terhadap master aktif; nullable untuk kasus ambigu. owner_division &
    // asset_number tetap server-owned (tidak berubah), RBAC tetap owner_division.
    let nextManagingUnitId: string | null | undefined;
    if (req.body.managing_unit_id !== undefined) {
      const uid = req.body.managing_unit_id ? String(req.body.managing_unit_id).trim() : null;
      if (uid && !(db.orgUnits || []).some(x => x.id === uid && x.is_active)) {
        return res.status(400).json({ success: false, message: `Unit "${uid}" tidak terdaftar atau sedang nonaktif.` });
      }
      nextManagingUnitId = uid;
    }

    // T2B-2: lokasi fisik aset (relasi ke asset_locations.id) — divalidasi
    // terhadap master; lokasi nonaktif hanya dipertahankan bila sama dengan
    // nilai yang sudah melekat (data historis), tidak dapat dipilih sebagai
    // perubahan baru. owner_division, managing_unit_id, asset_number, dan
    // teks `location` legacy TIDAK berubah oleh field ini.
    let nextAssetLocationId: string | null | undefined;
    if (req.body.asset_location_id !== undefined) {
      try {
        nextAssetLocationId = validateAssetLocation(req.body.asset_location_id, undefined, asset.asset_location_id);
      } catch (e: any) {
        return res.status(400).json({ success: false, message: e.message });
      }
    }

    // Snapshot before the first mutation. A failed durable write restores both
    // the asset and its audit trail so the rejected PATCH has no memory residue.
    const assetSnapshot = structuredClone(asset);
    const auditSnapshot = structuredClone(db.auditLogs);
    if (nextManagingUnitId !== undefined) asset.managing_unit_id = nextManagingUnitId;
    if (nextAssetLocationId !== undefined) asset.asset_location_id = nextAssetLocationId;

    // Update mutable fields (not asset_number or owner_division)
    const allowed = ['name', 'brand', 'model', 'serial_number', 'specifications', 'location', 'condition', 'notes', 'is_loanable', 'corporate_asset_number'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        (asset as any)[key] = req.body[key];
      }
    }
    asset.updated_at = new Date().toISOString();

    GabahDomainService.recordAudit('ASSET_UPDATED', 'Assets', `Memperbarui informasi aset ${asset.asset_number}`, actor, asset.id, false);
    if (!(await persistBeforeSuccess(req, res))) {
      for (const key of Object.keys(asset)) {
        if (!Object.prototype.hasOwnProperty.call(assetSnapshot, key)) delete (asset as any)[key];
      }
      Object.assign(asset, assetSnapshot);
      db.auditLogs.splice(0, db.auditLogs.length, ...auditSnapshot);
      return;
    }

    res.json({ success: true, data: asset });
  });

  app.post('/api/assets/:id/assign', async (req, res) => {
    if (!requireRbacPermission(req, res, 'assets.assign')) return;
    try {
      const actor = getActor(req);
      const { targetUserId, reason } = req.body;
      const asset = db.assets.find(item => item.id === req.params.id);
      if (!asset) return res.status(404).json({ success: false, message: 'Aset tidak ditemukan.' });
      const assetBefore = structuredClone(asset);
      const movementIdsBefore = new Set(db.movements.map(item => item.id));
      const auditIdsBefore = new Set(db.auditLogs.map(item => item.id));
      const updated = GabahDomainService.assignAsset(req.params.id, targetUserId, reason, actor, false);
      const assetAfter = structuredClone(updated);
      const createdMovementIds = new Set(db.movements.filter(item => !movementIdsBefore.has(item.id)).map(item => item.id));
      const createdAuditIds = new Set(db.auditLogs.filter(item => !auditIdsBefore.has(item.id)).map(item => item.id));
      if (!(await persistBeforeSuccess(req, res))) {
        if (JSON.stringify(asset) === JSON.stringify(assetAfter)) {
          for (const key of Object.keys(asset)) {
            if (!Object.prototype.hasOwnProperty.call(assetBefore, key)) delete (asset as any)[key];
          }
          Object.assign(asset, assetBefore);
        }
        db.movements.splice(0, db.movements.length, ...db.movements.filter(item => !createdMovementIds.has(item.id)));
        db.auditLogs.splice(0, db.auditLogs.length, ...db.auditLogs.filter(item => !createdAuditIds.has(item.id)));
        return;
      }
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/assets/:id/move', async (req, res) => {
    if (!requireRbacPermission(req, res, 'assets.move')) return;
    try {
      const actor = getActor(req);
      const { newLocation, reason } = req.body;
      const asset = db.assets.find(item => item.id === req.params.id);
      if (!asset) return res.status(404).json({ success: false, message: 'Aset tidak ditemukan.' });
      const assetBefore = structuredClone(asset);
      const movementIdsBefore = new Set(db.movements.map(item => item.id));
      const auditIdsBefore = new Set(db.auditLogs.map(item => item.id));
      const updated = GabahDomainService.moveAsset(req.params.id, newLocation, reason, actor, false);
      const assetAfter = structuredClone(updated);
      const createdMovementIds = new Set(db.movements.filter(item => !movementIdsBefore.has(item.id)).map(item => item.id));
      const createdAuditIds = new Set(db.auditLogs.filter(item => !auditIdsBefore.has(item.id)).map(item => item.id));
      if (!(await persistBeforeSuccess(req, res))) {
        if (JSON.stringify(asset) === JSON.stringify(assetAfter)) {
          for (const key of Object.keys(asset)) {
            if (!Object.prototype.hasOwnProperty.call(assetBefore, key)) delete (asset as any)[key];
          }
          Object.assign(asset, assetBefore);
        }
        db.movements.splice(0, db.movements.length, ...db.movements.filter(item => !createdMovementIds.has(item.id)));
        db.auditLogs.splice(0, db.auditLogs.length, ...db.auditLogs.filter(item => !createdAuditIds.has(item.id)));
        return;
      }
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/assets/:id/lifecycle', async (req, res) => {
    if (!requireRbacPermission(req, res, 'assets.lifecycle')) return;
    try {
      const actor = getActor(req);
      const { action, notes } = req.body;
      const asset = db.assets.find(item => item.id === req.params.id);
      if (!asset) return res.status(404).json({ success: false, message: 'Aset tidak ditemukan.' });
      const assetBefore = structuredClone(asset);
      const auditIdsBefore = new Set(db.auditLogs.map(item => item.id));
      const updated = GabahDomainService.mutateLifecycle(req.params.id, action, notes, actor, false);
      const assetAfter = structuredClone(updated);
      const createdAuditIds = new Set(db.auditLogs.filter(item => !auditIdsBefore.has(item.id)).map(item => item.id));
      if (!(await persistBeforeSuccess(req, res))) {
        if (JSON.stringify(asset) === JSON.stringify(assetAfter)) {
          for (const key of Object.keys(asset)) {
            if (!Object.prototype.hasOwnProperty.call(assetBefore, key)) delete (asset as any)[key];
          }
          Object.assign(asset, assetBefore);
        }
        db.auditLogs.splice(0, db.auditLogs.length, ...db.auditLogs.filter(item => !createdAuditIds.has(item.id)));
        return;
      }
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message });
    }
  });

  // Movements
  app.get('/api/movements', (req, res) => {
    if (!requireRbacPermission(req, res, 'movements.read')) return;
    const actor = getActor(req);
    // getScopedAssets() already combines the employee's personal baseline
    // with every explicit dynamic role scope. Do not re-filter by legacy
    // primary-role labels here: that would hide scoped assets from employees
    // who hold additional operational roles.
    const employeeBaselineRoles = ['Karyawan', 'Sekretaris Direksi', 'Humas', 'Supply Chain', 'PIBC'];
    const isEmployeeBaseline = employeeBaselineRoles.includes(actor.role)
      && !hasApplicationRole(actor, 'it') && !hasApplicationRole(actor, 'ga');
    const scopedAssets = GabahDomainService.getScopedAssets(actor);
    // Employee baseline may see unassigned loanable assets in the asset catalogue
    // to request a loan, but that catalogue visibility must not expose their
    // movement history. Keep personally assigned assets and independently
    // granted dynamic owner/unit/location scopes only.
    const movementAssets = isEmployeeBaseline
      ? scopedAssets.filter(asset =>
          asset.assigned_to?.id === actor.id || assetVisibleUnderDynamicScopes(actor, asset)
        )
      : scopedAssets;
    const visibleAssetIds = new Set(movementAssets.map(asset => asset.id));
    const { assetId } = req.query;
    if (assetId) {
      if (!visibleAssetIds.has(String(assetId)) && !isSuperadminActor(actor) && !isAuditorActor(actor)) {
        return res.status(404).json({ success: false, message: 'Aset tidak ditemukan.' });
      }
      const filtered = db.movements.filter(m => m.asset_id === assetId);
      return res.json({ success: true, data: filtered });
    }
    const filtered = isSuperadminActor(actor) || isAuditorActor(actor)
      ? db.movements
      : db.movements.filter(m => visibleAssetIds.has(m.asset_id));
    res.json({ success: true, data: filtered });
  });

  // Loans
  app.get('/api/loans', (req, res) => {
    if (!requireRbacPermission(req, res, 'loans.read')) return;
    const actor = getActor(req);
    const visibleLoans = (isSuperadminActor(actor) || isAuditorActor(actor))
      ? db.loans
      : db.loans.filter(loan =>
          loan.borrower_id === actor.id
          || (isPostgresPersistenceActive()
            ? hasRbacScope(String(actor.id), 'division', loan.owner_division, 'loans')
            : hasApplicationRole(actor, String(loan.owner_division || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')))
        );

    // Return server-authoritative action capabilities with each visible loan.
    // The UI must not infer owner custody from a role label or borrower visibility.
    const data = visibleLoans.map(loan => ({
      ...loan,
      allowed_actions: {
        approve: loan.status === 'pending_approval'
          && GabahDomainService.canOperateLoan(loan, actor, 'loans.approve'),
        reject: loan.status === 'pending_approval'
          && GabahDomainService.canOperateLoan(loan, actor, 'loans.reject'),
        handover: loan.status === 'approved'
          && GabahDomainService.canOperateLoan(loan, actor, 'loans.handover'),
        return: loan.status === 'borrowed'
          && !isAuditorActor(actor)
          && (loan.borrower_id === actor.id
            || GabahDomainService.canOperateLoan(loan, actor, 'loans.return')),
      },
    }));
    return res.json({ success: true, data });
  });

  app.post('/api/loans', async (req, res) => {
    try {
      
    if (!requireRbacPermission(req, res, 'loans.create')) return;
    const actor = getActor(req);
      const { asset_ids, asset_id } = req.body;

      if (Array.isArray(asset_ids) && asset_ids.length > 0) {
        const normalizedAssetIds = asset_ids.map((id: unknown) => String(id ?? '').trim());
        if (normalizedAssetIds.some((id: string) => !id)
          || new Set(normalizedAssetIds).size !== normalizedAssetIds.length) {
          return res.status(400).json({ success: false, message: 'Daftar aset pinjaman mengandung ID kosong atau duplikat.' });
        }

        // Bulk requests are one business operation: roll back every in-memory
        // side effect if any item or persistence step fails.
        const snapshots = {
          loans: [...db.loans],
          notifications: [...db.notifications],
          auditLogs: [...db.auditLogs],
        };
        try {
          const createdLoans = [];
          for (const id of normalizedAssetIds) {
            const newLoan = GabahDomainService.requestLoan({ ...req.body, asset_id: id }, actor);
            createdLoans.push(newLoan);
          }
          await persistDataStore();
      (req as any).__gabahPersisted = true;
          return res.status(201).json({
            success: true,
            data: createdLoans[0],
            loans: createdLoans,
            count: createdLoans.length,
            message: `${createdLoans.length} aset pinjaman berhasil diajukan.`
          });
        } catch (bulkError) {
          db.loans.splice(0, db.loans.length, ...snapshots.loans);
          db.notifications.splice(0, db.notifications.length, ...snapshots.notifications);
          db.auditLogs.splice(0, db.auditLogs.length, ...snapshots.auditLogs);
          throw bulkError;
        }
      }

      const newLoan = await GabahDomainService.persistLoanMutation(() => GabahDomainService.requestLoan(req.body, actor));
      (req as any).__gabahPersisted = true;
      res.status(201).json({ success: true, data: newLoan });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/loans/:id/approve', async (req, res) => {
    try {
      
    if (!requireRbacPermission(req, res, 'loans.approve')) return;
    const actor = getActor(req);
      const approved = await GabahDomainService.persistLoanMutation(() => GabahDomainService.approveLoan(req.params.id, actor));
      (req as any).__gabahPersisted = true;
      res.json({ success: true, data: approved });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/loans/:id/reject', async (req, res) => {
    try {
      
    if (!requireRbacPermission(req, res, 'loans.reject')) return;
    const actor = getActor(req);
      const rejected = await GabahDomainService.persistLoanMutation(() => GabahDomainService.rejectLoan(req.params.id, req.body?.reason, actor));
      (req as any).__gabahPersisted = true;
      res.json({ success: true, data: rejected });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/loans/:id/handover', async (req, res) => {
    try {
      if (!requireRbacPermission(req, res, 'loans.handover')) return;
      const actor = getActor(req);
      let bastNotificationEnabled = true;
      if (isPostgresPersistenceActive()) {
        try {
          const setting = await queryRbac<{ is_active: boolean }>(
            "SELECT is_active FROM gabah_notification_rule_settings WHERE rule_id = 'rule-bast'",
          );
          if (setting.rows.length !== 1) {
            return res.status(503).json({ success: false, code: 'NOTIFICATION_RULE_SETTINGS_UNAVAILABLE', message: 'Konfigurasi notifikasi BAST belum dapat diverifikasi.' });
          }
          bastNotificationEnabled = setting.rows[0].is_active === true;
        } catch (error: any) {
          console.error('[GABAH API] BAST notification rule unavailable:', error?.message || error);
          return res.status(503).json({ success: false, code: 'NOTIFICATION_RULE_SETTINGS_UNAVAILABLE', message: 'Konfigurasi notifikasi BAST tidak dapat diverifikasi.' });
        }
      }
      const { handoverNotes } = req.body;
      const handedOver = await GabahDomainService.persistLoanMutation(() => {
        const result = GabahDomainService.handoverLoan(req.params.id, handoverNotes, actor);
        if (bastNotificationEnabled) {
          const createdAt = new Date().toISOString();
          const notification = {
            title: `BAST Selesai: ${result.loan_number}`,
            message: `Serah terima fisik ${result.asset_name} kepada ${result.borrower_name} telah dicatat oleh ${actor.name}.`,
            severity: 'success' as const,
            category: 'loan' as const,
            link_type: 'loan' as const,
            link_id: result.id,
            is_read: false,
            created_at: createdAt,
          };
          db.notifications.unshift(
            { ...notification, id: `NOTIF-${crypto.randomUUID()}`, recipient_user_id: result.borrower_id },
            { ...notification, id: `NOTIF-${crypto.randomUUID()}`, recipient_division: result.owner_division },
          );
        }
        return result;
      });
      (req as any).__gabahPersisted = true;
      res.json({ success: true, data: handedOver });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/loans/:id/return', async (req, res) => {
    try {
      const actor = getActor(req);
      if (isAuditorActor(actor)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak: Auditor hanya memiliki izin baca (read-only).' });
      }
      const requestedLoan = db.loans.find(loan => loan.id === req.params.id);
      if (!requestedLoan) return res.status(404).json({ success: false, message: 'Data pinjaman tidak ditemukan.' });
      // Borrowers may return their own borrowed asset without a custodian
      // permission. Other borrowers' loans remain permission+scope controlled.
      const isBorrowerReturningOwnLoan = requestedLoan.borrower_id === actor.id;
      if (!isBorrowerReturningOwnLoan && !requireRbacPermission(req, res, 'loans.return')) return;
      const { condition, returnNotes } = req.body;
      const returned = await GabahDomainService.persistLoanMutation(() => GabahDomainService.returnLoan(req.params.id, condition, returnNotes, actor));
      (req as any).__gabahPersisted = true;
      res.json({ success: true, data: returned });
    } catch (err: any) {
      // SECURITY: 403 (authorization) / 409 (invalid state transition) are
      // enforced by the domain service and surfaced verbatim to the client.
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message });
    }
  });

  // Helpdesk Tickets
  app.get('/api/tickets', (req, res) => {
    if (!requireRbacPermission(req, res, 'tickets.read')) return;
    const actor = getActor(req);
    const isReporter = (ticket: any) => ticket.reporter_id === actor.id;
    const canReadTicketOwner = (owner: string) =>
      isPostgresPersistenceActive()
        ? hasRbacScope(String(actor.id), 'division', owner, 'tickets')
        : hasApplicationRole(actor, owner.toLowerCase());
    const canReadTicketUnit = (unitId?: string) =>
      Boolean(unitId && isPostgresPersistenceActive()
        && hasRbacScope(String(actor.id), 'unit', unitId, 'tickets'));
    const withAllowedActions = (ticket: any) => {
      const hasTicketUpdatePermission = !isPostgresPersistenceActive()
        || hasRbacPermission(String(actor.id), 'tickets.update');
      const isOperationalHandler = hasTicketUpdatePermission && (
        isSuperadminActor(actor)
        || ticket.assigned_agent_id === actor.id
        || canReadTicketOwner(String(ticket.category))
        || canReadTicketUnit(ticket.assigned_unit_id)
      );
      const isReporterOfTicket = isReporter(ticket);
      const canMutate = !isAuditorActor(actor);
      return {
        ...ticket,
        allowed_actions: {
          start: canMutate && isOperationalHandler && ['open', 'assigned', 'pending_vendor'].includes(String(ticket.status)),
          wait_vendor: canMutate && isOperationalHandler && ticket.status === 'in_progress',
          resolve: canMutate && isOperationalHandler && ticket.status === 'in_progress',
          close: canMutate && (isOperationalHandler || isReporterOfTicket) && ticket.status === 'resolved',
          reopen: canMutate && (isOperationalHandler || isReporterOfTicket) && ticket.status === 'closed',
        },
      };
    };

    if (isSuperadminActor(actor) || isAuditorActor(actor)) {
      return res.json({ success: true, data: db.tickets.map(withAllowedActions) });
    }
    const data = db.tickets.filter(ticket =>
      isReporter(ticket)
      || ticket.assigned_agent_id === actor.id
      || canReadTicketOwner(String(ticket.category))
      || canReadTicketUnit(ticket.assigned_unit_id)
    ).map(withAllowedActions);
    return res.json({ success: true, data });
  });

  // Manual assignment is permission + object-scope driven. Job titles and
  // display labels never qualify an operator for a ticket queue.
  const canManageTicketAssignment = (ticket: any, actor: ServerUser): boolean => {
    if (isAuditorActor(actor)) return false;
    if (isSuperadminActor(actor)) return true;
    if (isPostgresPersistenceActive()) {
      return hasRbacPermission(String(actor.id), 'tickets.assign')
        && (hasRbacScope(String(actor.id), 'division', String(ticket.category), 'tickets')
          || Boolean(ticket.assigned_unit_id && hasRbacScope(String(actor.id), 'unit', String(ticket.assigned_unit_id), 'tickets')));
    }
    return actor.role === ticket.category || hasApplicationRole(actor, String(ticket.category || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'));
  };

  const getEligibleTicketAssignees = (ticket: any): ServerUser[] => db.users.filter(user => {
    if (user.is_active === false || isAuditorActor(user) || isSuperadminActor(user)) return false;
    if (!isPostgresPersistenceActive()) return user.role === ticket.category || hasApplicationRole(user, String(ticket.category || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'));
    if (!hasRbacPermission(String(user.id), 'tickets.update')) return false;
    if (ticket.assigned_unit_id) {
      return hasRbacScope(String(user.id), 'unit', String(ticket.assigned_unit_id), 'tickets');
    }
    return hasRbacScope(String(user.id), 'division', String(ticket.category), 'tickets');
  });

  app.get('/api/tickets/:id/assignees', (req, res) => {
    if (!requireRbacPermission(req, res, 'tickets.assign')) return;
    const actor = getActor(req);
    const ticket = db.tickets.find(item => item.id === req.params.id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Tiket tidak ditemukan.' });
    if (!canManageTicketAssignment(ticket, actor)) {
      return res.status(403).json({ success: false, message: 'Akses ditolak: Anda tidak memiliki kewenangan penugasan pada tiket ini.' });
    }
    const data = getEligibleTicketAssignees(ticket).map(user => ({
      id: user.id,
      name: user.name,
      department: user.department,
    }));
    return res.json({ success: true, data });
  });

  app.patch('/api/tickets/:id/assignment', async (req, res) => {
    try {
      if (!requireRbacPermission(req, res, 'tickets.assign')) return;
      const actor = getActor(req);
      if (isAuditorActor(actor)) {
        return res.status(403).json({ success: false, message: 'Auditor hanya memiliki akses baca.' });
      }
      const ticket = db.tickets.find(item => item.id === req.params.id);
      if (!ticket) return res.status(404).json({ success: false, message: 'Tiket tidak ditemukan.' });
      if (!canManageTicketAssignment(ticket, actor)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak: tiket di luar cakupan penugasan Anda.' });
      }
      if (!['open', 'assigned'].includes(String(ticket.status))) {
        return res.status(409).json({ success: false, message: 'Penugasan hanya dapat diubah sebelum pekerjaan dimulai.' });
      }
      const ticketBefore = structuredClone(ticket);
      const notificationIdsBefore = new Set(db.notifications.map(item => item.id));
      const auditIdsBefore = new Set(db.auditLogs.map(item => item.id));
      const previousAssignedAgentId = ticket.assigned_agent_id;
      const assigneeId = req.body?.assigned_agent_id;
      if (assigneeId !== null && (typeof assigneeId !== 'string' || !assigneeId.trim())) {
        return res.status(400).json({ success: false, message: 'ID petugas tidak valid.' });
      }
      if (assigneeId === null) {
        ticket.assigned_agent_id = undefined;
        ticket.assigned_agent_name = undefined;
        ticket.status = 'open';
      } else {
        const eligible = getEligibleTicketAssignees(ticket);
        const assignee = eligible.find(user => user.id === assigneeId.trim());
        if (!assignee) {
          return res.status(400).json({ success: false, message: 'Petugas tidak aktif atau tidak memiliki permission dan cakupan antrean tiket ini.' });
        }
        ticket.assigned_agent_id = assignee.id;
        ticket.assigned_agent_name = assignee.name;
        ticket.status = 'assigned';
      }
      ticket.updated_at = new Date().toISOString();
      GabahDomainService.recordAudit(
        'TICKET_ASSIGNMENT_UPDATED',
        'Tickets',
        ticket.assigned_agent_id
          ? `Menugaskan tiket ${ticket.ticket_number} kepada ${ticket.assigned_agent_name}.`
          : `Melepas penugasan tiket ${ticket.ticket_number}.`,
        actor,
        ticket.id,
        false,
      );
      if (ticket.assigned_agent_id && ticket.assigned_agent_id !== previousAssignedAgentId) {
        GabahDomainService.notify({
          recipient_user_id: ticket.assigned_agent_id,
          title: `Tiket Ditugaskan: ${ticket.ticket_number}`,
          message: `Anda ditugaskan menangani tiket "${ticket.title}" dengan prioritas ${String(ticket.priority).toUpperCase()}.`,
          severity: ticket.priority === 'urgent' ? 'critical' : ticket.priority === 'high' ? 'action_required' : 'info',
          category: 'sla',
          link_type: 'ticket',
          link_id: ticket.id,
        });
      }
      const ticketAfter = structuredClone(ticket);
      const createdNotificationIds = new Set(db.notifications.filter(item => !notificationIdsBefore.has(item.id)).map(item => item.id));
      const createdAuditIds = new Set(db.auditLogs.filter(item => !auditIdsBefore.has(item.id)).map(item => item.id));
      if (!(await persistBeforeSuccess(req, res))) {
        if (JSON.stringify(ticket) === JSON.stringify(ticketAfter)) {
          for (const key of Object.keys(ticket)) {
            if (!Object.prototype.hasOwnProperty.call(ticketBefore, key)) delete (ticket as any)[key];
          }
          Object.assign(ticket, ticketBefore);
        }
        db.notifications.splice(0, db.notifications.length, ...db.notifications.filter(item => !createdNotificationIds.has(item.id)));
        db.auditLogs.splice(0, db.auditLogs.length, ...db.auditLogs.filter(item => !createdAuditIds.has(item.id)));
        return;
      }
      return res.json({ success: true, data: ticket });
    } catch (error: any) {
      return res.status(typeof error?.statusCode === 'number' ? error.statusCode : 400)
        .json({ success: false, message: error?.message || 'Penugasan tiket gagal diperbarui.' });
    }
  });

  // Ticket discussion is stored in the normalized PostgreSQL ticket_comments table.
  // Access follows the same per-ticket reporter / assignee / owner-division / unit boundary
  // as the ticket queue. No client-supplied user identity is trusted.
  const canAccessTicketRecord = (ticket: any, actor: ServerUser): boolean => {
    if (isSuperadminActor(actor) || isAuditorActor(actor)) return true;
    if (ticket.reporter_id === actor.id || ticket.assigned_agent_id === actor.id) return true;
    if (isPostgresPersistenceActive()) {
      return hasRbacScope(String(actor.id), 'division', String(ticket.category), 'tickets')
        || Boolean(ticket.assigned_unit_id && hasRbacScope(String(actor.id), 'unit', String(ticket.assigned_unit_id), 'tickets'));
    }
    return actor.role === ticket.category || hasApplicationRole(actor, String(ticket.category || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'));
  };

  app.get('/api/tickets/:id/comments', async (req, res) => {
    if (!requireRbacPermission(req, res, 'tickets.read')) return;
    try {
      const actor = getActor(req);
      const ticket = db.tickets.find(item => item.id === req.params.id);
      if (!ticket) return res.status(404).json({ success: false, message: 'Tiket tidak ditemukan.' });
      if (!canAccessTicketRecord(ticket, actor)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak: tiket di luar cakupan Anda.' });
      }
      if (!isPostgresPersistenceActive()) {
        return res.status(503).json({ success: false, code: 'TICKET_COMMENTS_REQUIRE_POSTGRES', message: 'Diskusi tiket memerlukan penyimpanan PostgreSQL aktif.' });
      }
      const result = await queryRbac(
        `SELECT c.id, c.ticket_id, c.user_id, u.name AS user_name, c.body, c.created_at
         FROM ticket_comments c
         INNER JOIN users u ON u.id = c.user_id
         WHERE c.ticket_id = $1
         ORDER BY c.created_at ASC, c.id ASC`,
        [ticket.id],
      );
      return res.json({ success: true, data: result.rows });
    } catch (error: any) {
      return res.status(503).json({ success: false, code: 'TICKET_COMMENTS_UNAVAILABLE', message: 'Komentar tiket belum dapat dibaca.' });
    }
  });

  app.post('/api/tickets/:id/comments', async (req, res) => {
    if (!requireRbacPermission(req, res, 'tickets.read')) return;
    try {
      const actor = getActor(req);
      if (isAuditorActor(actor)) {
        return res.status(403).json({ success: false, message: 'Auditor hanya memiliki akses baca.' });
      }
      const ticket = db.tickets.find(item => item.id === req.params.id);
      if (!ticket) return res.status(404).json({ success: false, message: 'Tiket tidak ditemukan.' });
      if (!canAccessTicketRecord(ticket, actor)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak: tiket di luar cakupan Anda.' });
      }
      const isReporter = ticket.reporter_id === actor.id;
      const hasUpdate = !isPostgresPersistenceActive() || hasRbacPermission(String(actor.id), 'tickets.update');
      const canCommentAsHandler = hasUpdate && (
        isSuperadminActor(actor)
        || ticket.assigned_agent_id === actor.id
        || (isPostgresPersistenceActive()
          && (hasRbacScope(String(actor.id), 'division', String(ticket.category), 'tickets')
            || Boolean(ticket.assigned_unit_id && hasRbacScope(String(actor.id), 'unit', String(ticket.assigned_unit_id), 'tickets'))))
        || (!isPostgresPersistenceActive() && (actor.role === ticket.category || hasApplicationRole(actor, String(ticket.category || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'))))
      );
      if (!isReporter && !canCommentAsHandler) {
        return res.status(403).json({ success: false, message: 'Hanya pelapor atau petugas berwenang yang dapat menambahkan komentar.' });
      }
      const body = req.body?.body;
      if (typeof body !== 'string' || !body.trim() || body.trim().length > 4000) {
        return res.status(400).json({ success: false, message: 'Komentar wajib diisi dan maksimal 4.000 karakter.' });
      }
      if (!isPostgresPersistenceActive()) {
        return res.status(503).json({ success: false, code: 'TICKET_COMMENTS_REQUIRE_POSTGRES', message: 'Diskusi tiket memerlukan penyimpanan PostgreSQL aktif.' });
      }
      const saved = await withRbacTransaction(async client => {
        const result = await client.query(
          `INSERT INTO ticket_comments (ticket_id, user_id, body)
           VALUES ($1, $2, $3)
           RETURNING id, ticket_id, user_id, body, created_at`,
          [ticket.id, actor.id, body.trim()],
        );
        return result.rows[0];
      });
      // The comment transaction is already committed; prevent the global JSON persistence gate from writing a second, unrelated snapshot.
      (req as any).__gabahPersisted = true;
      return res.status(201).json({ success: true, data: { ...saved, user_name: actor.name } });
    } catch (error: any) {
      return res.status(503).json({ success: false, code: 'TICKET_COMMENT_SAVE_FAILED', message: 'Komentar belum dapat disimpan.' });
    }
  });

  app.post('/api/tickets', async (req, res) => {
    try {
      const requestedCategory = String(req.body?.category || '').trim().toUpperCase();
      const createPermission = requestedCategory === 'ME' ? 'tickets.create.me' : 'tickets.create';
      if (!requireRbacPermission(req, res, createPermission)) return;
      const actor = getActor(req);
      const notificationIdsBefore = new Set(db.notifications.map(item => item.id));
      const auditIdsBefore = new Set(db.auditLogs.map(item => item.id));
      const newTicket = GabahDomainService.createTicket(req.body, actor, false);
      const createdNotificationIds = new Set(db.notifications.filter(item => !notificationIdsBefore.has(item.id)).map(item => item.id));
      const createdAuditIds = new Set(db.auditLogs.filter(item => !auditIdsBefore.has(item.id)).map(item => item.id));
      if (!(await persistBeforeSuccess(req, res))) {
        db.tickets.splice(0, db.tickets.length, ...db.tickets.filter(item => item.id !== newTicket.id));
        db.notifications.splice(0, db.notifications.length, ...db.notifications.filter(item => !createdNotificationIds.has(item.id)));
        db.auditLogs.splice(0, db.auditLogs.length, ...db.auditLogs.filter(item => !createdAuditIds.has(item.id)));
        return;
      }
      res.status(201).json({ success: true, data: newTicket });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message });
    }
  });

  // SECURITY (CR-06): authoritative ticket status state machine.
  // open → in_progress → resolved → closed; open/reopened work may be
  // assigned. Arbitrary status strings and skipped transitions are rejected.
  const TICKET_TRANSITIONS: Record<string, string[]> = {
    // Work must enter the active queue before an operator can resolve it;
    // closing is reserved for an already-resolved ticket (reporter or handler).
    open: ['in_progress'],
    assigned: ['in_progress'],
    in_progress: ['pending_vendor', 'resolved', 'open'],
    pending_vendor: ['in_progress'],
    resolved: ['closed', 'open'],
    closed: ['open'],
  };

  app.patch('/api/tickets/:id/status', async (req, res) => {
    try {
      
    if (!requireRbacPermission(req, res, 'tickets.read')) return;
    const actor = getActor(req);
      if (isAuditorActor(actor)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak: Auditor hanya memiliki izin baca (read-only).' });
      }
      const ticket = db.tickets.find(t => t.id === req.params.id);
      if (!ticket) return res.status(404).json({ success: false, message: 'Tiket tidak ditemukan' });

      // A broad tickets.update permission is not sufficient to mutate every
      // ticket. Match the same object-level boundary used by the ticket list.
      const isReporter = ticket.reporter_id === actor.id;
      const canReadTicketOwner = isPostgresPersistenceActive()
        ? hasRbacScope(String(actor.id), 'division', String(ticket.category), 'tickets')
        : (actor.role === ticket.category || hasApplicationRole(actor, String(ticket.category || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')));
      const canReadTicketUnit = Boolean(ticket.assigned_unit_id && isPostgresPersistenceActive()
        && hasRbacScope(String(actor.id), 'unit', ticket.assigned_unit_id, 'tickets'));
      const hasTicketUpdatePermission = !isPostgresPersistenceActive()
        || hasRbacPermission(String(actor.id), 'tickets.update');
      const isOperationalTicketHandler = hasTicketUpdatePermission && (
        isSuperadminActor(actor)
        || ticket.assigned_agent_id === actor.id
        || canReadTicketOwner
        || canReadTicketUnit
      );
      const canUpdateTicket = isOperationalTicketHandler || isReporter;
      if (!canUpdateTicket) {
        return res.status(403).json({
          success: false,
          message: 'Akses ditolak: tiket ini bukan milik Anda dan tidak termasuk cakupan penugasan/divisi Anda.',
        });
      }

      const { status, resolutionNotes } = req.body || {};
      if (resolutionNotes !== undefined
        && (typeof resolutionNotes !== 'string' || resolutionNotes.length > 4000)) {
        return res.status(400).json({
          success: false,
          message: 'Catatan penyelesaian harus berupa teks maksimal 4000 karakter.',
        });
      }
      const currentStatus = String(ticket.status);
      const nextStatus = String(status || '');

      if (!nextStatus) {
        return res.status(400).json({ success: false, message: 'Status tujuan wajib diisi.' });
      }
      const allowed = TICKET_TRANSITIONS[currentStatus] || [];
      if (!isOperationalTicketHandler) {
        // Pelapor boleh mengonfirmasi penyelesaian atau membuka kembali tiket
        // yang sudah ditutup, tetapi tidak boleh mengubah tiket menjadi selesai
        // atau mengelola progres operasional petugas.
        const reporterTransitions: Record<string, string[]> = {
          resolved: ['closed'],
          closed: ['open'],
        };
        const reporterAllowed = reporterTransitions[currentStatus] || [];
        if (!reporterAllowed.includes(nextStatus)) {
          return res.status(403).json({
            success: false,
            message: 'Pelapor hanya dapat menutup tiket yang sudah selesai atau membuka kembali tiket yang telah ditutup.',
          });
        }
      }

      if (!allowed.includes(nextStatus)) {
        return res.status(400).json({
          success: false,
          message: `Transisi status tiket tidak valid: '${currentStatus}' → '${nextStatus}'. Transisi diizinkan: ${allowed.join(', ') || '(tidak ada)'}.`,
        });
      }

      // Snapshot after authorization and transition validation, before mutation.
      const ticketBefore = structuredClone(ticket);
      const auditIdsBefore = new Set(db.auditLogs.map(item => item.id));
      // Object-level authorization already enforced by middleware for scoped
      // roles; Admin GABAH handles everything.
      ticket.status = nextStatus as any;
      if (resolutionNotes !== undefined) ticket.resolution_notes = resolutionNotes.trim();
      if (nextStatus === 'resolved' || nextStatus === 'closed') {
        ticket.resolved_at = new Date().toISOString();
      } else {
        // Preserve a completion timestamp for both terminal work states;
        // clear it only when the ticket is reopened or returned to progress.
        ticket.resolved_at = undefined as any;
      }
      ticket.updated_at = new Date().toISOString();

      GabahDomainService.recordAudit('TICKET_STATUS_UPDATED', 'Tickets', `Mengubah status tiket ${ticket.ticket_number} dari ${currentStatus} menjadi ${nextStatus}`, actor, ticket.id, false);
      const ticketAfter = structuredClone(ticket);
      const createdAuditIds = new Set(db.auditLogs.filter(item => !auditIdsBefore.has(item.id)).map(item => item.id));
      if (!(await persistBeforeSuccess(req, res))) {
        if (JSON.stringify(ticket) === JSON.stringify(ticketAfter)) {
          for (const key of Object.keys(ticket)) {
            if (!Object.prototype.hasOwnProperty.call(ticketBefore, key)) delete (ticket as any)[key];
          }
          Object.assign(ticket, ticketBefore);
        }
        db.auditLogs.splice(0, db.auditLogs.length, ...db.auditLogs.filter(item => !createdAuditIds.has(item.id)));
        return;
      }

      res.json({ success: true, data: ticket });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  const validateMaintenanceInput = (body: any): string | null => {
    const frequencies = ['weekly', 'monthly', 'quarterly', 'biannual', 'annual', 'one_time'];
    const statuses = ['scheduled', 'in_progress', 'completed', 'overdue', 'cancelled'];
    if (body.frequency !== undefined && !frequencies.includes(body.frequency)) return 'Frekuensi maintenance tidak valid.';
    if (body.status !== undefined && !statuses.includes(body.status)) return 'Status maintenance tidak valid.';
    if (body.scheduled_date !== undefined) {
      const date = body.scheduled_date;
      if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Tanggal maintenance harus berupa tanggal kalender valid (YYYY-MM-DD).';
      const parsedDate = new Date(`${date}T00:00:00.000Z`);
      if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) return 'Tanggal maintenance harus berupa tanggal kalender valid (YYYY-MM-DD).';
    }
    for (const field of ['estimated_cost', 'actual_cost']) {
      if (body[field] !== undefined && (typeof body[field] !== 'number' || !Number.isFinite(body[field]) || body[field] < 0)) return 'Biaya maintenance harus berupa angka non-negatif.';
    }
    for (const [field, max] of [['title', 180], ['technician_name', 180], ['notes', 4000]] as const) {
      if (body[field] !== undefined && (typeof body[field] !== 'string' || body[field].includes('\u0000') || Array.from(body[field]).length > max)) return `Field ${field} harus berupa teks maksimal ${max} karakter.`;
    }
    if (body.checklist !== undefined && (!Array.isArray(body.checklist) || body.checklist.length > 100 || body.checklist.some((item: unknown) => typeof item !== 'string' || item.includes('\u0000') || Array.from(item).length > 300))) return 'Checklist harus berupa daftar teks (maksimal 100 item, 300 karakter per item).';
    return null;
  };

  // Maintenance & Calibration Schedules
  app.get('/api/maintenances', (req, res) => {
    const actor = getActor(req);
    if (!requireRbacPermission(req, res, 'maintenances.read')) return;
    if (isSuperadminActor(actor) || isAuditorActor(actor)) {
      return res.json({ success: true, data: db.maintenances });
    }

    // PostgreSQL: dynamic owner/unit/location scopes are authoritative for
    // maintenance records. Do not re-filter by the user's primary role: an
    // employee may hold additional operational scopes without changing identity.
    // The GA read-only IT-workstation exception is intentionally excluded here:
    // it grants inventory visibility, not access to IT maintenance records.
    if (isPostgresPersistenceActive()) {
      const dynamicallyScopedScheduleIds = new Set(
        filterMaintenanceSchedulesByDynamicScopes(db.maintenances, actor).map(schedule => schedule.id)
      );
      const employeeBaselineRoles = ['Karyawan', 'Sekretaris Direksi', 'Humas', 'Supply Chain', 'PIBC'];
      const personalAssetIds = new Set(employeeBaselineRoles.includes(actor.role)
        ? db.assets.filter(asset => asset.assigned_to?.id === actor.id).map(asset => asset.id)
        : []);
      const filtered = db.maintenances.filter(schedule =>
        dynamicallyScopedScheduleIds.has(schedule.id) || personalAssetIds.has(schedule.asset_id)
      );
      return res.json({ success: true, data: filtered });
    }

    // File-store compatibility must honor the secondary operational roles
    // carried by canonical Karyawan profiles. IT and GA maintenance queues are
    // restricted to their owner domains; ordinary employees see assigned assets only.
    const canReadItMaintenance = hasApplicationRole(actor, 'it');
    const canReadGaMaintenance = hasApplicationRole(actor, 'ga');
    const hasOperationalMaintenanceRole = canReadItMaintenance || canReadGaMaintenance;
    const employeeBaseline = !hasOperationalMaintenanceRole
      && ['Karyawan', 'Sekretaris Direksi', 'Humas', 'Supply Chain', 'PIBC'].includes(actor.role);
    const visibleAssetIds = new Set(GabahDomainService.getScopedAssets(actor)
      .filter(asset => {
        const owner = String(asset.owner_division || '').trim().toUpperCase();
        if (canReadItMaintenance && owner === 'IT') return true;
        if (canReadGaMaintenance && owner === 'GA') return true;
        return employeeBaseline && asset.assigned_to?.id === actor.id;
      })
      .map(asset => asset.id));
    const filtered = db.maintenances.filter(item => visibleAssetIds.has(item.asset_id));
    return res.json({ success: true, data: filtered });
  });

  // Resolve vendor references from the authoritative master only after the
  // caller has passed permission and asset-owner scope checks. Client-supplied
  // names are never persisted as authoritative vendor identities.
  const resolveMaintenanceVendor = (vendorIdInput: unknown, vendorNameInput: unknown) => {
    const validInput = (value: unknown) => value === undefined || value === null || typeof value === 'string';
    if (!validInput(vendorIdInput) || !validInput(vendorNameInput)) {
      return { valid: false as const, vendor: undefined, clear: false };
    }
    const requestedVendorId = typeof vendorIdInput === 'string' ? vendorIdInput.trim() : '';
    const requestedVendorName = typeof vendorNameInput === 'string' ? vendorNameInput.trim() : '';
    if (!requestedVendorId && !requestedVendorName) {
      return { valid: true as const, vendor: undefined, clear: true };
    }
    const normalizedName = requestedVendorName.toLocaleLowerCase('id-ID');
    const vendor = requestedVendorId
      ? db.vendors.find(v => v.id === requestedVendorId)
      : db.vendors.find(v => String(v.name || '').trim().toLocaleLowerCase('id-ID') === normalizedName);
    if (!vendor || (requestedVendorName
      && String(vendor.name || '').trim().toLocaleLowerCase('id-ID') !== normalizedName)) {
      return { valid: false as const, vendor: undefined, clear: false };
    }
    return { valid: true as const, vendor, clear: false };
  };

  app.post('/api/maintenances', async (req, res) => {
    const actor = getActor(req);
    // RBAC: mode file-store mempertahankan allowlist legacy (Admin GABAH / IT /
    // GA) secara eksplisit; mode PostgreSQL beralih ke permission dinamis
    // `maintenances.create` (Stage 13F, seed 020 mirror daftar yang sama).
    if (isPostgresPersistenceActive()) {
      if (!requireRbacPermission(req, res, 'maintenances.create')) return;
    } else if (!isSuperadminActor(actor) && !hasApplicationRole(actor, 'it') && !hasApplicationRole(actor, 'ga')) {
      return res.status(403).json({ success: false, message: 'Akses ditolak: hanya Admin GABAH, IT, atau GA yang berwenang mengelola jadwal servis.' });
    }
    const validationError = validateMaintenanceInput(req.body || {});
    if (validationError) return res.status(400).json({ success: false, message: validationError });
    if (!req.body.asset_id) {
      return res.status(400).json({ success: false, message: 'Aset wajib dipilih untuk jadwal pemeliharaan.' });
    }
    const asset = db.assets.find(a => a.id === req.body.asset_id);
    if (!asset) {
      return res.status(400).json({ success: false, message: 'Aset yang dipilih tidak ditemukan.' });
    }

    // Maintenance authority inherits the asset's owner domain and requires
    // the operation permission plus an explicit matching owner scope.
    if (!canMutateAssetOwner(actor, asset.owner_division, 'maintenances.create')) {
      return res.status(403).json({ success: false, message: `Akses ditolak: permission maintenances.create dan scope owner "${asset.owner_division}" wajib dimiliki.` });
    }

    const vendorResolution = resolveMaintenanceVendor(req.body?.vendor_id, req.body?.vendor_name);
    if (!vendorResolution.valid) {
      return res.status(400).json({ success: false, message: 'Vendor maintenance tidak valid atau ID dan nama vendor tidak cocok.' });
    }

    const count = db.maintenances.length + 1;
    const scheduleCode = `MNT-2026-${String(count).padStart(3, '0')}`;
    const newSchedule = {
      id: `mnt-${Date.now()}`,
      schedule_code: scheduleCode,
      title: req.body.title || `Servis Pemeliharaan ${asset.name}`,
      asset_id: asset.id,
      asset_name: asset.name,
      asset_number: asset.asset_number,
      category_type: asset.category_type || 'General',
      owner_division: asset.owner_division,
      scheduled_date: req.body.scheduled_date || new Date().toISOString().split('T')[0],
      frequency: req.body.frequency || 'one_time',
      status: req.body.status || 'scheduled',
      technician_name: req.body.technician_name || 'Tim Internal',
      vendor_id: vendorResolution.vendor?.id,
      vendor_name: vendorResolution.vendor?.name,
      estimated_cost: req.body.estimated_cost || 0,
      actual_cost: req.body.actual_cost || 0,
      notes: req.body.notes || '',
      checklist: req.body.checklist || [],
      created_at: new Date().toISOString(),
    };
    db.maintenances.push(newSchedule);
    GabahDomainService.recordAudit('MAINTENANCE_SCHEDULED', 'Maintenance', `Menambahkan jadwal servis ${scheduleCode} untuk ${newSchedule.asset_name}`, actor, newSchedule.id);
    if (!(await persistBeforeSuccess(req, res))) return;
    res.status(201).json({ success: true, data: newSchedule });
  });

  app.patch('/api/maintenances/:id', async (req, res) => {
    const actor = getActor(req);
    // RBAC: file-store mempertahankan allowlist legacy; PostgreSQL beralih ke
    // permission dinamis `maintenances.update` (Stage 13F, seed 020 mirror).
    if (isPostgresPersistenceActive()) {
      if (!requireRbacPermission(req, res, 'maintenances.update')) return;
    } else if (!isSuperadminActor(actor) && !hasApplicationRole(actor, 'it') && !hasApplicationRole(actor, 'ga')) {
      return res.status(403).json({ success: false, message: 'Akses ditolak: hanya Admin GABAH, IT, atau GA yang berwenang mengubah jadwal servis.' });
    }
    const schedule = db.maintenances.find(m => m.id === req.params.id);
    if (!schedule) return res.status(404).json({ success: false, message: 'Jadwal servis tidak ditemukan' });

    // Schedule authorization inherits the asset owner and is checked
    // through the same dynamic owner policy as asset/loan operations.
    if (!canMutateAssetOwner(actor, schedule.owner_division, 'maintenances.update')) {
      return res.status(403).json({ success: false, message: `Akses ditolak: permission maintenances.update dan scope owner "${schedule.owner_division}" wajib dimiliki.` });
    }

    const validationError = validateMaintenanceInput(req.body || {});
    if (validationError) return res.status(400).json({ success: false, message: validationError });

    // SECURITY (CR-06): explicit allowlist — no Object.assign / mass assignment.
    // Protected server-owned fields: id, schedule_code, asset_id, asset_name,
    // asset_number, category_type, owner_division, created_at.
    const hasVendorInput = req.body?.vendor_id !== undefined || req.body?.vendor_name !== undefined;
    const vendorResolution = hasVendorInput
      ? resolveMaintenanceVendor(req.body?.vendor_id, req.body?.vendor_name)
      : undefined;
    if (vendorResolution && !vendorResolution.valid) {
      return res.status(400).json({ success: false, message: 'Vendor maintenance tidak valid atau ID dan nama vendor tidak cocok.' });
    }

    const allowedMaintenanceFields = [
      'title', 'scheduled_date', 'frequency', 'status', 'technician_name',
      'estimated_cost', 'actual_cost', 'notes', 'checklist',
    ];
    for (const key of allowedMaintenanceFields) {
      if (req.body[key] !== undefined) {
        (schedule as any)[key] = req.body[key];
      }
    }
    if (vendorResolution) {
      schedule.vendor_id = vendorResolution.vendor?.id;
      schedule.vendor_name = vendorResolution.vendor?.name;
    }
    if (req.body.status === 'completed') {
      schedule.last_completed_at = new Date().toISOString();
    }
    GabahDomainService.recordAudit('MAINTENANCE_UPDATED', 'Maintenance', `Memperbarui jadwal servis ${schedule.schedule_code} status: ${schedule.status}`, actor, schedule.id);
    if (!(await persistBeforeSuccess(req, res))) return;
    res.json({ success: true, data: schedule });
  });

  // =========================
  // Vendor Directory (server-authoritative)
  // =========================
  // Contract records are linked to vendors by normalized vendor_name (legacy schema).
  // Never trust a client-provided or cached active_contracts_count value.
  const getActiveVendorContractCount = (vendorName: string): number => {
    const normalizedName = String(vendorName || '').trim().toLocaleLowerCase('id-ID');
    if (!normalizedName) return 0;
    return db.contracts.filter(contract =>
      String(contract.vendor_name || '').trim().toLocaleLowerCase('id-ID') === normalizedName &&
      ['active', 'expiring', 'renewal_in_progress'].includes(String(contract.status || '').toLowerCase())
    ).length;
  };
  app.get('/api/vendors', (req, res) => {
    
    if (!requireRbacPermission(req, res, 'vendors.read')) return;
    const actor = getActor(req);
    if (isSuperadminActor(actor) || isAuditorActor(actor)) {
      return res.json({ success: true, data: db.vendors.map(v => ({ ...v, active_contracts_count: getActiveVendorContractCount(v.name) })) });
    }
    const data = db.vendors.filter(v => {
      const owner = String(v.owner_division || '').trim();
      // Legacy records without an explicit owner are visible only to global readers
      // until Super Admin classifies them. Category is never used as ownership.
      if (!owner) return false;
      return isPostgresPersistenceActive()
        ? hasRbacScope(String(actor.id), 'division', owner, 'vendors')
        : hasApplicationRole(actor, owner.toLowerCase());
    });
    return res.json({ success: true, data: data.map(v => ({ ...v, active_contracts_count: getActiveVendorContractCount(v.name) })) });
  });

  app.post('/api/vendors', async (req, res) => {
    const actor = getActor(req);
    if (isPostgresPersistenceActive()) {
      if (!requireRbacPermission(req, res, 'vendors.create')) return;
    }
    const requestedCategory = String(req.body?.category || '').trim();
    if (!requestedCategory || requestedCategory.includes('\u0000') || Array.from(requestedCategory).length > 80) {
      return res.status(400).json({ success: false, message: 'Kategori vendor wajib diisi (maksimal 80 karakter).' });
    }
    const requestedOwnerInput = String(req.body?.owner_division || '').trim().toUpperCase();
    const ownerMaster = (db.divisions || []).find(d =>
      String(d.code || '').trim().toUpperCase() === requestedOwnerInput && d.is_active !== false
    );
    if (!ownerMaster) {
      return res.status(400).json({ success: false, message: 'Owner vendor wajib dipilih dari master fungsi pemilik yang aktif.' });
    }
    const requestedOwner = String(ownerMaster.code).trim().toUpperCase();
    const canManageRequestedOwner = isSuperadminActor(actor) || (isPostgresPersistenceActive()
      ? hasRbacScope(String(actor.id), 'division', requestedOwner, 'vendors')
      : (actor.role === requestedOwner || hasApplicationRole(actor, requestedOwner.toLowerCase().replace(/[^a-z0-9]+/g, '_'))));
    if (!canManageRequestedOwner) {
      return res.status(403).json({ success: false, message: 'Akses ditolak: scope pengguna tidak mencakup domain vendor yang dipilih.' });
    }
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    if (!name || name.includes('\u0000') || Array.from(name).length > 180) {
      return res.status(400).json({ success: false, message: 'Nama vendor wajib diisi (maksimal 180 karakter).' });
    }

    const vendorTextFields: Array<[string, unknown, number]> = [
      ['Nama PIC', req.body?.pic_name, 180],
      ['Telepon PIC', req.body?.pic_phone, 40],
      ['Email PIC', req.body?.pic_email, 254],
      ['Alamat vendor', req.body?.address, 2000],
      ['Catatan vendor', req.body?.notes, 4000],
    ];
    for (const [label, value, maxLength] of vendorTextFields) {
      if (value !== undefined && value !== null
        && (typeof value !== 'string' || value.includes('\u0000') || Array.from(value).length > maxLength)) {
        return res.status(400).json({ success: false, message: `${label} tidak valid (maksimal ${maxLength} karakter dan tanpa NUL).` });
      }
    }
    const rating = Number(req.body.rating ?? 4);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating vendor harus berada pada rentang 1 sampai 5.' });
    }
    const count = db.vendors.length + 1;
    const vendor = {
      id: `VND-${String(count).padStart(2, '0')}-${Date.now().toString(36)}`,
      name,
      category: requestedCategory,
      owner_division: requestedOwner,
      pic_name: req.body.pic_name || '',
      pic_phone: req.body.pic_phone || '',
      pic_email: req.body.pic_email || '',
      address: req.body.address || '',
      active_contracts_count: getActiveVendorContractCount(name),
      rating,
      notes: req.body.notes || '',
    };
    db.vendors.push(vendor);
    GabahDomainService.recordAudit('VENDOR_CREATED', 'Vendor', `Menambahkan vendor ${vendor.name}`, actor, vendor.id);
    if (!(await persistBeforeSuccess(req, res))) return;
    res.status(201).json({ success: true, data: vendor });
  });

  app.patch('/api/vendors/:id', async (req, res) => {
    const actor = getActor(req);
    if (isPostgresPersistenceActive()) {
      if (!requireRbacPermission(req, res, 'vendors.update')) return;
    }
    const existingVendor = db.vendors.find(v => v.id === req.params.id);
    if (!existingVendor) return res.status(404).json({ success: false, message: 'Vendor tidak ditemukan.' });
    const existingOwner = String(existingVendor.owner_division || '').trim().toUpperCase();
    const requestedCategory = req.body?.category === undefined
      ? String(existingVendor.category || '').trim()
      : String(req.body.category || '').trim();
    const requestedOwnerInput = req.body?.owner_division === undefined
      ? existingOwner
      : String(req.body.owner_division || '').trim().toUpperCase();
    const ownerMaster = (db.divisions || []).find(d =>
      String(d.code || '').trim().toUpperCase() === requestedOwnerInput && d.is_active !== false
    );
    const requestedOwner = ownerMaster ? String(ownerMaster.code).trim().toUpperCase() : '';
    const requestedName = req.body?.name === undefined
      ? String(existingVendor.name || '').trim()
      : String(req.body.name || '').trim();

    const vendorTextFields: Array<[string, unknown, number]> = [
      ['Nama PIC', req.body?.pic_name, 180],
      ['Telepon PIC', req.body?.pic_phone, 40],
      ['Email PIC', req.body?.pic_email, 254],
      ['Alamat vendor', req.body?.address, 2000],
      ['Catatan vendor', req.body?.notes, 4000],
    ];
    for (const [label, value, maxLength] of vendorTextFields) {
      if (value !== undefined && value !== null
        && (typeof value !== 'string' || value.includes('\u0000') || Array.from(value).length > maxLength)) {
        return res.status(400).json({ success: false, message: `${label} tidak valid (maksimal ${maxLength} karakter dan tanpa NUL).` });
      }
    }
    if (requestedName.includes('\u0000') || Array.from(requestedName).length > 180) {
      return res.status(400).json({ success: false, message: 'Nama vendor tidak valid (maksimal 180 karakter dan tanpa NUL).' });
    }
    const requestedRating = req.body?.rating === undefined ? Number(existingVendor.rating) : Number(req.body.rating);
    if (!existingOwner && !isSuperadminActor(actor)) {
      return res.status(403).json({ success: false, message: 'Vendor lama belum memiliki owner; klasifikasi hanya dapat dilakukan Super Admin.' });
    }
    if (!requestedOwner) {
      return res.status(400).json({ success: false, message: 'Owner vendor wajib dipilih dari master fungsi pemilik yang aktif.' });
    }
    if (!requestedCategory || requestedCategory.includes('\u0000') || Array.from(requestedCategory).length > 80 || !requestedName || requestedName.includes('\u0000') || Array.from(requestedName).length > 180) {
      return res.status(400).json({ success: false, message: 'Nama dan kategori vendor wajib valid.' });
    }
    if (!Number.isFinite(requestedRating) || requestedRating < 1 || requestedRating > 5) {
      return res.status(400).json({ success: false, message: 'Rating vendor harus berada pada rentang 1 sampai 5.' });
    }
    const canManageExisting = isSuperadminActor(actor) || (isPostgresPersistenceActive()
      ? hasRbacScope(String(actor.id), 'division', existingOwner, 'vendors')
      : (actor.role === existingOwner || hasApplicationRole(actor, existingOwner.toLowerCase().replace(/[^a-z0-9]+/g, '_'))));
    const canManageRequested = isSuperadminActor(actor) || (isPostgresPersistenceActive()
      ? hasRbacScope(String(actor.id), 'division', requestedOwner, 'vendors')
      : (actor.role === requestedOwner || hasApplicationRole(actor, requestedOwner.toLowerCase().replace(/[^a-z0-9]+/g, '_'))));
    if (!canManageExisting || !canManageRequested) {
      return res.status(403).json({ success: false, message: 'Akses ditolak: scope pengguna tidak mencakup domain vendor ini.' });
    }
    const vendor = existingVendor;
    // SECURITY (CR-06): explicit allowlist — id is server-owned.
    const allowedVendorFields = ['name', 'category', 'owner_division', 'pic_name', 'pic_phone', 'pic_email', 'address', 'rating', 'notes'];
    for (const key of allowedVendorFields) {
      if (req.body[key] !== undefined) (vendor as any)[key] = req.body[key];
    }
    vendor.name = requestedName;
    vendor.category = requestedCategory;
    vendor.owner_division = requestedOwner;
    vendor.rating = requestedRating;
    vendor.active_contracts_count = getActiveVendorContractCount(vendor.name);
    GabahDomainService.recordAudit('VENDOR_UPDATED', 'Vendor', `Memperbarui data vendor ${vendor.name}`, actor, vendor.id);
    if (!(await persistBeforeSuccess(req, res))) return;
    res.json({ success: true, data: vendor });
  });

  // =========================
  // Knowledge Base (SOP & panduan operasional)
  // =========================
  app.get('/api/knowledge', (req, res) => {
    if (!requireRbacPermission(req, res, 'knowledge.read')) return;
    
    res.json({ success: true, data: db.knowledgeArticles });
  });

  app.post('/api/knowledge', async (req, res) => {
    const actor = getActor(req);
    if (isPostgresPersistenceActive()) {
      if (!requireRbacPermission(req, res, 'knowledge.create')) return;
    } else if (!isSuperadminActor(actor) && !hasApplicationRole(actor, 'it') && !hasApplicationRole(actor, 'ga')) {
      return res.status(403).json({ success: false, message: 'Akses ditolak: Hanya Admin GABAH, IT, atau GA yang berwenang menulis artikel panduan.' });
    }
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const content = typeof req.body.content === 'string' ? req.body.content : '';
    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Judul dan isi artikel wajib diisi.' });
    }
    const article = {
      id: `kb-${Date.now().toString(36)}`,
      title,
      category: req.body.category || 'Policy',
      content,
      tags: Array.isArray(req.body.tags) ? req.body.tags.map(String).slice(0, 10) : [],
      view_count: 0,
      helpful_votes: 0,
      author: actor.name,
      updated_at: new Date().toISOString(),
    };
    db.knowledgeArticles.push(article);
    GabahDomainService.recordAudit('KB_ARTICLE_CREATED', 'KnowledgeBase', `Menambahkan artikel: ${article.title}`, actor, article.id);
    if (!(await persistBeforeSuccess(req, res))) return;
    res.status(201).json({ success: true, data: article });
  });

  app.patch('/api/knowledge/:id', async (req, res) => {
    const actor = getActor(req);
    if (isPostgresPersistenceActive()) {
      if (!requireRbacPermission(req, res, 'knowledge.update')) return;
    } else if (!isSuperadminActor(actor) && !hasApplicationRole(actor, 'it') && !hasApplicationRole(actor, 'ga')) {
      return res.status(403).json({ success: false, message: 'Akses ditolak: Hanya Admin GABAH, IT, atau GA yang berwenang mengubah artikel.' });
    }
    const article = db.knowledgeArticles.find(a => a.id === req.params.id);
    if (!article) return res.status(404).json({ success: false, message: 'Artikel tidak ditemukan' });
    // SECURITY (CR-06): explicit allowlist — view_count/helpful_votes only via dedicated endpoints.
    const allowedArticleFields = ['title', 'category', 'content', 'tags', 'author'];
    for (const key of allowedArticleFields) {
      if (req.body[key] !== undefined) (article as any)[key] = req.body[key];
    }
    article.updated_at = new Date().toISOString();
    GabahDomainService.recordAudit('KB_ARTICLE_UPDATED', 'KnowledgeBase', `Memperbarui artikel: ${article.title}`, actor, article.id);
    if (!(await persistBeforeSuccess(req, res))) return;
    res.json({ success: true, data: article });
  });

  app.post('/api/knowledge/:id/vote', async (req, res) => {
    if (!requireRbacPermission(req, res, 'knowledge.vote')) return;
    const article = db.knowledgeArticles.find(a => a.id === req.params.id);
    if (!article) return res.status(404).json({ success: false, message: 'Artikel tidak ditemukan' });
    article.helpful_votes += 1;
    if (!(await persistBeforeSuccess(req, res))) return;
    res.json({ success: true, data: article });
  });

  app.post('/api/knowledge/:id/view', async (req, res) => {
    if (!requireRbacPermission(req, res, 'knowledge.read')) return;
    const article = db.knowledgeArticles.find(a => a.id === req.params.id);
    if (!article) return res.status(404).json({ success: false, message: 'Artikel tidak ditemukan' });
    article.view_count += 1;
    if (!(await persistBeforeSuccess(req, res))) return;
    res.json({ success: true, data: article });
  });

  // Notifications
  const isNotificationRecipient = (actor: ServerUser, notification: any): boolean => {
    if (isSuperadminActor(actor)) return true;
    // Explicit user recipient takes precedence over role/division fallbacks.
    if (notification.recipient_user_id) return notification.recipient_user_id === actor.id;
    if (notification.recipient_unit_id) {
      return isPostgresPersistenceActive()
        ? hasRbacScope(String(actor.id), 'unit', notification.recipient_unit_id, 'tickets')
        : notification.recipient_unit_id === 'UNIT-PIBC-ME' && hasApplicationRole(actor, 'me');
    }
    // A user may hold additional RBAC roles beyond the primary profile role.
    if (notification.recipient_role) {
      return hasApplicationRole(actor, primaryRoleKey(notification.recipient_role));
    }
    if (notification.recipient_division) return notification.recipient_division === actor.division;
    return false;
  };

  app.get('/api/notifications', (req, res) => {
    
    if (!requireRbacPermission(req, res, 'notifications.read')) return;
    const actor = getActor(req);
    // Recipient metadata is authoritative. Do not infer Humas-only access from
    // title/message keywords: an explicit user or division recipient must remain
    // visible even when the notification text mentions photo documentation.
    const filtered = db.notifications.filter(n => isNotificationRecipient(actor, n));
    res.json({ success: true, data: filtered });
  });

  app.patch('/api/notifications/:id/read', (req, res) => {
    // Marking one notification read is a recipient self-service action;
    // read_all is reserved for the bulk endpoint below.
    if (!requireRbacPermission(req, res, 'notifications.read')) return;
    
    const actor = getActor(req);
    const notif = db.notifications.find(n => n.id === req.params.id);
    const isRecipient = notif ? isNotificationRecipient(actor, notif) : false;
    if (!notif || !isRecipient) {
      return res.status(404).json({ success: false, message: 'Notifikasi tidak ditemukan.' });
    }
    notif.is_read = true;
    res.json({ success: true, data: notif });
  });

  app.post('/api/notifications/read-all', (req, res) => {
    
    if (!requireRbacPermission(req, res, 'notifications.read_all')) return;
    const actor = getActor(req);
    for (const n of db.notifications) {
      const isRecipient = isNotificationRecipient(actor, n);
      if (isRecipient) n.is_read = true;
    }
    res.json({ success: true, message: 'Semua notifikasi ditandai telah dibaca' });
  });

  // Dashboard Stats & Attention Center
  app.get('/api/dashboard/stats', (req, res) => {
    if (!requireRbacPermission(req, res, 'dashboard.read')) return;
    const actor = getActor(req);
    const assets = GabahDomainService.getScopedAssets(actor);
    const totalAssets = assets.length;
    const activeAssets = assets.filter(a => ['active', 'assigned'].includes(a.status)).length;
    const loanableAssets = assets.filter(a => a.is_loanable && a.status === 'available').length;
    const inRepairAssets = assets.filter(a => a.status === 'in_repair').length;

    const canReadOwnerScope = (owner: string, module: 'loans' | 'tickets') =>
      isPostgresPersistenceActive()
        ? hasRbacScope(String(actor.id), 'division', owner, module)
        : hasApplicationRole(actor, owner.toLowerCase());
    const visibleLoans = isSuperadminActor(actor) || isAuditorActor(actor)
      ? db.loans
      : db.loans.filter(loan =>
        loan.borrower_id === actor.id
        || canReadOwnerScope(loan.owner_division, 'loans')
      );
    const visibleTickets = isSuperadminActor(actor) || isAuditorActor(actor)
      ? db.tickets
      : db.tickets.filter(ticket =>
        ticket.reporter_id === actor.id
        || ticket.assigned_agent_id === actor.id
        || canReadOwnerScope(ticket.category, 'tickets')
        || Boolean(ticket.assigned_unit_id && isPostgresPersistenceActive()
          && hasRbacScope(String(actor.id), 'unit', ticket.assigned_unit_id, 'tickets'))
      );

    const activeLoans = visibleLoans.filter(l => l.status === 'borrowed').length;
    const pendingLoans = visibleLoans.filter(l => l.status === 'pending_approval').length;
    const openTickets = visibleTickets.filter(t => ['open', 'assigned', 'in_progress'].includes(t.status)).length;

    res.json({
      success: true,
      data: {
        total_assets: totalAssets,
        active_assets: activeAssets,
        loanable_available: loanableAssets,
        in_repair: inRepairAssets,
        active_loans: activeLoans,
        pending_loans: pendingLoans,
        open_tickets: openTickets,
      },
    });
  });

  app.get('/api/dashboard/attention', async (req, res) => {
    if (!requireRbacPermission(req, res, 'dashboard.read')) return;
    const actor = getActor(req);
    let items = GabahDomainService.getAttentionCenter(actor);
    if (isPostgresPersistenceActive()) {
      try {
        const settings = await queryRbac<{ rule_id: string; is_active: boolean }>(
          "SELECT rule_id, is_active FROM gabah_notification_rule_settings WHERE rule_id IN ('rule-warranty', 'rule-loan', 'rule-sla')",
        );
        if (settings.rows.length !== 3) {
          return res.status(503).json({ success: false, code: 'NOTIFICATION_RULE_SETTINGS_UNAVAILABLE', message: 'Konfigurasi aturan notifikasi belum lengkap; pusat perhatian tidak dapat diverifikasi.' });
        }
        const enabled = new Map(settings.rows.map(setting => [setting.rule_id, setting.is_active === true]));
        items = items.filter(item => {
          if (item.type === 'warranty_expiring') return enabled.get('rule-warranty') === true;
          if (item.type === 'loan_pending' || item.type === 'loan_overdue') return enabled.get('rule-loan') === true;
          if (item.type === 'sla_breach' || item.type === 'sla_warning') return enabled.get('rule-sla') === true;
          return true;
        });
      } catch (error: any) {
        console.error('[GABAH API] Notification rule settings unavailable:', error?.message || error);
        return res.status(503).json({ success: false, code: 'NOTIFICATION_RULE_SETTINGS_UNAVAILABLE', message: 'Konfigurasi aturan notifikasi tidak dapat diverifikasi.' });
      }
    }
    const isGlobalReader = isSuperadminActor(actor) || isAuditorActor(actor);
    const visibleAssets = isGlobalReader ? db.assets : GabahDomainService.getScopedAssets(actor);
    const canReadOwnerScope = (module: 'loans' | 'tickets', owner: string) =>
      isPostgresPersistenceActive()
        ? hasRbacScope(String(actor.id), 'division', owner, module)
        : hasApplicationRole(actor, owner.toLowerCase());
    const visibleItems = filterDashboardAttentionItems(items, {
      actorId: String(actor.id),
      isGlobalReader,
      visibleAssetIds: new Set(visibleAssets.map(asset => asset.id)),
      loans: db.loans,
      tickets: db.tickets,
      canReadOwnerScope,
    });
    res.json({ success: true, data: visibleItems });
  });

  // Accurate ERP Reconciliation
  app.get('/api/reconciliation', (req, res) => {
    if (!requireRbacPermission(req, res, 'reconciliation.read')) return;
    const actor = getActor(req);
    const visibleAssets = isSuperadminActor(actor) || isAuditorActor(actor)
      ? db.assets
      : GabahDomainService.getScopedAssets(actor);
    const reconData = GabahDomainService.getReconciliationData(visibleAssets);
    res.json({ success: true, data: reconData });
  });

  app.post('/api/reconciliation/link', (req, res) => {
    
    if (!requireRbacPermission(req, res, 'reconciliation.link')) return;
    const actor = getActor(req);
    const { assetId, corporateAssetNumber } = req.body;
    const asset = db.assets.find(a => a.id === assetId);
    if (!asset) return res.status(404).json({ success: false, message: 'Aset tidak ditemukan' });
    if (!canMutateAssetOwner(actor, asset.owner_division, 'assets.update')) {
      return res.status(403).json({ success: false, message: 'Akses ditolak: Anda tidak memiliki permission dan owner scope untuk mengubah data aset ini.' });
    }

    asset.corporate_asset_number = corporateAssetNumber ? corporateAssetNumber.trim() : null;
    asset.updated_at = new Date().toISOString();

    GabahDomainService.recordAudit('RECONCILIATION_LINK', 'Assets', `Menautkan nomor aset Accurate "${corporateAssetNumber}" ke ${asset.asset_number}`, actor, asset.id);

    res.json({ success: true, data: asset });
  });

  // Audit Logs
  app.get('/api/audit-logs', (req, res) => {
    if (!requireRbacPermission(req, res, 'audit.read')) return;
    
    res.json({ success: true, data: db.auditLogs });
  });

  // ==========================================
  // CONTRACT MANAGEMENT API (separate domain — NOT helpdesk)
  // ==========================================
  app.get('/api/contracts', (req, res) => {
    try {
      
    if (!requireRbacPermission(req, res, 'contracts.read')) return;
    const actor = getActor(req);
      res.json({ success: true, data: ContractDomainService.listContracts(actor) });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.get('/api/contracts/:id', (req, res) => {
    try {
      
    if (!requireRbacPermission(req, res, 'contracts.read')) return;
    const actor = getActor(req);
      res.json({ success: true, data: ContractDomainService.getContract(actor, req.params.id) });
    } catch (err: any) {
      res.status(404).json({ success: false, message: err.message });
    }
  });

  // Contract Management — create. Reminder recipients are resolved SERVER-SIDE
  // (PIC + owner division + escalation from the stored contract); client input
  // can never add or spoof a recipient channel/destination.
  app.post('/api/contracts', async (req, res) => {
    try {
      
    if (!requireRbacPermission(req, res, 'contracts.create')) return;
    const actor = getActor(req);
      const created = await ContractDomainService.createContract(req.body, actor);
      await persistDataStore();
      (req as any).__gabahPersisted = true;
      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message });
    }
  });

  app.patch('/api/contracts/:id', async (req, res) => {
    try {
      
    if (!requireRbacPermission(req, res, 'contracts.update')) return;
    const actor = getActor(req);
      const updated = ContractDomainService.updateContract(req.params.id, req.body, actor);
      await persistDataStore();
      (req as any).__gabahPersisted = true;
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message });
    }
  });

  // SEC-08: Contract documents are stored as durable files, not metadata-only placeholders.
  // The configured upload directory must be backed by persistent storage in production.
  const uploadRoot = () => path.resolve(process.env.GABAH_UPLOAD_DIR || path.join(process.cwd(), 'uploads'));
  // Memory storage is bounded to 2 concurrent uploads × 10 MiB per app process.
  // Multipart metadata is also capped to prevent field/part-count exhaustion.
  const limitContractUploadConcurrency = createUploadConcurrencyLimiter(2, 10);
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 1,
      fields: 10,
      parts: 11,
      fieldNameSize: 100,
      fieldSize: 64 * 1024,
      headerPairs: 100,
    },
    fileFilter: (req, file, cb) => {
      const mimeByExtension: Record<string, string> = {
        '.pdf': 'application/pdf',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      };
      const ext = path.extname(file.originalname).toLowerCase();
      if (!mimeByExtension[ext] || mimeByExtension[ext] !== file.mimetype) {
        return cb(Object.assign(new Error('Unsupported contract upload file type.'), { code: 'UNSUPPORTED_FILE_TYPE' }));
      }
      cb(null, true);
    },
  });

  const hasValidContractDocumentSignature = (file: Express.Multer.File): boolean => {
    const ext = path.extname(file.originalname).toLowerCase();
    const bytes = file.buffer;
    if (ext === '.pdf') return bytes.subarray(0, 5).toString() === '%PDF-';
    if (ext === '.jpg' || ext === '.jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (ext === '.png') return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    if (ext === '.doc') return bytes.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
    if (ext === '.docx') return bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    return false;
  };

  // Multer runs before the route handler, so its errors need an explicit
  // route-level adapter; otherwise Express may emit an HTML error page.
  const parseContractUpload = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    upload.single('file')(req, res, (error: any) => {
      if (!error) return next();
      const normalized = normalizeContractUploadError(error);
      if (!normalized) return next(error);
      return res.status(normalized.statusCode).json({
        success: false,
        code: normalized.code,
        message: normalized.message,
      });
    });
  };

  const authorizeContractDocumentUpload = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!requireRbacPermission(req, res, 'contracts.documents.upload')) return;
    const actor = getActor(req);
    const contract = db.contracts.find(item => item.id === req.params.id);
    if (!contract) return res.status(404).json({ success: false, message: 'Kontrak tidak ditemukan.' });
    if (!canEditContract(actor, contract)) {
      return res.status(403).json({ success: false, message: 'Akses ditolak: bukan PIC/divisi pemilik kontrak.' });
    }
    return next();
  };

  app.post('/api/contracts/:id/documents/upload', authorizeContractDocumentUpload, limitContractUploadConcurrency, parseContractUpload, async (req, res) => {
    let savedFilePath: string | null = null;
    let savedContract: any = null;
    let savedDocumentId: string | null = null;
    try {
      if (!requireRbacPermission(req, res, 'contracts.documents.upload')) return;
      const actor = getActor(req);
      const contractId = req.params.id;
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Tidak ada file yang diunggah.' });
      }

      const file = req.file;
      if (!hasValidContractDocumentSignature(file)) {
        return res.status(400).json({ success: false, message: 'Isi file tidak sesuai dengan tipe dokumen yang diizinkan.' });
      }
      const contract = db.contracts.find(c => c.id === contractId);
      if (!contract) {
        return res.status(404).json({ success: false, message: 'Kontrak tidak ditemukan.' });
      }
      if (!canEditContract(actor, contract)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak: bukan PIC/divisi pemilik kontrak.' });
      }

      const safeFilename = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180) || 'document';
      const fileExt = path.extname(safeFilename).toLowerCase();
      const fileKind = file.mimetype.startsWith('image/') ? 'supporting_document' : 'original_contract';
      const documentId = 'CDoc-' + crypto.randomUUID();
      const storedFilename = crypto.randomUUID() + fileExt;
      const contractStorageKey = crypto.createHash('sha256').update(String(contractId)).digest('hex').slice(0, 24);
      const relativeFileRef = path.join('contracts', contractStorageKey, storedFilename);
      const absoluteFilePath = path.resolve(uploadRoot(), relativeFileRef);

      await fs.mkdir(path.dirname(absoluteFilePath), { recursive: true, mode: 0o700 });
      await fs.writeFile(absoluteFilePath, file.buffer, { flag: 'wx', mode: 0o600 });
      savedFilePath = absoluteFilePath;
      savedContract = contract;
      savedDocumentId = documentId;

      contract.documents.push({
        id: documentId,
        kind: fileKind,
        file_name: safeFilename,
        file_ref: relativeFileRef,
        file_size: file.size,
        file_mime: file.mimetype,
        uploaded_by: actor.id,
        uploaded_by_name: actor.name,
        uploaded_at: new Date().toISOString(),
      });
      contract.updated_at = new Date().toISOString();
      await persistDataStore();
      (req as any).__gabahPersisted = true;

      return res.json({
        success: true,
        message: 'Dokumen berhasil diunggah dan disimpan.',
        data: {
          document_id: documentId,
          file_name: safeFilename,
          file_size: file.size,
          file_mime: file.mimetype,
        },
      });
    } catch (err: any) {
      if (savedContract && savedDocumentId) {
        savedContract.documents = savedContract.documents.filter((document: any) => document.id !== savedDocumentId);
      }
      if (savedFilePath) {
        await fs.rm(savedFilePath, { force: true }).catch(() => undefined);
      }
      return res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message });
    }
  });

  // Documents are never exposed as a public static directory. Every download
  // re-checks the caller's contract permission and record-level visibility.
  app.get('/api/contracts/:id/documents/:documentId/download', async (req, res) => {
    if (!requireRbacPermission(req, res, 'contracts.read')) return;
    const actor = getActor(req);
    const contract = db.contracts.find(item => item.id === req.params.id);
    if (!contract || !canSeeContract(actor, contract)) {
      return res.status(404).json({ success: false, message: 'Dokumen tidak ditemukan.' });
    }
    const document = (contract.documents || []).find(item => item.id === req.params.documentId);
    if (!document || !document.file_ref || document.file_ref.startsWith('memory://')) {
      return res.status(404).json({ success: false, message: 'Berkas dokumen tidak tersedia.' });
    }

    const root = uploadRoot();
    const contractStorageKey = crypto.createHash('sha256').update(String(contract.id)).digest('hex').slice(0, 24);
    const contractRoot = path.resolve(root, 'contracts', contractStorageKey) + path.sep;
    const absoluteFilePath = path.resolve(root, document.file_ref);
    if (!absoluteFilePath.startsWith(contractRoot)) {
      return res.status(404).json({ success: false, message: 'Dokumen tidak ditemukan.' });
    }

    try {
      const stat = await fs.stat(absoluteFilePath);
      if (!stat.isFile()) return res.status(404).json({ success: false, message: 'Berkas dokumen tidak tersedia.' });
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Type', document.file_mime || 'application/octet-stream');
      return res.download(absoluteFilePath, document.file_name, error => {
        if (error && !res.headersSent) {
          res.status(404).json({ success: false, message: 'Berkas dokumen tidak tersedia.' });
        }
      });
    } catch {
      return res.status(404).json({ success: false, message: 'Berkas dokumen tidak tersedia.' });
    }
  });

  // Legacy endpoint (kept for backward compatibility, but only stores metadata)
  app.post('/api/contracts/:id/documents', async (req, res) => {
    try {
      
    if (!requireRbacPermission(req, res, 'contracts.documents.upload')) return;
    const actor = getActor(req);
      const updated = ContractDomainService.addDocument(req.params.id, req.body, actor);
      await persistDataStore();
      (req as any).__gabahPersisted = true;
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/contracts/:id/milestones', async (req, res) => {
    try {
      
    if (!requireRbacPermission(req, res, 'contracts.milestones.manage')) return;
    const actor = getActor(req);
      const updated = ContractDomainService.addMilestone(req.params.id, req.body, actor);
      await persistDataStore();
      (req as any).__gabahPersisted = true;
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/contracts/:id/renewal-decision', async (req, res) => {
    try {
      
    if (!requireRbacPermission(req, res, 'contracts.renewal.decide')) return;
    const actor = getActor(req);
      const { outcome, notes, replacement_contract_id } = req.body;
      const updated = ContractDomainService.decideRenewal(req.params.id, outcome, notes, replacement_contract_id || null, actor);
      await persistDataStore();
      (req as any).__gabahPersisted = true;
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message });
    }
  });

  // Reminder evaluation sweep (idempotent per threshold per due-day). The internal
  // scheduler calls the same engine automatically; this manual trigger stays
  // available for administrative execution and testing without waiting for a
  // real reminder date.
  app.post('/api/contracts/reminders/run', async (req, res) => {
    try {
      
    if (!requireRbacPermission(req, res, 'contracts.reminders.manage')) return;
    const actor = getActor(req);
      if (!isSuperadminActor(actor)) {
        return res.status(403).json({ success: false, message: 'Hanya Admin GABAH yang dapat menjalankan reminder sweep manual.' });
      }
      const result = await runReminderManualOnce(actor);
      if (!result.ok || !result.data) {
        return res.status(409).json({ success: false, message: result.summary });
      }
      res.json({ success: true, data: result.data });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  // CR-05 STEP 4: scheduler observability (admin only — no secret values exposed).
  app.get('/api/contracts/reminders/scheduler-status', (req, res) => {
    try {
      
    if (!requireRbacPermission(req, res, 'contracts.reminders.manage')) return;
    const actor = getActor(req);
      if (!isSuperadminActor(actor)) {
        return res.status(403).json({ success: false, message: 'Hanya Admin GABAH yang dapat melihat status scheduler.' });
      }
      res.json({ success: true, data: getSchedulerStatus() });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.get('/api/contracts/:id/notification-logs', (req, res) => {
    try {
      
    if (!requireRbacPermission(req, res, 'contracts.read')) return;
    const actor = getActor(req);
      res.json({ success: true, data: ContractDomainService.getNotificationLogs(actor, req.params.id) });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  // ==========================================
  // MEETING ROOMS & RESERVATIONS API
  // ==========================================
  app.get('/api/meeting-rooms', (req, res) => {
    if (!requireRbacPermission(req, res, 'meeting_rooms.read')) return;
    
    res.json({ success: true, data: GabahDomainService.getMeetingRooms() });
  });

  app.patch('/api/meeting-rooms/:id', async (req, res) => {
    try {
      
    if (!requireRbacPermission(req, res, 'meeting_rooms.update')) return;
    const actor = getActor(req);
      const updated = await GabahDomainService.updateMeetingRoom(req.params.id, req.body, actor);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message });
    }
  });

  app.get('/api/room-reservations', (req, res) => {
    if (!requireRbacPermission(req, res, 'room_reservations.read')) return;
    const actor = getActor(req);
    const { room_id, date, status, organizer_id } = req.query as any;
    let data = GabahDomainService.getRoomReservations({ room_id, date, status, organizer_id });

    // Agenda details are private by default. Operational queues are granted
    // by explicit capabilities, never by the employee's primary role label.
    if (!isSuperadminActor(actor) && !isAuditorActor(actor)) {
      const canOperateRooms = isPostgresPersistenceActive()
        ? hasRbacPermission(String(actor.id), 'room_reservations.approve')
          || hasRbacPermission(String(actor.id), 'room_reservations.reject')
        : hasApplicationRole(actor, 'ga');
      const canReadITFacilityQueue = isPostgresPersistenceActive()
        ? hasRbacPermission(String(actor.id), 'room_reservations.it_facilities.read')
        : hasApplicationRole(actor, 'it');
      const canReadDocumentationQueue = isPostgresPersistenceActive()
        ? hasRbacPermission(String(actor.id), 'room_reservations.documentation.read')
        : hasApplicationRole(actor, 'humas');
      if (canOperateRooms) {
        data = data.map(item => item.organizer_id === actor.id ? item : ({
          ...item,
          title: 'Reservasi ruang rapat',
          description: undefined,
          attendees_list: undefined,
          organizer_phone: '',
          consumption_notes: undefined,
          documentation_type: undefined,
          documentation_notes: undefined,
          notes: undefined,
          rejection_reason: undefined,
          interruption_reason: undefined,
        }));
      } else if (canReadITFacilityQueue) {
        const itFacilityNames = new Set(db.meetingFacilities
          .filter(facility => facility.category === 'IT')
          .map(facility => facility.name));
        data = data.filter(item => item.organizer_id === actor.id
          || (item.facilities_requested || []).some(name => itFacilityNames.has(name)))
          .map(item => item.organizer_id === actor.id ? item : ({
            ...item,
            title: 'Reservasi dengan kebutuhan fasilitas IT',
            description: undefined,
            attendees_list: undefined,
            organizer_phone: '',
            consumption_notes: undefined,
            documentation_type: undefined,
            documentation_notes: undefined,
            notes: undefined,
            rejection_reason: undefined,
            interruption_reason: undefined,
          }));
      } else if (canReadDocumentationQueue) {
        // Humas needs the schedule and documentation brief, not the meeting's
        // private attendee/contact/consumption or internal operational details.
        data = data.filter(item => Boolean(item.documentation_requested))
          .map(item => item.organizer_id === actor.id ? item : ({
            ...item,
            title: 'Kegiatan membutuhkan dokumentasi',
            description: undefined,
            attendees_list: undefined,
            organizer_phone: '',
            facilities_requested: [],
            consumption_requested: false,
            consumption_type: undefined,
            consumption_pax: undefined,
            consumption_serving_time: undefined,
            consumption_notes: undefined,
            notes: undefined,
            rejection_reason: undefined,
            interruption_reason: undefined,
          }));
      } else {
        data = data.filter(item => item.organizer_id === actor.id);
      }
    }
    res.json({ success: true, data });
  });

  app.post('/api/room-reservations', async (req, res) => {
    try {
      
    if (!requireRbacPermission(req, res, 'room_reservations.create')) return;
    const actor = getActor(req);
      const created = await GabahDomainService.requestRoomReservation(req.body, actor);
      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      // RBAC: preserve domain-service status codes — 403 for override/interupsi
      // denial (GA / Sekretaris Direksi non-HIGH), 409 for running (in_use)
      // protection, 400 for ordinary validation/conflict errors.
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({
        success: false,
        message: err.message,
        conflict: err.conflict || null,
        can_override: Boolean(err.can_override),
      });
    }
  });

  app.post('/api/room-reservations/:id/approve', async (req, res) => {
    try {
      
    if (!requireRbacPermission(req, res, 'room_reservations.approve')) return;
    const actor = getActor(req);
      const approved = await GabahDomainService.approveRoomReservation(req.params.id, actor);
      res.json({ success: true, data: approved });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/room-reservations/:id/reject', async (req, res) => {
    try {
      
    if (!requireRbacPermission(req, res, 'room_reservations.reject')) return;
    const actor = getActor(req);
      const rejected = await GabahDomainService.rejectRoomReservation(req.params.id, req.body.reason, actor);
      res.json({ success: true, data: rejected });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/room-reservations/:id/checkin', async (req, res) => {
    try {
      
    if (!requireRbacPermission(req, res, 'room_reservations.checkin')) return;
    const actor = getActor(req);
      const checkedIn = await GabahDomainService.checkinRoomReservation(req.params.id, actor);
      res.json({ success: true, data: checkedIn });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/room-reservations/:id/checkout', async (req, res) => {
    try {
      
    if (!requireRbacPermission(req, res, 'room_reservations.checkout')) return;
    const actor = getActor(req);
      const checkedOut = await GabahDomainService.checkoutRoomReservation(req.params.id, actor);
      res.json({ success: true, data: checkedOut });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/room-reservations/:id/cancel', async (req, res) => {
    try {
      
    if (!requireRbacPermission(req, res, 'room_reservations.cancel')) return;
    const actor = getActor(req);
      const cancelled = await GabahDomainService.cancelRoomReservation(req.params.id, actor);
      res.json({ success: true, data: cancelled });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message });
    }
  });

  // Meeting Types CRUD API (Admin GABAH)
  app.get('/api/meeting-types', (req, res) => {
    if (!requireRbacPermission(req, res, 'meeting_types.read')) return;
    
    res.json({ success: true, data: GabahDomainService.getMeetingTypes() });
  });

  app.post('/api/meeting-types', async (req, res) => {
    try {
      
    if (!requireRbacPermission(req, res, 'meeting_types.manage')) return;
    const actor = getActor(req);
      const created = await GabahDomainService.createMeetingType(req.body, actor);
      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.patch('/api/meeting-types/:id', async (req, res) => {
    try {
      
    if (!requireRbacPermission(req, res, 'meeting_types.manage')) return;
    const actor = getActor(req);
      const updated = await GabahDomainService.updateMeetingType(req.params.id, req.body, actor);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.delete('/api/meeting-types/:id', async (req, res) => {
    try {
      
    if (!requireRbacPermission(req, res, 'meeting_types.manage')) return;
    const actor = getActor(req);
      const result = await GabahDomainService.deleteMeetingType(req.params.id, actor);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  // Meeting Facilities CRUD API (Admin GABAH, GA, IT)
  app.get('/api/meeting-facilities', (req, res) => {
    if (!requireRbacPermission(req, res, 'meeting_facilities.read')) return;
    
    res.json({ success: true, data: GabahDomainService.getMeetingFacilities() });
  });

  app.post('/api/meeting-facilities', async (req, res) => {
    try {
      
    if (!requireRbacPermission(req, res, 'meeting_facilities.manage')) return;
    const actor = getActor(req);
      const created = await GabahDomainService.createMeetingFacility(req.body, actor);
      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.patch('/api/meeting-facilities/:id', async (req, res) => {
    try {
      
    if (!requireRbacPermission(req, res, 'meeting_facilities.manage')) return;
    const actor = getActor(req);
      const updated = await GabahDomainService.updateMeetingFacility(req.params.id, req.body, actor);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.delete('/api/meeting-facilities/:id', async (req, res) => {
    try {
      
    if (!requireRbacPermission(req, res, 'meeting_facilities.manage')) return;
    const actor = getActor(req);
      const result = await GabahDomainService.deleteMeetingFacility(req.params.id, actor);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  // ==========================================
  // VITE MIDDLEWARE (DEVELOPMENT vs PRODUCTION)
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
    // Vite is a build/development dependency; load it only in development so
    // the production image can safely install with npm ci --omit=dev.
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[GABAH Enterprise Engine] Running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start GABAH server:', err);
  process.exit(1);
});
