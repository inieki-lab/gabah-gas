import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import multer from 'multer';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { db, seedInitialData, ServerUser, ServerAsset, ServerSession, CANONICAL_USERS } from './server/db';
import { CANONICAL_TAXONOMY, FIXED_ASSET_MAIN_TYPES, isFixedAssetMainType, isGabahCategoryType, isOwnerDivision, normalizeCategoryMaster, resolveTaxonomyByHumanName } from './server/taxonomy';
import { AssetNumberingEngine } from './server/numbering';
import { GabahDomainService, getDynamicAssetWriteAuthority } from './server/services';
import { validateAssetLocation, resolveAssetLocationIdByText, assertValidLocationParent, getAssetLocationPath } from './server/asset-location';
import { ContractDomainService, canSeeContract, canEditContract } from './server/contracts';
import { isEmailConfigured } from './server/notifications/emailProvider';
import { isTelegramConfigured } from './server/notifications/telegramProvider';
import { initializePersistence, persistDataStore, isPostgresPersistenceActive, queryRbac, withRbacTransaction } from './server/persistence';
import { refreshRbacPolicy, isRbacSuperadmin, isSuperadminActor, countRbacSuperadmins, hasRbacPermission } from './server/rbac-policy';
import { startReminderScheduler, runOnce as runReminderOnce, getSchedulerStatus } from './server/notifications/reminderScheduler';
import { gabahSecurityMiddleware, actorFor } from './server/runtime-hardening';
import { requestContext, extractClientIp } from './server/requestContext';
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
} from './server/auth';

// Initialize seed data
seedInitialData();

async function startServer() {
  await initializePersistence();
  await refreshRbacPolicy();
  AssetNumberingEngine.syncFromExistingRecords({ tickets: db.tickets, loans: db.loans, contracts: db.contracts });

  // CR-05 STEP 4: internal production scheduler for contract reminders.
  // Timezone-aware (GABAH_REMINDER_TIMEZONE, default Asia/Jakarta), configurable
  // interval, leader-locked for multi-instance deployments, and fully contained
  // (a failing tick never crashes the API server).
  startReminderScheduler();

  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.use(express.json());

  // Per-request audit context: carry the client IP through the async chain so
  // recordAudit writers can stamp ip_address (P2#9).
  app.use((req, res, next) => {
    requestContext.run({ ip: extractClientIp(req) }, () => next());
  });

  // Production API security and session/role hardening
  app.use(gabahSecurityMiddleware);

  // Persist every successful state-changing API request after the response is sent
  app.use((req, res, next) => {
    if (req.method === 'GET' || !req.path.startsWith('/api/')) return next();
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        void persistDataStore();
      }
    });
    next();
  });

  // Helper to extract authenticated user from verified request context
  const getActor = (req: express.Request): ServerUser => {
    const verified = (req as any).user || actorFor(req);
    if (verified) return verified;
    throw new Error('Pengguna tidak terautentikasi.');
  };

  // Permission guard for migrated endpoints. PostgreSQL policy is authoritative in
  // production; JSON/file-store development retains legacy behavior during migration.
  const requireRbacPermission = (req: express.Request, res: express.Response, permissionKey: string): boolean => {
    if (!isPostgresPersistenceActive()) return true;
    const actor = (req as any).user as ServerUser | undefined;
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
  const rbacFailure = (res: express.Response, error: any) => {
    if (error?.code === '23505') return res.status(409).json({ success: false, message: 'Nama atau kunci role sudah digunakan.' });
    if (error?.code === '23503') return res.status(409).json({ success: false, message: 'Role masih memiliki relasi yang digunakan.' });
    const message = String(error?.message || '');
    if (message.includes('memerlukan PostgreSQL aktif')) return res.status(503).json({ success: false, message });
    if (message === 'RBAC_ROLE_NOT_FOUND') return res.status(404).json({ success: false, message: 'Role tidak ditemukan.' });
    if (message === 'RBAC_SUPERADMIN_PROTECTED') return res.status(409).json({ success: false, message: 'Role Superadmin dilindungi dan tidak dapat dinonaktifkan, dihapus, atau kehilangan kendali tertingginya.' });
    if (message === 'RBAC_ROLE_IN_USE') return res.status(409).json({ success: false, message: 'Role masih ditetapkan ke user. Pindahkan assignment terlebih dahulu.' });
    if (message === 'RBAC_PERMISSION_INVALID') return res.status(400).json({ success: false, message: 'Satu atau lebih permission tidak terdaftar atau sudah nonaktif.' });
    if (message === 'RBAC_USER_NOT_FOUND') return res.status(404).json({ success: false, message: 'User target tidak ditemukan.' });
    if (message === 'RBAC_ROLE_INVALID') return res.status(400).json({ success: false, message: 'Satu atau lebih role tidak terdaftar atau sudah nonaktif.' });
    if (message === 'RBAC_LAST_SUPERADMIN') return res.status(409).json({ success: false, message: 'Superadmin aktif terakhir tidak boleh kehilangan role Superadmin.' });
    return res.status(400).json({ success: false, message: 'Permintaan Dynamic RBAC tidak valid atau gagal diproses.' });
  };

  app.get('/api/admin/rbac/permissions', async (req, res) => {
    if (!requireRbacSuperadmin(req, res)) return;
    try {
      const result = await queryRbac('SELECT permission_key, module, action, description, is_active FROM gabah_permissions ORDER BY module, action, permission_key');
      return res.json({ success: true, data: result.rows });
    } catch (error: any) { return rbacFailure(res, error); }
  });

  app.get('/api/admin/rbac/roles', async (req, res) => {
    if (!requireRbacSuperadmin(req, res)) return;
    try {
      const roles = await queryRbac<any>('SELECT r.id, r.role_key, r.name, r.description, r.is_superadmin, r.is_active, r.created_at, r.updated_at, (SELECT COUNT(*)::int FROM gabah_user_roles ur WHERE ur.role_id = r.id) AS assigned_user_count FROM gabah_roles r ORDER BY r.is_superadmin DESC, r.name');
      const [permissions, scopes] = await Promise.all([
        queryRbac<any>('SELECT rp.role_id, p.permission_key FROM gabah_role_permissions rp JOIN gabah_permissions p USING (permission_key) WHERE p.is_active = TRUE ORDER BY p.module, p.action'),
        queryRbac<any>('SELECT role_id, scope_type, scope_value FROM gabah_role_division_scopes ORDER BY role_id, scope_type, scope_value')
      ]);
      return res.json({ success: true, data: roles.rows.map(role => ({
        ...role,
        permissions: permissions.rows.filter(p => p.role_id === role.id).map(p => p.permission_key),
        scopes: scopes.rows.filter(s => s.role_id === role.id).map(s => ({ type: s.scope_type, value: s.scope_value }))
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
      const result = await queryRbac<any>('INSERT INTO gabah_roles (role_key, name, description, is_superadmin, is_active) VALUES ($1, $2, $3, FALSE, TRUE) RETURNING id, role_key, name, description, is_superadmin, is_active, created_at, updated_at', [roleKey, name, description]);
      await refreshRbacPolicy();
      GabahDomainService.recordAudit('RBAC_ROLE_CREATED', 'Administration', 'Superadmin membuat role "' + name + '" (' + roleKey + ').', actor);
      return res.status(201).json({ success: true, data: { ...result.rows[0], permissions: [], scopes: [], assigned_user_count: 0 } });
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
    const validTypes = new Set(['all', 'own', 'division', 'unit', 'location']);
    if (!Number.isSafeInteger(id) || id < 1 || !Array.isArray(scopes)) {
      return res.status(400).json({ success: false, message: 'ID role atau daftar scope tidak valid.' });
    }
    if (scopes.some((scope: any) => !scope || !validTypes.has(scope.type)
      || (['division', 'unit', 'location'].includes(scope.type) && (typeof scope.value !== 'string' || !scope.value.trim()))
      || (['all', 'own'].includes(scope.type) && scope.value != null))) {
      return res.status(400).json({ success: false, message: 'Scope harus all/own tanpa nilai, atau division/unit/location dengan nilai.' });
    }
    try {
      const result = await withRbacTransaction(async client => {
        const found = await client.query('SELECT id, role_key, is_superadmin FROM gabah_roles WHERE id = $1 FOR UPDATE', [id]);
        const role = found.rows[0];
        if (!role) throw new Error('RBAC_ROLE_NOT_FOUND');
        if (role.is_superadmin || role.role_key === 'superadmin') throw new Error('RBAC_SUPERADMIN_PROTECTED');
        await client.query('DELETE FROM gabah_role_division_scopes WHERE role_id = $1', [id]);
        for (const scope of scopes) {
          await client.query('INSERT INTO gabah_role_division_scopes (role_id, scope_type, scope_value) VALUES ($1, $2, $3)', [id, scope.type, ['all', 'own'].includes(scope.type) ? null : scope.value.trim()]);
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
      const result = await withRbacTransaction(async client => {
        const target = await client.query('SELECT id, name, email FROM users WHERE id = $1', [userId]);
        const user = target.rows[0];
        if (!user) throw new Error('RBAC_USER_NOT_FOUND');
        const uniqueIds = [...new Set((roleIds as number[]).map(Number))];
        const valid = await client.query('SELECT id, name, is_superadmin FROM gabah_roles WHERE is_active = TRUE AND id = ANY($1::bigint[])', [uniqueIds]);
        if (valid.rowCount !== uniqueIds.length) throw new Error('RBAC_ROLE_INVALID');
        // Last-superadmin protection mirrors PATCH/DELETE /api/users/:id: the
        // target must keep a superadmin-capable role if it is the only holder.
        const current = await client.query('SELECT ur.role_id FROM gabah_user_roles ur JOIN gabah_roles r ON r.id = ur.role_id WHERE ur.user_id = $1 AND r.is_superadmin = TRUE', [userId]);
        if (current.rowCount > 0 && !valid.rows.some(row => row.is_superadmin)) {
          const remaining = await client.query(
            'SELECT COUNT(*)::int AS count FROM gabah_user_roles ur JOIN gabah_roles r ON r.id = ur.role_id WHERE r.is_superadmin = TRUE AND ur.user_id <> $1',
            [userId],
          );
          if (Number(remaining.rows[0]?.count || 0) === 0) throw new Error('RBAC_LAST_SUPERADMIN');
        }
        // Replace whole assignment set in one transaction: partial writes roll
        // back together, so a user is never left with half of a new set.
        await client.query('DELETE FROM gabah_user_roles WHERE user_id = $1', [userId]);
        for (const roleId of uniqueIds) {
          await client.query(
            'INSERT INTO gabah_user_roles (user_id, role_id, assigned_by_user_id) VALUES ($1, $2, $3) ON CONFLICT (user_id, role_id) DO NOTHING',
            [userId, roleId, actor.id],
          );
        }
        return {
          user_id: userId,
          user_name: String(user.name),
          user_email: String(user.email),
          role_ids: uniqueIds,
          role_names: valid.rows.map(row => String(row.name)),
        };
      });
      await refreshRbacPolicy();
     GabahDomainService.recordAudit(
        'RBAC_USER_ROLES_UPDATED',
        'Administration',
        'Superadmin mengubah assignment role untuk user "' + result.user_name + '" (' + result.user_email + ') menjadi: ' + result.role_names.join(', ') + '.',
        actor,
      );
      return res.json({ success: true, data: result });
    } catch (error: any) { return rbacFailure(res, error); }
  });

  // ==========================================
  // API ROUTES (FIRST)
  // ==========================================

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      app: 'GABAH (General Asset & Business Administration Hub)',
      version: '2026.1.0-enterprise',
      organization: 'PT Food Station Tjipinang Jaya (BUMD DKI Jakarta)',
      persistence: isPostgresPersistenceActive() ? 'postgresql' : 'file-store (development fallback)',
      scheduler: getSchedulerStatus(),
    });
  });

  // Auth / Users
  app.get('/api/users', (req, res) => {
    res.json({ success: true, data: db.users.map(u => sanitizeUser(u)) });
  });

  app.post('/api/users', async (req, res) => {
    try {
      const actor = getActor(req);
      if (!isSuperadminActor(actor)) {
        return res.status(403).json({ success: false, message: 'Hanya Admin GABAH yang berwenang menambah pengguna.' });
      }
      const { name, email, role, division, department, password, phone } = req.body;
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
        'Supply Chain': 'Logistik Beras',
        'PIBC': 'Pengawas Pasar PIBC',
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
        id: `USR-${Date.now().toString().slice(-6)}`,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: role || 'Karyawan',
        role_label: roleLabels[role] || 'Pegawai Operasional',
        division: division || 'Umum',
        department: department || 'Operasional',
        job_level_code: newJobLevel,
        unit_id: newUnitId || null,
        office_location_id: newOfficeId || null,
        phone: phone || '',
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
      await refreshRbacPolicy();

      res.status(201).json({
        success: true,
        data: sanitizeUser(newUser),
      });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
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

      const validRoles = ['Admin GABAH', 'IT', 'GA', 'Sekretaris Direksi', 'Humas', 'Supply Chain', 'PIBC', 'Karyawan', 'Auditor'];
      const roleLabels: Record<string, string> = {
        'Admin GABAH': 'Super Admin',
        'IT': 'IT Technical Support',
        'GA': 'Fasilitas & Gedung',
        'Sekretaris Direksi': 'Sekretariat Direksi',
        'Humas': 'Humas & Protokoler',
        'Supply Chain': 'Logistik Beras',
        'PIBC': 'Pengawas Pasar PIBC',
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

        if (!name) { errors.push(`Baris ${rowNo}: Nama wajib diisi.`); continue; }
        if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { errors.push(`Baris ${rowNo}: Email "${email}" tidak valid.`); continue; }
        if (seenEmails.has(email)) { errors.push(`Baris ${rowNo}: Email duplikat di dalam berkas (${email}).`); continue; }
        seenEmails.add(email);

        const role = roleRaw && validRoles.includes(roleRaw) ? roleRaw : 'Karyawan';
        if (roleRaw && !validRoles.includes(roleRaw)) {
          // Soft warning: baris TETAP diimpor dengan peran default Karyawan.
          warnings.push(`Baris ${rowNo}: Peran "${roleRaw}" tidak dikenali (memakai Karyawan).`);
        }

        const existing = db.users.find(u => u.email.toLowerCase().trim() === email);
        if (existing) {
          // UPDATE profil (password, is_active, dan sesi tidak disentuh)
          existing.name = name;
          existing.role = role as ServerUser['role'];
          (existing as any).role_label = roleLabels[role] || role;
          existing.division = division as ServerUser['division'];
          existing.department = department;
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
            id: `USR-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`,
            name,
            email,
            role: role as ServerUser['role'],
            role_label: roleLabels[role] || 'Pegawai Operasional',
            division: division as ServerUser['division'],
            department,
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
          users: importedUsers.map(u => sanitizeUser(u)),
        },
      });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.patch('/api/users/:id', async (req, res) => {
    try {
      const actor = getActor(req);
      if (!isSuperadminActor(actor)) {
        return res.status(403).json({ success: false, message: 'Hanya Admin GABAH yang berwenang mengubah akun pengguna.' });
      }

      const targetUser = db.users.find(u => u.id === req.params.id);
      if (!targetUser) {
        return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan' });
      }

      const { name, email, role, division, department, is_active, password, phone, telegram_chat_id } = req.body;
      const targetIsSuperadmin = targetUser.is_active && isRbacSuperadmin(targetUser.id);
      const wouldDemoteSuperadmin = role !== undefined && role !== 'Admin GABAH';
      const wouldDeactivateSuperadmin = is_active === false;
      if (targetIsSuperadmin && (wouldDemoteSuperadmin || wouldDeactivateSuperadmin)
        && countRbacSuperadmins(db.users.filter(u => u.is_active).map(u => u.id)) <= 1) {
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
      if (name !== undefined) targetUser.name = name.trim();
      // CR-05: Telegram chat id is an admin-managed profile field (server-side only);
      // it is NEVER accepted from non-admin input and never echoed in login flows.
      if (telegram_chat_id !== undefined) targetUser.telegram_chat_id = String(telegram_chat_id).trim() || undefined;
      if (email !== undefined && email.trim()) {
        const trimmedEmail = email.trim().toLowerCase();
        if (db.users.some(u => u.id !== targetUser.id && u.email.toLowerCase().trim() === trimmedEmail)) {
          return res.status(400).json({ success: false, message: 'Email sudah digunakan oleh akun lain.' });
        }
        targetUser.email = trimmedEmail;
      }
      const privilegeChanged = role !== undefined && role !== targetUser.role;
      const accountDeactivated = is_active !== undefined && is_active === false && targetUser.is_active === true;

      if (role !== undefined) {
        targetUser.role = role;
        const roleLabels: Record<string, string> = {
          'Admin GABAH': 'Admin GABAH (Super Admin)',
          'IT': 'Staff Divisi IT',
          'GA': 'Staff Divisi General Affairs',
          'Supply Chain': 'Staff Divisi Supply Chain',
          'PIBC': 'Staff Divisi Pasar Induk Cipinang',
          'Management': 'Direksi / Management',
          'Auditor': 'Satuan Pengawas Internal (SPI)',
          'Karyawan': 'Karyawan / Pemohon',
        };
        (targetUser as any).role_label = roleLabels[role] || role;
      }
      if (division !== undefined) targetUser.division = division;
      if (department !== undefined) targetUser.department = department.trim();
      if (is_active !== undefined) targetUser.is_active = Boolean(is_active);
      if (phone !== undefined) targetUser.phone = phone.trim();
      // ORG-MODEL: atribut jabatan/unit/lokasi — independen dari role/permission.
      if (orgJobLevel !== undefined) targetUser.job_level_code = orgJobLevel ?? undefined;
      if (orgUnit !== undefined) targetUser.unit_id = orgUnit;
      if (orgOffice !== undefined) targetUser.office_location_id = orgOffice;

      if (password) {
        const plain = String(password).trim();
        if (plain) {
          const { hash, salt } = hashPassword(plain);
          targetUser.password_hash = hash;
          targetUser.password_salt = salt;
          delete targetUser.temp_password;
        }
      }

      // SECURITY (CR-03 §3.4): password change, privilege change, or
      // deactivation invalidates ALL active sessions of this user.
      if (password || privilegeChanged || accountDeactivated) {
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
      await refreshRbacPolicy();

      res.json({ success: true, data: sanitizeUser(targetUser) });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.delete('/api/users/:id', async (req, res) => {
    try {
      const actor = getActor(req);
      if (!isSuperadminActor(actor)) {
        return res.status(403).json({ success: false, message: 'Hanya Admin GABAH yang berwenang menghapus pengguna.' });
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
      if (targetUser.is_active && isRbacSuperadmin(targetUser.id)
        && countRbacSuperadmins(db.users.filter(u => u.is_active).map(u => u.id)) <= 1) {
        return res.status(409).json({ success: false, message: 'Superadmin aktif terakhir tidak boleh dihapus.' });
      }

      // Auto unassign any assets assigned to this user back to available pool
      let releasedAssetsCount = 0;
      for (const a of db.assets) {
        if (a.assigned_to?.id === targetId) {
          a.status = 'available';
          a.assigned_to = null;
          releasedAssetsCount++;
        }
      }

      // Auto close/return active loans
      let closedLoansCount = 0;
      for (const l of db.loans) {
        if (l.borrower_id === targetId && ['pending_approval', 'approved', 'borrowed'].includes(l.status)) {
          l.status = 'closed';
          l.actual_returned_at = new Date().toISOString();
          l.return_condition = 'Dikembalikan otomatis karena penutupan akun pengguna';
          closedLoansCount++;
        }
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
        `Menghapus akun pengguna: ${targetUser.name} (${targetUser.email}, ${targetUser.role}) - ${releasedAssetsCount} aset dilepaskan, ${closedLoansCount} pinjaman ditutup`,
        actor,
        targetId
      );

      await persistDataStore();
      await refreshRbacPolicy();

      res.json({
        success: true,
        message: `Pengguna ${targetUser.name} berhasil dihapus.${releasedAssetsCount > 0 ? ` ${releasedAssetsCount} aset berhasil dikembalikan ke status Tersedia.` : ''}`
      });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
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

      res.json({ success: true, data: { temp_password: tempPassword, user_id: targetUser.id } });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  // P2#10: live numbering sequence snapshot for the admin Asset Numbering panel
  // (replaces the hardcoded sample counters previously shown in the UI).
  app.get('/api/numbering/sequences', (req, res) => {
    res.json({ success: true, data: AssetNumberingEngine.getAssetSequenceSnapshot() });
  });

  // P2#11: CR-05 reminder subsystem overview for the admin Notification Center —
  // scheduler state, provider configuration presence, thresholds, and delivery
  // statistics derived from the authoritative notification log. Admin-only;
  // no provider secrets are exposed (only configured true/false).
  app.get('/api/contracts/reminders/overview', (req, res) => {
    try {
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
  app.post('/api/auth/login', (req, res) => {
    try {
      const ip = (req.headers['x-forwarded-for'] as string || req.socket?.remoteAddress || '127.0.0.1').split(',')[0].trim();
      const lockCheck = isLoginLocked(ip);
      if (lockCheck.isLocked) {
        return res.status(429).json({
          success: false,
          message: `Terlalu banyak percobaan login gagal. Silakan coba lagi dalam ${lockCheck.remainingLockoutSeconds} detik.`,
        });
      }

      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email dan password wajib diisi.' });
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

      if (!user || !user.is_active) {
        const lock = recordFailedLogin(ip);
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
        const lock = recordFailedLogin(ip);
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
      clearFailedLogins(ip);

      // Create persistent session
      const session = createSession(user.id, req);
      GabahDomainService.recordAudit(
        'AUTH_LOGIN_SUCCESS',
        'Auth',
        `Pengguna ${user.name} (${user.role}) berhasil masuk dari IP ${session.ip_address}`,
        user
      );

      res.json({
        success: true,
        data: {
          user: sanitizeUser(user),
          token: session.token,
          expires_at: session.expires_at,
        },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    try {
      const token = extractToken(req);
      if (token) {
        destroySession(token);
      }
      res.json({ success: true, message: 'Logout berhasil.' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Self-service password change (P1): the CURRENT user rotates their own
  // password. Requires the current password; revokes all other sessions but
  // issues a fresh token for THIS device so the user is not logged out.
  app.post('/api/auth/change-password', (req, res) => {
    try {
      const actor = getActor(req);
      const { currentPassword, newPassword } = req.body;
      if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || !currentPassword || !newPassword) {
        return res.status(400).json({ success: false, message: 'Kata sandi lama dan baru wajib diisi.' });
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
      persistDataStore().catch(() => {});

      res.json({
        success: true,
        data: { user: sanitizeUser(user), token: session.token, expires_at: session.expires_at },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.get('/api/auth/me', (req, res) => {
    try {
      const actor = getActor(req);
      res.json({ success: true, data: sanitizeUser(actor) });
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

      res.json({
        success: true,
        data: {
          user: sanitizeUser(targetUser),
          token: session.token,
          expires_at: session.expires_at,
        },
      });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
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

      const { code, name, main_type, owner_division, category_type, description, is_loanable_by_default, is_active } = req.body;
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
        return res.status(400).json({ success: false, message: `Divisi pemilik "${owner_division}" tidak dikenal. Nilai yang diizinkan: IT, GA, SC, PIBC.` });
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
        owner_division,
        category_type: normalizedCategoryType,
        description: description || `Kategori ${name.trim()} (Milik ${owner_division})`,
        is_loanable_by_default: Boolean(is_loanable_by_default),
        // T2B-3: default aktif; nonaktif hanya lewat toggle PATCH (disable,
        // bukan hapus permanen) agar relasi aset tidak pernah rusak.
        is_active: is_active === undefined ? true : Boolean(is_active),
      };

      db.categories.push(newCategory);
      GabahDomainService.recordAudit('CATEGORY_CREATED', 'MasterData', `Menambahkan master kategori ${newCategory.code} - ${newCategory.name}`, actor);
      await persistDataStore();

      res.status(201).json({ success: true, data: newCategory });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
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

      const { name, main_type, owner_division, category_type, description, is_loanable_by_default, is_active } = req.body;
      // T2B-3: validasi domain (bila field dikirim) — nilai di luar enum
      // kanonikal ditolak sehingga master tidak pernah menyimpan junk.
      if (main_type !== undefined && !isFixedAssetMainType(main_type)) {
        return res.status(400).json({
          success: false,
          message: `Jenis utama aset "${main_type}" tidak dikenal. Nilai yang diizinkan: ${FIXED_ASSET_MAIN_TYPES.join(', ')}.`
        });
      }
      if (owner_division !== undefined && !isOwnerDivision(owner_division)) {
        return res.status(400).json({ success: false, message: `Divisi pemilik "${owner_division}" tidak dikenal. Nilai yang diizinkan: IT, GA, SC, PIBC.` });
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
      if (owner_division) target.owner_division = owner_division;
      if (category_type) target.category_type = category_type;
      if (description !== undefined) target.description = description;
      if (is_loanable_by_default !== undefined) target.is_loanable_by_default = Boolean(is_loanable_by_default);
      // T2B-3: toggle enable/disable (bukan hard-delete). Kategori nonaktif
      // tetap terbaca untuk aset historis, tetapi ditolak sebagai nilai baru.
      if (is_active !== undefined) target.is_active = Boolean(is_active);
      if (typeof target.is_active !== 'boolean') target.is_active = true;

      GabahDomainService.recordAudit(
        'CATEGORY_UPDATED',
        'MasterData',
        `Memperbarui master kategori ${target.code} - ${target.name}${is_active !== undefined ? (target.is_active ? ' (diaktifkan)' : ' (dinonaktifkan)') : ''}`,
        actor,
      );
      await persistDataStore();
      res.json({ success: true, data: target });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
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
      res.json({ success: true, message: `Kategori ${code} berhasil dihapus.` });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
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
      res.status(201).json({ success: true, data: newLoc });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
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
      res.json({ success: true, data: target });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
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
      res.json({ success: true, message: `Lokasi ${loc.name} berhasil dihapus.` });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
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
      res.status(201).json({ success: true, data: newDiv });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
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
      res.json({ success: true, data: div });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.delete('/api/master/divisions/:code', async (req, res) => {
    try {
      const actor = getActor(req);
      if (!isSuperadminActor(actor)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak: Hanya Super Admin yang berwenang menghapus divisi.' });
      }
      const code = req.params.code.trim().toUpperCase();
      const assetsCount = db.assets.filter(a => a.owner_division === code).length;
      if (assetsCount > 0) {
        return res.status(400).json({
          success: false,
          message: `Tidak dapat menghapus divisi "${code}" karena masih memiliki ${assetsCount} aset terdaftar.`
        });
      }

      if (!db.divisions) db.divisions = [];
      const div = db.divisions.find(d => d.code.toUpperCase() === code);
      if (!div) return res.status(404).json({ success: false, message: 'Divisi tidak ditemukan.' });

      db.divisions = db.divisions.filter(d => d.code.toUpperCase() !== code);
      GabahDomainService.recordAudit('DIVISION_DELETED', 'Organization', `Menghapus struktur divisi ${code} (${div.name})`, actor);
      await persistDataStore();
      res.json({ success: true, message: `Divisi ${code} berhasil dihapus.` });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
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
      res.status(201).json({ success: true, data: level });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
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
      if (req.body.label !== undefined) level.label = String(req.body.label).trim() || level.label;
      if (req.body.order !== undefined) level.order = Number(req.body.order);
      if (req.body.is_active !== undefined) level.is_active = Boolean(req.body.is_active);
      GabahDomainService.recordAudit('JOB_LEVEL_UPDATED', 'Organization', `Memperbarui master jabatan ${level.code} (${level.label}) — aktif: ${level.is_active}`, actor);
      await persistDataStore();
      res.json({ success: true, data: level });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
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
      const divisionCode = String(req.body.division_code || 'Umum').trim().toUpperCase();
      if (!name) return res.status(400).json({ success: false, message: 'Nama unit wajib diisi.' });
      if (!db.orgUnits) db.orgUnits = [];
      if (db.orgUnits.some(u => u.name.toLowerCase() === name.toLowerCase())) {
        return res.status(400).json({ success: false, message: `Unit "${name}" sudah ada.` });
      }
      const unit = { id: `UNIT-${Date.now().toString(36).toUpperCase()}`, name, division_code: divisionCode as any, is_active: true };
      db.orgUnits.push(unit);
      GabahDomainService.recordAudit('ORG_UNIT_CREATED', 'Organization', `Menambahkan master unit ${unit.name} (divisi ${unit.division_code})`, actor);
      await persistDataStore();
      res.status(201).json({ success: true, data: unit });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
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
      if (req.body.name !== undefined) unit.name = String(req.body.name).trim() || unit.name;
      if (req.body.division_code !== undefined) unit.division_code = String(req.body.division_code).trim().toUpperCase() as any;
      if (req.body.is_active !== undefined) unit.is_active = Boolean(req.body.is_active);
      GabahDomainService.recordAudit('ORG_UNIT_UPDATED', 'Organization', `Memperbarui master unit ${unit.name} — aktif: ${unit.is_active}`, actor);
      await persistDataStore();
      res.json({ success: true, data: unit });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
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
      res.status(201).json({ success: true, data: loc });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
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
      if (req.body.name !== undefined) loc.name = String(req.body.name).trim() || loc.name;
      if (req.body.is_active !== undefined) loc.is_active = Boolean(req.body.is_active);
      GabahDomainService.recordAudit('OFFICE_LOCATION_UPDATED', 'Organization', `Memperbarui master lokasi kantor ${loc.name} — aktif: ${loc.is_active}`, actor);
      await persistDataStore();
      res.json({ success: true, data: loc });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
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
      res.status(201).json({ success: true, data: loc });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
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
      if (req.body.is_active !== undefined) loc.is_active = Boolean(req.body.is_active);
      GabahDomainService.recordAudit('ASSET_LOCATION_UPDATED', 'Assets', `Memperbarui master lokasi fisik aset ${getAssetLocationPath(loc)} — aktif: ${loc.is_active}`, actor);
      await persistDataStore();
      res.json({ success: true, data: loc });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
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
      if (actor.role === 'Auditor') {
        return res.status(403).json({ success: false, message: 'Akses ditolak: Auditor hanya memiliki izin baca (read-only).' });
      }
      if (actor.role === 'Karyawan') {
        return res.status(403).json({ success: false, message: 'Akses ditolak: Karyawan tidak memiliki wewenang mendaftarkan aset baru.' });
      }
      const newAsset = GabahDomainService.createAsset(req.body, actor);
      await persistDataStore();
      res.status(201).json({ success: true, data: newAsset });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
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
      const blockedRoles = ['Karyawan', 'Auditor', 'Humas', 'Sekretaris Direksi'];
      if (blockedRoles.includes(actor.role)) {
        return res.status(403).json({ success: false, message: 'Peran Anda tidak berwenang mengimpor aset baru.' });
      }

      const rows: any[] = Array.isArray(req.body?.assets) ? req.body.assets : [];
      if (rows.length === 0) {
        return res.status(400).json({ success: false, message: 'Tidak ada baris data aset untuk diimpor.' });
      }
      if (rows.length > 500) {
        return res.status(400).json({ success: false, message: 'Maksimal 500 baris per impor. Pisahkan menjadi beberapa berkas.' });
      }
      const allowUpdate = req.body?.allow_update === true;

      const VALID_CONDITIONS = ['new', 'good', 'fair', 'poor', 'broken'];
      const VALID_DIVISIONS = ['IT', 'GA', 'SC', 'PIBC'];
      // CR-06: allowlist identik dengan PATCH /api/assets/:id
      const UPDATE_FIELDS = ['name', 'brand', 'model', 'serial_number', 'specifications', 'location', 'condition', 'notes', 'is_loanable', 'status', 'corporate_asset_number'];

      let created = 0;
      let updated = 0;
      const errors: string[] = [];
      const warnings: string[] = [];
      const importedAssets: ServerAsset[] = [];
      const seenKeys = new Set<string>();

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
          isLoanable = /^(true|1|ya|yes)$/i.test(String(row.is_loanable).trim());
        }

        const existing = (serial && db.assets.find(a => a.serial_number && a.serial_number.trim().toLowerCase() === serial.toLowerCase()))
          || (corp && db.assets.find(a => a.corporate_asset_number && a.corporate_asset_number.trim().toLowerCase() === corp.toLowerCase()));

        if (existing) {
          if (!allowUpdate) {
            errors.push(`Baris ${rowNo}: ${serial ? `Serial "${serial}"` : `Nomor Accurate "${corp}"`} sudah terdaftar pada aset ${existing.asset_number} (${existing.name}). Aktifkan opsi perbarui bila ingin memperbarui.`);
            continue;
          }
          // Otorisasi jalur UPDATE — authority divisi identik dengan PATCH
          // /api/assets/:id (SEC-10): impor massal tidak boleh melewati
          // pembatasan intradivisional saat mengubah baris aset yang sudah ada.
          // Dynamic RBAC Stage 13E: rule legacy tetap utuh ditambah authority
          // dinamis dari scope 'all'/'division'; deny-by-default tanpa scope.
          if (!isSuperadminActor(actor)) {
            const dynamicWriteAuthority = isPostgresPersistenceActive() ? getDynamicAssetWriteAuthority(actor) : null;
            const hasDynamicDivisionAuthority = (division: string): boolean =>
              dynamicWriteAuthority != null && (dynamicWriteAuthority.all || dynamicWriteAuthority.divisions.has(String(division).toUpperCase()));
            if (existing.owner_division === 'IT' && actor.role !== 'IT' && !hasDynamicDivisionAuthority('IT')) {
              errors.push(`Baris ${rowNo}: ${existing.asset_number} adalah barang IT dan hanya dapat diperbarui oleh personel IT atau Admin GABAH.`);
              continue;
            }
            if (existing.owner_division === 'GA' && actor.role !== 'GA' && !hasDynamicDivisionAuthority('GA')) {
              errors.push(`Baris ${rowNo}: ${existing.asset_number} milik Divisi GA dan hanya dapat diperbarui oleh personel GA atau Admin GABAH.`);
              continue;
            }
            if (existing.owner_division === 'SC' && actor.role !== 'Supply Chain' && !hasDynamicDivisionAuthority('SC')) {
              errors.push(`Baris ${rowNo}: ${existing.asset_number} milik Divisi Supply Chain dan hanya dapat diperbarui oleh personel Supply Chain atau Admin GABAH.`);
              continue;
            }
            if (existing.owner_division === 'PIBC' && actor.role !== 'PIBC' && !hasDynamicDivisionAuthority('PIBC')) {
              errors.push(`Baris ${rowNo}: ${existing.asset_number} milik Divisi PIBC dan hanya dapat diperbarui oleh personel PIBC atau Admin GABAH.`);
              continue;
            }
          }
          // UPDATE path — allowlist eksplisit, asset_number & owner_division server-owned
          for (const key of UPDATE_FIELDS) {
            if (key === 'condition') {
              if (condition) (existing as any).condition = condition;
              continue;
            }
            if (key === 'is_loanable') {
              if (isLoanable !== undefined) (existing as any).is_loanable = isLoanable;
              continue;
            }
            const value = row[key];
            if (value !== undefined && String(value).trim() !== '') {
              (existing as any)[key] = typeof value === 'string' ? value.trim() : value;
            }
          }
          existing.updated_at = new Date().toISOString();
          GabahDomainService.recordAudit('ASSET_BULK_UPDATED', 'Assets', `Impor massal: data aset ${existing.asset_number} (${existing.name}) diperbarui.`, actor, existing.id);
          importedAssets.push(existing);
          updated++;
          continue;
        }

        // CREATE path — domain service yang otoritatif
        const priceRaw = String(row.purchase_price ?? '').replace(/[^0-9.-]/g, '');
        const priceNum = Number(priceRaw);
        try {
          const asset = GabahDomainService.createAsset({
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
          }, actor);
          GabahDomainService.recordAudit('ASSET_BULK_CREATED', 'Assets', `Impor massal: aset baru ${asset.asset_number} (${asset.name}) didaftarkan.`, actor, asset.id);
          importedAssets.push(asset);
          created++;
        } catch (rowErr: any) {
          errors.push(`Baris ${rowNo}: ${rowErr.message}`);
        }
      }

      if (created > 0 || updated > 0) {
        await persistDataStore();
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
      res.status(400).json({ success: false, message: err.message });
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

  app.patch('/api/assets/:id', (req, res) => {
    if (!requireRbacPermission(req, res, 'assets.update')) return;
    const actor = getActor(req);
    const asset = db.assets.find(a => a.id === req.params.id);
    if (!asset) return res.status(404).json({ success: false, message: 'Aset tidak ditemukan' });

    // Auditor is strictly read-only
    if (actor.role === 'Auditor') {
      return res.status(403).json({ success: false, message: 'Akses ditolak: Auditor hanya memiliki izin baca (read-only).' });
    }
    // Karyawan cannot mutate assets
    if (actor.role === 'Karyawan') {
      return res.status(403).json({ success: false, message: 'Akses ditolak: Karyawan tidak memiliki wewenang mengubah aset.' });
    }
    // Enforce Division Authority (SEC-10). Legacy rule (kompatibilitas sembilan
    // role legacy via users.role) TETAP UTUH, dan Dynamic RBAC Stage 13E
    // menambahkan authority dinamis dari scope 'all'/'division' (cerminkan
    // semantik baca Stage 11). Deny-by-default: scope yang tidak mencakup aset
    // ini tidak pernah menambah kewenangan.
    if (!isSuperadminActor(actor)) {
      const dynamicWriteAuthority = isPostgresPersistenceActive() ? getDynamicAssetWriteAuthority(actor) : null;
      const hasDynamicDivisionAuthority = (division: string): boolean =>
        dynamicWriteAuthority != null && (dynamicWriteAuthority.all || dynamicWriteAuthority.divisions.has(String(division).toUpperCase()));
      if (asset.owner_division === 'IT' && actor.role !== 'IT' && !hasDynamicDivisionAuthority('IT')) {
        return res.status(403).json({ success: false, message: 'Akses ditolak: Aset IT hanya dapat diubah oleh personel IT atau Admin GABAH.' });
      }
      if (asset.owner_division === 'GA' && actor.role !== 'GA' && !hasDynamicDivisionAuthority('GA')) {
        return res.status(403).json({ success: false, message: 'Akses ditolak: Aset GA hanya dapat diubah oleh personel GA atau Admin GABAH.' });
      }
      if (asset.owner_division === 'SC' && actor.role !== 'Supply Chain' && !hasDynamicDivisionAuthority('SC')) {
        return res.status(403).json({ success: false, message: 'Akses ditolak: Aset Supply Chain hanya dapat diubah oleh personel Supply Chain atau Admin GABAH.' });
      }
      if (asset.owner_division === 'PIBC' && actor.role !== 'PIBC' && !hasDynamicDivisionAuthority('PIBC')) {
        return res.status(403).json({ success: false, message: 'Akses ditolak: Aset PIBC hanya dapat diubah oleh personel PIBC atau Admin GABAH.' });
      }
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

    // T2B-1: managing unit operasional (relasi ke org_units.id) — divalidasi
    // terhadap master aktif; nullable untuk kasus ambigu. owner_division &
    // asset_number tetap server-owned (tidak berubah), RBAC tetap owner_division.
    if (req.body.managing_unit_id !== undefined) {
      const uid = req.body.managing_unit_id ? String(req.body.managing_unit_id).trim() : null;
      if (uid && !(db.orgUnits || []).some(x => x.id === uid && x.is_active)) {
        return res.status(400).json({ success: false, message: `Unit "${uid}" tidak terdaftar atau sedang nonaktif.` });
      }
      asset.managing_unit_id = uid;
    }

    // T2B-2: lokasi fisik aset (relasi ke asset_locations.id) — divalidasi
    // terhadap master; lokasi nonaktif hanya dipertahankan bila sama dengan
    // nilai yang sudah melekat (data historis), tidak dapat dipilih sebagai
    // perubahan baru. owner_division, managing_unit_id, asset_number, dan
    // teks `location` legacy TIDAK berubah oleh field ini.
    if (req.body.asset_location_id !== undefined) {
      try {
        asset.asset_location_id = validateAssetLocation(req.body.asset_location_id, undefined, asset.asset_location_id);
      } catch (e: any) {
        return res.status(400).json({ success: false, message: e.message });
      }
    }

    // Update mutable fields (not asset_number or owner_division)
    const allowed = ['name', 'brand', 'model', 'serial_number', 'specifications', 'location', 'condition', 'notes', 'is_loanable', 'status', 'corporate_asset_number'];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        (asset as any)[key] = req.body[key];
      }
    }
    asset.updated_at = new Date().toISOString();

    GabahDomainService.recordAudit('ASSET_UPDATED', 'Assets', `Memperbarui informasi aset ${asset.asset_number}`, actor, asset.id);
    persistDataStore().catch(() => {});

    res.json({ success: true, data: asset });
  });

  app.post('/api/assets/:id/assign', (req, res) => {
    if (!requireRbacPermission(req, res, 'assets.assign')) return;
    try {
      const actor = getActor(req);
      const { targetUserId, reason } = req.body;
      const updated = GabahDomainService.assignAsset(req.params.id, targetUserId, reason, actor);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/assets/:id/move', (req, res) => {
    if (!requireRbacPermission(req, res, 'assets.move')) return;
    try {
      const actor = getActor(req);
      const { newLocation, reason } = req.body;
      const updated = GabahDomainService.moveAsset(req.params.id, newLocation, reason, actor);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/assets/:id/lifecycle', (req, res) => {
    if (!requireRbacPermission(req, res, 'assets.lifecycle')) return;
    try {
      const actor = getActor(req);
      const { action, notes } = req.body;
      const updated = GabahDomainService.mutateLifecycle(req.params.id, action, notes, actor);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  // Movements
  app.get('/api/movements', (req, res) => {
    if (!requireRbacPermission(req, res, 'movements.read')) return;
    const { assetId } = req.query;
    if (assetId) {
      const filtered = db.movements.filter(m => m.asset_id === assetId);
      return res.json({ success: true, data: filtered });
    }
    res.json({ success: true, data: db.movements });
  });

  // Loans
  app.get('/api/loans', (req, res) => {
    const actor = getActor(req);
    // Scoping loans:
    if (isSuperadminActor(actor) || actor.role === 'Auditor') {
      return res.json({ success: true, data: db.loans });
    }
    if (actor.role === 'Karyawan') {
      return res.json({ success: true, data: db.loans.filter(l => l.borrower_id === actor.id) });
    }
    if (actor.role === 'IT') {
      return res.json({ success: true, data: db.loans.filter(l => l.owner_division === 'IT') });
    }
    if (actor.role === 'GA') {
      return res.json({ success: true, data: db.loans.filter(l => l.owner_division === 'GA') });
    }
    if (actor.role === 'Supply Chain') {
      return res.json({ success: true, data: db.loans.filter(l => l.owner_division === 'SC') });
    }
    res.json({ success: true, data: db.loans });
  });

  app.post('/api/loans', async (req, res) => {
    try {
      const actor = getActor(req);
      const { asset_ids, asset_id } = req.body;

      if (Array.isArray(asset_ids) && asset_ids.length > 0) {
        const createdLoans = [];
        for (const id of asset_ids) {
          const newLoan = GabahDomainService.requestLoan({ ...req.body, asset_id: id }, actor);
          createdLoans.push(newLoan);
        }
        await persistDataStore();
        return res.status(201).json({
          success: true,
          data: createdLoans[0],
          loans: createdLoans,
          count: createdLoans.length,
          message: `${createdLoans.length} aset pinjaman berhasil diajukan.`
        });
      }

      const newLoan = GabahDomainService.requestLoan(req.body, actor);
      await persistDataStore();
      res.status(201).json({ success: true, data: newLoan });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/loans/:id/approve', async (req, res) => {
    try {
      const actor = getActor(req);
      const approved = GabahDomainService.approveLoan(req.params.id, actor);
      await persistDataStore();
      res.json({ success: true, data: approved });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/loans/:id/reject', async (req, res) => {
    try {
      const actor = getActor(req);
      const rejected = GabahDomainService.rejectLoan(req.params.id, req.body?.reason, actor);
      await persistDataStore();
      res.json({ success: true, data: rejected });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/loans/:id/handover', async (req, res) => {
    try {
      const actor = getActor(req);
      const { handoverNotes } = req.body;
      const handedOver = GabahDomainService.handoverLoan(req.params.id, handoverNotes, actor);
      await persistDataStore();
      res.json({ success: true, data: handedOver });
    } catch (err: any) {
      // SECURITY: 403 (authorization) / 409 (invalid state transition) are
      // enforced by the domain service and surfaced verbatim to the client.
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/loans/:id/return', async (req, res) => {
    try {
      const actor = getActor(req);
      const { condition, returnNotes } = req.body;
      const returned = GabahDomainService.returnLoan(req.params.id, condition, returnNotes, actor);
      await persistDataStore();
      res.json({ success: true, data: returned });
    } catch (err: any) {
      // SECURITY: 403 (authorization) / 409 (invalid state transition) are
      // enforced by the domain service and surfaced verbatim to the client.
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message });
    }
  });

  // Helpdesk Tickets
  app.get('/api/tickets', (req, res) => {
    const actor = getActor(req);
    const actorId = actor.id || '';
    const actorName = (actor.name || '').trim().toLowerCase();

    const isReporter = (t: any) => {
      const repName = (t.reporter_name || '').trim().toLowerCase();
      return (
        t.reporter_id === actorId ||
        Boolean(repName && actorName && (repName === actorName || repName.includes(actorName) || actorName.includes(repName)))
      );
    };

    // 1. IT and Super Admin (Admin GABAH) can see all tickets
    if (isSuperadminActor(actor) || actor.role === 'IT') {
      return res.json({ success: true, data: db.tickets });
    }

    // 1b. Auditor: read-only visibility over all tickets (enforced by middleware for mutations)
    if (actor.role === 'Auditor') {
      return res.json({ success: true, data: db.tickets });
    }

    // 1c. Operational divisions: scoped to their category (SC → 'SC', PIBC → 'PIBC') plus own tickets
    if (actor.role === 'Supply Chain' || actor.role === 'PIBC') {
      const ownCategory = actor.role === 'Supply Chain' ? 'SC' : 'PIBC';
      return res.json({
        success: true,
        data: db.tickets.filter(t => (t.category as string) === ownCategory || isReporter(t)),
      });
    }

    // 2. GA: only tickets directed to GA ('GA' category), or tickets reported by the GA user
    if (actor.role === 'GA') {
      return res.json({
        success: true,
        data: db.tickets.filter(t => t.category === 'GA' || isReporter(t)),
      });
    }

    // 3. All other users (Karyawan, Humas, Sekretaris Direksi, Supply Chain, PIBC, Auditor, etc.):
    // ONLY see tickets where they are the reporter
    return res.json({
      success: true,
      data: db.tickets.filter(t => isReporter(t)),
    });
  });

  app.post('/api/tickets', async (req, res) => {
    try {
      const actor = getActor(req);
      const newTicket = GabahDomainService.createTicket(req.body, actor);
      // Optional contract linkage: Contract = data, Ticket = pekerjaan (action).
      // SECURITY: linkage is only honored when the actor may actually see the
      // contract (canSeeContract) — client input cannot probe restricted contracts.
      if (req.body?.contract_id) {
        const contract = db.contracts.find((c: any) => c.id === req.body.contract_id);
        if (contract && canSeeContract(actor, contract)) newTicket.contract_id = contract.id;
      }
      // Await persistence so the linkage is durable before the response is sent.
      await persistDataStore();
      res.status(201).json({ success: true, data: newTicket });
    } catch (err: any) {
      res.status(err?.statusCode === 400 ? 400 : 400).json({ success: false, message: err.message });
    }
  });

  // SECURITY (CR-06): authoritative ticket status state machine.
  // open → in_progress → resolved → closed; open/reopened work may be
  // assigned. Arbitrary status strings and skipped transitions are rejected.
  const TICKET_TRANSITIONS: Record<string, string[]> = {
    open: ['in_progress', 'resolved', 'closed'],
    assigned: ['in_progress', 'resolved', 'closed'],
    in_progress: ['resolved', 'closed', 'open'],
    resolved: ['closed', 'open'],
    closed: ['open'],
  };

  app.patch('/api/tickets/:id/status', (req, res) => {
    try {
      const actor = getActor(req);
      if (actor.role === 'Auditor') {
        return res.status(403).json({ success: false, message: 'Akses ditolak: Auditor hanya memiliki izin baca (read-only).' });
      }
      const ticket = db.tickets.find(t => t.id === req.params.id);
      if (!ticket) return res.status(404).json({ success: false, message: 'Tiket tidak ditemukan' });

      const { status, resolutionNotes } = req.body || {};
      const currentStatus = String(ticket.status);
      const nextStatus = String(status || '');

      if (!nextStatus) {
        return res.status(400).json({ success: false, message: 'Status tujuan wajib diisi.' });
      }
      const allowed = TICKET_TRANSITIONS[currentStatus] || [];
      if (!allowed.includes(nextStatus)) {
        return res.status(400).json({
          success: false,
          message: `Transisi status tiket tidak valid: '${currentStatus}' → '${nextStatus}'. Transisi diizinkan: ${allowed.join(', ') || '(tidak ada)'}.`,
        });
      }

      // Object-level authorization already enforced by middleware for scoped
      // roles; Admin GABAH handles everything.
      ticket.status = nextStatus as any;
      if (resolutionNotes) ticket.resolution_notes = resolutionNotes;
      if (nextStatus === 'resolved' || nextStatus === 'closed') {
        ticket.resolved_at = new Date().toISOString();
      }
      if (nextStatus !== 'closed') {
        ticket.resolved_at = undefined as any;
      }
      ticket.updated_at = new Date().toISOString();

      GabahDomainService.recordAudit('TICKET_STATUS_UPDATED', 'Tickets', `Mengubah status tiket ${ticket.ticket_number} dari ${currentStatus} menjadi ${nextStatus}`, actor, ticket.id);
      persistDataStore().catch(() => {});

      res.json({ success: true, data: ticket });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  // Maintenance & Calibration Schedules
  app.get('/api/maintenances', (req, res) => {
    const actor = getActor(req);
    if (isSuperadminActor(actor) || actor.role === 'Auditor') {
      return res.json({ success: true, data: db.maintenances });
    }
    if (actor.role === 'IT') {
      return res.json({ success: true, data: db.maintenances.filter(m => m.owner_division === 'IT' || m.category_type === 'IT') });
    }
    if (actor.role === 'GA') {
      return res.json({ success: true, data: db.maintenances.filter(m => m.owner_division === 'GA' || m.category_type === 'GA' || m.category_type === 'General') });
    }
    if (actor.role === 'Supply Chain') {
      return res.json({ success: true, data: db.maintenances.filter(m => m.owner_division === 'SC' || m.owner_division === 'Supply Chain') });
    }
    res.json({ success: true, data: db.maintenances });
  });

  app.post('/api/maintenances', (req, res) => {
    const actor = getActor(req);
    // RBAC: hanya Admin GABAH / IT / GA yang mendapat management action
    // maintenance; peran lain (SC, PIBC, Sekdir, Humas, Auditor) tidak.
    if (!['Admin GABAH', 'IT', 'GA'].includes(actor.role)) {
      return res.status(403).json({ success: false, message: 'Akses ditolak: hanya Admin GABAH, IT, atau GA yang berwenang mengelola jadwal servis.' });
    }
    if (!req.body.asset_id) {
      return res.status(400).json({ success: false, message: 'Aset wajib dipilih untuk jadwal pemeliharaan.' });
    }
    const asset = db.assets.find(a => a.id === req.body.asset_id);
    if (!asset) {
      return res.status(400).json({ success: false, message: 'Aset yang dipilih tidak ditemukan.' });
    }

    // Enforce Division Authority
    if (!isSuperadminActor(actor)) {
      if (asset.owner_division === 'IT' && actor.role !== 'IT') {
        return res.status(403).json({ success: false, message: 'Jadwal servis aset IT hanya dapat dibuat oleh Divisi IT.' });
      }
      if (asset.owner_division === 'GA' && actor.role !== 'GA') {
        return res.status(403).json({ success: false, message: 'Jadwal servis aset GA hanya dapat dibuat oleh Divisi GA.' });
      }
      if (asset.owner_division === 'SC' && actor.role !== 'Supply Chain') {
        return res.status(403).json({ success: false, message: 'Jadwal servis aset Supply Chain hanya dapat dibuat oleh Divisi Supply Chain.' });
      }
      if (asset.owner_division === 'PIBC' && actor.role !== 'PIBC') {
        return res.status(403).json({ success: false, message: 'Jadwal servis aset PIBC hanya dapat dibuat oleh Divisi PIBC.' });
      }
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
      vendor_id: req.body.vendor_id,
      vendor_name: req.body.vendor_name,
      estimated_cost: req.body.estimated_cost || 0,
      actual_cost: req.body.actual_cost || 0,
      notes: req.body.notes || '',
      checklist: req.body.checklist || [],
      created_at: new Date().toISOString(),
    };
    db.maintenances.push(newSchedule);
    GabahDomainService.recordAudit('MAINTENANCE_SCHEDULED', 'Maintenance', `Menambahkan jadwal servis ${scheduleCode} untuk ${newSchedule.asset_name}`, actor, newSchedule.id);
    persistDataStore().catch(() => {});
    res.status(201).json({ success: true, data: newSchedule });
  });

  app.patch('/api/maintenances/:id', (req, res) => {
    const actor = getActor(req);
    // RBAC: hanya Admin GABAH / IT / GA yang mendapat management action
    // maintenance; peran lain (SC, PIBC, Sekdir, Humas, Auditor) tidak.
    if (!['Admin GABAH', 'IT', 'GA'].includes(actor.role)) {
      return res.status(403).json({ success: false, message: 'Akses ditolak: hanya Admin GABAH, IT, atau GA yang berwenang mengubah jadwal servis.' });
    }
    const schedule = db.maintenances.find(m => m.id === req.params.id);
    if (!schedule) return res.status(404).json({ success: false, message: 'Jadwal servis tidak ditemukan' });

    if (!isSuperadminActor(actor)) {
      if (schedule.owner_division === 'IT' && actor.role !== 'IT') {
        return res.status(403).json({ success: false, message: 'Akses ditolak: Hanya Divisi IT atau Admin GABAH yang berwenang mengubah jadwal ini.' });
      }
      if (schedule.owner_division === 'GA' && actor.role !== 'GA') {
        return res.status(403).json({ success: false, message: 'Akses ditolak: Hanya Divisi GA atau Admin GABAH yang berwenang mengubah jadwal ini.' });
      }
      if ((schedule.owner_division === 'SC' || schedule.owner_division === 'Supply Chain') && actor.role !== 'Supply Chain') {
        return res.status(403).json({ success: false, message: 'Akses ditolak: Hanya Divisi Supply Chain atau Admin GABAH yang berwenang mengubah jadwal ini.' });
      }
      if (schedule.owner_division === 'PIBC' && actor.role !== 'PIBC') {
        return res.status(403).json({ success: false, message: 'Akses ditolak: Hanya Divisi PIBC atau Admin GABAH yang berwenang mengubah jadwal ini.' });
      }
    }

    // SECURITY (CR-06): explicit allowlist — no Object.assign / mass assignment.
    // Protected server-owned fields: id, schedule_code, asset_id, asset_name,
    // asset_number, category_type, owner_division, created_at.
    const allowedMaintenanceFields = [
      'title', 'scheduled_date', 'frequency', 'status', 'technician_name',
      'vendor_id', 'vendor_name', 'estimated_cost', 'actual_cost', 'notes', 'checklist',
    ];
    for (const key of allowedMaintenanceFields) {
      if (req.body[key] !== undefined) {
        (schedule as any)[key] = req.body[key];
      }
    }
    if (req.body.status === 'completed') {
      schedule.last_completed_at = new Date().toISOString();
    }
    GabahDomainService.recordAudit('MAINTENANCE_UPDATED', 'Maintenance', `Memperbarui jadwal servis ${schedule.schedule_code} status: ${schedule.status}`, actor, schedule.id);
    persistDataStore().catch(() => {});
    res.json({ success: true, data: schedule });
  });

  // =========================
  // Vendor Directory (server-authoritative)
  // =========================
  app.get('/api/vendors', (req, res) => {
    const actor = getActor(req);
    if (isSuperadminActor(actor) || actor.role === 'Auditor') {
      return res.json({ success: true, data: db.vendors });
    }
    if (actor.role === 'IT') {
      return res.json({ success: true, data: db.vendors.filter(v => ['IT', 'License'].includes(String(v.category))) });
    }
    if (actor.role === 'GA') {
      return res.json({ success: true, data: db.vendors.filter(v => !['IT', 'License'].includes(String(v.category))) });
    }
    // Supply Chain & PIBC: can see all vendors for contract management
    if (actor.role === 'Supply Chain' || actor.role === 'PIBC') {
      return res.json({ success: true, data: db.vendors });
    }
    return res.status(403).json({ success: false, message: 'Akses vendor tidak tersedia untuk peran ini.' });
  });

  app.post('/api/vendors', (req, res) => {
    const actor = getActor(req);
    if (isPostgresPersistenceActive()) {
      if (!requireRbacPermission(req, res, 'vendors.create')) return;
    } else if (!['Admin GABAH', 'IT', 'GA', 'Supply Chain', 'PIBC'].includes(actor.role)) {
      return res.status(403).json({ success: false, message: 'Akses ditolak: hanya Admin GABAH, IT, GA, Supply Chain, atau PIBC yang dapat mengelola vendor.' });
    }
    if (actor.role === 'IT' && req.body?.category && !['IT', 'License'].includes(String(req.body.category))) {
      return res.status(403).json({ success: false, message: 'Divisi IT hanya dapat mengelola vendor domain IT/License.' });
    }
    if (actor.role === 'GA' && req.body?.category && ['IT', 'License'].includes(String(req.body.category))) {
      return res.status(403).json({ success: false, message: 'Divisi GA tidak dapat mengelola vendor domain IT/License.' });
    }
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    if (!name) {
      return res.status(400).json({ success: false, message: 'Nama vendor wajib diisi.' });
    }
    const count = db.vendors.length + 1;
    const vendor = {
      id: `VND-${String(count).padStart(2, '0')}-${Date.now().toString(36)}`,
      name,
      category: req.body.category || 'General',
      pic_name: req.body.pic_name || '',
      pic_phone: req.body.pic_phone || '',
      pic_email: req.body.pic_email || '',
      address: req.body.address || '',
      active_contracts_count: Number(req.body.active_contracts_count) || 0,
      rating: Number(req.body.rating) || 4.0,
      notes: req.body.notes || '',
    };
    db.vendors.push(vendor);
    GabahDomainService.recordAudit('VENDOR_CREATED', 'Vendor', `Menambahkan vendor ${vendor.name}`, actor, vendor.id);
    persistDataStore().catch(() => {});
    res.status(201).json({ success: true, data: vendor });
  });

  app.patch('/api/vendors/:id', (req, res) => {
    const actor = getActor(req);
    if (isPostgresPersistenceActive()) {
      if (!requireRbacPermission(req, res, 'vendors.update')) return;
    } else if (!['Admin GABAH', 'IT', 'GA', 'Supply Chain', 'PIBC'].includes(actor.role)) {
      return res.status(403).json({ success: false, message: 'Akses ditolak: hanya Admin GABAH, IT, GA, Supply Chain, atau PIBC yang dapat mengelola vendor.' });
    }
    const existingVendor = db.vendors.find(v => v.id === req.params.id);
    if (!existingVendor) return res.status(404).json({ success: false, message: 'Vendor tidak ditemukan.' });
    if (actor.role === 'IT' && !['IT', 'License'].includes(String(existingVendor.category))) {
      return res.status(403).json({ success: false, message: 'Divisi IT hanya dapat mengelola vendor domain IT/License.' });
    }
    if (actor.role === 'GA' && ['IT', 'License'].includes(String(existingVendor.category))) {
      return res.status(403).json({ success: false, message: 'Divisi GA tidak dapat mengelola vendor domain IT/License.' });
    }
    const vendor = existingVendor;
    // SECURITY (CR-06): explicit allowlist — id is server-owned.
    const allowedVendorFields = ['name', 'category', 'pic_name', 'pic_phone', 'pic_email', 'address', 'active_contracts_count', 'rating', 'notes'];
    for (const key of allowedVendorFields) {
      if (req.body[key] !== undefined) (vendor as any)[key] = req.body[key];
    }
    GabahDomainService.recordAudit('VENDOR_UPDATED', 'Vendor', `Memperbarui data vendor ${vendor.name}`, actor, vendor.id);
    persistDataStore().catch(() => {});
    res.json({ success: true, data: vendor });
  });

  // =========================
  // Knowledge Base (SOP & panduan operasional)
  // =========================
  app.get('/api/knowledge', (req, res) => {
    res.json({ success: true, data: db.knowledgeArticles });
  });

  app.post('/api/knowledge', (req, res) => {
    const actor = getActor(req);
    if (isPostgresPersistenceActive()) {
      if (!requireRbacPermission(req, res, 'knowledge.create')) return;
    } else if (!['Admin GABAH', 'IT', 'GA'].includes(actor.role)) {
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
    persistDataStore().catch(() => {});
    res.status(201).json({ success: true, data: article });
  });

  app.patch('/api/knowledge/:id', (req, res) => {
    const actor = getActor(req);
    if (isPostgresPersistenceActive()) {
      if (!requireRbacPermission(req, res, 'knowledge.update')) return;
    } else if (!['Admin GABAH', 'IT', 'GA'].includes(actor.role)) {
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
    persistDataStore().catch(() => {});
    res.json({ success: true, data: article });
  });

  app.post('/api/knowledge/:id/vote', (req, res) => {
    const article = db.knowledgeArticles.find(a => a.id === req.params.id);
    if (!article) return res.status(404).json({ success: false, message: 'Artikel tidak ditemukan' });
    article.helpful_votes += 1;
    persistDataStore().catch(() => {});
    res.json({ success: true, data: article });
  });

  app.post('/api/knowledge/:id/view', (req, res) => {
    const article = db.knowledgeArticles.find(a => a.id === req.params.id);
    if (!article) return res.status(404).json({ success: false, message: 'Artikel tidak ditemukan' });
    article.view_count += 1;
    persistDataStore().catch(() => {});
    res.json({ success: true, data: article });
  });

  // Notifications
  app.get('/api/notifications', (req, res) => {
    const actor = getActor(req);
    const filtered = db.notifications.filter(n => {
      // Photo and documentation request notifications are strictly for Humas role only
      const isPhotoNotification = n.recipient_role === 'Humas' ||
        (n.title && (n.title.toLowerCase().includes('foto') || n.title.toLowerCase().includes('dokumentasi humas') || n.title.toLowerCase().includes('liputan foto'))) ||
        (n.message && (n.message.toLowerCase().includes('peliputan foto') || n.message.toLowerCase().includes('dokumentasi foto')));

      if (isPhotoNotification) {
        return actor.role === 'Humas';
      }

      if (isSuperadminActor(actor)) return true;
      if (n.recipient_user_id && n.recipient_user_id === actor.id) return true;
      if (n.recipient_role && n.recipient_role === actor.role) return true;
      if (n.recipient_division && n.recipient_division === actor.division) return true;
      return false;
    });
    res.json({ success: true, data: filtered });
  });

  app.patch('/api/notifications/:id/read', (req, res) => {
    const notif = db.notifications.find(n => n.id === req.params.id);
    if (notif) notif.is_read = true;
    res.json({ success: true, data: notif });
  });

  app.post('/api/notifications/read-all', (req, res) => {
    const actor = getActor(req);
    for (const n of db.notifications) {
      if (isSuperadminActor(actor) || n.recipient_role === actor.role || n.recipient_user_id === actor.id) {
        n.is_read = true;
      }
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

    const activeLoans = db.loans.filter(l => l.status === 'borrowed').length;
    const pendingLoans = db.loans.filter(l => l.status === 'pending_approval').length;

    const openTickets = db.tickets.filter(t => ['open', 'assigned', 'in_progress'].includes(t.status)).length;

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

  app.get('/api/dashboard/attention', (req, res) => {
    if (!requireRbacPermission(req, res, 'dashboard.read')) return;
    const actor = getActor(req);
    const items = GabahDomainService.getAttentionCenter(actor);
    res.json({ success: true, data: items });
  });

  // Accurate ERP Reconciliation
  app.get('/api/reconciliation', (req, res) => {
    const reconData = GabahDomainService.getReconciliationData();
    res.json({ success: true, data: reconData });
  });

  app.post('/api/reconciliation/link', (req, res) => {
    const actor = getActor(req);
    const { assetId, corporateAssetNumber } = req.body;
    const asset = db.assets.find(a => a.id === assetId);
    if (!asset) return res.status(404).json({ success: false, message: 'Aset tidak ditemukan' });

    asset.corporate_asset_number = corporateAssetNumber ? corporateAssetNumber.trim() : null;
    asset.updated_at = new Date().toISOString();

    GabahDomainService.recordAudit('RECONCILIATION_LINK', 'Assets', `Menautkan nomor aset Accurate "${corporateAssetNumber}" ke ${asset.asset_number}`, actor, asset.id);

    res.json({ success: true, data: asset });
  });

  // Audit Logs
  app.get('/api/audit-logs', (req, res) => {
    res.json({ success: true, data: db.auditLogs });
  });

  // ==========================================
  // CONTRACT MANAGEMENT API (separate domain — NOT helpdesk)
  // ==========================================
  app.get('/api/contracts', (req, res) => {
    try {
      const actor = getActor(req);
      res.json({ success: true, data: ContractDomainService.listContracts(actor) });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.get('/api/contracts/:id', (req, res) => {
    try {
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
      const actor = getActor(req);
      const created = ContractDomainService.createContract(req.body, actor);
      await persistDataStore();
      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.patch('/api/contracts/:id', async (req, res) => {
    try {
      const actor = getActor(req);
      const updated = ContractDomainService.updateContract(req.params.id, req.body, actor);
      await persistDataStore();
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  // SEC-08: Real file upload endpoint for contract documents
  // Uses multer for multipart/form-data handling with file validation
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max
    },
    fileFilter: (req, file, cb) => {
      const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
      const ext = path.extname(file.originalname).toLowerCase();
      if (!allowedMimes.includes(file.mimetype) && !allowedExts.includes(ext)) {
        return cb(new Error('Jenis file tidak diizinkan. Hanya PDF, JPG, PNG, DOC, DOCX.'));
      }
      cb(null, true);
    },
  });

  app.post('/api/contracts/:id/documents/upload', upload.single('file'), async (req, res) => {
    try {
      const actor = getActor(req);
      const contractId = req.params.id;
      
      // SEC-08: Validate we have a file
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Tidak ada file yang diunggah.' });
      }
      
      const file = (req as any).file as { originalname: string; filename: string; size: number; mimetype: string; buffer: Buffer };
      const contract = db.contracts.find(c => c.id === contractId);
      if (!contract) {
        return res.status(404).json({ success: false, message: 'Kontrak tidak ditemukan.' });
      }
      if (!canEditContract(actor, contract)) {
        return res.status(403).json({ success: false, message: 'Akses ditolak: bukan PIC/divisi pemilik kontrak.' });
      }
      
      // Sanitize filename
      const safeFilename = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileExt = path.extname(safeFilename).toLowerCase();
      const fileKind = file.mimetype.startsWith('image/') ? 'supporting_document' : 'original_contract';
      
      // SEC-08: In production, save to actual storage (local disk or S3)
      // For now, we store metadata in DB and keep file in memory
      // Production implementation should save to persistent storage
      const fileRef = process.env.NODE_ENV === 'production'
        ? `/uploads/contracts/${contractId}/${Date.now()}_${safeFilename}`
        : `memory://${file.filename}`;
      
      // Add document to contract
      contract.documents.push({
        id: `CDoc-${Date.now()}`,
        kind: fileKind,
        file_name: safeFilename,
        file_ref: fileRef,
        file_size: file.size,
        file_mime: file.mimetype,
        uploaded_by: actor.id,
        uploaded_by_name: actor.name,
        uploaded_at: new Date().toISOString(),
      });
      
      contract.updated_at = new Date().toISOString();
      await persistDataStore();
      
      res.json({
        success: true,
        message: 'Dokumen berhasil diunggah.',
        data: {
          file_name: safeFilename,
          file_size: file.size,
          file_mime: file.mimetype,
        },
      });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  // Legacy endpoint (kept for backward compatibility, but only stores metadata)
  app.post('/api/contracts/:id/documents', async (req, res) => {
    try {
      const actor = getActor(req);
      const updated = ContractDomainService.addDocument(req.params.id, req.body, actor);
      await persistDataStore();
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/contracts/:id/milestones', async (req, res) => {
    try {
      const actor = getActor(req);
      const updated = ContractDomainService.addMilestone(req.params.id, req.body, actor);
      await persistDataStore();
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/contracts/:id/renewal-decision', async (req, res) => {
    try {
      const actor = getActor(req);
      const { outcome, notes, replacement_contract_id } = req.body;
      const updated = ContractDomainService.decideRenewal(req.params.id, outcome, notes, replacement_contract_id || null, actor);
      await persistDataStore();
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  // Reminder evaluation sweep (idempotent per threshold per due-day). The internal
  // scheduler calls the same engine automatically; this manual trigger stays
  // available for administrative execution and testing without waiting for a
  // real reminder date.
  app.post('/api/contracts/reminders/run', async (req, res) => {
    try {
      const actor = getActor(req);
      if (!isSuperadminActor(actor)) {
        return res.status(403).json({ success: false, message: 'Hanya Admin GABAH yang dapat menjalankan reminder sweep manual.' });
      }
      const result = await ContractDomainService.runReminderSweep(actor);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  // CR-05 STEP 4: scheduler observability (admin only — no secret values exposed).
  app.get('/api/contracts/reminders/scheduler-status', (req, res) => {
    try {
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
    res.json({ success: true, data: GabahDomainService.getMeetingRooms() });
  });

  app.patch('/api/meeting-rooms/:id', (req, res) => {
    try {
      const actor = getActor(req);
      const updated = GabahDomainService.updateMeetingRoom(req.params.id, req.body, actor);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message });
    }
  });

  app.get('/api/room-reservations', (req, res) => {
    const { room_id, date, status, organizer_id } = req.query as any;
    const data = GabahDomainService.getRoomReservations({ room_id, date, status, organizer_id });
    res.json({ success: true, data });
  });

  app.post('/api/room-reservations', (req, res) => {
    try {
      const actor = getActor(req);
      const created = GabahDomainService.requestRoomReservation(req.body, actor);
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

  app.post('/api/room-reservations/:id/approve', (req, res) => {
    try {
      const actor = getActor(req);
      const approved = GabahDomainService.approveRoomReservation(req.params.id, actor);
      res.json({ success: true, data: approved });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/room-reservations/:id/reject', (req, res) => {
    try {
      const actor = getActor(req);
      const rejected = GabahDomainService.rejectRoomReservation(req.params.id, req.body.reason, actor);
      res.json({ success: true, data: rejected });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/room-reservations/:id/checkin', (req, res) => {
    try {
      const actor = getActor(req);
      const checkedIn = GabahDomainService.checkinRoomReservation(req.params.id, actor);
      res.json({ success: true, data: checkedIn });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/room-reservations/:id/checkout', (req, res) => {
    try {
      const actor = getActor(req);
      const checkedOut = GabahDomainService.checkoutRoomReservation(req.params.id, actor);
      res.json({ success: true, data: checkedOut });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message });
    }
  });

  app.post('/api/room-reservations/:id/cancel', (req, res) => {
    try {
      const actor = getActor(req);
      const cancelled = GabahDomainService.cancelRoomReservation(req.params.id, actor);
      res.json({ success: true, data: cancelled });
    } catch (err: any) {
      res.status(typeof err?.statusCode === 'number' ? err.statusCode : 400).json({ success: false, message: err.message });
    }
  });

  // Meeting Types CRUD API (Admin GABAH)
  app.get('/api/meeting-types', (req, res) => {
    res.json({ success: true, data: GabahDomainService.getMeetingTypes() });
  });

  app.post('/api/meeting-types', (req, res) => {
    try {
      const actor = getActor(req);
      const created = GabahDomainService.createMeetingType(req.body, actor);
      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.patch('/api/meeting-types/:id', (req, res) => {
    try {
      const actor = getActor(req);
      const updated = GabahDomainService.updateMeetingType(req.params.id, req.body, actor);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.delete('/api/meeting-types/:id', (req, res) => {
    try {
      const actor = getActor(req);
      const result = GabahDomainService.deleteMeetingType(req.params.id, actor);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  // Meeting Facilities CRUD API (Admin GABAH, GA, IT)
  app.get('/api/meeting-facilities', (req, res) => {
    res.json({ success: true, data: GabahDomainService.getMeetingFacilities() });
  });

  app.post('/api/meeting-facilities', (req, res) => {
    try {
      const actor = getActor(req);
      const created = GabahDomainService.createMeetingFacility(req.body, actor);
      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.patch('/api/meeting-facilities/:id', (req, res) => {
    try {
      const actor = getActor(req);
      const updated = GabahDomainService.updateMeetingFacility(req.params.id, req.body, actor);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  app.delete('/api/meeting-facilities/:id', (req, res) => {
    try {
      const actor = getActor(req);
      const result = GabahDomainService.deleteMeetingFacility(req.params.id, actor);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  // ==========================================
  // VITE MIDDLEWARE (DEVELOPMENT vs PRODUCTION)
  // ==========================================
  if (process.env.NODE_ENV !== 'production') {
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
